import { Injectable, Logger } from '@nestjs/common'

import { countPipelineEvent } from '../../infra/telemetry/business'
import { TorrentService } from '../shared/torrent.service'
import { EraiService } from './erai.service'
import { EraiScanJobService } from './erai/erai-scan-job.service'
import { ExtractorRepository } from './extractor.repository'
import { MoeService } from './moe.service'
import { NyaaService } from './nyaa.service'

@Injectable()
export class ExtractorService {
  private readonly logger = new Logger(ExtractorService.name)

  constructor(
    private readonly repository: ExtractorRepository,
    private readonly torrentService: TorrentService,
    private readonly moeService: MoeService,
    private readonly nyaaService: NyaaService,
    private readonly eraiService: EraiService,
    private readonly eraiScanJob: EraiScanJobService
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
    ])
    await this.eraiScanJob.enqueueRecent()
    this.logger.log(`scan end ${results.reduce((a, b) => a + b, 0)}`)
  }

  async scanFull(): Promise<number> {
    const results = await Promise.all([
      this.executeExtractor('moe', () => this.moeService.extractor()),
      this.executeExtractor('moe', () => this.moeService.extractorAll()),
      this.executeExtractor('nyaa', () => this.nyaaService.extractor(undefined, true)),
    ])
    await this.eraiScanJob.enqueueRecent()
    return results.reduce((a, b) => a + b, 0)
  }

  async extractorRss(query: any, scanAllItems = false) {
    if (!query) return
    await Promise.all([
      this.executeExtractor('nyaa', () => this.nyaaService.extractor(query, scanAllItems)),
      this.eraiScanJob.enqueueTerm(typeof query.q === 'string' ? query.q : undefined),
    ])
  }

  /**
   * Runs one Erai request and saves its items; only the rate-limited `Scan erai` worker calls this.
   * @example await extractorService.runErai('frieren')
   */
  async runErai(term?: string): Promise<number> {
    return this.executeExtractor('erai', () => this.eraiService.extractor(term))
  }

  async scanBySite(site: string, filters: any): Promise<number> {
    // Erai is never called inline: it goes through the rate-limited queue, so nothing is saved yet.
    if (site === 'erai') {
      await this.eraiScanJob.enqueueRecent()
      return 0
    }
    const fromTo: Record<string, { source: string; run: () => AsyncGenerator<any> }> = {
      nyaa: { source: 'nyaa', run: () => this.nyaaService.extractor(filters, true) },
    }
    // Own keys only: `site` comes from the request, and inherited names like `constructor` would resolve too.
    // The metric source comes from this table, never from the request.
    const extractor = Object.hasOwn(fromTo, site) ? fromTo[site] : undefined
    if (!extractor) throw new Error('Site not supported or invalid method')
    return this.executeExtractor(extractor.source, extractor.run)
  }
}
