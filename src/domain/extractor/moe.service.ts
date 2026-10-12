import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { load } from 'cheerio'

import { ExtractorRepository } from './extractor.repository'
import { NyaaService } from './nyaa.service'

const moeApi = axios.create({ baseURL: 'https://magnets.moe' })

@Injectable()
export class MoeService {
  private readonly logger = new Logger(MoeService.name)
  private acceptedTags: string[] = []

  constructor(
    private readonly nyaaService: NyaaService,
    private readonly repository: ExtractorRepository
  ) {}

  private async process(url: string) {
    const page = await moeApi.get(url).then((res) => res.data)
    const html = load(page)
    const pageDate = html('body > h3').text()
    const blocks = html('body > div')

    const listData: { title: string; link: string; pubDate: string; hour: string }[] = []
    const listVerify: string[] = []
    const isAccept = (text: string) => this.acceptedTags.some((tag) => text.toLowerCase().includes(tag))
    blocks.each(function (this: any) {
      const hour = html(this).text()
      const pageTags = html(this).find('a')
      const paragraphs = pageTags
        .map((_: any, e: any) => {
          if (e.attribs?.href && e.attribs.href.includes('magnet')) {
            return e.attribs?.href
          }
          if (e.children.length > 0 && e.children[0]?.data) {
            return e.children[0]?.data
          }
          return null
        })
        .toArray()
        .filter((e: any) => e !== null)
      if (paragraphs.length !== 2) {
        return
      }
      if (paragraphs[1].trim() === '') {
        return
      }
      const text = paragraphs[1].toLowerCase()
      if (isAccept(text)) {
        listData.push({
          title: paragraphs[1],
          link: paragraphs[0],
          pubDate: pageDate,
          hour,
        })
        return
      }
      pageTags.map((_: any, item: any) => {
        if (item.attribs?.href && item.attribs.href.startsWith('/torrent/')) {
          listVerify.push(item.attribs.href)
        }
      })
    })
    const nextUrl = html('body > p:nth-child(3) > a:nth-child(2)').attr('href')
    return { nextUrl, listData, listVerify }
  }

  private async processPageItem(uri: string) {
    try {
      const page = await moeApi.get(uri).then((res) => res.data)
      const html = load(page)
      const title = html('body > p:nth-child(2) > b').text()
      const pageDate = html('body > p:nth-child(4)').text()
      let linkNyaa: string | null = null
      html('body > p:nth-child(5) > a').each((_: any, item: any) => {
        if (item.attribs?.href && item.attribs.href.startsWith('https://nyaa') && !linkNyaa) {
          linkNyaa = item.attribs.href
        }
      })
      const magnet = html('body > p:nth-child(6) > a')
      if (!magnet.length) return null
      const link = magnet[0].attribs.href
      if (!linkNyaa) return null
      const isAccept = await this.nyaaService.isAcceptInNyaa(linkNyaa)
      if (!isAccept) return null
      const pubDate = pageDate.replace('Upload date: ', '')
      return { title, link, pubDate, hour: pubDate.split(' ')[1] }
    } catch {
      return null
    }
  }

  private format({ hour, link, pubDate, title }: { hour: string; link: string; pubDate: string; title: string }): {
    title: string
    link: string
    date: Date
  } {
    const date = pubDate.substring(0, 10)
    const dateFormatted = new Date(`${date} ${hour.substring(0, 5)}:00:000z`)
    return {
      date: dateFormatted,
      link,
      title,
    }
  }

  async *extractor(total = 2): AsyncGenerator<{ title: string; link: string; date: Date }> {
    this.logger.log('Extractor Moe -> start')
    let url = `/new`

    const { accepted, verify } = await this.repository.listTags()
    this.acceptedTags = accepted.map((item) => item.tag)
    this.nyaaService.verifyTags = verify.map((item) => item.tag)
    this.nyaaService.acceptedTags = this.acceptedTags

    for (let index = 0; index < total; index++) {
      let newurl = ''
      try {
        const { nextUrl, listData, listVerify } = await this.process(url)
        if (nextUrl) newurl = nextUrl
        for (const item of listData) {
          yield this.format(item)
        }
        for (const item of listVerify) {
          const response = await this.processPageItem(item)
          if (!response) continue
          yield this.format(response)
        }
      } catch (e) {
        this.logger.error(e)
        continue
      }
      if (!newurl) {
        break
      }
      url = `${newurl}`
    }

    this.logger.log('Extractor Moe -> end')
  }

  private async processInPageShow(uri: string): Promise<any[]> {
    let page: any = null
    for (let i = 0; i < 3; i++) {
      try {
        page = await moeApi.get(uri).then((res) => res.data)
        break
      } catch {}
    }
    if (!page) throw new Error('Falha na busca')
    const html = load(page)
    const pageDate = html('body > h3').first().text()
    const blocksAll = html('body > div')
    const blocks = blocksAll.filter((_: any, block: any) =>
      block.children.some((child: any) => child?.attribs?.href && child.attribs?.href.startsWith('magnet:?'))
    )
    const regexHour = /(\d){2}:(\d){2} \|/
    const response: any[] = []
    const promises: Promise<any>[] = []
    const processBlock = async (block: any) => {
      const data: any = {
        pubDate: pageDate,
      }
      try {
        let uriToPageItem: string | null = null
        for (const child of block.children) {
          if (child.attribs?.href?.startsWith('magnet:?')) {
            data.link = child.attribs.href
          } else if (child.attribs?.href?.startsWith('/torrent') && child.children?.length) {
            data.title = child.children[0]?.data
            uriToPageItem = child.attribs.href
          } else if (regexHour.test(child?.data)) {
            data.hour = regexHour.exec(child.data)![0].replaceAll('|', '').trim()
          }
        }
        if (!data.link || !data.title || !data.hour) return null
        if (this.acceptedTags.some((tag) => data.title.includes(tag))) {
          response.push(data)
          return null
        }
        const result = await this.processPageItem(uriToPageItem!)
        if (!result) return null
        response.push(result)
      } catch {
        return null
      }
    }
    for (const block of blocks) {
      promises.push(processBlock(block))
      if (promises.length >= 10) {
        await Promise.all(promises)
        promises.length = 0
      }
    }
    await Promise.all(promises)
    const nextUrl = html('body > p:nth-child(8) > a:nth-child(2)').attr('href')
    if (!nextUrl) return response
    return response.concat(await this.processInPageShow(nextUrl))
  }

  private async listHref(): Promise<string[]> {
    const page = await moeApi.get(`/shows`).then((res) => res.data)
    const html = load(page)
    const blocks = html('body > div:nth-child(4)')
    const listHref = new Set<string>()
    blocks.children().each((_: any, i: any) => {
      for (const element of i.children) {
        if (!element.attribs?.id) continue
        if (!element.attribs.id?.startsWith('element')) continue
        for (const child of element.children) {
          if (!child.attribs?.href) continue
          if (!child.attribs.href.startsWith('/show/')) continue
          listHref.add(child.attribs.href)
        }
      }
    })
    return [...listHref].sort((a, b) => {
      const w = parseInt(a.split('/').pop()!)
      const q = parseInt(b.split('/').pop()!)
      return w - q
    })
  }

  async *extractorAll(): AsyncGenerator<{ title: string; link: string; date: Date }> {
    this.logger.log('extractorAll - start')
    const list = await this.listHref()
    const limit = 20
    const promises: Promise<any[]>[] = []
    this.logger.log(`extractorAll - total ${list.length}`)
    for (let index = 0; index < list.length; index++) {
      const item = list[index]
      promises.push(this.processInPageShow(item))
      if (promises.length < limit) continue
      const responses = await Promise.all(promises)
      this.logger.log(`${index + 1}/${list.length} -> batch ${limit}`)
      for (const response of responses) {
        if (!response.length) continue
        for (const item of response) {
          yield this.format(item)
        }
      }
      promises.length = 0
    }
    const responses = await Promise.all(promises)
    for (const response of responses) {
      if (!response.length) continue
      for (const item of response) {
        yield this.format(item)
      }
    }
    this.logger.log('extractorAll - end')
  }
}
