import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import { BittorrentService } from './bittorrent.service'

const makeClient = () => ({
  getAllData: jest.fn(),
  removeTorrent: jest.fn().mockResolvedValue(undefined),
  stopTorrent: jest.fn().mockResolvedValue(undefined),
})

jest.mock('@ctrl/qbittorrent', () => ({
  QBittorrent: jest.fn().mockImplementation(() => makeClient()),
}))

const buildModule = async () => {
  const module = await Test.createTestingModule({
    providers: [BittorrentService, { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('mock') } }],
  }).compile()
  return { service: module.get(BittorrentService) }
}

describe('BittorrentService', () => {
  describe('listTorrents', () => {
    it('mapeia dados crus para o tipo Torrent', async () => {
      const { service } = await buildModule()
      const raw = {
        id: 'abc123',
        name: 'Anime.S01E01',
        availability: 1,
        state: 'seeding',
        progress: 1,
        isCompleted: true,
        dateCompleted: new Date(1700000000 * 1000).toISOString(),
      }
      ;(service as any).client.getAllData = jest.fn().mockResolvedValue({ torrents: [raw] })
      const result = await service.listTorrents()
      expect(result).toEqual([
        {
          hash: 'abc123',
          name: 'Anime.S01E01',
          availability: 1,
          state: 'seeding',
          progress: 1,
          isCompleted: true,
          dateCompleted: new Date(1700000000 * 1000),
        },
      ])
    })
  })

  describe('listTorrentsConcluded', () => {
    it('retorna apenas torrents concluídos', async () => {
      const { service } = await buildModule()
      const old = {
        id: 'old',
        name: 'Old',
        availability: 1,
        state: 'seeding',
        progress: 1,
        isCompleted: false,
        completion_on: 1609459200,
      } // 2021
      const recent = {
        id: 'new',
        name: 'New',
        availability: 1,
        state: 'seeding',
        progress: 1,
        isCompleted: true,
        completion_on: 1704067200,
      } // 2024
      ;(service as any).client.getAllData = jest.fn().mockResolvedValue({ torrents: [old, recent] })
      const result = await service.listTorrentsConcluded()
      expect(result).toHaveLength(1)
      expect(result[0].hash).toBe('new')
    })
  })
})
