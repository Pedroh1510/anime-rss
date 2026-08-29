import request from 'supertest'
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { TorznabController } from '../src/domain/torznab/torznab.controller'
import { TorznabService } from '../src/domain/torznab/torznab.service'

const mockTorznabService = {
  handle: jest.fn().mockResolvedValue('<rss/>'),
}

describe('TorznabController (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TorznabController],
      providers: [{ provide: TorznabService, useValue: mockTorznabService }],
    }).compile()

    app = module.createNestApplication()
    await app.init()
  })

  afterAll(() => app.close())

  beforeEach(() => jest.clearAllMocks())

  describe('GET /torznab', () => {
    it('retorna 200 com Content-Type application/xml', async () => {
      await request(app.getHttpServer()).get('/torznab').expect(200).expect('Content-Type', /xml/).expect('<rss/>')
    })

    it('repassa t=caps para o service', async () => {
      await request(app.getHttpServer()).get('/torznab?t=caps').expect(200)
      expect(mockTorznabService.handle).toHaveBeenCalledWith(expect.objectContaining({ t: 'caps' }))
    })

    it('repassa t=tvsearch com q, season, ep, offset e limit', async () => {
      await request(app.getHttpServer())
        .get('/torznab?t=tvsearch&q=naruto&season=1&ep=5&offset=20&limit=50')
        .expect(200)
      expect(mockTorznabService.handle).toHaveBeenCalledWith(
        expect.objectContaining({ t: 'tvsearch', q: 'naruto', season: '1', ep: '5', offset: '20', limit: '50' })
      )
    })
  })
})
