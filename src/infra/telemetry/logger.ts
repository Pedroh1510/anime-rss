import { isSpanContextValid, trace } from '@opentelemetry/api'
import pino, { LoggerOptions } from 'pino'

// app-observability door 3: the collector copies trace_id/span_id into the
// log record, linking the line to its trace
function activeSpanIds(): Record<string, string> {
  const spanContext = trace.getActiveSpan()?.spanContext()
  if (!spanContext || !isSpanContextValid(spanContext)) return {}
  return { trace_id: spanContext.traceId, span_id: spanContext.spanId }
}

/** One JSON object per line: level (label), msg, time (ISO), span ids. */
export function pinoOptions(): LoggerOptions {
  return {
    level: process.env.LOG_LEVEL ?? 'info',
    base: undefined,
    messageKey: 'msg',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
    mixin: activeSpanIds,
  }
}
