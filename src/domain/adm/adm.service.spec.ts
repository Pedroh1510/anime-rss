import { Test, TestingModule } from '@nestjs/testing'

import { BittorrentService } from '../../infra/service/bittorrent.service'
import { ScanTtlRepository } from '../extractor/repository/scan-ttl.repository'
import { CsvService } from '../shared/csv.service'
import { AdmRepository } from './adm.repository'
import { AdmService } from './adm.service'

const makeAdmRepo = () => ({
  listAll: jest.fn(async function* () {}),
  insert: jest.fn().mockResolvedValue(undefined),
  deleteAll: jest.fn().mockResolvedValue(undefined),
  insertAcceptedTags: jest.fn().mockResolvedValue(undefined),
  insertVerifyTags: jest.fn().mockResolvedValue(undefined),
  listAcceptedTags: jest.fn().mockResolvedValue([]),
  listVerifyTags: jest.fn().mockResolvedValue([]),
})

const makeBittorrentService = () => ({
  listTorrents: jest.fn().mockResolvedValue([]),
  listTorrentsConcluded: jest.fn().mockResolvedValue([]),
  stopTorrents: jest.fn().mockResolvedValue(undefined),
  deleteTorrents: jest.fn().mockResolvedValue(undefined),
})

const makeScanTtlRepo = () => ({
  clearAll: jest.fn().mockResolvedValue(undefined),
})

const makeCsvService = () => ({
  jsonToCsvStream: jest.fn(),
  csvToJson: jest.fn(),
})

const buildModule = async (overrides: Record<string, any> = {}) => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AdmService,
      { provide: AdmRepository, useValue: overrides.repository ?? makeAdmRepo() },
      { provide: BittorrentService, useValue: overrides.bittorrentService ?? makeBittorrentService() },
      { provide: CsvService, useValue: overrides.csvService ?? makeCsvService() },
      { provide: ScanTtlRepository, useValue: overrides.scanTtlRepository ?? makeScanTtlRepo() },
    ],
  }).compile()

  return {
    service: module.get(AdmService),
    repository: module.get(AdmRepository) as jest.Mocked<AdmRepository>,
    bittorrentService: module.get(BittorrentService) as jest.Mocked<BittorrentService>,
    scanTtlRepository: module.get(ScanTtlRepository) as jest.Mocked<ScanTtlRepository>,
  }
}

describe('AdmService', () => {
  describe('deleteRss', () => {
    it('should call repository.deleteAll', async () => {
      const { service, repository } = await buildModule()
      await service.deleteRss()
      expect(repository.deleteAll).toHaveBeenCalled()
    })
  })

  describe('insertTags', () => {
    it('should insert accepted and verify tags', async () => {
      const { service, repository } = await buildModule()
      await service.insertTags({ acceptedTags: ['tag1'], verifyTags: ['tag2'] })
      expect(repository.insertAcceptedTags).toHaveBeenCalledWith([{ tag: 'tag1' }])
      expect(repository.insertVerifyTags).toHaveBeenCalledWith([{ tag: 'tag2' }])
    })

    it('should not call insert when arrays are empty', async () => {
      const { service, repository } = await buildModule()
      await service.insertTags({})
      expect(repository.insertAcceptedTags).not.toHaveBeenCalled()
      expect(repository.insertVerifyTags).not.toHaveBeenCalled()
    })
  })

  describe('listTags', () => {
    it('should return verifyTags and acceptedTags', async () => {
      const { service, repository } = await buildModule()
      ;(repository.listAcceptedTags as jest.Mock).mockResolvedValue([{ tag: 'a' }])
      ;(repository.listVerifyTags as jest.Mock).mockResolvedValue([{ tag: 'b' }])
      await expect(service.listTags()).resolves.toEqual({
        acceptedTags: [{ tag: 'a' }],
        verifyTags: [{ tag: 'b' }],
      })
    })
  })

  describe('deleteFiles', () => {
    it('should return zero totals when no concluded torrents', async () => {
      const { service } = await buildModule()
      await expect(service.deleteFiles()).resolves.toEqual({ total: 0, totalDeleted: 0 })
    })

    it('should delete expired torrents (>2h)', async () => {
      const expired = new Date(Date.now() - 3 * 60 * 60 * 1000)
      const { service, bittorrentService } = await buildModule()
      ;(bittorrentService.listTorrentsConcluded as jest.Mock).mockResolvedValue([
        { hash: 'abc', name: 'Anime.ep01', dateCompleted: expired },
      ])
      const result = await service.deleteFiles()
      expect(result.totalDeleted).toBe(1)
      expect(bittorrentService.deleteTorrents).toHaveBeenCalledWith(['abc'])
    })
  })

  describe('clearScanCache', () => {
    it('should call scanTtlRepository.clearAll', async () => {
      const { service, scanTtlRepository } = await buildModule()
      await service.clearScanCache()
      expect(scanTtlRepository.clearAll).toHaveBeenCalled()
    })
  })

  describe('listTorrents', () => {
    it('retorna lista do bittorrentService', async () => {
      const torrent = {
        hash: 'abc',
        name: 'A',
        availability: 1,
        state: 'seeding',
        progress: 1,
        isCompleted: true,
        dateCompleted: new Date(),
      }
      const { service, bittorrentService } = await buildModule()
      bittorrentService.listTorrents.mockResolvedValue([torrent])
      await expect(service.listTorrents()).resolves.toEqual([torrent])
    })
  })

  describe('listConcludedTorrents', () => {
    it('retorna lista do bittorrentService', async () => {
      const torrent = {
        hash: 'abc',
        name: 'A',
        availability: 1,
        state: 'seeding',
        progress: 1,
        isCompleted: true,
        dateCompleted: new Date(),
      }
      const { service, bittorrentService } = await buildModule()
      bittorrentService.listTorrentsConcluded.mockResolvedValue([torrent])
      await expect(service.listConcludedTorrents()).resolves.toEqual([torrent])
    })
  })

  describe('stopTorrent', () => {
    it('chama bittorrentService.stopTorrents com o hash', async () => {
      const { service, bittorrentService } = await buildModule()
      await service.stopTorrent('abc123')
      expect(bittorrentService.stopTorrents).toHaveBeenCalledWith('abc123')
    })

    it('lança BadRequestException quando bittorrentService falha', async () => {
      const { service, bittorrentService } = await buildModule()
      bittorrentService.stopTorrents.mockRejectedValue(new Error('connection refused'))
      await expect(service.stopTorrent('abc123')).rejects.toMatchObject({
        message: 'connection refused',
        status: 400,
      })
    })
  })

  describe('deleteTorrent', () => {
    it('chama bittorrentService.deleteTorrents com array de um hash', async () => {
      const { service, bittorrentService } = await buildModule()
      await service.deleteTorrent('abc123')
      expect(bittorrentService.deleteTorrents).toHaveBeenCalledWith(['abc123'])
    })

    it('lança BadRequestException quando bittorrentService falha', async () => {
      const { service, bittorrentService } = await buildModule()
      bittorrentService.deleteTorrents.mockRejectedValue(new Error('not found'))
      await expect(service.deleteTorrent('abc123')).rejects.toMatchObject({
        message: 'not found',
        status: 400,
      })
    })
  })
})
