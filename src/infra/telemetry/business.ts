import { Counter, metrics } from '@opentelemetry/api'

import { SERVICE_NAME } from './config'

// app-observability door 2c: the anime-rss pipeline counters
export const PIPELINE_EVENTS = ['rss.items.fetched', 'rss.items.saved', 'rss.torrents.cleaned'] as const
export type PipelineEvent = (typeof PIPELINE_EVENTS)[number]

const counters = new Map<PipelineEvent, Counter>()

function counter(name: PipelineEvent): Counter {
  let found = counters.get(name)
  if (!found) {
    found = metrics.getMeter(SERVICE_NAME).createCounter(name)
    counters.set(name, found)
  }
  return found
}

/**
 * Counts one pipeline event. `source` is the extractor site or `qbittorrent`
 * (closed domain, never a title) and `result` is ok | fail.
 */
export function countPipelineEvent(name: PipelineEvent, attributes: { source: string; result: 'ok' | 'fail' }): void {
  if (!PIPELINE_EVENTS.includes(name)) return
  counter(name).add(1, { source: attributes.source, result: attributes.result })
}
