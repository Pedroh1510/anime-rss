import { Controller, Get, Header, Query, Res } from '@nestjs/common'
import { ApiQuery, ApiTags } from '@nestjs/swagger'
import { Response } from 'express'
import { TorznabService } from './torznab.service'

@ApiTags('Torznab')
@Controller('torznab')
export class TorznabController {
  constructor(private readonly torznabService: TorznabService) {}

  @Get()
  @Header('Content-Type', 'application/xml')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @ApiQuery({ name: 't', required: false, type: String, description: 'caps | search | tvsearch' })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'season', required: false, type: String })
  @ApiQuery({ name: 'ep', required: false, type: String })
  @ApiQuery({ name: 'cat', required: false, type: String })
  @ApiQuery({ name: 'offset', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: String })
  async handle(@Query() query: Record<string, string>, @Res() res: Response) {
    const data = await this.torznabService.handle(query)
    res.send(data)
  }
}
