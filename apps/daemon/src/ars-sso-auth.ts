import { createHmac } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { jwtVerify, SignJWT } from 'jose';

const ASSERTION_SCOPE = 'ars:opendesign';
const ASSERTION_TYPE = 'ars+sso';
const SESSION_TYPE = 'ars+session';
const SESSION_SECONDS = 60 * 60;
const ALLOWED_ROLES = new Set(['super_admin', 'admin', 'developer']);

type ArsSsoConfig = {
  audience: string;
  assertionKey: Uint8Array;
  issuer: string;
  loginUrl: string;
  secureCookie: boolean;
  sessionKey: Uint8Array;
};

export type ArsSsoAuth = {
  authorizeApiRequest(request: Request): Promise<'authorized' | 'csrf' | 'unauthorized'>;
  callback: RequestHandler;
  isAuthenticated(request: Request): Promise<boolean>;
  loginUrl: string;
};

function parseOrigin(value: string, name: string, allowLocalHttp = false): URL {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !(allowLocalHttp && local))
    || url.username
    || url.password
    || url.pathname !== '/'
    || url.search
    || url.hash
  ) {
    throw new Error(`${name} must be an HTTPS origin without credentials, path, query, or fragment`);
  }
  return url;
}

function loadConfig(env: NodeJS.ProcessEnv): ArsSsoConfig | null {
  const secret = env.OD_ARS_SSO_SECRET?.trim() ?? '';
  const issuerValue = env.OD_ARS_SSO_ISSUER?.trim() ?? '';
  const audienceValue = env.OD_ARS_SSO_AUDIENCE?.trim() ?? '';
  const loginValue = env.OD_ARS_SSO_LOGIN_URL?.trim() ?? '';
  const configured = [secret, issuerValue, audienceValue, loginValue].filter(Boolean).length;
  if (configured === 0) return null;
  if (configured !== 4) {
    throw new Error(
      'ARS SSO is partially configured. Set OD_ARS_SSO_SECRET, OD_ARS_SSO_ISSUER, '
      + 'OD_ARS_SSO_AUDIENCE, and OD_ARS_SSO_LOGIN_URL together.',
    );
  }
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('OD_ARS_SSO_SECRET must contain at least 32 bytes');
  }

  const issuer = parseOrigin(issuerValue, 'OD_ARS_SSO_ISSUER').origin;
  const audienceUrl = parseOrigin(audienceValue, 'OD_ARS_SSO_AUDIENCE', true);
  const loginUrl = new URL(loginValue);
  if (
    loginUrl.protocol !== 'https:'
    || loginUrl.username
    || loginUrl.password
    || loginUrl.origin !== issuer
    || loginUrl.hash
  ) {
    throw new Error('OD_ARS_SSO_LOGIN_URL must be an HTTPS URL on OD_ARS_SSO_ISSUER');
  }

  const assertionKey = new TextEncoder().encode(secret);
  const sessionKey = createHmac('sha256', assertionKey)
    .update('open-design:ars-session:v1')
    .digest();
  return {
    audience: audienceUrl.origin,
    assertionKey,
    issuer,
    loginUrl: loginUrl.toString(),
    secureCookie: audienceUrl.protocol === 'https:',
    sessionKey,
  };
}

function cookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null;
  const values = header
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`))
    .map((part) => part.slice(name.length + 1));
  return values.length === 1 && values[0] && values[0].length <= 4096 ? values[0] : null;
}

export function createArsSsoAuth(env: NodeJS.ProcessEnv = process.env): ArsSsoAuth | null {
  const config = loadConfig(env);
  if (!config) return null;
  const ssoConfig = config;

  const usedAssertions = new Map<string, number>();
  const cookieName = ssoConfig.secureCookie ? '__Host-od_ars_session' : 'od_ars_session';

  async function sessionIsValid(request: Request): Promise<boolean> {
    const token = cookieValue(request.headers.cookie, cookieName);
    if (!token) return false;
    try {
      const { payload } = await jwtVerify(token, ssoConfig.sessionKey, {
        algorithms: ['HS256'],
        audience: ssoConfig.audience,
        issuer: ssoConfig.audience,
        maxTokenAge: `${SESSION_SECONDS} seconds`,
        requiredClaims: ['sub', 'iat', 'exp', 'scope'],
        typ: SESSION_TYPE,
      });
      return payload.scope === ASSERTION_SCOPE;
    } catch {
      return false;
    }
  }

  const callback: RequestHandler = async (request, response) => {
    const assertion = request.body?.assertion;
    try {
      if (typeof assertion !== 'string' || assertion.length > 4096) {
        throw new Error('Invalid assertion');
      }
      if (request.get('origin') !== ssoConfig.issuer) {
        throw new Error('Invalid assertion origin');
      }

      const { payload } = await jwtVerify(assertion, ssoConfig.assertionKey, {
        algorithms: ['HS256'],
        audience: ssoConfig.audience,
        clockTolerance: 5,
        issuer: ssoConfig.issuer,
        maxTokenAge: '90 seconds',
        requiredClaims: ['sub', 'iat', 'exp', 'jti', 'scope'],
        typ: ASSERTION_TYPE,
      });
      const roles = payload.roles;
      if (
        payload.scope !== ASSERTION_SCOPE
        || !payload.jti
        || !Array.isArray(roles)
        || roles.length === 0
        || !roles.every((role) => typeof role === 'string' && ALLOWED_ROLES.has(role))
      ) {
        throw new Error('Invalid assertion claims');
      }

      const now = Math.floor(Date.now() / 1000);
      for (const [jti, expiresAt] of usedAssertions) {
        if (expiresAt <= now) usedAssertions.delete(jti);
      }
      if (usedAssertions.has(payload.jti)) throw new Error('Assertion already used');
      usedAssertions.set(payload.jti, payload.exp!);

      const session = await new SignJWT({
        roles,
        scope: ASSERTION_SCOPE,
      })
        .setProtectedHeader({ alg: 'HS256', typ: SESSION_TYPE })
        .setIssuer(ssoConfig.audience)
        .setAudience(ssoConfig.audience)
        .setSubject(payload.sub!)
        .setIssuedAt()
        .setExpirationTime(`${SESSION_SECONDS} seconds`)
        .sign(ssoConfig.sessionKey);
      response.setHeader(
        'Set-Cookie',
        `${cookieName}=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}`
        + (ssoConfig.secureCookie ? '; Secure' : ''),
      );
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Referrer-Policy', 'no-referrer');
      response.redirect(303, '/');
    } catch {
      response.setHeader('Cache-Control', 'no-store');
      response.status(401).type('text/plain').send('ARS sign-in could not be verified.');
    }
  };

  return {
    async authorizeApiRequest(request) {
      if (!(await sessionIsValid(request))) return 'unauthorized';
      if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return 'authorized';
      const fetchSite = request.get('sec-fetch-site');
      if (
        request.get('origin') !== ssoConfig.audience
        || (fetchSite != null && fetchSite !== 'same-origin')
      ) {
        return 'csrf';
      }
      return 'authorized';
    },
    callback,
    isAuthenticated: sessionIsValid,
    loginUrl: ssoConfig.loginUrl,
  };
}
