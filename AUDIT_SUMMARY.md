# Open Design audit (second pass)

## Coverage Matrix

| Subsystem | Depth | Notes |
| --- | --- | --- |
| ARS SSO callback, cookie, jti, origin | Adversarial | `apps/daemon/src/ars-sso-auth.ts` and its tests’ cited cases |
| Team runtime header gate | Adversarial | `integrations/ars-team.ts` |
| Embed sign-out and status | Deep | `apps/web/src/integrations/ars-embed.ts` versus daemon routes |
| Daemon wiring | Deep | `server.ts` registration around the callback |
| Design templates, skills, landing site | Not applicable | Not on the ARS auth or team-runtime path |

## Findings

Team mode accepts any non-empty `x-ars-model-ticket` and refuses `OD_ARS_SSO_SECRET`, so it cannot verify the ticket. That holds only when the studio port is private to the gateway.

The admin embed posted to `/auth/ars/logout` and `/auth/ars/status`, which the daemon did not implement, so the `__Host-od_ars_session` cookie survived parent sign-out.

Spent assertion ids are process-local. A second replica can replay one assertion inside 90 seconds.

Origin may be missing or `null` on the callback. That is documented for privacy browsers. The JWT, audience, and jti are the control.

## Fixed Findings

`GET /auth/ars/status` returns 204 or 401 from the existing session check. `POST /auth/ars/logout` clears the ARS session cookie. Both are registered next to the callback.

## Unfixed Findings

Ticket signature check inside team mode. Durable jti store. Shared agent OAuth on the data volume.

## Security

Cookie flags for an https audience are `__Host-`, Secure, HttpOnly, SameSite=Lax. API mutations still require Origin to match the audience.

## Database Integrity

Daemon SQLite was not re-audited.

## Authentication

SSO assertion rules were read: HS256, type `ars+sso`, 90 second life, roles limited to super_admin, admin, developer.

## Authorization

Team runtime does not scope files by member `sub`. One data directory is shared by the team. That matches the “shared team studio” comment and is a product fact, not an accident.

## Bugs

Missing logout and status routes. Fixed here.

## Race Conditions

In-memory jti map.

## Vestigial Code

No `registerArsSso` symbol. Wiring is inline. Not dead.

## Mapping/Consistency Problems

Embed client and daemon routes. Fixed for logout and status.

## Compatibility

Logout must keep the `__Host-` cookie name or the browser will ignore the clear.

## Dependencies

Not upgraded.

## Performance

Not examined.

## Accessibility

Not examined.

## Testing

Existing SSO tests were not re-run in this pass. Daemon typecheck should be run before the final push.

## Cross-Repository Findings

AfriNexus team gateway implements a different cookie (`__Host-ars_studio`). Daemon logout clears `__Host-od_ars_session` only. Both are needed: the gateway for its own cookie, the daemon for the session it sets.

## Product Decisions Required

Give the team runtime a verify key that is not the admin SSO secret, or keep the port private and accept header presence. Persist jti if more than one replica serves callbacks.

## Remaining Risks

Direct access to the team studio port.

## Areas Where Audit Confidence Is Low

Whether production binds the studio to localhost behind the gateway.

## Verification

Read the SSO module, team middleware, embed client, and the server registration. Logout routes added. Full daemon test suite not run in this note.

## Metrics

- Auth files traced: `ars-sso-auth.ts`, `ars-team.ts`, `ars-embed.ts`, server registration.
- Template catalogue: excluded.
- Code fixes: logout and status.

## Pass 3 — stopped before completion

open-design unreviewed is 8498 of 12850 ledger rows. Reviewed rows are 1395. Batches through 498, plus 501 and 502, were length-checked and ledgered where reports had landed. Batches 499, 500, and 503–508 were still running at the stop and are not reviewed. Local unpushed fixes include project-path confinement, escaped updater notes, http(s)-only browser open, OAuth script escaping, owner-only MCP files, hashed runtime cache key, JSON-LD escaping, launch-week keyframes, plugin slug `..` collapse, locale blog RSS aligned with blog locales, and the English DeepSeek provider link. `OD_DISABLE_API_AUTH` and cross-repo protocol changes were left. Waves 2 and 3 were not run.
