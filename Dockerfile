FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --silent
RUN npm run rebuild:approved

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

# ---

FROM node:24-alpine AS runner
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --silent
RUN npm run rebuild:approved

COPY prisma ./prisma/
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

ENV PORT=3333
EXPOSE 3333

CMD ["node", "dist/main"]
