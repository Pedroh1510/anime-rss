import { Test, TestingModule } from '@nestjs/testing'
import { TorznabRepository } from './torznab.repository'
import { PrismaService } from '../../infra/database/prisma.service'

const makePrismaMock = () => ({
  torrent: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
})

describe('TorznabRepository', () => {
  let repository: TorznabRepository
  let prisma: ReturnType<typeof makePrismaMock>

  beforeEach(async () => {
    prisma = makePrismaMock()

    const module: TestingModule = await Test.createTestingModule({
      providers: [TorznabRepository, { provide: PrismaService, useValue: prisma }],
    }).compile()

    repository = module.get(TorznabRepository)
  })

  describe('search', () => {
    it('aplica skip e take, ordena por id desc', async () => {
      await repository.search({ term: undefined, skip: 20, take: 10 })
      expect(prisma.torrent.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { id: 'desc' },
        skip: 20,
        take: 10,
      })
    })

    it('filtra por title contains quando term informado', async () => {
      await repository.search({ term: 'naruto', skip: 0, take: 50 })
      expect(prisma.torrent.findMany).toHaveBeenCalledWith({
        where: { title: { contains: 'naruto', mode: 'insensitive' } },
        orderBy: { id: 'desc' },
        skip: 0,
        take: 50,
      })
    })
  })

  describe('count', () => {
    it('conta sem filtro quando term ausente', async () => {
      await repository.count({ term: undefined })
      expect(prisma.torrent.count).toHaveBeenCalledWith({ where: undefined })
    })

    it('conta com filtro quando term informado', async () => {
      await repository.count({ term: 'naruto' })
      expect(prisma.torrent.count).toHaveBeenCalledWith({
        where: { title: { contains: 'naruto', mode: 'insensitive' } },
      })
    })
  })
})
