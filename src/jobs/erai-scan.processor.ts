import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'

import { EraiGuardRepository } from '../domain/extractor/erai/erai-guard.repository'
import { ERAI_SCAN_QUEUE, EraiScanJobData } from '../domain/extractor/erai/erai-scan-job.service'
import { ExtractorService } from '../domain/extractor/extractor.service'
import { countSourceError } from '../infra/telemetry/business'
import { withJobMetrics } from '../infra/telemetry/jobs'

const DEFAULT_ERAI_RATE_MS = 60_000

/**
 * Minimum gap between two Erai requests. Read from the process env because the
 * worker limiter is fixed when the decorator runs, before ConfigModule loads .env files.
 * @example eraiRateMs({ ERAI_RATE_MS: '120000' }) // 120000
 */
export function eraiRateMs(env: NodeJS.ProcessEnv = process.env): number {
  const configured = Number(env.ERAI_RATE_MS)
  return configured > 0 ? configured : DEFAULT_ERAI_RATE_MS
}

// concurrency 1 + limiter: a burst of Sonarr searches becomes one Erai request per ERAI_RATE_MS.
@Processor(ERAI_SCAN_QUEUE, { concurrency: 1, limiter: { max: 1, duration: eraiRateMs() } })
export class EraiScanProcessor extends WorkerHost {
  private readonly logger = new Logger(EraiScanProcessor.name)

  constructor(
    private readonly extractorService: ExtractorService,
    private readonly guard: EraiGuardRepository
  ) {
    super()
  }

  private readonly run = withJobMetrics(ERAI_SCAN_QUEUE, async (job: Job<EraiScanJobData>) => {
    const { term } = job.data
    if (await this.guard.isLocked()) {
      countSourceError({ source: 'erai', status: 'locked' })
      this.logger.log(`eraiScanJob dropped, source locked term=${term ?? '<recent>'}`)
      return
    }
    const saved = await this.extractorService.runErai(term)
    this.logger.log(`eraiScanJob end term=${term ?? '<recent>'} saved=${saved}`)
  })

  async process(job: Job<EraiScanJobData>): Promise<void> {
    return this.run(job)
  }

  /** After the last retry, frees the term so a later Sonarr search can try again. */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<EraiScanJobData>): Promise<void> {
    const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 1)
    if (!isLastAttempt || !job.data.term) return
    this.logger.warn(`eraiScanJob gave up term=${job.data.term}; cooldown released`)
    await this.guard.releaseTerm(job.data.term)
  }
}
