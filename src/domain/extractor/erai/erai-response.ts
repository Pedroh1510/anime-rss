/** What the Erai feed answer means for the caller. */
export type EraiOutcome = 'ok' | 'locked' | 'retryable' | 'not_found' | 'failed'

export interface EraiRawResponse {
  /** undefined when the request never got an HTTP answer (timeout, ECONNRESET, DNS). */
  status: number | undefined
  body: string
}

// The Erai bot filter answers 502 with an HTML page (observed 2026-11-12), so 502 means
// "blocked", not "outage". Hammering a block is what extends it.
const LOCKED_STATUSES = new Set([403, 429, 502])
const RETRYABLE_STATUSES = new Set([500, 503, 504])

function isRssBody(body: string): boolean {
  return body.includes('<rss')
}

/**
 * Classifies a raw Erai feed answer. Status wins over body, except a 2xx that is not RSS
 * (block page served with 200) counts as locked.
 * @example classifyEraiResponse({ status: 502, body: '<html>' }) // 'locked'
 */
export function classifyEraiResponse({ status, body }: EraiRawResponse): EraiOutcome {
  if (status === undefined) return 'retryable'
  if (LOCKED_STATUSES.has(status)) return 'locked'
  if (RETRYABLE_STATUSES.has(status)) return 'retryable'
  if (status === 404) return 'not_found'
  if (status >= 200 && status < 300) return isRssBody(body) ? 'ok' : 'locked'
  return 'failed'
}
