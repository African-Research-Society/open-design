import type { Express, RequestHandler } from 'express';
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
});
