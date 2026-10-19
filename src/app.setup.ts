import { INestApplication, ValidationPipe } from '@nestjs/common'

/**
 * Global pipes shared by main.ts and the HTTP test harnesses, so DTO
 * validation in tests is the same validation production runs.
 * @example applyGlobalPipes(app)
 */
export function applyGlobalPipes(app: INestApplication): void {
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
}

const DEFAULT_PORT = 3033
const MAX_PORT = 65535

/**
 * HTTP port from `PORT`; lowercase `port` is still read because the current
 * Coolify service sets `port=4000` — drop the fallback once it migrates to `PORT`.
 * @example resolvePort(process.env) // 3033 when neither is set
 */
export function resolvePort(env: NodeJS.ProcessEnv): number {
  const raw = env.PORT ?? env.port
  if (raw === undefined || raw === '') return DEFAULT_PORT
  const port = Number(raw)
  if (Number.isInteger(port) && port >= 1 && port <= MAX_PORT) return port
  throw new Error(`Invalid port "${raw}": expected integer 1-${MAX_PORT}`)
}
