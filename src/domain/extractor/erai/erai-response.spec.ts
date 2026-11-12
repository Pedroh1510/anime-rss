import { classifyEraiResponse } from './erai-response'

const RSS_BODY = '<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>'
const HTML_BODY = '<!DOCTYPE html><html><title>Error 502</title></html>'

describe('classifyEraiResponse', () => {
  it('treats a 2xx RSS body as ok', () => {
    expect(classifyEraiResponse({ status: 200, body: RSS_BODY })).toBe('ok')
  })

  // The Erai bot filter answers 502 with an HTML page (2026-11-12), so 502 is a block, not an outage.
  it.each([502, 403, 429])('treats %i as locked', (status) => {
    expect(classifyEraiResponse({ status, body: HTML_BODY })).toBe('locked')
  })

  it('treats a 2xx body that is not RSS as locked (block page served with 200)', () => {
    expect(classifyEraiResponse({ status: 200, body: HTML_BODY })).toBe('locked')
  })

  it.each([500, 503, 504])('treats %i as retryable', (status) => {
    expect(classifyEraiResponse({ status, body: HTML_BODY })).toBe('retryable')
  })

  it('treats a network failure (no status) as retryable', () => {
    expect(classifyEraiResponse({ status: undefined, body: '' })).toBe('retryable')
  })

  it('treats 404 as not_found', () => {
    expect(classifyEraiResponse({ status: 404, body: HTML_BODY })).toBe('not_found')
  })

  it.each([400, 401])('treats other statuses like %i as failed', (status) => {
    expect(classifyEraiResponse({ status, body: HTML_BODY })).toBe('failed')
  })
})
