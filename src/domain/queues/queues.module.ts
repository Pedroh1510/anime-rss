import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { QUEUE_NAMES } from './queue-names'
import { QueuesSummaryController } from './queues-summary.controller'
import { QueuesSummaryService } from './queues-summary.service'

@Module({
  imports: [BullModule.registerQueue(...QUEUE_NAMES.map((name) => ({ name })))],
  controllers: [QueuesSummaryController],
  providers: [QueuesSummaryService],
})
export class QueuesModule {}
