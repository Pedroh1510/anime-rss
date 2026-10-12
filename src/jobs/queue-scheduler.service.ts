import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { Queue } from 'bullmq'

@Injectable()
export class QueueSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(QueueSchedulerService.name)

  constructor(
    @InjectQueue('Anime process') private readonly animeQueue: Queue,
    @InjectQueue('Adm Anime') private readonly admAnimeQueue: Queue
  ) {}

  async onModuleInit() {
    this.logger.log('Setting up recurring jobs')
    await this.animeQueue.add('cron', null, {
      repeat: { pattern: '30 * * * *' },
      removeOnComplete: true,
      removeOnFail: { age: 1800 },
    })
    await this.admAnimeQueue.add('cron', null, {
      repeat: { pattern: '1 * * * *' },
      removeOnComplete: true,
      removeOnFail: { age: 60 },
    })
  }
}
