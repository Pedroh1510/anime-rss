import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'

import { AnimeToshoService } from './anime-tosho.service'
import { EraiService } from './erai.service'
import { ExtractorController } from './extractor.controller'
import { ExtractorRepository } from './extractor.repository'
import { ExtractorService } from './extractor.service'
import { MoeService } from './moe.service'
import { N8nService } from './n8n.service'
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
    AnimeToshoService,
    EraiService,
    N8nService,
  ],
  exports: [ScanJobService, ExtractorService],
})
export class ExtractorModule {}
