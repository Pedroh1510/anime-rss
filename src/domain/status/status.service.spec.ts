import { Test, TestingModule } from '@nestjs/testing'

import { PrismaService } from '../../infra/database/prisma.service'
import { BittorrentService } from '../../infra/service/bittorrent.service'
import { StatusService } from './status.service'

const makePrismaMock = () => ({ $queryRaw: jest.fn() })
const makeBittorrentMock = () => ({ getServerInfo: jest.fn() })

describe('StatusService', () => {
  let service: StatusService
  let prisma: ReturnType<typeof makePrismaMock>
  let bittorrent: ReturnType<typeof makeBittorrentMock>

  beforeEach(async () => {
    prisma = makePrismaMock()
    bittorrent = makeBittorrentMock()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatusService,
        { provide: PrismaService, useValue: prisma },
        { provide: BittorrentService, useValue: bittorrent },
      ],
    }).compile()

    service = module.get(StatusService)
  })

  describe('database info', () => {
    beforeEach(() => {
      bittorrent.getServerInfo.mockResolvedValue({ appVersion: 'v5.1.4', apiVersion: '2.11.4' })
    })

    it('retorna version, maxConnections e activeConnections quando DB está disponível', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ server_version: '16.2' }])
        .mockResolvedValueOnce([{ max_connections: '100' }])
        .mockResolvedValueOnce([{ count: BigInt(3) }])

      const result = await service.getStatus()

      expect(result.database).toEqual({
        version: '16.2',
        maxConnections: 100,
        activeConnections: 3,
      })
    })

    it('retorna error no campo database quando DB falha', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('Connection refused'))

      const result = await service.getStatus()

      expect(result.database).toEqual({ error: 'Connection refused' })
    })
  })

  describe('qbittorrent info', () => {
    beforeEach(() => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ server_version: '16.2' }])
        .mockResolvedValueOnce([{ max_connections: '100' }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
    })

    it('retorna version e apiVersion quando qBittorrent está disponível', async () => {
      bittorrent.getServerInfo.mockResolvedValue({ appVersion: 'v5.1.4', apiVersion: '2.11.4' })

      const result = await service.getStatus()

      expect(result.qbittorrent).toEqual({ version: 'v5.1.4', apiVersion: '2.11.4' })
    })

    it('retorna error no campo qbittorrent quando serviço falha', async () => {
      bittorrent.getServerInfo.mockRejectedValue(new Error('qBittorrent unreachable'))

      const result = await service.getStatus()

      expect(result.qbittorrent).toEqual({ error: 'qBittorrent unreachable' })
    })
  })

  it('retorna ambos com error quando DB e qBittorrent falham', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('DB down'))
    bittorrent.getServerInfo.mockRejectedValue(new Error('QB down'))

    const result = await service.getStatus()

    expect(result).toEqual({
      database: { error: 'DB down' },
      qbittorrent: { error: 'QB down' },
    })
  })
})
