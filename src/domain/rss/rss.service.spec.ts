import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { RssService } from './rss.service'
import { RssRepository } from './rss.repository'
import { XmlService } from '../shared/xml.service'
import { TorrentService } from '../shared/torrent.service'
import { ScanJobService } from '../extractor/scan-job.service'

const makeRssRepo = () => ({
  list: jest.fn().mockResolvedValue([]),
  listAll: jest.fn().mockResolvedValue([]),
  count: jest.fn().mockResolvedValue(0),
})

const makeScanJobService = () => ({
  enqueueScan: jest.fn().mockResolvedValue(undefined),
})

const makeXmlService = () => ({
  buildToRss: jest.fn().mockReturnValue('<rss/>'),
})

const makeTorrentService = () => ({
  magnetInfo: jest.fn().mockResolvedValue('hash123'),
})

const makeConfigService = () => ({
  get: jest.fn().mockImplementation((_key: string, def: any) => def),
})

const buildModule = async (overrides: Record<string, any> = {}) => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      RssService,
      { provide: RssRepository, useValue: overrides.repository ?? makeRssRepo() },
      { provide: XmlService, useValue: overrides.xmlService ?? makeXmlService() },
      { provide: TorrentService, useValue: overrides.torrentService ?? makeTorrentService() },
      { provide: ScanJobService, useValue: overrides.scanJobService ?? makeScanJobService() },
      { provide: ConfigService, useValue: overrides.configService ?? makeConfigService() },
    ],
  }).compile()

  return {
    service: module.get(RssService),
    repository: module.get(RssRepository) as jest.Mocked<RssRepository>,
    scanJobService: module.get(ScanJobService) as jest.Mocked<ScanJobService>,
    xmlService: module.get(XmlService) as jest.Mocked<XmlService>,
  }
}

describe('RssService', () => {
  describe('count', () => {
    it('should return total from repository', async () => {
      const { service, repository } = await buildModule()
      ;(repository.count as jest.Mock).mockResolvedValue(42)
      await expect(service.count()).resolves.toEqual({ total: 42 })
    })
  })

  describe('listAll', () => {
    it('should delegate to repository.listAll', async () => {
      const { service, repository } = await buildModule()
      ;(repository.listAll as jest.Mock).mockResolvedValue([{ id: 1 }])
      await expect(service.listAll()).resolves.toEqual([{ id: 1 }])
    })
  })

  describe('list', () => {
    it('should call enqueueScan when isScan is true', async () => {
      const { service, scanJobService } = await buildModule()
      await service.list({ term: 'One Piece S01', isScan: 'true' })
      expect(scanJobService.enqueueScan).toHaveBeenCalledWith('One Piece', { scanAllItems: true })
    })

    it('should not call enqueueScan when isScan is false', async () => {
      const { service, scanJobService } = await buildModule()
      await service.list({ term: 'One Piece', isScan: false })
      expect(scanJobService.enqueueScan).not.toHaveBeenCalled()
    })

    it('should return items even when enqueueScan throws', async () => {
      const scanJobService = makeScanJobService()
      ;(scanJobService.enqueueScan as jest.Mock).mockRejectedValue(new Error('Custom Id cannot contain :'))
      const repository = makeRssRepo()
      ;(repository.list as jest.Mock).mockResolvedValue([
        { id: 1, magnet: 'magnet:?xt=urn:btih:abc', title: 'Re:Zero' },
      ])
      const { service } = await buildModule({ scanJobService, repository })
      const result = await service.list({ term: 'Re:Zero', isScan: 'true' })
      expect(result).toHaveLength(1)
    })

    it('should return empty array when repository returns empty', async () => {
      const { service } = await buildModule()
      const result = await service.list({ isScan: false })
      expect(result).toEqual([])
    })

    it('should build items in parallel and preserve input order', async () => {
      const repository = makeRssRepo()
      ;(repository.list as jest.Mock).mockResolvedValue([
        { id: 1, magnet: 'magnet:?xt=urn:btih:aaa', title: 'A' },
        { id: 2, magnet: 'magnet:?xt=urn:btih:bbb', title: 'B' },
        { id: 3, magnet: 'magnet:?xt=urn:btih:ccc', title: 'C' },
      ])
      const torrentService = makeTorrentService()
      let inFlight = 0
      let maxInFlight = 0
      ;(torrentService.magnetInfo as jest.Mock).mockImplementation(async (magnet: string) => {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        await Promise.resolve()
        inFlight--
        return `hash-${magnet}`
      })
      const { service } = await buildModule({ repository, torrentService })

      const result = await service.list({ isScan: false })

      expect(maxInFlight).toBeGreaterThan(1)
      expect(result.map((item: any) => item.title)).toEqual(['A', 'B', 'C'])
    })

    it('should skip item and keep others when magnetInfo fails for one item', async () => {
      const repository = makeRssRepo()
      ;(repository.list as jest.Mock).mockResolvedValue([
        { id: 1, magnet: 'magnet:?xt=urn:btih:aaa', title: 'A' },
        { id: 2, magnet: 'magnet:bad', title: 'B' },
        { id: 3, magnet: 'magnet:?xt=urn:btih:ccc', title: 'C' },
      ])
      const torrentService = makeTorrentService()
      ;(torrentService.magnetInfo as jest.Mock).mockImplementation(async (magnet: string) => {
        if (magnet === 'magnet:bad') throw new Error('parse failed')
        return `hash-${magnet}`
      })
      const { service } = await buildModule({ repository, torrentService })

      const result = await service.list({ isScan: false })

      expect(result.map((item: any) => item.title)).toEqual(['A', 'C'])
    })
  })

  describe('listAsXml', () => {
    it('should return xml string from xmlService', async () => {
      const { service, xmlService } = await buildModule()
      ;(xmlService.buildToRss as jest.Mock).mockReturnValue('<rss><item/></rss>')
      const result = await service.listAsXml({ isScan: false })
      expect(result).toBe('<rss><item/></rss>')
    })
  })
})
