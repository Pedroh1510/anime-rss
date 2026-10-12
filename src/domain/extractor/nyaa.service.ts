import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { load } from 'cheerio'

import { DateFormatter } from '../../utils/date-formatter'
import { TorrentService } from '../shared/torrent.service'
import { XmlService } from '../shared/xml.service'
import { ExtractorRepository } from './extractor.repository'

const nyaaApi = axios.create({ baseURL: 'https://nyaa.si' })

@Injectable()
export class NyaaService {
  private readonly logger = new Logger(NyaaService.name)
  acceptedTags: string[] = []
  verifyTags: string[] = []

  constructor(
    private readonly xmlService: XmlService,
    private readonly torrentService: TorrentService,
    private readonly repository: ExtractorRepository
  ) {}

  private async searchXml(term: any) {
    const query = term?.q ?? term
    const q = !query ? undefined : query
    return nyaaApi
      .get('/', {
        params: {
          page: 'rss',
          c: '1_0',
          q,
        },
      })
      .then((response) => response.data)
      .catch((e) => {
        this.logger.error(e)
        return null
      })
  }

  private isAcceptedTitle(title: string): boolean {
    return this.acceptedTags.some((tag) => title.toLowerCase().includes(tag))
  }

  isVerify(text: string): boolean {
    return this.verifyTags.some((tag) => text.toLowerCase().includes(tag))
  }

  async *extractor(term?: any, processAllItems = false): AsyncGenerator<{ title: string; link: string; date: Date }> {
    this.logger.log('Extractor Nyaa -> start')
    const query = term?.q ?? term
    const xml = await this.searchXml(query)
    if (!xml) return
    const json = this.xmlService.parserToJson(xml) as any
    const isValidXml = json?.rss && json.rss?.channel && json.rss.channel?.item !== undefined
    if (!isValidXml) return
    if (!Array.isArray(json.rss.channel?.item)) json.rss.channel.item = [json.rss.channel?.item]
    const { accepted, verify } = await this.repository.listTags()
    this.verifyTags = verify.map((item) => item.tag)
    this.acceptedTags = accepted.map((item) => item.tag)
    const isVerify = (text: string) => this.verifyTags.some((tag) => text.toLowerCase().includes(tag))
    const promises: Promise<any>[] = []
    const processItem = async (item: any) => {
      if (!this.isAcceptedTitle(item.title)) {
        if (!isVerify(item.title) && !processAllItems) return null
        const link = item.link.includes('.torrent') ? item.guid : item.link
        const isValid = await this.isAcceptInNyaa(link)
        if (!isValid) return null
      }
      const dateIgnoreWeekday = item.pubDate.split(', ').slice(1).join(', ')
      const link = await this.torrentService.magnetByLinkFile(item.link)
      try {
        await this.torrentService.magnetInfo(link)
      } catch {
        return null
      }

      const title = item.title?.toLowerCase()?.includes(`${query}`.toLowerCase())
        ? item.title
        : `${query ?? ''} ${item.title}`
      return {
        title,
        link,
        date: DateFormatter.toDate(dateIgnoreWeekday, 'DD MMM YYYY HH:mm:ss ZZ'),
      }
    }
    const maxParallelRequest = 1
    for (const item of json.rss.channel.item) {
      promises.push(processItem(item))
      if (promises.length >= maxParallelRequest) {
        const responses = await Promise.all(promises)
        for (const response of responses) {
          if (!response) continue
          yield response
        }
        promises.length = 0
      }
    }
    if (promises.length) {
      const responses = await Promise.all(promises)
      for (const response of responses) {
        if (!response) continue
        yield response
      }
    }

    this.logger.log('Extractor Nyaa -> end')
  }

  async isAcceptInNyaa(url: string): Promise<boolean> {
    try {
      const page = await axios.get(url).then((res) => res.data)
      const html = load(page)
      const tableDescription = html('#torrent-description')
      const listTags = this.acceptedTags
      for (const item of tableDescription) {
        if (item.children.length === 1) {
          const child = item.children[0] as any
          if (!child?.data) continue
          const text = child.data?.toLowerCase()
          if (!text) continue
          const textSplited = text.split('\n').filter((item: string) => !!item)
          const subtitle = textSplited.find((item: string) => item.includes('subtitle'))
          if (!subtitle) continue
          if (!listTags.some((tag) => subtitle.replace(/\*/gm, '').includes(tag))) continue
          return true
        }
      }
      return false
    } catch {
      return false
    }
  }
}
