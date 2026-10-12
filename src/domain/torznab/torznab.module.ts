import { Module } from '@nestjs/common'

import { TorznabController } from './torznab.controller'
import { TorznabRepository } from './torznab.repository'
import { TorznabService } from './torznab.service'

@Module({
  controllers: [TorznabController],
  providers: [TorznabService, TorznabRepository],
})
export class TorznabModule {}
