import { Controller, Get } from '@nestjs/common'
import { ApiResponse, ApiTags } from '@nestjs/swagger'
import { QueuesSummaryService } from './queues-summary.service'

@ApiTags('Status')
@Controller('queues-summary')
export class QueuesSummaryController {
  constructor(private readonly queuesSummaryService: QueuesSummaryService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'Job counts per state for every queue, sorted by name' })
  @ApiResponse({ status: 503, description: 'Redis did not answer within 3000ms' })
  async summarize() {
    return this.queuesSummaryService.summarize()
  }
}
