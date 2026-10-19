import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'

import { HealthController } from './health.controller'
import { HEALTH_QUEUE, HealthService } from './health.service'

@Module({
  imports: [BullModule.registerQueue({ name: HEALTH_QUEUE })],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
