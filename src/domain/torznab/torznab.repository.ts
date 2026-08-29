import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../infra/database/prisma.service'

@Injectable()
export class TorznabRepository {
  constructor(private readonly prisma: PrismaService) {}

  async search({ term, skip, take }: { term?: string; skip: number; take: number }) {
    return this.prisma.torrent.findMany({
      where: term ? { title: { contains: term, mode: 'insensitive' } } : undefined,
      orderBy: { id: 'desc' },
      skip,
      take,
    })
  }

  async count({ term }: { term?: string }) {
    return this.prisma.torrent.count({
      where: term ? { title: { contains: term, mode: 'insensitive' } } : undefined,
    })
  }
}
