import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'

import { ExtractorService } from '../domain/extractor/extractor.service'
import { withJobMetrics } from '../infra/telemetry/jobs'

@Processor('Anime process', { concurrency: 1 })
export class AnimeQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(AnimeQueueProcessor.name)

  constructor(private readonly extractorService: ExtractorService) {
    super()
  }

  private readonly run = withJobMetrics('Anime process', async () => {
    this.logger.log('startCron animeQueueJob')
    await this.extractorService.scan({ total: 5 }).catch((e: Error) => {
      this.logger.warn(`animeQueueJob error: ${e.message}`)
      // rethrown so the job fails in BullMQ and in app.job.duration
      throw e
    })
    this.logger.log('endCron animeQueueJob')
  })

  async process(job: Job): Promise<void> {
    return this.run(job)
  }
}
