ARG ARS_STUDIO_BASE
FROM node:24-bookworm-slim AS adapter
WORKDIR /build
RUN npm install --no-save typescript@6.0.3
COPY apps/daemon/src/integrations/ars-team.ts ./ars-team.ts
COPY apps/daemon/src/runtimes/env.ts ./env.ts
RUN node -e "const ts=require('typescript'),fs=require('fs');for(const n of ['ars-team','env'])fs.writeFileSync(n+'.js',ts.transpileModule(fs.readFileSync(n+'.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText)"
FROM ars/ai-execution:weekly-v1 AS broker
FROM ${ARS_STUDIO_BASE}
USER root
COPY --from=adapter /build/ars-team.js /app/apps/daemon/dist/integrations/ars-team.js
COPY --from=adapter /build/env.js /app/apps/daemon/dist/runtimes/env.js
COPY --from=broker /broker/src/studio-relay.ts /opt/ars/studio-relay.ts
RUN rm /usr/local/bin/codex && printf '#!/bin/sh\nexec node /opt/ars/studio-relay.ts "$@"\n' > /usr/local/bin/codex && chmod 755 /usr/local/bin/codex
USER 1001:1001
