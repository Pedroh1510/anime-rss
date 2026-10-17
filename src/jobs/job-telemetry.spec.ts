import { ROOT_CONTEXT, context, propagation, trace } from '@opentelemetry/api'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'

import { createMeterProvider, installMeterProvider } from '../../tests/helpers/meters'

let meters: ReturnType<typeof installMeterProvider>
let jobs: typeof import('../infra/telemetry/jobs')

beforeAll(async () => {
  meters = installMeterProvider()
  jobs = await import('../infra/telemetry/jobs')
})

afterAll(async () => {
  await meters.uninstall()
})

function fakeQueue(name: string, { counts, oldest, failing = false }: any) {
  return {
    name,
    getJobCounts: async () => {
      if (failing) throw new Error('redis down')
      return counts
    },
    getJobs: async () => (oldest ? [oldest] : []),
  } as any
}

describe('job metrics', () => {
  it('records job duration with result ok and fail', async () => {
    const failure = new Error('nyaa down')
    const ok = jobs.withJobMetrics('Anime process', async () => 'value')
    const fail = jobs.withJobMetrics('Anime process', async () => {
      throw failure
    })

    await expect(ok({ name: 'cron' } as any)).resolves.toBe('value')
    await expect(fail({ name: 'cron' } as any)).rejects.toBe(failure)

    const points = await meters.points('app.job.duration')
    expect(points.map((point) => point.attributes.result).sort()).toEqual(['fail', 'ok'])
    for (const point of points) {
      expect(point.attributes).toEqual({ queue: 'Anime process', 'job.name': 'cron', result: point.attributes.result })
      expect(point.value.count).toBe(1)
    }
  })
})

describe('queue gauges', () => {
  it('queue gauge reports counts per state and oldest waiting age', async () => {
    const now = 1_800_000_000_000
    jobs.registerQueueGauges(
      () => [
        fakeQueue('Scan process', {
          counts: { waiting: 3, delayed: 1, active: 2, failed: 4 },
          oldest: { timestamp: now - 90_000 },
        }),
        fakeQueue('Adm Anime', { counts: { waiting: 0, delayed: 0, active: 0, failed: 0 } }),
      ],
      { now: () => now }
    )

    const counts = Object.fromEntries(
      (await meters.points('app.queue.jobs'))
        .filter((point) => point.attributes.queue === 'Scan process')
        .map((point) => [point.attributes.state, point.value])
    )
    expect(counts).toEqual({ waiting: 3, delayed: 1, active: 2, failed: 4 })
    const ages = Object.fromEntries(
      (await meters.points('app.queue.oldest_waiting_age')).map((point) => [point.attributes.queue, point.value])
    )
    expect(ages).toEqual({ 'Scan process': 90, 'Adm Anime': 0 })
  })

  it('queue gauge skips a failing queue', async () => {
    const local = createMeterProvider()
    jobs.registerQueueGauges(
      () => [
        fakeQueue('broken', { counts: {}, failing: true }),
        fakeQueue('healthy', { counts: { waiting: 5, delayed: 0, active: 0, failed: 0 } }),
      ],
      { meter: local.provider.getMeter('test') }
    )

    const { errors } = await local.collect()
    const queues = new Set((await local.points('app.queue.jobs')).map((point) => point.attributes.queue))
    await local.shutdown()

    expect(errors).toEqual([])
    expect([...queues]).toEqual(['healthy'])
  })
})

describe('bullmq tracing', () => {
  let provider: NodeTracerProvider

  beforeAll(() => {
    provider = new NodeTracerProvider()
    provider.register()
  })

  afterAll(async () => {
    await provider.shutdown()
    trace.disable()
    propagation.disable()
    context.disable()
  })

  function metadataOfAdd(fromContext: any): string {
    return context.with(fromContext, () => {
      const span = jobs.jobTelemetry.tracer.startSpan('add Scan process', {})
      const ctx = span.setSpanOnContext(context.active())
      span.end()
      return jobs.jobTelemetry.contextManager.getMetadata(ctx)
    })
  }

  it('traces only add and process operations', () => {
    const ctx = context.active()
    const internal = jobs.jobTelemetry.tracer.startSpan('getNextJob Scan process', {})
    expect(internal.setSpanOnContext(ctx)).toBe(ctx)
    internal.end()
  })

  it('a job enqueued by a request propagates its trace', () => {
    const request = trace.getTracer('test').startSpan('GET /rss')
    const metadata = metadataOfAdd(trace.setSpan(ROOT_CONTEXT, request))
    request.end()
    expect(JSON.parse(metadata).traceparent).toContain(request.spanContext().traceId)
  })

  it('a job enqueued by another job starts its own trace', () => {
    const parent = jobs.jobTelemetry.tracer.startSpan('process Anime process', {})
    const metadata = metadataOfAdd(parent.setSpanOnContext(ROOT_CONTEXT))
    parent.end()
    expect(JSON.parse(metadata)).toEqual({})
  })
})
