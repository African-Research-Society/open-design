import express, { type Express, type RequestHandler } from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { arsFundedProvider, installArsTeamMode } from '../../src/integrations/ars-team.js';

afterEach(() => vi.unstubAllEnvs());
describe('ARS team runtime identity', () => {
  it('preserves standalone behavior and fails closed without request identity', () => {
    vi.stubEnv('OD_ARS_TEAM_ID', '');
    expect(arsFundedProvider()).toBeNull();
    vi.stubEnv('OD_ARS_TEAM_ID', 'team');
    expect(() => arsFundedProvider()).toThrow('current member request');
  });
  it('keeps concurrent member tickets out of persisted provider settings', async () => {
    vi.stubEnv('OD_ARS_TEAM_ID', 'team');
    vi.stubEnv('OD_ARS_MODEL_BASE_URL', 'http://gateway/internal/model/team/v1');
    vi.stubEnv('OD_ARS_MODEL', 'funded-model');
    vi.stubEnv('OD_ARS_SSO_SECRET', '');
    let middleware: RequestHandler;
    installArsTeamMode({ use: (handler: RequestHandler) => { middleware = handler; } } as unknown as Express);
    const tickets = await Promise.all(['member-a','member-b'].map((ticket) => new Promise<string | undefined>((resolve) => {
      const req = { path: '/api/chat', method: 'POST', body: { agentId:'other', byokProvider:{ apiKey:'client-key' } }, get: () => ticket };
      middleware!(req as never, {} as never, () => {
        expect(req.body.byokProvider.apiKey).toBe('ars-managed');
        setTimeout(() => resolve(arsFundedProvider()?.apiKey), 1);
      });
    })));
    expect(tickets).toEqual(['member-a','member-b']);
    expect(() => arsFundedProvider()).toThrow('current member request');
  });
  it('drops client model keys on generation paths Express still routes', async () => {
    vi.stubEnv('OD_ARS_TEAM_ID', 'team');
    vi.stubEnv('OD_ARS_MODEL_BASE_URL', 'http://gateway/internal/model/team/v1');
    vi.stubEnv('OD_ARS_MODEL', 'funded-model');
    vi.stubEnv('OD_ARS_SSO_SECRET', '');
    const app = express();
    app.use(express.json());
    installArsTeamMode(app);
    const seen = (req: { body?: { byokProvider?: { apiKey?: string; baseUrl?: string } } }, res: { json: (body: unknown) => void }) => {
      res.json({
        apiKey: req.body?.byokProvider?.apiKey ?? null,
        baseUrl: req.body?.byokProvider?.baseUrl ?? null,
      });
    };
    app.post('/api/chat', seen as RequestHandler);
    app.post('/api/runs', seen as RequestHandler);
    const server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    try {
      const port = (server.address() as { port: number }).port;
      const aliases = ['/api/chat/', '/API/chat', '/api/chat/.', '/api/runs/', '/Api/Runs'];
      for (const path of aliases) {
        const response = await fetch(`http://127.0.0.1:${port}${path}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-ars-model-ticket': 'member-ticket',
          },
          body: JSON.stringify({
            agentId: 'other',
            byokProvider: {
              protocol: 'openai',
              apiKey: 'sk-client-supplied',
              baseUrl: 'https://evil.example/v1',
            },
          }),
        });
        expect(response.status, path).toBe(200);
        const body = await response.json() as { apiKey: string; baseUrl: string };
        expect(body, path).toEqual({
          apiKey: 'ars-managed',
          baseUrl: 'http://gateway/internal/model/team/v1',
        });
        expect(JSON.stringify(body), path).not.toContain('sk-client-supplied');
        expect(JSON.stringify(body), path).not.toContain('evil.example');
      }
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });
});
