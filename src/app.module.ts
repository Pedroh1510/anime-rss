import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { AdmModule } from './domain/adm/adm.module'
import { ExtractorModule } from './domain/extractor/extractor.module'
import { QueuesModule } from './domain/queues/queues.module'
import { RssModule } from './domain/rss/rss.module'
import { SharedModule } from './domain/shared/shared.module'
import { StatusModule } from './domain/status/status.module'
import { TorznabModule } from './domain/torznab/torznab.module'
import { DatabaseModule } from './infra/database/database.module'
import { JobsModule } from './jobs/jobs.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env.development', '.env'] }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    DatabaseModule,
    SharedModule,
    StatusModule,
    ExtractorModule,
    RssModule,
    AdmModule,
    TorznabModule,
    JobsModule,
    QueuesModule,
  ],
})
export class AppModule {}
