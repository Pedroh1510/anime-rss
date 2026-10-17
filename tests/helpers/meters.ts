import { metrics } from '@opentelemetry/api'
import { AggregationTemporality, MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics'

class CollectingReader extends MetricReader {
  constructor() {
    super({ aggregationTemporalitySelector: () => AggregationTemporality.CUMULATIVE })
  }

  protected async onForceFlush(): Promise<void> {}

  protected async onShutdown(): Promise<void> {}
}

export interface DataPoint {
  attributes: Record<string, unknown>
  value: any
}

/** An in-memory meter provider whose data points can be read back. */
export function createMeterProvider() {
  const reader = new CollectingReader()
  const provider = new MeterProvider({ readers: [reader] })
  return {
    provider,
    collect: () => reader.collect(),
    async points(name: string): Promise<DataPoint[]> {
      const { resourceMetrics } = await reader.collect()
      return resourceMetrics.scopeMetrics
        .flatMap((scope) => scope.metrics)
        .filter((metric) => metric.descriptor.name === name)
        .flatMap((metric) => metric.dataPoints as DataPoint[])
    },
    shutdown: () => provider.shutdown(),
  }
}

/** Same, registered as the global provider; call uninstall() after. */
export function installMeterProvider() {
  const meters = createMeterProvider()
  metrics.setGlobalMeterProvider(meters.provider)
  return {
    ...meters,
    async uninstall() {
      await meters.shutdown()
      metrics.disable()
    },
  }
}
