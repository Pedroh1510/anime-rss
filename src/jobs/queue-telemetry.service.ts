import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { Queue } from 'bullmq'

import { registerQueueGauges } from '../infra/telemetry/jobs'

/** Publishes the queue gauges (app.queue.jobs, app.queue.oldest_waiting_age) for the three queues. */
@Injectable()
export class QueueTelemetryService implements OnModuleInit {
  constructor(
    @InjectQueue('Anime process') private readonly animeQueue: Queue,
    @InjectQueue('Adm Anime') private readonly admAnimeQueue: Queue,
    @InjectQueue('Scan process') private readonly scanQueue: Queue
  ) {}

  onModuleInit(): void {
    registerQueueGauges(() => [this.animeQueue, this.admAnimeQueue, this.scanQueue])
  }
}
