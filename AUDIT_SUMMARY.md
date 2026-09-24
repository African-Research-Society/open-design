# Open Design audit

## Executive Summary

Thirteen commits ahead of upstream, mostly ARS branding, deploy, SSO, and a team runtime. The team runtime treats any non-empty `x-ars-model-ticket` as identity while `OD_DISABLE_API_AUTH=1`. That is safe only if nothing except the ARS gateway can reach the container. Verifying the ticket inside the daemon would require the SSO secret, and this runtime is written to refuse that secret so it cannot share the admin SSO. No code change was made. The fix is network placement plus a human decision on how identity should be checked.

## Architecture Overview

Open Design daemon and web app. ARS runs a team studio behind a gateway that injects a model ticket, and an admin studio that accepts SSO assertions.

## Audit Coverage

SSO (`ars-sso-auth.ts`), team mode (`integrations/ars-team.ts`), embed logout routes, and the deploy Dockerfile notes in the ARS commits. Upstream Open Design was not re-audited.

## Confirmed Issues

Team mode authenticates by header presence, not by signature. The comment states the gateway overwrites the header and the model gateway verifies it. A client that can reach the studio port directly skips that.

## Security Findings

- Header-only team auth. High if the studio port is reachable. Not changed, because a local verifier needs a secret this process is forbidden to hold.
- Admin embed calls `/auth/ars/logout` and `/auth/ars/status`. The daemon registers `/auth/ars/callback` only. The team gateway implements the other two. The admin studio does not clear the session cookie on parent sign-out.
- Spent SSO `jti` values live in a process-local map. Two replicas can each accept one replay inside the 90 second window.
- Agent OAuth homes on a shared data volume are one identity for everyone who can use that studio.
- Origin checks skip a missing or `null` Origin. The JWT, TTL, and `jti` are the real control.

## Bugs

Missing logout/status routes on the daemon for the admin embed path.

## Compatibility Findings

Team runtime throws if `OD_ARS_SSO_SECRET` is set. That is intentional isolation from admin SSO.

## Dead/Vestigial Code

Not searched upstream.

## Mapping/Consistency Problems

Web embed paths and daemon routes do not match for logout and status.

## Performance/Reliability

Not examined beyond the in-memory replay cache.

## Testing Gaps

No new tests. Adding logout routes without a red spec in this large repo was deferred.

## Improvements

None landed.

## Fixes Implemented

None. A wrong verifier would be worse than the documented gateway assumption.

## Tests Added

None.

## Verification Performed

Read the team middleware, SSO callback, and the deploy notes in the ARS commits. Daemon tests were not run.

## Findings Not Fixed

All of the security items above.

## Items Requiring Human Decision

- Keep the studio on a private network and treat the gateway as the only client, or give the daemon a ticket-verify secret that is not the admin SSO secret.
- Add logout and status on the daemon for the admin studio.
- Persist spent `jti` values if more than one replica will take callbacks.

## Recommended Future Work

A dedicated model-ticket public key in the team runtime, logout/status routes, and a shared `jti` store.

## Statistics

- Commits examined: 13.
- Coverage: ARS delta, focused on auth and deploy.
- Fixed: 0.
- Dependencies changed: none.
- Confidence is high on the header check as written, and medium on whether production networking already prevents direct access.
