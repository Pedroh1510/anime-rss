import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PassThrough, Readable, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { BittorrentService } from '../../infra/service/bittorrent.service'
import { DateFormatter } from '../../utils/date-formatter'
import { ScanTtlRepository } from '../extractor/repository/scan-ttl.repository'
import { CsvService } from '../shared/csv.service'
import { AdmRepository } from './adm.repository'

@Injectable()
export class AdmService {
  private readonly logger = new Logger(AdmService.name)

  constructor(
    private readonly csvService: CsvService,
    private readonly bittorrentService: BittorrentService,
    private readonly repository: AdmRepository,
    private readonly scanTtlRepository: ScanTtlRepository
  ) {}

  async deleteFiles() {
    const listTorrents = await this.bittorrentService.listTorrentsConcluded()
    this.logger.log(`Total de torrents concluidos ${listTorrents.length}`)

    const stopped = []
    for (const torrent of listTorrents) {
      await this.bittorrentService
        .stopTorrents(torrent.hash)
        .then(() => stopped.push(torrent))
        .catch((e: any) => this.logger.error(`erro ao parar torrent ${torrent.name}: ${e.message}`))
    }

    const maxHours = 2
    const expired = stopped.filter((item: any) => DateFormatter.diff(Date.now(), item.dateCompleted, 'hour') > maxHours)

    if (!expired.length) return { total: stopped.length, totalDeleted: 0 }

    await this.bittorrentService.deleteTorrents(expired.map((item: any) => item.hash))
    return {
      total: stopped.length,
      totalDeleted: expired.length,
      deleted: expired.map(({ name }: { name: string }) => name),
    }
  }

  exportData() {
    const read = Readable.from(this.repository.listAll())
    return {
      fileName: 'data.csv',
      stream: read.pipe(this.csvService.jsonToCsvStream({ objectMode: true })).pipe(new PassThrough()),
    }
  }

  async deleteRss() {
    await this.repository.deleteAll()
  }

  async importData({ fileStream }: { fileStream: NodeJS.ReadableStream }) {
    let totalInserted = 0
    await pipeline(
      fileStream as any,
      this.csvService.csvToJson(),
      new Writable({
        objectMode: true,
        write: async (chunk, _, cb) => {
          await this.repository
            .insert(chunk)
            .then(() => totalInserted++)
            .catch(() => {})
          cb(null)
        },
      })
    )
    return { totalInserted }
  }

  async insertTags({ acceptedTags, verifyTags }: { acceptedTags?: string[]; verifyTags?: string[] }) {
    if (acceptedTags?.length) {
      await this.repository.insertAcceptedTags(acceptedTags.map((tag) => ({ tag }))).catch(() => {})
    }
    if (verifyTags?.length) {
      await this.repository.insertVerifyTags(verifyTags.map((tag) => ({ tag }))).catch(() => {})
    }
  }

  async listTags() {
    return {
      verifyTags: await this.repository.listVerifyTags(),
      acceptedTags: await this.repository.listAcceptedTags(),
    }
  }

  async clearScanCache() {
    await this.scanTtlRepository.clearAll()
  }

  async listTorrents() {
    return this.bittorrentService.listTorrents()
  }

  async listConcludedTorrents() {
    return this.bittorrentService.listTorrentsConcluded()
  }

  async stopTorrent(hash: string): Promise<void> {
    await this.bittorrentService.stopTorrents(hash).catch((e: any) => {
      throw new BadRequestException(e.message)
    })
  }

  async deleteTorrent(hash: string): Promise<void> {
    await this.bittorrentService.deleteTorrents([hash]).catch((e: any) => {
      throw new BadRequestException(e.message)
    })
  }
}
