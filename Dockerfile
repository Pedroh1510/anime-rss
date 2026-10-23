# Digest pinned so builds are reproducible; Dependabot (docker ecosystem) bumps it.
FROM node:25-alpine@sha256:bdf2cca6fe3dabd014ea60163eca3f0f7015fbd5c7ee1b0e9ccb4ced6eb02ef4 AS builder
WORKDIR /app

# .npmrc must be present before install so min-release-age/ignore-scripts/engine-strict apply to the build too.
COPY package*.json .npmrc ./
RUN npm ci --silent
RUN npm run rebuild:approved

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

# ---

FROM node:25-alpine@sha256:bdf2cca6fe3dabd014ea60163eca3f0f7015fbd5c7ee1b0e9ccb4ced6eb02ef4 AS runner
WORKDIR /app
ENV NODE_ENV=production

# Fresh prod-only install instead of `npm prune` in the builder: prune hung indefinitely on the
# Coolify build host (deployment wzlhj3ig8ps0nnktov1bk8fb, 2026-10-19) while passing locally.
COPY --chown=node:node package*.json .npmrc ./
RUN npm ci --omit=dev --silent
# Only prod packages whose install scripts matter; @prisma/client's postinstall would need the prisma CLI (devDep).
RUN npm rebuild msgpackr-extract protobufjs --foreground-scripts --ignore-scripts=false
# Generated client (query engine included) comes from the builder, so no second `prisma generate`.
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/dist ./dist

# Port comes from PORT (legacy lowercase `port` still honoured), default 3033 — see resolvePort.
EXPOSE 3033
USER node
# node fetch instead of curl/wget: no extra binary in the image. Coolify gates deploys on this.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||process.env.port||3033)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Same entrypoint as `npm run start:prod`: telemetry must load before the app modules.
CMD ["node", "--import", "./dist/telemetry.js", "dist/main"]
