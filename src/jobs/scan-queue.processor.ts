import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'

import { ExtractorService } from '../domain/extractor/extractor.service'
import { withJobMetrics } from '../infra/telemetry/jobs'

@Processor('Scan process', { concurrency: 2 })
export class ScanQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(ScanQueueProcessor.name)

  constructor(private readonly extractorService: ExtractorService) {
    super()
  }

  private readonly run = withJobMetrics('Scan process', async (job: Job<{ term: string; scanAllItems: boolean }>) => {
    const { term, scanAllItems } = job.data
    this.logger.log(`startCron scanJob term=${term} scanAllItems=${scanAllItems}`)
    await this.extractorService.extractorRss({ q: term }, scanAllItems).catch((e: Error) => {
      this.logger.warn(`scanJob error: ${e.message}`)
      // rethrown so the job fails in BullMQ and in app.job.duration
      throw e
    })
    this.logger.log(`endCron scanJob term=${term}`)
  })

  async process(job: Job<{ term: string; scanAllItems: boolean }>): Promise<void> {
    return this.run(job)
  }
}
