import { ConfigService } from '@nestjs/config'

import { EraiGuardRedis, EraiGuardRepository } from './erai-guard.repository'

/** In-memory stand-in for the three Redis commands the guard uses; TTLs are recorded, not enforced. */
class FakeGuardRedis implements EraiGuardRedis {
  readonly store = new Map<string, { value: string; ttl: number }>()

  async exists(key: string): Promise<number> {
    return this.store.has(key) ? 1 : 0
  }

  async set(key: string, value: string, _ex: 'EX', ttl: number, nx?: 'NX'): Promise<'OK' | null> {
    if (nx && this.store.has(key)) return null
    this.store.set(key, { value, ttl })
    return 'OK'
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0
  }
}

function buildGuard(env: Record<string, string> = {}) {
  const redis = new FakeGuardRedis()
  const guard = new EraiGuardRepository(new ConfigService(env), redis)
  return { guard, redis }
}

describe('EraiGuardRepository lock', () => {
  it('is unlocked by default', async () => {
    const { guard } = buildGuard()
    await expect(guard.isLocked()).resolves.toBe(false)
  })

  it('locks the whole source for 24h', async () => {
    const { guard, redis } = buildGuard()
    await guard.lock()
    await expect(guard.isLocked()).resolves.toBe(true)
    expect(redis.store.get('erai:locked')?.ttl).toBe(86400)
  })
})

describe('EraiGuardRepository term cooldown', () => {
  it('claims a fresh term once and refuses the second claim', async () => {
    const { guard } = buildGuard()
    await expect(guard.claimTerm('Frieren')).resolves.toBe(true)
    await expect(guard.claimTerm('frieren')).resolves.toBe(false)
  })

  it('normalizes the term (trim + lowercase) for the key', async () => {
    const { guard, redis } = buildGuard()
    await guard.claimTerm('  Sousou no Frieren ')
    expect(redis.store.has('erai:term:sousou no frieren')).toBe(true)
  })

  it('uses ERAI_TERM_COOLDOWN_S as the TTL, 24h by default', async () => {
    const custom = buildGuard({ ERAI_TERM_COOLDOWN_S: '600' })
    await custom.guard.claimTerm('a')
    expect(custom.redis.store.get('erai:term:a')?.ttl).toBe(600)

    const fallback = buildGuard()
    await fallback.guard.claimTerm('a')
    expect(fallback.redis.store.get('erai:term:a')?.ttl).toBe(86400)
  })

  it('releases a term so it can be claimed again', async () => {
    const { guard } = buildGuard()
    await guard.claimTerm('frieren')
    await guard.releaseTerm('Frieren')
    await expect(guard.claimTerm('frieren')).resolves.toBe(true)
  })
})
