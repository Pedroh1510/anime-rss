import { Module } from '@nestjs/common'

import { ExtractorModule } from '../extractor/extractor.module'
import { RssController } from './rss.controller'
import { RssRepository } from './rss.repository'
import { RssService } from './rss.service'

@Module({
  imports: [ExtractorModule],
  controllers: [RssController],
  providers: [RssService, RssRepository],
})
export class RssModule {}
