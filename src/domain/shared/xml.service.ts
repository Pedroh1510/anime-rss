import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import XMLBuilder from 'fast-xml-builder'
import { XMLParser } from 'fast-xml-parser'

import { DateFormatter } from '../../utils/date-formatter'

@Injectable()
export class XmlService {
  constructor(private readonly config: ConfigService) {}

  parserToJson(xml: string | null | undefined): object {
    if (xml === null || xml === undefined) return {}
    const instance = new XMLParser()
    return instance.parse(xml)
  }

  private makeBody(itens: any[]): object {
    const port = this.config.get('port', 3033)
    return {
      rss: {
        '@_xmlns:atom': 'http://www.w3.org/2005/Atom',
        '@_xmlns:nyaa': 'https://nyaa.si/xmlns/nyaa',
        '@_version': '2.0',
        channel: {
          title: 'Nyaa - Home - Torrent File RSS',
          description: 'RSS Feed for Home',
          link: `http://localhost:${port}/`,
          'atom:link': {
            '@_href': `http://localhost:${port}`,
            '@_rel': 'self',
            '@_type': 'application/rss+xml',
          },
          language: 'en',
          item: itens,
        },
      },
    }
  }

  private makeItem({
    magnet,
    page,
    pubDate,
    title,
    id,
  }: {
    magnet: string
    page: string
    pubDate: Date | string
    title: string
    id: any
  }): object {
    const dateFormatted = DateFormatter.format(pubDate, 'ddd, DD MMM YYYY HH:mm:ss -0000')
    return {
      title,
      link: magnet,
      guid: { '#text': page },
      pubDate: dateFormatted,
      'nyaa:seeders': 1,
      'nyaa:leechers': 18,
      'nyaa:downloads': 0,
      'nyaa:infoHash': id,
      'nyaa:categoryId': '1_2',
      'nyaa:category': 'Anime - English-translated',
      'nyaa:size': '249.0 MiB',
      'nyaa:comments': 0,
      'nyaa:trusted': 'No',
      'nyaa:remake': 'No',
      description: '<a href="https://nyaa.si/view/1741283">#1741283</a>',
    }
  }

  buildToRss({ items }: { items: any[] }): string {
    const builder = new XMLBuilder({ ignoreAttributes: false, format: true })
    return builder.build(this.makeBody(items.map((item) => this.makeItem({ ...item }))))
  }
}
