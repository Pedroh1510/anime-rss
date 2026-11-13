import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Redis } from 'ioredis'

import { EraiService } from './erai.service'
import { AxiosEraiHttp, ERAI_HTTP, EraiFeedClient } from './erai/erai-feed.client'
import { ERAI_GUARD_REDIS, EraiGuardRepository } from './erai/erai-guard.repository'
import { ERAI_SCAN_QUEUE, EraiScanJobService } from './erai/erai-scan-job.service'
import { ExtractorController } from './extractor.controller'
import { ExtractorRepository } from './extractor.repository'
import { ExtractorService } from './extractor.service'
import { MoeService } from './moe.service'
import { NyaaService } from './nyaa.service'
import { ScanTtlRepository } from './repository/scan-ttl.repository'
import { ScanJobService } from './scan-job.service'

@Module({
  imports: [BullModule.registerQueue({ name: 'Scan process' }, { name: ERAI_SCAN_QUEUE })],
  controllers: [ExtractorController],
  providers: [
    ExtractorService,
    ExtractorRepository,
    ScanJobService,
    ScanTtlRepository,
    MoeService,
    NyaaService,
    EraiService,
    EraiFeedClient,
    EraiGuardRepository,
    EraiScanJobService,
    { provide: ERAI_HTTP, useClass: AxiosEraiHttp },
    {
      provide: ERAI_GUARD_REDIS,
      inject: [ConfigService],
      // lazyConnect: specs that build the module never open a socket unless the guard is used.
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.get('REDIS_HOST', '127.0.0.1'),
          port: parseInt(config.get('REDIS_PORT', '6379')),
          lazyConnect: true,
        }),
    },
  ],
  exports: [ScanJobService, ExtractorService, EraiGuardRepository],
})
export class ExtractorModule {}
