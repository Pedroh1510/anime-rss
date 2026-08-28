import { Injectable } from '@nestjs/common'
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
}
