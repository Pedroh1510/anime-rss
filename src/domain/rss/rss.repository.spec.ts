import { Test, TestingModule } from '@nestjs/testing'
import { RssRepository } from './rss.repository'
import { PrismaService } from '../../infra/database/prisma.service'

const makePrismaMock = () => ({
  torrent: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
})

describe('RssRepository', () => {
  let repository: RssRepository
  let prisma: ReturnType<typeof makePrismaMock>

  beforeEach(async () => {
    prisma = makePrismaMock()

    const module: TestingModule = await Test.createTestingModule({
      providers: [RssRepository, { provide: PrismaService, useValue: prisma }],
    }).compile()

    repository = module.get(RssRepository)
  })

  describe('list', () => {
    it('ordena por id desc (ordem de inserção, não pubDate da fonte)', async () => {
      await repository.list({ term: undefined, limit: 100 })
      expect(prisma.torrent.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { id: 'desc' } }))
    })

    it('não aplica limit quando term é informado', async () => {
      await repository.list({ term: 'naruto', limit: undefined })
      expect(prisma.torrent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: undefined,
          where: { title: { contains: 'naruto', mode: 'insensitive' } },
          orderBy: { id: 'desc' },
        })
      )
    })
  })

  describe('listAll', () => {
    it('ordena por id desc com limit 100', async () => {
      await repository.listAll()
      expect(prisma.torrent.findMany).toHaveBeenCalledWith({ take: 100, orderBy: { id: 'desc' } })
    })
  })
})
