import { Module } from '@nestjs/common'
import { TorznabController } from './torznab.controller'
import { TorznabService } from './torznab.service'
import { TorznabRepository } from './torznab.repository'

@Module({
  controllers: [TorznabController],
  providers: [TorznabService, TorznabRepository],
})
export class TorznabModule {}
