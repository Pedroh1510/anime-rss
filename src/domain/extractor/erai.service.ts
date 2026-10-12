import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'

import { DateFormatter } from '../../utils/date-formatter'
import { XmlService } from '../shared/xml.service'
import { ExtractorRepository } from './extractor.repository'

@Injectable()
export class EraiService {
  private readonly logger = new Logger(EraiService.name)
  private acceptedTags: string[] = []
  private verifyTags: string[] = []

  constructor(
    private readonly config: ConfigService,
    private readonly xmlService: XmlService,
    private readonly repository: ExtractorRepository
  ) {}

  private async searchXml() {
    const eraiUrl = this.config.get<string>('ERAI')
    return axios
      .get(eraiUrl!)
      .then((response) => response.data)
      .catch((e) => {
        this.logger.error(e.message)
        return null
      })
  }

  private isAcceptedTitle(title: string): boolean {
    const firstCheck = this.acceptedTags.some((tag) => title.toLowerCase().includes(tag))
    const staticList = ['br']
    const secundCheck = staticList.some((tag) => title.toLowerCase().includes(tag))
    return firstCheck || secundCheck
  }

  isVerify(text: string): boolean {
    return this.verifyTags.some((tag) => text.toLowerCase().includes(tag))
  }

  private async getData() {
    const xml = await this.searchXml()
    if (!xml) return
    const json = this.xmlService.parserToJson(xml) as any
    if (!json?.rss) return null
    if (!json.rss?.channel) return null
    if (!json.rss.channel?.item) return null
    json.rss.channel.item = Array.isArray(json.rss.channel.item) ? json.rss.channel.item : [json.rss.channel.item]
    return json.rss.channel.item.map((item: any) => ({ ...item, subtitles: item['erai:subtitles'] }))
  }

  async *extractor(): AsyncGenerator<{ title: string; link: string; date: Date }> {
    this.logger.log('Extractor Erai -> start')
    const data = await this.getData()
    if (!data) {
      this.logger.log('Extractor Erai -> end empty')
      return
    }
    const { accepted, verify } = await this.repository.listTags()
    this.verifyTags = verify.map((item) => item.tag)
    this.acceptedTags = accepted.map((item) => item.tag)
    for (const item of data) {
      if (!this.isAcceptedTitle(item.subtitles)) continue
      const dateIgnoreWeekday = item.pubDate.split(', ').slice(1).join(', ')
      yield {
        title: item.title,
        link: item.link,
        date: DateFormatter.toDate(dateIgnoreWeekday, 'DD MMM YYYY HH:mm:ss ZZ'),
      }
    }
    this.logger.log('Extractor Erai -> end')
  }
}
