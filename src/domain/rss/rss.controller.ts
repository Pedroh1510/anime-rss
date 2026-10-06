import { Body, Controller, Get, Header, Post, Query, Res } from '@nestjs/common'
import { ApiQuery, ApiTags } from '@nestjs/swagger'
import { Response } from 'express'
import { RssService } from './rss.service'
import { CreateRssItemDto } from './dto/create-rss-item.dto'

@ApiTags('RSS')
@Controller('rss')
export class RssController {
  constructor(private readonly rssService: RssService) {}

  @Get()
  @Header('Content-Type', 'application/xml')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @ApiQuery({ name: 'term', required: false, type: String })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'scanAllItems', required: false, type: Boolean })
  @ApiQuery({ name: 'isScan', required: false, type: Boolean })
  async listAsXml(@Query() query: Record<string, string>, @Res() res: Response) {
    const data = await this.rssService.listAsXml(query)
    res.send(data)
  }

  @Get('json')
  @ApiQuery({ name: 'term', required: false, type: String })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'scanAllItems', required: false, type: Boolean })
  @ApiQuery({ name: 'isScan', required: false, type: Boolean })
  async list(@Query() query: Record<string, string>) {
    return this.rssService.list(query)
  }

  @Get('all')
  async listAll() {
    return this.rssService.listAll()
  }

  @Get('amount')
  async count() {
    return this.rssService.count()
  }

  @Post()
  async create(@Body() body: CreateRssItemDto) {
    return this.rssService.create({ title: body.title, magnet: body.magnet })
  }
}
