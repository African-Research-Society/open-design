import { AsyncLocalStorage } from 'node:async_hooks';
import type { Express } from 'express';

const identity = new AsyncLocalStorage<string>();
export function arsFundedProvider() {
  if (!process.env.OD_ARS_TEAM_ID) return null;
  const ticket = identity.getStore();
  if (!ticket) throw new Error('ARS generation requires a current member request');
  return { protocol: 'openai' as const, apiKey: ticket, baseUrl: process.env.OD_ARS_MODEL_BASE_URL! };
}

/** Runs only in a dedicated team runtime behind the ARS gateway. The gateway
 * overwrites the ticket header; the model gateway verifies its signed identity.
 * No provider credentials are stored in the runtime or persisted run metadata.
 */
export function installArsTeamMode(app: Express) {
  if (!process.env.OD_ARS_TEAM_ID) return;
  if (!process.env.OD_ARS_MODEL_BASE_URL || !process.env.OD_ARS_MODEL || process.env.OD_ARS_SSO_SECRET) {
    throw new Error('Team runtime requires its funded gateway/model and cannot share administrator SSO');
  }
  app.use((req, res, next) => {
    if (req.path === '/api/health') return next();
    const ticket = req.get('x-ars-model-ticket');
    if (!ticket) { res.status(401).json({ error: 'ARS gateway identity required' }); return; }
    if (req.method === 'POST' && ['/api/chat', '/api/runs'].includes(req.path)) {
      req.body = { ...req.body, agentId: 'byok-opencode', model: process.env.OD_ARS_MODEL,
        byokProvider: { protocol: 'openai', apiKey: 'ars-managed', baseUrl: process.env.OD_ARS_MODEL_BASE_URL } };
    }
    if (req.method === 'GET' && req.path === '/api/ars/team-config') {
      res.json({ managed: true, model: process.env.OD_ARS_MODEL });
      return;
    }
    identity.run(ticket, next);
  });
}
