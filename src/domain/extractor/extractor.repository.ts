import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../infra/database/prisma.service'

@Injectable()
export class ExtractorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(item: { title: string; link: string; date: Date }): Promise<void> {
    await this.prisma.torrent
      .upsert({
        where: { title: item.title },
        create: { magnet: item.link, title: item.title, pubDate: item.date },
        update: {},
      })
      .catch(() => {})
  }

  async listTags() {
    return {
      accepted: await this.prisma.acceptedTags.findMany({ select: { tag: true } }),
      verify: await this.prisma.verifyTags.findMany({ select: { tag: true } }),
    }
  }
}
