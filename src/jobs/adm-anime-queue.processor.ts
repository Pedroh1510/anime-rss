import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'

import { AdmService } from '../domain/adm/adm.service'

@Processor('Adm Anime', { concurrency: 1 })
export class AdmAnimeQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(AdmAnimeQueueProcessor.name)

  constructor(private readonly admService: AdmService) {
    super()
  }

  async process(_job: Job): Promise<void> {
    this.logger.log('startCron admAnimeQueueJob')
    await this.admService.deleteFiles().catch((e: Error) => {
      this.logger.error(`${e.message}\n${e.stack}`)
    })
    this.logger.log('endCron admAnimeQueueJob')
  }
}
