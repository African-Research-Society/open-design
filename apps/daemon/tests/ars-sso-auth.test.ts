import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { startServer } from '../src/server.js';

const ENV_NAMES = [
  'OD_API_TOKEN',
  'OD_ARS_SSO_SECRET',
  'OD_ARS_SSO_ISSUER',
  'OD_ARS_SSO_AUDIENCE',
  'OD_ARS_SSO_LOGIN_URL',
] as const;
const PREVIOUS_ENV = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
const SECRET = 'ars-sso-test-secret-that-is-at-least-32-bytes';
const ISSUER = 'https://africanresearchsociety.org';
const AUDIENCE = 'https://design.africanresearchsociety.org';

let server: Server | undefined;
let shutdown: (() => Promise<void> | void) | undefined;
let staticDir: string | undefined;

function makeConnectionsAppearNonLoopback(target: Server): void {
  target.prependListener('connection', (socket) => {
    Object.defineProperty(socket, 'remoteAddress', {
      configurable: true,
      value: '172.18.0.1',
    });
  });
}

async function assertion(roles = ['super_admin']): Promise<string> {
  return new SignJWT({ roles, scope: 'ars:opendesign' })
    .setProtectedHeader({ alg: 'HS256', typ: 'ars+sso' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject('00000000-0000-4000-8000-000000000001')
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime('60 seconds')
    .sign(new TextEncoder().encode(SECRET));
}

afterEach(async () => {
  if (shutdown) await Promise.resolve(shutdown());
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
  shutdown = undefined;
  if (staticDir) rmSync(staticDir, { force: true, recursive: true });
  staticDir = undefined;
  for (const name of ENV_NAMES) {
    const previous = PREVIOUS_ENV[name];
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
});

describe('ARS SSO browser authentication', () => {
  it('exchanges a one-time assertion for a secure browser session without a Basic prompt', async () => {
    process.env.OD_API_TOKEN = 'independent-cli-token';
    process.env.OD_ARS_SSO_SECRET = SECRET;
    process.env.OD_ARS_SSO_ISSUER = ISSUER;
    process.env.OD_ARS_SSO_AUDIENCE = AUDIENCE;
    process.env.OD_ARS_SSO_LOGIN_URL = `${ISSUER}/admin/design`;
    staticDir = mkdtempSync(path.join(os.tmpdir(), 'od-ars-sso-static-'));
    writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><div>ARS studio</div>');

    const started = (await startServer({
      port: 0,
      host: '127.0.0.1',
      returnServer: true,
      staticDir,
    })) as {
      url: string;
      server: Server;
      shutdown?: () => Promise<void> | void;
    };
    server = started.server;
    shutdown = started.shutdown;
    makeConnectionsAppearNonLoopback(server);

    const unauthenticated = await fetch(`${started.url}/`, { redirect: 'manual' });
    expect(unauthenticated.status).toBe(303);
    expect(unauthenticated.headers.get('location')).toBe(`${ISSUER}/admin/design`);
    expect(unauthenticated.headers.get('www-authenticate')).toBeNull();

    const token = await assertion();
    const exchange = await fetch(`${started.url}/auth/ars/callback`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: ISSUER,
      },
      body: new URLSearchParams({ assertion: token }),
    });
    expect(exchange.status).toBe(303);
    expect(exchange.headers.get('location')).toBe('/');
    const cookie = exchange.headers.get('set-cookie');
    expect(cookie).toContain('__Host-od_ars_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');

    const authenticated = await fetch(`${started.url}/`, {
      headers: { cookie: cookie!.split(';', 1)[0]! },
    });
    expect(authenticated.status).toBe(200);
    expect(await authenticated.text()).toContain('ARS studio');

    const authenticatedApi = await fetch(`${started.url}/api/plugins`, {
      headers: { cookie: cookie!.split(';', 1)[0]! },
    });
    expect(authenticatedApi.status).toBe(200);

    const forgedMutation = await fetch(`${started.url}/api/not-a-real-route`, {
      method: 'POST',
      headers: {
        cookie: cookie!.split(';', 1)[0]!,
        'content-type': 'application/json',
        origin: 'https://attacker.example',
        'sec-fetch-site': 'cross-site',
      },
      body: '{}',
    });
    expect(forgedMutation.status).toBe(403);
    expect(await forgedMutation.json()).toEqual({
      error: {
        code: 'CSRF_VALIDATION_FAILED',
        message: 'Same-origin request required',
      },
    });

    const replay = await fetch(`${started.url}/auth/ars/callback`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: ISSUER,
      },
      body: new URLSearchParams({ assertion: token }),
    });
    expect(replay.status).toBe(401);

    const unprivileged = await fetch(`${started.url}/auth/ars/callback`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: ISSUER,
      },
      body: new URLSearchParams({ assertion: await assertion(['member']) }),
    });
    expect(unprivileged.status).toBe(401);
  });

  it('fails startup when ARS SSO is only partially configured', async () => {
    process.env.OD_API_TOKEN = 'independent-cli-token';
    process.env.OD_ARS_SSO_SECRET = SECRET;
    delete process.env.OD_ARS_SSO_ISSUER;
    delete process.env.OD_ARS_SSO_AUDIENCE;
    delete process.env.OD_ARS_SSO_LOGIN_URL;

    await expect(
      startServer({ port: 0, host: '127.0.0.1', returnServer: true }),
    ).rejects.toThrow(/partially configured/);
  });
});
