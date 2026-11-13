import { Injectable, Logger } from '@nestjs/common'

import { countSourceError } from '../../infra/telemetry/business'
import { DateFormatter } from '../../utils/date-formatter'
import { XmlService } from '../shared/xml.service'
import { EraiFeedClient } from './erai/erai-feed.client'
import { EraiGuardRepository } from './erai/erai-guard.repository'
import { ExtractorRepository } from './extractor.repository'

export interface EraiItem {
  title: string
  link: string
  date: Date
}

interface EraiFeedEntry {
  title: string
  link: string
  pubDate: string
  'erai:subtitles'?: string
}

interface EraiFeedJson {
  rss?: { channel?: { item?: EraiFeedEntry | EraiFeedEntry[] } }
}

/** Transient Erai failure (5xx, timeout); thrown so the BullMQ job retries with backoff. */
export class EraiRetryableError extends Error {
  constructor(status: number | undefined) {
    super(`Erai feed transient failure: status=${status ?? 'network'}; expected 2xx RSS`)
  }
}

const ALWAYS_ACCEPTED_SUBS = ['br']

@Injectable()
export class EraiService {
  private readonly logger = new Logger(EraiService.name)

  constructor(
    private readonly xmlService: XmlService,
    private readonly repository: ExtractorRepository,
    private readonly feedClient: EraiFeedClient,
    private readonly guard: EraiGuardRepository
  ) {}

  /**
   * Reads the Erai br feed (recent releases, or a search when `term` is given). Makes exactly one request.
   * @example for await (const item of eraiService.extractor('frieren')) save(item)
   */
  async *extractor(term?: string): AsyncGenerator<EraiItem> {
    const entries = await this.fetchEntries(term)
    if (!entries.length) return
    const acceptedTags = await this.loadAcceptedTags()
    for (const entry of entries) {
      if (!this.isAccepted(entry['erai:subtitles'], acceptedTags)) continue
      yield { title: entry.title, link: entry.link, date: this.parseDate(entry.pubDate) }
    }
  }

  private async fetchEntries(term?: string): Promise<EraiFeedEntry[]> {
    const result = await this.feedClient.fetchFeed(term)
    if (result.outcome === 'ok') return this.parseEntries(result.body)
    if (result.outcome === 'retryable') {
      countSourceError({ source: 'erai', status: 'error' })
      throw new EraiRetryableError(result.status)
    }
    await this.handleNonRetryable(result.outcome, result.status)
    return []
  }

  private async handleNonRetryable(outcome: 'locked' | 'not_found' | 'failed', status: number | undefined) {
    if (outcome === 'locked') {
      await this.guard.lock()
      this.logger.warn(`Erai blocked the request (status=${status}); source locked for 24h`)
      countSourceError({ source: 'erai', status: 'locked' })
      return
    }
    if (outcome === 'failed') this.logger.warn(`Erai feed failed: status=${status}; expected 2xx RSS`)
    countSourceError({ source: 'erai', status: outcome === 'not_found' ? 'not_found' : 'error' })
  }

  private parseEntries(xml: string): EraiFeedEntry[] {
    const json = this.xmlService.parserToJson(xml) as EraiFeedJson
    const item = json.rss?.channel?.item
    if (!item) return []
    return Array.isArray(item) ? item : [item]
  }

  private async loadAcceptedTags(): Promise<string[]> {
    const { accepted } = await this.repository.listTags()
    return [...accepted.map((item) => item.tag), ...ALWAYS_ACCEPTED_SUBS]
  }

  // The feed is already filtered to br server-side; missing subtitles must not drop the item.
  private isAccepted(subtitles: string | undefined, acceptedTags: string[]): boolean {
    if (!subtitles) return true
    const normalized = subtitles.toLowerCase()
    return acceptedTags.some((tag) => normalized.includes(tag))
  }

  private parseDate(pubDate: string): Date {
    const dateIgnoreWeekday = pubDate.split(', ').slice(1).join(', ')
    return DateFormatter.toDate(dateIgnoreWeekday, 'DD MMM YYYY HH:mm:ss ZZ')
  }
}
