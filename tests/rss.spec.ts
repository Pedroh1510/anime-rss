import request from 'supertest'
import { Test } from '@nestjs/testing'
import { ConflictException, INestApplication } from '@nestjs/common'
import { RssController } from '../src/domain/rss/rss.controller'
import { RssService } from '../src/domain/rss/rss.service'
import { applyGlobalPipes } from '../src/app.setup'

const mockRssService = {
  listAsXml: jest.fn().mockResolvedValue('<rss/>'),
  list: jest.fn().mockResolvedValue([]),
  listAll: jest.fn().mockResolvedValue([]),
  count: jest.fn().mockResolvedValue({ total: 0 }),
  create: jest.fn(),
}

describe('RssController (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [RssController],
      providers: [{ provide: RssService, useValue: mockRssService }],
    }).compile()

    app = module.createNestApplication()
    applyGlobalPipes(app)
    await app.init()
  })

  afterAll(() => app.close())

  beforeEach(() => jest.clearAllMocks())

  describe('GET /rss', () => {
    it('retorna 200 com Content-Type application/xml', async () => {
      await request(app.getHttpServer())
        .get('/rss')
        .expect(200)
        .expect('Content-Type', /xml/)
        .expect('<rss/>')
    })

    it('repassa query params para listAsXml', async () => {
      await request(app.getHttpServer())
        .get('/rss?isScan=false&term=naruto')
        .expect(200)
      expect(mockRssService.listAsXml).toHaveBeenCalledWith(
        expect.objectContaining({ isScan: 'false', term: 'naruto' }),
      )
    })
  })

  describe('GET /rss/json', () => {
    it('retorna 200 com array vazio', async () => {
      await request(app.getHttpServer()).get('/rss/json').expect(200).expect([])
    })

    it('repassa query params para list', async () => {
      await request(app.getHttpServer()).get('/rss/json?term=one+piece').expect(200)
      expect(mockRssService.list).toHaveBeenCalledWith(
        expect.objectContaining({ term: 'one piece' }),
      )
    })
  })

  describe('GET /rss/all', () => {
    it('retorna 200 com array vazio', async () => {
      await request(app.getHttpServer()).get('/rss/all').expect(200).expect([])
    })
  })

  describe('GET /rss/amount', () => {
    it('retorna 200 com { total: 0 }', async () => {
      await request(app.getHttpServer())
        .get('/rss/amount')
        .expect(200)
        .expect({ total: 0 })
    })
  })

  describe('POST /rss', () => {
    const HEX_MAGNET = `magnet:?xt=urn:btih:${'a'.repeat(40)}`
    const BASE32_MAGNET = `magnet:?xt=urn:btih:${'A2'.repeat(16)}`
    const created = {
      id: 7,
      title: '[SubsPlease] Frieren - 01 (1080p)',
      magnet: HEX_MAGNET,
      pubDate: '2026-10-05T12:00:00.000Z',
    }
    const post = (body: Record<string, unknown>) =>
      request(app.getHttpServer()).post('/rss').send(body)

    it('POST /rss retorna 201 com o item criado', async () => {
      mockRssService.create.mockResolvedValue(created)

      await post({ title: '  [SubsPlease] Frieren - 01 (1080p)  ', magnet: HEX_MAGNET })
        .expect(201)
        .expect(created)
      expect(mockRssService.create).toHaveBeenCalledWith({
        title: '[SubsPlease] Frieren - 01 (1080p)',
        magnet: HEX_MAGNET,
      })
    })

    it('POST /rss rejeita magnet fora do formato', async () => {
      const invalid = [
        'http://x',
        'magnet:?xt=urn:btih:abc',
        `magnet:?xt=urn:sha1:${'a'.repeat(40)}`,
        '',
      ]
      for (const magnet of invalid) {
        const response = await post({ title: 'Frieren', magnet }).expect(400)
        expect(JSON.stringify(response.body.message)).toContain('magnet')
      }
      expect(mockRssService.create).not.toHaveBeenCalled()
    })

    it('POST /rss aceita hash hex de 40 e base32 de 32', async () => {
      mockRssService.create.mockResolvedValue(created)

      await post({ title: 'Frieren hex', magnet: HEX_MAGNET }).expect(201)
      await post({ title: 'Frieren base32', magnet: BASE32_MAGNET }).expect(201)
    })

    it('POST /rss valida o título', async () => {
      mockRssService.create.mockResolvedValue(created)
      const invalid = [
        { magnet: HEX_MAGNET },
        { title: '   ', magnet: HEX_MAGNET },
        { title: 'x'.repeat(501), magnet: HEX_MAGNET },
      ]
      for (const body of invalid) {
        const response = await post(body).expect(400)
        expect(JSON.stringify(response.body.message)).toContain('title')
      }
      expect(mockRssService.create).not.toHaveBeenCalled()

      await post({ title: 'x'.repeat(500), magnet: HEX_MAGNET }).expect(201)
    })

    it('POST /rss retorna 409 para título duplicado', async () => {
      mockRssService.create.mockRejectedValue(
        new ConflictException('Torrent with title Frieren already exists'),
      )

      await post({ title: 'Frieren', magnet: HEX_MAGNET })
        .expect(409)
        .expect((response) => {
          expect(response.body).toMatchObject({
            statusCode: 409,
            message: 'Torrent with title Frieren already exists',
          })
        })
    })

    it('POST /rss retorna 500 em erro inesperado', async () => {
      mockRssService.create.mockRejectedValue(new Error('db down'))

      await post({ title: 'Frieren', magnet: HEX_MAGNET }).expect(500)
    })
  })
})
