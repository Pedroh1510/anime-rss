import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'

import { AdmModule } from '../domain/adm/adm.module'
import { ExtractorModule } from '../domain/extractor/extractor.module'
import { AdmAnimeQueueProcessor } from './adm-anime-queue.processor'
import { AnimeQueueProcessor } from './anime-queue.processor'
import { QueueSchedulerService } from './queue-scheduler.service'
import { QueueTelemetryService } from './queue-telemetry.service'
import { ScanQueueProcessor } from './scan-queue.processor'

@Module({
  imports: [
    BullModule.registerQueue({ name: 'Anime process' }, { name: 'Adm Anime' }, { name: 'Scan process' }),
    ExtractorModule,
    AdmModule,
  ],
  providers: [
    AnimeQueueProcessor,
    AdmAnimeQueueProcessor,
    ScanQueueProcessor,
    QueueSchedulerService,
    QueueTelemetryService,
  ],
  exports: [QueueSchedulerService],
})
export class JobsModule {}
