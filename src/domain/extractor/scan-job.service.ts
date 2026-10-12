import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Queue } from 'bullmq'

import { ScanTtlRepository } from './repository/scan-ttl.repository'

function isWithinTtl(lastScan: string, ttlMinutes: number): boolean {
  return Date.now() - new Date(lastScan).getTime() < ttlMinutes * 60 * 1000
}

@Injectable()
export class ScanJobService {
  constructor(
    @InjectQueue('Scan process') private readonly queue: Queue,
    private readonly ttlRepo: ScanTtlRepository,
    private readonly config: ConfigService
  ) {}

  async enqueueScan(term: string | undefined, options = { scanAllItems: false }): Promise<void> {
    const lastScan = await this.ttlRepo.getLastScan(term)
    const ttl = this.config.get<number>('SCAN_TTL_MINUTES', 15)
    if (lastScan && isWithinTtl(lastScan, ttl)) return

    await this.queue.add(
      'scan',
      { term, ...options },
      {
        jobId: `scan-${term?.replace(/:/g, '-')}`,
        removeOnComplete: true,
      }
    )

    await this.ttlRepo.setLastScan(term)
  }
}
