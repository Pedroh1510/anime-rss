import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../infra/database/prisma.service'
import { BittorrentService } from '../../infra/service/bittorrent.service'

type DatabaseOk = { version: string; maxConnections: number; activeConnections: number }
type DatabaseError = { error: string }
type QbittorrentOk = { version: string; apiVersion: string }
type QbittorrentError = { error: string }

export type StatusResult = {
  database: DatabaseOk | DatabaseError
  qbittorrent: QbittorrentOk | QbittorrentError
}

@Injectable()
export class StatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bittorrent: BittorrentService
  ) {}

  async getStatus(): Promise<StatusResult> {
    const [database, qbittorrent] = await Promise.all([this.getDatabaseStatus(), this.getQbittorrentStatus()])

    return { database, qbittorrent }
  }

  private async getDatabaseStatus(): Promise<DatabaseOk | DatabaseError> {
    try {
      const [versionRow] = await this.prisma.$queryRaw<[{ server_version: string }]>`SHOW server_version`
      const [maxConnRow] = await this.prisma.$queryRaw<[{ max_connections: string }]>`SHOW max_connections`
      const [activeRow] = await this.prisma.$queryRaw<
        [{ count: bigint }]
      >`SELECT count(*) as count FROM pg_stat_activity`

      return {
        version: versionRow.server_version,
        maxConnections: parseInt(maxConnRow.max_connections, 10),
        activeConnections: Number(activeRow.count),
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }

  private async getQbittorrentStatus(): Promise<QbittorrentOk | QbittorrentError> {
    try {
      const { appVersion, apiVersion } = await this.bittorrent.getServerInfo()
      return { version: appVersion, apiVersion }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }
}
