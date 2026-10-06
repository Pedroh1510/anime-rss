import { ConflictException, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../infra/database/prisma.service'

@Injectable()
export class RssRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list({ term, limit }: { term?: string; limit?: number }) {
    const termWithoutSeason = term?.split(/s\d/).pop().trim()
    return this.prisma.torrent.findMany({
      take: limit,
      where: termWithoutSeason ? { title: { contains: termWithoutSeason, mode: 'insensitive' } } : undefined,
      orderBy: { id: 'desc' },
    })
  }

  async listAll() {
    return this.prisma.torrent.findMany({ take: 100, orderBy: { id: 'desc' } })
  }

  async count() {
    return this.prisma.torrent.count({})
  }

  // The unique index on Torrent.title is what serializes concurrent creates:
  // the loser gets P2002, mapped to 409.
  async create(data: { title: string; magnet: string; pubDate: Date }) {
    try {
      return await this.prisma.torrent.create({ data })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Torrent with title ${data.title} already exists`)
      }
      throw error
    }
  }
}
