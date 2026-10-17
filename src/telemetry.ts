// Loaded with `node --import ./dist/telemetry.js` (app-observability door 5),
// so the SDK patches express, prisma and ioredis before the app requires them.
import { resolveTelemetryConfig } from './infra/telemetry/config'
import { startTelemetry } from './infra/telemetry/sdk'

const sdk = startTelemetry(resolveTelemetryConfig(process.env))

process.once('beforeExit', () => {
  sdk.shutdown().catch(() => {})
})
