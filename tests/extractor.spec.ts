import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { ExtractorController } from '../src/domain/extractor/extractor.controller'
import { ExtractorService } from '../src/domain/extractor/extractor.service'

const mockExtractorService = {
  scan: jest.fn().mockResolvedValue(undefined),
  scanFull: jest.fn().mockResolvedValue(5),
  scanBySite: jest.fn().mockResolvedValue(3),
  listSeries: jest.fn().mockResolvedValue([{ name: 'Naruto' }]),
  scanEps: jest.fn().mockResolvedValue(12),
}

describe('ExtractorController (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ExtractorController],
      providers: [{ provide: ExtractorService, useValue: mockExtractorService }],
    }).compile()

    app = module.createNestApplication()
    await app.init()
  })

  afterAll(() => app.close())

  beforeEach(() => jest.clearAllMocks())

  describe('GET /extractor/scan', () => {
    it('retorna 200 com body "ok"', async () => {
      const res = await request(app.getHttpServer()).get('/extractor/scan').expect(200)
      expect(res.text).toBe('ok')
      expect(mockExtractorService.scan).toHaveBeenCalled()
    })

    it('repassa query param total para service.scan', async () => {
      await request(app.getHttpServer()).get('/extractor/scan?total=10').expect(200)
      expect(mockExtractorService.scan).toHaveBeenCalledWith({ total: 10 })
    })
  })

  describe('GET /extractor/scan-all', () => {
    it('retorna 200 com { total: 5 }', async () => {
      await request(app.getHttpServer()).get('/extractor/scan-all').expect(200).expect({ total: 5 })
    })
  })

  describe('GET /extractor/:site', () => {
    it('retorna 200 com { total: 3 } para site nyaa', async () => {
      await request(app.getHttpServer()).get('/extractor/nyaa').expect(200).expect({ total: 3 })
      expect(mockExtractorService.scanBySite).toHaveBeenCalledWith('nyaa', expect.any(Object))
    })
  })

  describe('GET /extractor/:site/list/series', () => {
    it('retorna 200 com array de series para site n8n', async () => {
      await request(app.getHttpServer())
        .get('/extractor/n8n/list/series')
        .expect(200)
        .expect([{ name: 'Naruto' }])
      expect(mockExtractorService.listSeries).toHaveBeenCalledWith('n8n')
    })
  })

  describe('GET /extractor/:site/list/series/eps', () => {
    it('retorna 200 com { total: 12 } para site n8n', async () => {
      await request(app.getHttpServer())
        .get('/extractor/n8n/list/series/eps?name=Naruto&link=http://example.com')
        .expect(200)
        .expect({ total: 12 })
      expect(mockExtractorService.scanEps).toHaveBeenCalledWith({
        site: 'n8n',
        name: 'Naruto',
        link: 'http://example.com',
      })
    })
  })
})
