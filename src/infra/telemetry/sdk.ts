import { metrics } from '@opentelemetry/api'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis'
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { PrismaInstrumentation } from '@prisma/instrumentation'

import { SERVICE_NAME, TelemetryConfig } from './config'

const EXPORT_INTERVAL_MS = 30_000
// Short, so an unreachable collector costs a bounded wait per export, never
// the request path (AC 19)
const EXPORT_TIMEOUT_MS = 5_000
// bull-board polls its API every few seconds; its spans are noise. Matched as
// a path segment, so /queues-summary is still traced.
const BULL_BOARD_PATH = /^\/queues(\/|\?|$)/

export function isBullBoardRequest(url: string | undefined): boolean {
  return url !== undefined && BULL_BOARD_PATH.test(url)
}

/**
 * The instrumentations the app turns on (plan doors 4 and 4b): HTTP in and
 * out, fetch, Express routes, Prisma and Redis. Redis needs a parent span, so
 * BullMQ's own polling never starts a trace.
 */
export function createInstrumentations() {
  // stable HTTP semconv: http.server/client.request.duration, server.address
  process.env.OTEL_SEMCONV_STABILITY_OPT_IN ??= 'http'
  return [
    new HttpInstrumentation({ ignoreIncomingRequestHook: (request) => isBullBoardRequest(request.url) }),
    new UndiciInstrumentation(),
    // every layer stays: the middleware layers that mount routers are what
    // gives the request its http.route (door 4d)
    new ExpressInstrumentation(),
    new PrismaInstrumentation(),
    new IORedisInstrumentation({ requireParentSpan: true }),
  ]
}

function registerHeartbeat(): void {
  metrics
    .getMeter(SERVICE_NAME)
    .createObservableGauge('app.telemetry.up', { description: 'Always 1 while the process exports telemetry' })
    .addCallback((result) => result.observe(1))
}

/**
 * Starts the OpenTelemetry SDK: traces and metrics over OTLP HTTP to
 * `endpoint`, no OTLP logs (logs go to stdout as JSON, plan door 3). Export
 * failures are dropped by the SDK and never reach the app.
 */
export function startTelemetry(
  { serviceName, endpoint }: TelemetryConfig,
  { exportIntervalMillis = EXPORT_INTERVAL_MS }: { exportIntervalMillis?: number } = {}
): NodeSDK {
  process.env.OTEL_LOGS_EXPORTER ??= 'none'
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({ 'service.name': serviceName }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces`, timeoutMillis: EXPORT_TIMEOUT_MS }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics`, timeoutMillis: EXPORT_TIMEOUT_MS }),
      exportIntervalMillis,
      exportTimeoutMillis: Math.min(EXPORT_TIMEOUT_MS, exportIntervalMillis),
    }),
    logRecordProcessors: [],
    instrumentations: createInstrumentations(),
  })
  sdk.start()
  registerHeartbeat()
  return sdk
}
