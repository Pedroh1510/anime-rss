import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'

import { EraiService } from './erai.service'
import { ExtractorController } from './extractor.controller'
import { ExtractorRepository } from './extractor.repository'
import { ExtractorService } from './extractor.service'
import { MoeService } from './moe.service'
import { NyaaService } from './nyaa.service'
import { ScanTtlRepository } from './repository/scan-ttl.repository'
import { ScanJobService } from './scan-job.service'

@Module({
  imports: [BullModule.registerQueue({ name: 'Scan process' })],
  controllers: [ExtractorController],
  providers: [
    ExtractorService,
    ExtractorRepository,
    ScanJobService,
    ScanTtlRepository,
    MoeService,
    NyaaService,
    EraiService,
  ],
  exports: [ScanJobService, ExtractorService],
})
export class ExtractorModule {}
