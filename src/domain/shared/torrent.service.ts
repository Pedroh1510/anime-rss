import { Injectable } from '@nestjs/common'
import axios from 'axios'

// const { default: parseTorrent, toMagnetURI } = require('parse-torrent') as {
//   default: (input: any) => Promise<any>;
//   toMagnetURI: (input: any) => string;
// };
import parseTorrent, { toMagnetURI } from 'parse-torrent'

@Injectable()
export class TorrentService {
  async magnetInfo(url: string): Promise<{ infoHash: string }> {
    const data = await parseTorrent(url)
    return { infoHash: (data as any).infoHash }
  }

  infoHashToMagnet(infoHash: string): string {
    return toMagnetURI({ infoHash })
  }

  async magnetByLinkFile(url: string): Promise<string> {
    const buffer = await this.getBuffer(url)
    const info = await parseTorrent(buffer as Buffer)
    return toMagnetURI({ ...(info as any) })
  }

  private async getBuffer(reqUrl: string): Promise<Buffer> {
    const response = await axios({ method: 'GET', url: reqUrl, responseType: 'stream' }).catch(() => null)
    if (!response || response.status !== 200) {
      throw new Error('Error downloading torrent')
    }
    return this.stream2buffer(response.data)
  }

  private stream2buffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const _buf: Buffer[] = []
      stream.on('data', (chunk: Buffer) => _buf.push(chunk))
      stream.on('end', () => resolve(Buffer.concat(_buf)))
      stream.on('error', (err: Error) => reject(err))
    })
  }
}
