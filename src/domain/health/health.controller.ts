import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { HealthService } from './health.service'

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth() {
    const { healthy, checks } = await this.healthService.check()
    if (!healthy) throw new ServiceUnavailableException({ status: 'error', checks })
    return { status: 'ok', checks }
  }
}
