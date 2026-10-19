# Digest pinned so builds are reproducible; Dependabot (docker ecosystem) bumps it.
FROM node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS builder
WORKDIR /app

# .npmrc must be present before install so min-release-age/ignore-scripts/engine-strict apply to the build too.
COPY package*.json .npmrc ./
RUN npm ci --silent
RUN npm run rebuild:approved

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build
# Generated Prisma client lives in node_modules/.prisma and survives the prune.
RUN npm prune --omit=dev --silent

# ---

FROM node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
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
