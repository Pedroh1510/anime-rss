import { Module } from '@nestjs/common'

import { BittorrentService } from '../../infra/service/bittorrent.service'
import { StatusController } from './status.controller'
import { StatusService } from './status.service'

@Module({
  controllers: [StatusController],
  providers: [StatusService, BittorrentService],
})
export class StatusModule {}
