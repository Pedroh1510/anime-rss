import { ConfigService } from '@nestjs/config'

import { XmlService } from '../shared/xml.service'
import { EraiRetryableError, EraiService } from './erai.service'
import { EraiFeedResult } from './erai/erai-feed.client'
import { EraiOutcome } from './erai/erai-response'

class FakeFeedClient {
  readonly terms: (string | undefined)[] = []

  constructor(private readonly result: EraiFeedResult) {}

  async fetchFeed(term?: string): Promise<EraiFeedResult> {
    this.terms.push(term)
    return this.result
  }
}

class FakeGuard {
  lockCalls = 0

  async lock(): Promise<void> {
    this.lockCalls++
  }
}

class FakeTagRepository {
  async listTags() {
    return { accepted: [{ tag: 'pt-br' }], verify: [] }
  }
}

function rssWith(items: string): string {
  return `<?xml version="1.0"?><rss version="2.0" xmlns:erai="https://www.erai-raws.info/rss-page/"><channel>${items}</channel></rss>`
}

const BR_ITEM = `<item><title>[Erai-raws] Frieren - 01</title><link>magnet:?xt=urn:btih:AAA</link>
<pubDate>Fri, 29 Sep 2023 16:00:00 +0000</pubDate><erai:subtitles>[br][us]</erai:subtitles></item>`
const US_ONLY_ITEM = `<item><title>[Erai-raws] Other - 01</title><link>magnet:?xt=urn:btih:BBB</link>
<pubDate>Fri, 29 Sep 2023 16:00:00 +0000</pubDate><erai:subtitles>[us]</erai:subtitles></item>`
const NO_SUBS_ITEM = `<item><title>[Erai-raws] Frieren - 02</title><link>magnet:?xt=urn:btih:CCC</link>
<pubDate>Fri, 06 Oct 2023 16:00:00 +0000</pubDate></item>`

function buildService(outcome: EraiOutcome, body = '') {
  const client = new FakeFeedClient({ outcome, status: 200, body })
  const guard = new FakeGuard()
  const service = new EraiService(
    new XmlService(new ConfigService()),
    new FakeTagRepository() as any,
    client as any,
    guard as any
  )
  return { service, client, guard }
}

async function collect(generator: AsyncGenerator<unknown>): Promise<unknown[]> {
  const items: unknown[] = []
  for await (const item of generator) items.push(item)
  return items
}

describe('EraiService.extractor', () => {
  it('yields br items from the feed with their magnet and date', async () => {
    const { service } = buildService('ok', rssWith(BR_ITEM + US_ONLY_ITEM))
    const items = await collect(service.extractor())
    expect(items).toEqual([
      { title: '[Erai-raws] Frieren - 01', link: 'magnet:?xt=urn:btih:AAA', date: new Date('2023-09-29T16:00:00Z') },
    ])
  })

  it('keeps items without erai:subtitles, since the feed is already filtered to br', async () => {
    const { service } = buildService('ok', rssWith(NO_SUBS_ITEM))
    await expect(collect(service.extractor())).resolves.toHaveLength(1)
  })

  it('passes the search term to the feed client', async () => {
    const { service, client } = buildService('ok', rssWith(''))
    await collect(service.extractor('frieren'))
    expect(client.terms).toEqual(['frieren'])
  })

  it('locks the source and yields nothing when blocked', async () => {
    const { service, guard } = buildService('locked')
    await expect(collect(service.extractor())).resolves.toEqual([])
    expect(guard.lockCalls).toBe(1)
  })

  it.each<EraiOutcome>(['not_found', 'failed'])('yields nothing on %s without locking', async (outcome) => {
    const { service, guard } = buildService(outcome)
    await expect(collect(service.extractor())).resolves.toEqual([])
    expect(guard.lockCalls).toBe(0)
  })

  it('throws EraiRetryableError on a transient failure so the job retries', async () => {
    const { service } = buildService('retryable')
    await expect(collect(service.extractor())).rejects.toBeInstanceOf(EraiRetryableError)
  })
})
