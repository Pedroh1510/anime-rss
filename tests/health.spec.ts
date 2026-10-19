import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { HealthController } from '../src/domain/health/health.controller'
import { HealthResult, HealthService } from '../src/domain/health/health.service'

class FakeHealthService {
  result: HealthResult = { healthy: true, checks: { database: 'ok', redis: 'ok' } }
  check = jest.fn(async () => this.result)
}

describe('HealthController (integration)', () => {
  let app: INestApplication
  const healthService = new FakeHealthService()

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthService }],
    }).compile()
    app = module.createNestApplication()
    await app.init()
  })

  afterAll(() => app.close())

  it('GET /health → 200 quando dependências estão ok', async () => {
    healthService.result = { healthy: true, checks: { database: 'ok', redis: 'ok' } }
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', checks: { database: 'ok', redis: 'ok' } })
  })

  it('GET /health → 503 quando alguma dependência falha', async () => {
    healthService.result = { healthy: false, checks: { database: { error: 'down' }, redis: 'ok' } }
    const res = await request(app.getHttpServer()).get('/health').expect(503)
    expect(res.body).toEqual({ status: 'error', checks: { database: { error: 'down' }, redis: 'ok' } })
  })
})
