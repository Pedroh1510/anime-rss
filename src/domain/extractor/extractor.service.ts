import { Injectable, Logger } from '@nestjs/common'

import { countPipelineEvent } from '../../infra/telemetry/business'
import { TorrentService } from '../shared/torrent.service'
import { AnimeToshoService } from './anime-tosho.service'
import { EraiService } from './erai.service'
import { ExtractorRepository } from './extractor.repository'
import { MoeService } from './moe.service'
import { N8nService } from './n8n.service'
import { NyaaService } from './nyaa.service'

@Injectable()
export class ExtractorService {
  private readonly logger = new Logger(ExtractorService.name)

  constructor(
    private readonly repository: ExtractorRepository,
    private readonly torrentService: TorrentService,
    private readonly moeService: MoeService,
    private readonly nyaaService: NyaaService,
    private readonly animeToshoService: AnimeToshoService,
    private readonly eraiService: EraiService,
    private readonly n8nService: N8nService
  ) {}

  private async executeExtractor(
    source: string,
    generatorFn: () => AsyncGenerator<{ title: string; link: string; date: Date }>
  ): Promise<number> {
    let counter = 0
    for await (const item of generatorFn()) {
      countPipelineEvent('rss.items.fetched', { source, result: 'ok' })
      try {
        await this.torrentService.magnetInfo(item.link)
        await this.repository.save(item)
        countPipelineEvent('rss.items.saved', { source, result: 'ok' })
        counter++
      } catch (e) {
        countPipelineEvent('rss.items.saved', { source, result: 'fail' })
        this.logger.warn(`executeExtractor error: ${(e as Error)?.message}`)
      }
    }
    return counter
  }

  async scan({ total }: { total?: number }) {
    const results = await Promise.all([
      this.executeExtractor('moe', () => this.moeService.extractor(total)),
      this.executeExtractor('nyaa', () => this.nyaaService.extractor(undefined, true)),
      this.executeExtractor('anime-tosho', () => this.animeToshoService.extractor()),
      this.executeExtractor('erai', () => this.eraiService.extractor()),
    ])
    this.logger.log(`scan end ${results.reduce((a, b) => a + b, 0)}`)
  }

  async scanFull(): Promise<number> {
    const results = await Promise.all([
      this.executeExtractor('moe', () => this.moeService.extractor()),
      this.executeExtractor('moe', () => this.moeService.extractorAll()),
      this.executeExtractor('nyaa', () => this.nyaaService.extractor(undefined, true)),
      this.executeExtractor('anime-tosho', () => this.animeToshoService.extractor()),
      this.executeExtractor('erai', () => this.eraiService.extractor()),
    ])
    return results.reduce((a, b) => a + b, 0)
  }

  async extractorRss(query: any, scanAllItems = false) {
    if (!query) return
    await Promise.all([
      this.executeExtractor('nyaa', () => this.nyaaService.extractor(query, scanAllItems)),
      this.executeExtractor('anime-tosho', () => this.animeToshoService.extractor(query)),
      this.executeExtractor('n8n', () => this.n8nService.extractor()),
    ])
  }

  async scanBySite(site: string, filters: any): Promise<number> {
    const fromTo: Record<string, { source: string; run: () => AsyncGenerator<any> }> = {
      nyaa: { source: 'nyaa', run: () => this.nyaaService.extractor(filters, true) },
      tosho: { source: 'anime-tosho', run: () => this.animeToshoService.extractor() },
      erai: { source: 'erai', run: () => this.eraiService.extractor() },
      n8n: { source: 'n8n', run: () => this.n8nService.extractor() },
    }
    // Own keys only: `site` comes from the request, and inherited names like `constructor` would resolve too.
    // The metric source comes from this table, never from the request.
    const extractor = Object.hasOwn(fromTo, site) ? fromTo[site] : undefined
    if (!extractor) throw new Error('Site not supported or invalid method')
    return this.executeExtractor(extractor.source, extractor.run)
  }

  async listSeries(site: string) {
    if (site !== 'n8n') throw new Error('Site not supported or invalid method')
    return this.n8nService.listSeries()
  }

  async scanEps({ link, name, site }: { link: string; name: string; site: string }): Promise<number> {
    if (site !== 'n8n') throw new Error('Site not supported or invalid method')
    return this.executeExtractor('n8n', () => this.n8nService.listEps({ link, name }))
  }
}
