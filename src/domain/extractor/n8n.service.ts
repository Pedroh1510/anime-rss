import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'

@Injectable()
export class N8nService {
  private get disable(): boolean {
    return !this.config.get<string>('N8N_URL')
  }

  private get n8nApi() {
    return axios.create({ baseURL: this.config.get<string>('N8N_URL') })
  }

  constructor(private readonly config: ConfigService) {}

  async *extractor(): AsyncGenerator<{ title: string; link: string; date: Date }> {
    if (this.disable) return
    const response = await this.n8nApi
      .get('/darkmaou-ultimos-series-novos-eps')
      .then((response) => response.data)
      .catch(() => null)

    if (!Array.isArray(response)) return
    for (const item of response) {
      for (const links of item.links) {
        for (const link of links) {
          if (!link.includes('magnet')) continue
          yield {
            title: `${item.title} - ${item.ep}`,
            link,
            date: new Date(),
          }
        }
      }
    }
  }

  async listSeries(): Promise<any[]> {
    if (this.disable) return []
    const response = await this.n8nApi.get('/darkmaou-list-series').then((response) => response.data)
    return response ?? []
  }

  async *listEps({
    name,
    link,
  }: {
    name: string
    link: string
  }): AsyncGenerator<{ title: string; link: string; date: Date }> {
    if (this.disable) return
    const response = await this.n8nApi.post('/darkmaou-list-eps', { name, link }).then((response) => response.data)

    if (!Array.isArray(response)) return
    for (const item of response) {
      for (const links of item.links) {
        for (const link of links) {
          if (!link.includes('magnet')) continue
          yield {
            title: `${item.title} - ${item.ep}`,
            link,
            date: new Date(),
          }
        }
      }
    }
  }
}
