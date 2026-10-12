import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'

import { DateFormatter } from '../../utils/date-formatter'
import { TorrentService } from '../shared/torrent.service'
import { XmlService } from '../shared/xml.service'
import { ExtractorRepository } from './extractor.repository'

const animeToshoApi = axios.create({ baseURL: 'https://feed.animetosho.org/rss2' })

@Injectable()
export class AnimeToshoService {
  private readonly logger = new Logger(AnimeToshoService.name)
  private acceptedTags: string[] = []

  constructor(
    private readonly xmlService: XmlService,
    private readonly torrentService: TorrentService,
    private readonly repository: ExtractorRepository
  ) {}

  private async searchXml(term?: string) {
    return animeToshoApi
      .get('', {
        params: {
          only_tor: '1',
          reversepolarity: 1,
          q: term,
        },
      })
      .then((response) => response.data)
      .catch(() => {
        return null
      })
  }

  private isAcceptedTitle(title: string): boolean {
    const titleLow = title.toLowerCase()
    return this.acceptedTags.some((tag) => titleLow.includes(tag))
  }

  private getMagnetLink(description = ''): string | undefined {
    const array = description.split('"')
    return array.find((item) => item.includes('magnet:'))
  }

  async *extractor(term?: string): AsyncGenerator<{ title: string; link: string; date: Date }> {
    this.logger.log('Extractor AnimeTosho -> start')
    const xml = await this.searchXml(term)
    if (!xml) {
      this.logger.log('Extractor AnimeTosho -> end')
      return
    }
    const json = this.xmlService.parserToJson(xml) as any
    const isValidXml = json?.rss && json.rss?.channel && Array.isArray(json.rss.channel?.item)
    if (!isValidXml) {
      this.logger.log('Extractor AnimeTosho -> end')
      return
    }
    const { accepted } = await this.repository.listTags()
    this.acceptedTags = accepted.map((item) => item.tag)
    for (const item of json.rss.channel.item) {
      if (!this.isAcceptedTitle(item.title)) continue
      if (!this.getMagnetLink(item.description)) continue
      const dateIgnoreWeekday = item.pubDate.split(', ').slice(1).join(', ')
      const link = this.torrentService.infoHashToMagnet(item['nyaa:infoHash'])
      try {
        await this.torrentService.magnetInfo(link)
      } catch {
        continue
      }
      yield {
        title: item.title,
        link,
        date: DateFormatter.toDate(dateIgnoreWeekday, 'DD MMM YYYY HH:mm:ss ZZ'),
      }
    }

    this.logger.log('Extractor AnimeTosho -> end')
  }
}
