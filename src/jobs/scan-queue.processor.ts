import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'

import { ExtractorService } from '../domain/extractor/extractor.service'

@Processor('Scan process', { concurrency: 2 })
export class ScanQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(ScanQueueProcessor.name)

  constructor(private readonly extractorService: ExtractorService) {
    super()
  }

  async process(job: Job<{ term: string; scanAllItems: boolean }>): Promise<void> {
    const { term, scanAllItems } = job.data
    this.logger.log(`startCron scanJob term=${term} scanAllItems=${scanAllItems}`)
    await this.extractorService.extractorRss({ q: term }, scanAllItems).catch((e: Error) => {
      this.logger.warn(`scanJob error: ${e.message}`)
    })
    this.logger.log(`endCron scanJob term=${term}`)
  }
}
