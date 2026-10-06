import request from 'supertest'
import { Test } from '@nestjs/testing'
import { INestApplication, ServiceUnavailableException } from '@nestjs/common'
import { QueuesSummaryController } from '../src/domain/queues/queues-summary.controller'
import { QueuesSummaryService } from '../src/domain/queues/queues-summary.service'

const COUNTS = { active: 0, waiting: 1, delayed: 2, failed: 0, completed: 5, paused: 0 }
const SUMMARY = ['Adm Anime', 'Anime process', 'Scan process'].map((name) => ({ name, counts: COUNTS }))

const mockQueuesSummaryService = { summarize: jest.fn() }

describe('QueuesSummaryController (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [QueuesSummaryController],
      providers: [{ provide: QueuesSummaryService, useValue: mockQueuesSummaryService }],
    }).compile()
    app = module.createNestApplication()
    await app.init()
  })

  afterAll(() => app.close())

  it('GET /queues-summary retorna as contagens das 3 filas', async () => {
    mockQueuesSummaryService.summarize.mockResolvedValue(SUMMARY)

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
    mockQueuesSummaryService.summarize.mockRejectedValue(new ServiceUnavailableException('Queue backend unavailable'))

    await request(app.getHttpServer())
      .get('/queues-summary')
      .expect(503)
      .expect((response) => {
        expect(response.body).toMatchObject({ statusCode: 503, message: 'Queue backend unavailable' })
      })
  })
})
