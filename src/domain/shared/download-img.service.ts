import { Injectable } from '@nestjs/common'
import axios from 'axios'

@Injectable()
export class DownloadImgService {
  async getStream(url: string): Promise<NodeJS.ReadableStream> {
    return axios.get(url, { responseType: 'stream' }).then((response) => response.data)
  }

  async getBuffer(url: string, headers: Record<string, string> = {}): Promise<Buffer> {
    const { origin } = new URL(url)
    return axios
      .get(url, { headers: { Referer: origin, ...headers }, responseType: 'arraybuffer' })
      .then((response) => response.data)
  }
}
