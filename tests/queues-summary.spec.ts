import request from 'supertest'
import { Test } from '@nestjs/testing'
import { INestApplication, ServiceUnavailableException } from '@nestjs/common'
import { getQueueToken } from '@nestjs/bullmq'
import { QueuesSummaryController } from '../src/domain/queues/queues-summary.controller'
import { QueuesSummaryService } from '../src/domain/queues/queues-summary.service'

import { QUEUE_NAMES } from '../src/domain/queues/queue-names'

// Like BullMQ, answers only the job types it is asked for.
class FakeQueue {
  constructor(readonly name: string) {}

  async getJobCounts(...types: string[]) {
    return Object.fromEntries(types.map((type, index) => [type, index]))
  }
}

describe('QueuesSummaryController (integration)', () => {
  let app: INestApplication
  let service: QueuesSummaryService

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [QueuesSummaryController],
      providers: [
        QueuesSummaryService,
        ...QUEUE_NAMES.map((name) => ({ provide: getQueueToken(name), useValue: new FakeQueue(name) })),
      ],
    }).compile()
    app = module.createNestApplication()
    service = module.get(QueuesSummaryService)
    await app.init()
  })

  afterAll(() => app.close())
  afterEach(() => jest.restoreAllMocks())

  it('GET /queues-summary retorna as contagens das 3 filas', async () => {
    const response = await request(app.getHttpServer()).get('/queues-summary').expect(200)

    expect(response.body.map((item: { name: string }) => item.name)).toEqual([
      'Adm Anime',
      'Anime process',
      'Scan process',
    ])
    for (const { counts } of response.body) {
      expect(Object.keys(counts).sort()).toEqual(['active', 'completed', 'delayed', 'failed', 'paused', 'waiting'])
      for (const value of Object.values(counts)) {
        expect(Number.isInteger(value) && (value as number) >= 0).toBe(true)
      }
    }
  })

  it('GET /queues-summary retorna 503 quando o Redis não responde', async () => {
    jest
      .spyOn(service, 'summarize')
      .mockRejectedValue(new ServiceUnavailableException('Queue backend unavailable'))

    await request(app.getHttpServer())
      .get('/queues-summary')
      .expect(503)
      .expect((response) => {
        expect(response.body).toMatchObject({ statusCode: 503, message: 'Queue backend unavailable' })
      })
  })
})
