import { Module } from '@nestjs/common'

import { BittorrentService } from './bittorrent.service'

@Module({
  providers: [BittorrentService],
  exports: [BittorrentService],
})
export class BittorrentModule {}
