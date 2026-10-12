import { Module } from '@nestjs/common'

import { BittorrentModule } from '../../infra/service/bittorrent.module'
import { ScanTtlRepository } from '../extractor/repository/scan-ttl.repository'
import { AdmController } from './adm.controller'
import { AdmRepository } from './adm.repository'
import { AdmService } from './adm.service'

@Module({
  imports: [BittorrentModule],
  controllers: [AdmController],
  providers: [AdmService, AdmRepository, ScanTtlRepository],
  exports: [AdmService],
})
export class AdmModule {}
