import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

/** The subset of ioredis the guard needs; lets specs use a named fake. */
export interface EraiGuardRedis {
  exists(key: string): Promise<number>
  set(key: string, value: string, ex: 'EX', ttlSeconds: number, nx?: 'NX'): Promise<'OK' | null>
  del(key: string): Promise<number>
}

export const ERAI_GUARD_REDIS = Symbol('ERAI_GUARD_REDIS')

const LOCK_KEY = 'erai:locked'
const LOCK_TTL_S = 24 * 60 * 60
const DEFAULT_TERM_COOLDOWN_S = 24 * 60 * 60

/** Normalized form shared by the cooldown key and the job id, so "Frieren " and "frieren" are one term. */
export function normalizeEraiTerm(term: string): string {
  return term.trim().toLowerCase()
}

/**
 * Redis-backed protection for the Erai source: a source-wide lock after a block,
 * and a per-term cooldown so repeated Sonarr searches do not hit Erai again.
 */
@Injectable()
export class EraiGuardRepository {
  constructor(
    private readonly config: ConfigService,
    @Inject(ERAI_GUARD_REDIS) private readonly redis: EraiGuardRedis
  ) {}

  /** @example if (await guard.isLocked()) return */
  async isLocked(): Promise<boolean> {
    return (await this.redis.exists(LOCK_KEY)) === 1
  }

  /** Suspends every Erai request for 24h. Manual reset: `redis-cli DEL erai:locked`. */
  async lock(): Promise<void> {
    await this.redis.set(LOCK_KEY, new Date().toISOString(), 'EX', LOCK_TTL_S)
  }

  /**
   * Atomically marks the term as searched; false when it is still in cooldown.
   * @example if (!(await guard.claimTerm('frieren'))) return
   */
  async claimTerm(term: string): Promise<boolean> {
    const result = await this.redis.set(this.termKey(term), '1', 'EX', this.termCooldownSeconds(), 'NX')
    return result === 'OK'
  }

  /** Frees a term whose search failed for good, so the next Sonarr search can retry it. */
  async releaseTerm(term: string): Promise<void> {
    await this.redis.del(this.termKey(term))
  }

  private termKey(term: string): string {
    return `erai:term:${normalizeEraiTerm(term)}`
  }

  private termCooldownSeconds(): number {
    const configured = Number(this.config.get<string>('ERAI_TERM_COOLDOWN_S'))
    return configured > 0 ? configured : DEFAULT_TERM_COOLDOWN_S
  }
}
