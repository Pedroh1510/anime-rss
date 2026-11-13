import { ConfigService } from '@nestjs/config'
import { UnrecoverableError } from 'bullmq'

import { EraiFeedClient, EraiHttp, EraiHttpResponse } from './erai-feed.client'

class FakeEraiHttp implements EraiHttp {
  readonly calls: { url: string; headers: Record<string, string> }[] = []

  constructor(private readonly response: EraiHttpResponse | Error) {}

  async get(url: string, headers: Record<string, string>): Promise<EraiHttpResponse> {
    this.calls.push({ url, headers })
    if (this.response instanceof Error) throw this.response
    return this.response
  }
}

const RSS_BODY = '<rss><channel></channel></rss>'

function buildClient(http: FakeEraiHttp, env: Record<string, string> = {}) {
  const config = new ConfigService({ ERAI_TOKEN: 'tok123', ERAI_USER_AGENT: 'UA/1.0', ...env })
  return new EraiFeedClient(config, http)
}

describe('EraiFeedClient', () => {
  it('requests the br magnet feed with the token and no search term', async () => {
    const http = new FakeEraiHttp({ status: 200, body: RSS_BODY })
    await buildClient(http).fetchFeed()
    expect(http.calls[0].url).toBe('https://www.erai-raws.info/feed/?type=magnet&subs%5B0%5D=br&token=tok123')
  })

  it('appends the encoded search term', async () => {
    const http = new FakeEraiHttp({ status: 200, body: RSS_BODY })
    await buildClient(http).fetchFeed('sousou no frieren')
    expect(http.calls[0].url).toBe(
      'https://www.erai-raws.info/feed/?type=magnet&subs%5B0%5D=br&token=tok123&s=sousou%20no%20frieren'
    )
  })

  it('sends the configured User-Agent and an Accept header', async () => {
    const http = new FakeEraiHttp({ status: 200, body: RSS_BODY })
    await buildClient(http).fetchFeed()
    expect(http.calls[0].headers['User-Agent']).toBe('UA/1.0')
    expect(http.calls[0].headers.Accept).toContain('application/xml')
  })

  it('omits the User-Agent header when ERAI_USER_AGENT is not set', async () => {
    const http = new FakeEraiHttp({ status: 200, body: RSS_BODY })
    await buildClient(http, { ERAI_USER_AGENT: '' }).fetchFeed()
    expect(http.calls[0].headers).not.toHaveProperty('User-Agent')
  })

  it('returns the classified outcome with the body', async () => {
    const http = new FakeEraiHttp({ status: 200, body: RSS_BODY })
    await expect(buildClient(http).fetchFeed()).resolves.toEqual({ outcome: 'ok', status: 200, body: RSS_BODY })
  })

  it('maps a network error to retryable', async () => {
    const http = new FakeEraiHttp(new Error('ECONNRESET'))
    await expect(buildClient(http).fetchFeed()).resolves.toEqual({ outcome: 'retryable', status: undefined, body: '' })
  })

  // Unrecoverable so BullMQ does not retry a config error 3 times per job.
  it('throws an UnrecoverableError when ERAI_TOKEN is missing, without a request', async () => {
    const http = new FakeEraiHttp({ status: 200, body: RSS_BODY })
    const failure = buildClient(http, { ERAI_TOKEN: '' }).fetchFeed()
    await expect(failure).rejects.toBeInstanceOf(UnrecoverableError)
    await expect(failure).rejects.toThrow('ERAI_TOKEN')
    expect(http.calls).toHaveLength(0)
  })
})
