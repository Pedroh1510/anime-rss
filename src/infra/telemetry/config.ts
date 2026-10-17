// app-observability Q25: defaults live in the code, so a Coolify deploy
// needs no extra env; the env still overrides both.
export const SERVICE_NAME = 'anime-rss'
export const DEFAULT_OTLP_ENDPOINT = 'http://otel-collector:4318'

export interface TelemetryConfig {
  serviceName: string
  endpoint: string
}

/** Service name and OTLP base endpoint (no trailing slash) for the SDK. */
export function resolveTelemetryConfig(env: Record<string, string | undefined>): TelemetryConfig {
  return {
    serviceName: env.OTEL_SERVICE_NAME || SERVICE_NAME,
    endpoint: (env.OTEL_EXPORTER_OTLP_ENDPOINT || DEFAULT_OTLP_ENDPOINT).replace(/\/+$/, ''),
  }
}
