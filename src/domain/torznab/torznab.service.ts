import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import XMLBuilder from 'fast-xml-builder'
import { DateFormatter } from '../../utils/date-formatter'
import { TorznabRepository } from './torznab.repository'
import { TorznabQuery, TorrentRecord } from './torznab.types'
import {
  CATEGORY_ANIME,
  CATEGORY_TV,
  DEFAULT_LIMIT,
  FAKE_PEERS,
  FAKE_SEEDERS,
  FAKE_SIZE_BYTES,
  MAX_LIMIT,
} from './torznab.constants'

@Injectable()
export class TorznabService {
  private readonly logger = new Logger(TorznabService.name)

  constructor(
    private readonly repository: TorznabRepository,
    private readonly config: ConfigService
  ) {}

  async handle(query: TorznabQuery): Promise<string> {
    const t = query.t ?? 'search'
    this.logger.log(`Torznab -> t=${t} q=${query.q ?? ''}`)

    if (t === 'caps') return this.buildCaps()
    return this.search(query)
  }

  private async search(query: TorznabQuery): Promise<string> {
    const term = this.extractTerm(query.q)
    const take = this.resolveLimit(query.limit)
    const skip = this.resolveOffset(query.offset)

    const [items, total] = await Promise.all([
      this.repository.search({ term, skip, take }),
      this.repository.count({ term }),
    ])

    return this.buildResultsXml({ items, total, offset: skip })
  }

  private extractTerm(q?: string): string | undefined {
    if (!q) return undefined
    return q.replace(/ [sS]\d{1,}(.*)/g, '')
  }

  private resolveLimit(limit?: string): number {
    const parsed = Number(limit)
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT
    return Math.min(parsed, MAX_LIMIT)
  }

  private resolveOffset(offset?: string): number {
    const parsed = Number(offset)
    if (!Number.isFinite(parsed) || parsed < 0) return 0
    return parsed
  }

  private buildCaps(): string {
    const builder = new XMLBuilder({ ignoreAttributes: false, format: true })
    return builder.build({
      caps: {
        server: { '@_version': '1.0', '@_title': 'anime-rss' },
        limits: { '@_max': MAX_LIMIT, '@_default': DEFAULT_LIMIT },
        searching: {
          search: { '@_available': 'yes', '@_supportedParams': 'q' },
          'tv-search': { '@_available': 'yes', '@_supportedParams': 'q,season,ep' },
          'movie-search': { '@_available': 'no', '@_supportedParams': 'q' },
        },
        categories: {
          category: {
            '@_id': CATEGORY_TV,
            '@_name': 'TV',
            subcat: { '@_id': CATEGORY_ANIME, '@_name': 'Anime' },
          },
        },
      },
    })
  }

  private buildResultsXml({ items, total, offset }: { items: TorrentRecord[]; total: number; offset: number }): string {
    const host = this.config.get('host', 'localhost')
    const port = this.config.get('port', 3033)
    const builder = new XMLBuilder({ ignoreAttributes: false, format: true })

    return builder.build({
      rss: {
        '@_version': '2.0',
        '@_xmlns:atom': 'http://www.w3.org/2005/Atom',
        '@_xmlns:torznab': 'http://torznab.com/schemas/2015/feed',
        channel: {
          title: 'anime-rss - Torznab',
          description: 'Torznab feed for Sonarr',
          link: `http://${host}:${port}/`,
          language: 'en',
          'torznab:response': { '@_offset': offset, '@_total': total },
          item: items.map((item) => this.buildItem({ item, host, port })),
        },
      },
    })
  }

  private buildItem({ item, host, port }: { item: TorrentRecord; host: string; port: number }): object {
    const dateFormatted = DateFormatter.format(item.pubDate, 'ddd, DD MMM YYYY HH:mm:ss -0000')
    const page = `http://${host}:${port}/${item.id}`

    return {
      title: item.title,
      guid: { '@_isPermaLink': 'true', '#text': page },
      link: item.magnet,
      pubDate: dateFormatted,
      size: FAKE_SIZE_BYTES,
      category: CATEGORY_ANIME,
      enclosure: { '@_url': item.magnet, '@_length': FAKE_SIZE_BYTES, '@_type': 'application/x-bittorrent' },
      'torznab:attr': [
        { '@_name': 'category', '@_value': String(CATEGORY_ANIME) },
        { '@_name': 'size', '@_value': String(FAKE_SIZE_BYTES) },
        { '@_name': 'seeders', '@_value': String(FAKE_SEEDERS) },
        { '@_name': 'peers', '@_value': String(FAKE_SEEDERS + FAKE_PEERS) },
        { '@_name': 'magneturl', '@_value': item.magnet },
      ],
    }
  }
}
