import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'

import { AdmService } from '../domain/adm/adm.service'
import { withJobMetrics } from '../infra/telemetry/jobs'

@Processor('Adm Anime', { concurrency: 1 })
export class AdmAnimeQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(AdmAnimeQueueProcessor.name)

  constructor(private readonly admService: AdmService) {
    super()
  }

  private readonly run = withJobMetrics('Adm Anime', async () => {
    this.logger.log('startCron admAnimeQueueJob')
    await this.admService.deleteFiles().catch((e: Error) => {
      this.logger.error(`${e.message}\n${e.stack}`)
      // rethrown so the job fails in BullMQ and in app.job.duration
      throw e
    })
    this.logger.log('endCron admAnimeQueueJob')
  })

  async process(job: Job): Promise<void> {
    return this.run(job)
  }
}
