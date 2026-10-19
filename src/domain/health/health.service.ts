import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { Queue } from 'bullmq'

import { PrismaService } from '../../infra/database/prisma.service'

export const HEALTH_QUEUE = 'Scan process'
const CHECK_TIMEOUT_MS = 2000

type CheckResult = 'ok' | { error: string }
export type HealthResult = { healthy: boolean; checks: { database: CheckResult; redis: CheckResult } }

/**
 * Liveness + dependency probe used by the container HEALTHCHECK, so Coolify only
 * swaps in a new deploy when it can reach Postgres and Redis.
 * Example: `const { healthy } = await healthService.check()`
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(HEALTH_QUEUE) private readonly queue: Queue
  ) {}

  async check(): Promise<HealthResult> {
    const [database, redis] = await Promise.all([
      runCheck('database', () => this.prisma.$queryRaw`SELECT 1`),
      // getVersion is a typed Queue call that round-trips to Redis (IRedisClient exposes no ping).
      runCheck('redis', () => this.queue.getVersion()),
    ])
    return { healthy: database === 'ok' && redis === 'ok', checks: { database, redis } }
  }
}

async function runCheck(name: string, probe: () => Promise<unknown>): Promise<CheckResult> {
  try {
    await withTimeout(probe(), CHECK_TIMEOUT_MS, name)
    return 'ok'
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, name: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${name} check timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
