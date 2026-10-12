import { BadRequestException, INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { Readable } from 'node:stream'
import request from 'supertest'

import { AdmController } from '../src/domain/adm/adm.controller'
import { AdmService } from '../src/domain/adm/adm.service'

const mockAdmService = {
  deleteFiles: jest.fn().mockResolvedValue({ total: 0, totalDeleted: 0 }),
  deleteRss: jest.fn().mockResolvedValue(undefined),
  exportData: jest.fn().mockReturnValue({
    fileName: 'data.csv',
    stream: Readable.from([]),
  }),
  importData: jest.fn().mockResolvedValue({ totalInserted: 0 }),
  listTags: jest.fn().mockResolvedValue({ acceptedTags: [], verifyTags: [] }),
  insertTags: jest.fn().mockResolvedValue(undefined),
  clearScanCache: jest.fn().mockResolvedValue(undefined),
  listTorrents: jest.fn().mockResolvedValue([]),
  listConcludedTorrents: jest.fn().mockResolvedValue([]),
  stopTorrent: jest.fn().mockResolvedValue(undefined),
  deleteTorrent: jest.fn().mockResolvedValue(undefined),
}

describe('AdmController (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdmController],
      providers: [{ provide: AdmService, useValue: mockAdmService }],
    }).compile()

    app = module.createNestApplication()
    await app.init()
  })

  afterAll(() => app.close())

  beforeEach(() => jest.clearAllMocks())

  describe('GET /adm/delete', () => {
    it('retorna 200 com totais', async () => {
      await request(app.getHttpServer()).get('/adm/delete').expect(200).expect({ total: 0, totalDeleted: 0 })
    })
  })

  describe('GET /adm/delete-rss', () => {
    it('retorna 200 com body vazio', async () => {
      const res = await request(app.getHttpServer()).get('/adm/delete-rss').expect(200)
      expect(res.body).toEqual({})
      expect(mockAdmService.deleteRss).toHaveBeenCalled()
    })
  })

  describe('GET /adm/export-data', () => {
    it('retorna 200 com header Content-Disposition attachment', async () => {
      const res = await request(app.getHttpServer()).get('/adm/export-data').expect(200)
      expect(res.headers['content-disposition']).toMatch(/attachment/)
    })
  })

  describe('POST /adm/import-data', () => {
    it('retorna 201 com { totalInserted: 0 }', async () => {
      await request(app.getHttpServer()).post('/adm/import-data').send('').expect(201).expect({ totalInserted: 0 })
      expect(mockAdmService.importData).toHaveBeenCalledWith(expect.objectContaining({ fileStream: expect.anything() }))
    })
  })

  describe('GET /adm/tags', () => {
    it('retorna 200 com listas de tags', async () => {
      await request(app.getHttpServer()).get('/adm/tags').expect(200).expect({ acceptedTags: [], verifyTags: [] })
    })
  })

  describe('POST /adm/tags', () => {
    it('retorna 201 com body vazio', async () => {
      await request(app.getHttpServer())
        .post('/adm/tags')
        .send({ acceptedTags: ['shounen'], verifyTags: [] })
        .expect(201)
      expect(mockAdmService.insertTags).toHaveBeenCalledWith({
        acceptedTags: ['shounen'],
        verifyTags: [],
      })
    })
  })

  describe('POST /adm/cache-clean', () => {
    it('retorna 202 com body vazio', async () => {
      await request(app.getHttpServer()).post('/adm/cache-clean').expect(202)
      expect(mockAdmService.clearScanCache).toHaveBeenCalled()
    })
  })

  describe('GET /adm/torrents/concluded', () => {
    it('retorna 204 quando lista vazia', async () => {
      mockAdmService.listConcludedTorrents.mockResolvedValue([])
      await request(app.getHttpServer()).get('/adm/torrents/concluded').expect(204)
    })

    it('retorna 200 com lista quando há torrents', async () => {
      const torrent = {
        hash: 'abc',
        name: 'A',
        availability: 1,
        state: 'seeding',
        progress: 1,
        dateCompleted: new Date().toISOString(),
      }
      mockAdmService.listConcludedTorrents.mockResolvedValue([torrent])
      await request(app.getHttpServer()).get('/adm/torrents/concluded').expect(200).expect([torrent])
    })
  })

  describe('GET /adm/torrents', () => {
    it('retorna 204 quando lista vazia', async () => {
      mockAdmService.listTorrents.mockResolvedValue([])
      await request(app.getHttpServer()).get('/adm/torrents').expect(204)
    })

    it('retorna 200 com lista quando há torrents', async () => {
      const torrent = {
        hash: 'xyz',
        name: 'B',
        availability: 0.5,
        state: 'downloading',
        progress: 0.5,
        dateCompleted: new Date().toISOString(),
      }
      mockAdmService.listTorrents.mockResolvedValue([torrent])
      await request(app.getHttpServer()).get('/adm/torrents').expect(200).expect([torrent])
    })
  })

  describe('PATCH /adm/torrents/:hash/stop', () => {
    it('retorna 200 quando para o torrent com sucesso', async () => {
      mockAdmService.stopTorrent.mockResolvedValue(undefined)
      await request(app.getHttpServer()).patch('/adm/torrents/abc123/stop').expect(200)
      expect(mockAdmService.stopTorrent).toHaveBeenCalledWith('abc123')
    })

    it('retorna 400 quando o serviço falha', async () => {
      mockAdmService.stopTorrent.mockRejectedValue(new BadRequestException('connection refused'))
      await request(app.getHttpServer()).patch('/adm/torrents/abc123/stop').expect(400)
    })
  })

  describe('DELETE /adm/torrents/:hash', () => {
    it('retorna 200 quando deleta o torrent com sucesso', async () => {
      mockAdmService.deleteTorrent.mockResolvedValue(undefined)
      await request(app.getHttpServer()).delete('/adm/torrents/abc123').expect(200)
      expect(mockAdmService.deleteTorrent).toHaveBeenCalledWith('abc123')
    })

    it('retorna 400 quando o serviço falha', async () => {
      mockAdmService.deleteTorrent.mockRejectedValue(new BadRequestException('not found'))
      await request(app.getHttpServer()).delete('/adm/torrents/abc123').expect(400)
    })
  })
})
