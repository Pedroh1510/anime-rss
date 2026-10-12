import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { StatusController } from '../src/domain/status/status.controller'
import { StatusService } from '../src/domain/status/status.service'

const mockStatusResult = {
  database: { version: '16.0', maxConnections: 100, activeConnections: 5 },
  qbittorrent: { version: '5.0.0', apiVersion: '2.9' },
}

const mockStatusService = {
  getStatus: jest.fn().mockResolvedValue(mockStatusResult),
}

describe('StatusController (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [StatusController],
      providers: [{ provide: StatusService, useValue: mockStatusService }],
    }).compile()

    app = module.createNestApplication()
    await app.init()
  })

  afterAll(() => app.close())

  beforeEach(() => jest.clearAllMocks())

  it('GET /status → 200 com dados de database e qbittorrent', async () => {
    mockStatusService.getStatus.mockResolvedValue(mockStatusResult)
    await request(app.getHttpServer()).get('/status').expect(200).expect(mockStatusResult)
  })

  it('GET /status → 400 quando database retorna erro', async () => {
    mockStatusService.getStatus.mockResolvedValue({
      database: { error: 'connection refused' },
      qbittorrent: { version: '5.0.0', apiVersion: '2.9' },
    })
    await request(app.getHttpServer()).get('/status').expect(400)
  })
})
