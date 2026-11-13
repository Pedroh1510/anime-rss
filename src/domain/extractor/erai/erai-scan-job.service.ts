import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { JobsOptions, Queue } from 'bullmq'
import { createHash } from 'node:crypto'

import { countSourceError } from '../../../infra/telemetry/business'
import { EraiGuardRepository, normalizeEraiTerm } from './erai-guard.repository'

export const ERAI_SCAN_QUEUE = 'Scan erai'

export interface EraiScanJobData {
  /** Normalized search term; absent for the recent-releases feed. */
  term?: string
}

const RETRY_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 60_000 },
  removeOnComplete: true,
  // A retained failed job would make a later add() with the same jobId a silent no-op.
  removeOnFail: true,
}

// Hash, not a slug: a slug collapsed non-Latin titles and punctuation variants into one id,
// and add() with an id already waiting is a silent no-op.
function termJobId(term: string): string {
  return `erai-term-${createHash('sha1').update(term).digest('hex').slice(0, 16)}`
}

/**
 * Single entry point for every Erai request. The `Scan erai` worker is rate limited,
 * so callers only enqueue; the lock and the term cooldown stop jobs before they exist.
 */
@Injectable()
export class EraiScanJobService {
  constructor(
    @InjectQueue(ERAI_SCAN_QUEUE) private readonly queue: Queue<EraiScanJobData>,
    private readonly guard: EraiGuardRepository
  ) {}

  /** @example await eraiScanJobService.enqueueRecent() // hourly cron, scan-all, /extractor/erai */
  async enqueueRecent(): Promise<void> {
    if (await this.isLocked()) return
    await this.queue.add('recent', {}, { ...RETRY_OPTIONS, jobId: 'erai-recent' })
  }

  /** @example await eraiScanJobService.enqueueTerm('frieren') // Sonarr /rss?q= search */
  async enqueueTerm(rawTerm: string | undefined): Promise<void> {
    const term = normalizeEraiTerm(rawTerm ?? '')
    if (!term) return
    if (await this.isLocked()) return
    if (!(await this.guard.claimTerm(term))) return
    try {
      await this.queue.add('term', { term }, { ...RETRY_OPTIONS, jobId: termJobId(term) })
    } catch (error) {
      // No job exists, so the 24h cooldown would block the term for nothing.
      await this.guard.releaseTerm(term)
      throw error
    }
  }

  private async isLocked(): Promise<boolean> {
    if (!(await this.guard.isLocked())) return false
    countSourceError({ source: 'erai', status: 'locked' })
    return true
  }
}
