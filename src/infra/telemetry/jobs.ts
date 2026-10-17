import { Logger } from '@nestjs/common'
import { Context, Meter, ObservableGauge, ROOT_CONTEXT, context, createContextKey, metrics } from '@opentelemetry/api'
import type { Job, Queue } from 'bullmq'
import { BullMQOtel } from 'bullmq-otel'

import { SERVICE_NAME } from './config'

const logger = new Logger('JobTelemetry')
const QUEUE_STATES = ['waiting', 'delayed', 'active', 'failed'] as const
// BullMQ wraps its internal loop (getNextJob blocks up to drainDelay, 5s) in
// spans too; only these become spans, or the slow-trace policy keeps them all
const PRODUCER_OPERATIONS = new Set(['add', 'addBulk'])
const CONSUMER_OPERATION = 'process'
// Set on the context a job runs in (plan door 4c)
const INSIDE_JOB = createContextKey('anime-rss bullmq job')

type BullSpan = ReturnType<BullMQOtel['tracer']['startSpan']>

class UntracedSpan {
  setSpanOnContext(ctx: Context): Context {
    return ctx
  }
  setAttribute(): void {}
  setAttributes(): void {}
  addEvent(): void {}
  recordException(): void {}
  end(): void {}
}

// A job enqueued by another job: no producer span, and an empty context, so
// the child job starts its own trace instead of growing the parent's
class DetachedSpan extends UntracedSpan {
  setSpanOnContext(): Context {
    return ROOT_CONTEXT
  }
}

function markInsideJob(span: BullSpan): BullSpan {
  const marked = Object.create(span)
  marked.setSpanOnContext = (ctx: Context) => span.setSpanOnContext(ctx).setValue(INSIDE_JOB, true)
  return marked
}

/**
 * One trace per job (plan door 4c): a job enqueued by a request joins the
 * request's trace, a job enqueued by a job does not.
 */
function createJobTelemetry(): BullMQOtel {
  const telemetry = new BullMQOtel(SERVICE_NAME)
  const { tracer } = telemetry
  telemetry.tracer = {
    startSpan(name: string, options: any, ctx?: Context) {
      const operation = name.split(' ')[0]
      if (operation === CONSUMER_OPERATION) return markInsideJob(tracer.startSpan(name, options, ctx))
      if (!PRODUCER_OPERATIONS.has(operation)) return new UntracedSpan()
      if (context.active().getValue(INSIDE_JOB)) return new DetachedSpan()
      return tracer.startSpan(name, options, ctx)
    },
  } as BullMQOtel['tracer']
  return telemetry
}

/** `telemetry` option for BullModule.forRoot (plan door 4). */
export const jobTelemetry = createJobTelemetry()

let jobDuration: ReturnType<Meter['createHistogram']> | undefined
function jobDurationHistogram() {
  jobDuration ??= metrics.getMeter(SERVICE_NAME).createHistogram('app.job.duration', {
    unit: 's',
    description: 'Duration of one BullMQ job, by queue, job name and result',
  })
  return jobDuration
}

/**
 * Wraps a job handler so every run records `app.job.duration` with `queue`,
 * `job.name` and `result` (ok | fail). Result and error pass through unchanged.
 */
export function withJobMetrics<T>(queueName: string, handler: (job: Job) => Promise<T>) {
  return async (job: Job): Promise<T> => {
    const startedAt = performance.now()
    let result = 'fail'
    try {
      const value = await handler(job)
      result = 'ok'
      return value
    } finally {
      jobDurationHistogram().record((performance.now() - startedAt) / 1000, {
        queue: queueName,
        'job.name': job.name,
        result,
      })
    }
  }
}

interface Gauges {
  jobs: ObservableGauge
  oldestAge: ObservableGauge
}

async function observeQueue(observer: any, gauges: Gauges, queue: Queue, now: () => number) {
  const [counts, [oldest]] = await Promise.all([
    queue.getJobCounts(...QUEUE_STATES),
    queue.getJobs(['waiting'], 0, 0, true),
  ])
  for (const state of QUEUE_STATES) {
    observer.observe(gauges.jobs, counts[state] ?? 0, { queue: queue.name, state })
  }
  const age = oldest ? Math.max(0, (now() - oldest.timestamp) / 1000) : 0
  observer.observe(gauges.oldestAge, age, { queue: queue.name })
}

/**
 * Publishes `app.queue.jobs` per state and `app.queue.oldest_waiting_age`
 * for every queue `listQueues()` returns, at each metric collection (30 s).
 * A queue whose read fails is skipped for that collection.
 */
export function registerQueueGauges(
  listQueues: () => Queue[],
  { now = Date.now, meter = metrics.getMeter(SERVICE_NAME) }: { now?: () => number; meter?: Meter } = {}
): void {
  const gauges: Gauges = {
    jobs: meter.createObservableGauge('app.queue.jobs', { description: 'Jobs in the queue, by state' }),
    oldestAge: meter.createObservableGauge('app.queue.oldest_waiting_age', {
      unit: 's',
      description: 'Age of the oldest waiting job; 0 when none waits',
    }),
  }
  meter.addBatchObservableCallback(
    async (observer) => {
      await Promise.all(
        listQueues().map((queue) =>
          observeQueue(observer, gauges, queue, now).catch((error: Error) => {
            logger.warn(`queue gauge failed for ${queue.name}: ${error.message}`)
          })
        )
      )
    },
    [gauges.jobs, gauges.oldestAge]
  )
}
