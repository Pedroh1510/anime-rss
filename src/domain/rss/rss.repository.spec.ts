import { Test, TestingModule } from '@nestjs/testing'
import { RssRepository } from './rss.repository'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ConflictException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../infra/database/prisma.service'

const makePrismaMock = () => ({
  torrent: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn(),
  },
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

  describe('create', () => {
    const data = { title: 'Frieren - 01', magnet: 'magnet:?xt=urn:btih:abc', pubDate: new Date('2026-10-05T12:00:00Z') }

    it('create insere o torrent', async () => {
      prisma.torrent.create.mockResolvedValue({ id: 1, ...data })

      await expect(repository.create(data)).resolves.toEqual({ id: 1, ...data })
      expect(prisma.torrent.create).toHaveBeenCalledWith({ data })
    })

    it('create converte P2002 em ConflictException', async () => {
      prisma.torrent.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6' })
      )

      const error = await repository.create(data).catch((e) => e)
      expect(error).toBeInstanceOf(ConflictException)
      expect(error.message).toEqual('Torrent with title Frieren - 01 already exists')
    })

    it('create relança erros que não são P2002', async () => {
      const original = new Error('db down')
      prisma.torrent.create.mockRejectedValue(original)

      await expect(repository.create(data)).rejects.toBe(original)
    })

    it('schema mantém title único em Torrent', () => {
      const schema = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf-8')
      const torrentModel = schema.match(/model Torrent \{[^}]*\}/)?.[0] ?? ''
      expect(torrentModel).toMatch(/title\s+String\s+@unique/)
    })
  })
})
