import { BadRequestException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'

import { StatusController } from './status.controller'
import { StatusService } from './status.service'

const makeStatusServiceMock = () => ({ getStatus: jest.fn() })

describe('StatusController', () => {
  let controller: StatusController
  let statusService: ReturnType<typeof makeStatusServiceMock>

  beforeEach(async () => {
    statusService = makeStatusServiceMock()

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatusController],
      providers: [{ provide: StatusService, useValue: statusService }],
    }).compile()

    controller = module.get(StatusController)
  })

  it('retorna 200 com dados quando banco está disponível', async () => {
    const payload = {
      database: { version: '16.2', maxConnections: 100, activeConnections: 1 },
      qbittorrent: { version: 'v5.1.4', apiVersion: '2.11.4' },
    }
    statusService.getStatus.mockResolvedValue(payload)

    const result = await controller.getStatus()

    expect(result).toEqual(payload)
  })

  it('lança BadRequestException quando banco falha', async () => {
    const payload = {
      database: { error: 'Connection refused' },
      qbittorrent: { version: 'v5.1.4', apiVersion: '2.11.4' },
    }
    statusService.getStatus.mockResolvedValue(payload)

    await expect(controller.getStatus()).rejects.toThrow(BadRequestException)
  })

  it('BadRequestException contém o payload completo na response', async () => {
    const payload = {
      database: { error: 'Connection refused' },
      qbittorrent: { version: 'v5.1.4', apiVersion: '2.11.4' },
    }
    statusService.getStatus.mockResolvedValue(payload)

    await expect(controller.getStatus()).rejects.toMatchObject(new BadRequestException(payload))
  })
})
