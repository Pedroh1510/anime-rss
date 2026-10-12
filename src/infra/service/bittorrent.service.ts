import { QBittorrent } from '@ctrl/qbittorrent'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export type Torrent = {
  hash: string
  name: string
  availability: number
  state: string
  progress: number
  isCompleted: boolean
  dateCompleted: Date
}

@Injectable()
export class BittorrentService {
  private readonly client: QBittorrent

  constructor(private readonly config: ConfigService) {
    this.client = new QBittorrent({
      baseUrl: this.config.get('url_torrent'),
      username: this.config.get('user_torrent'),
      password: this.config.get('pass_torrent'),
    })
  }

  private mapTorrent(item: any): Torrent {
    return {
      hash: item.id,
      name: item.name,
      availability: item.availability,
      state: item.state,
      progress: item.progress,
      isCompleted: item.isCompleted,
      dateCompleted: new Date(item.dateCompleted),
    }
  }

  async getServerInfo() {
    const [apiVersion, appVersion] = await Promise.all([this.client.getApiVersion(), this.client.getAppVersion()])
    return { apiVersion, appVersion }
  }

  async listTorrents(): Promise<Torrent[]> {
    const data = await this.client.getAllData()
    return data.torrents.map((item: any) => this.mapTorrent(item))
  }

  async listTorrentsConcluded(): Promise<Torrent[]> {
    const list = await this.listTorrents()
    return list.filter(({ isCompleted }) => isCompleted)
  }

  async deleteTorrents(listHashes: string[]): Promise<void> {
    await this.client.removeTorrent(listHashes, true)
  }

  async stopTorrents(hash: string): Promise<void> {
    try {
      await this.client.stopTorrent(hash)
    } catch (error) {
      throw new Error(
        `Erro ao parar torrent com hash ${hash}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      )
    }
  }
}
