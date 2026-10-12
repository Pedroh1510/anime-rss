import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Redis } from 'ioredis'

@Injectable()
export class ScanTtlRepository {
  private readonly redis: Redis

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis({
      host: this.config.get('REDIS_HOST', '127.0.0.1'),
      port: parseInt(this.config.get('REDIS_PORT', '6379')),
    })
  }

  async getLastScan(term: string | undefined): Promise<string | null> {
    return this.redis.get(`scan:ttl:${term}`)
  }

  async setLastScan(term: string | undefined): Promise<void> {
    const ttlSeconds = this.config.get<number>('SCAN_TTL_MINUTES', 15) * 60
    await this.redis.set(`scan:ttl:${term}`, new Date().toISOString(), 'EX', ttlSeconds)
  }

  async clearAll(): Promise<void> {
    const keys = await this.redis.keys('scan:ttl:*')
    if (keys.length) await this.redis.del(keys)
  }
}
