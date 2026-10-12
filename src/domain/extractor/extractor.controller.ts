import { Controller, Get, Param, Query, Res } from '@nestjs/common'
import { ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger'
import { Response } from 'express'

import { ExtractorService } from './extractor.service'

@ApiTags('Extractor')
@Controller('extractor')
export class ExtractorController {
  constructor(private readonly extractorService: ExtractorService) {}

  @Get('scan')
  @ApiQuery({ name: 'total', required: false, type: Number })
  async scan(@Query() query: { total?: string }, @Res() res: Response) {
    await this.extractorService.scan({ total: query.total ? Number(query.total) : undefined })
    res.send('ok')
  }

  @Get('scan-all')
  async scanFull() {
    const total = await this.extractorService.scanFull()
    return { total }
  }

  @Get(':site/list/series/eps')
  @ApiParam({ name: 'site', type: String })
  @ApiQuery({ name: 'name', required: true, type: String })
  @ApiQuery({ name: 'link', required: true, type: String })
  async scanEps(@Param('site') site: string, @Query() query: { name: string; link: string }) {
    const total = await this.extractorService.scanEps({ ...query, site })
    return { total }
  }

  @Get(':site/list/series')
  @ApiParam({ name: 'site', type: String })
  async listSeries(@Param('site') site: string) {
    return this.extractorService.listSeries(site)
  }

  @Get(':site')
  @ApiParam({ name: 'site', type: String })
  async scanBySite(@Param('site') site: string, @Query() query: Record<string, string>) {
    const total = await this.extractorService.scanBySite(site, query)
    return { total }
  }
}
