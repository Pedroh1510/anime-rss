import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../infra/database/prisma.service'

@Injectable()
export class AdmRepository {
  constructor(private readonly prisma: PrismaService) {}

  async *listAll() {
    const total = await this.prisma.torrent.count({})
    const pageSize = 100
    for (let skip = 0; skip < total; skip += pageSize) {
      const rows = await this.prisma.torrent.findMany({ take: pageSize, skip })
      for (const row of rows) yield row
    }
  }

  async insert(data: { magnet: string; pubDate: Date; title: string }) {
    await this.prisma.torrent.create({ data })
  }

  async deleteAll() {
    await this.prisma.torrent.deleteMany()
  }

  async insertAcceptedTags(data: { tag: string }[]) {
    await this.prisma.acceptedTags.createMany({ data })
  }

  async insertVerifyTags(data: { tag: string }[]) {
    await this.prisma.verifyTags.createMany({ data })
  }

  async listAcceptedTags() {
    return this.prisma.acceptedTags.findMany({ select: { tag: true } })
  }

  async listVerifyTags() {
    return this.prisma.verifyTags.findMany({ select: { tag: true } })
  }
}
