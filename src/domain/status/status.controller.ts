import { BadRequestException, Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { StatusService } from './status.service'

@ApiTags('Status')
@Controller('status')
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @Get()
  async getStatus() {
    const status = await this.statusService.getStatus()

    if ('error' in status.database) {
      throw new BadRequestException(status)
    }

    return status
  }
}
