import { getQueueToken } from '@nestjs/bullmq'
import { Test } from '@nestjs/testing'

import { PrismaService } from '../../infra/database/prisma.service'
import { HEALTH_QUEUE, HealthService } from './health.service'

class FakePrisma {
  $queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }])
}

class FakeQueue {
  getVersion = jest.fn().mockResolvedValue('bullmq:5')
}

describe('HealthService', () => {
  let service: HealthService
  let prisma: FakePrisma
  let queue: FakeQueue

  beforeEach(async () => {
    prisma = new FakePrisma()
    queue = new FakeQueue()
    const module = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(HEALTH_QUEUE), useValue: queue },
      ],
    }).compile()
    service = module.get(HealthService)
  })

  afterEach(() => jest.useRealTimers())

  it('é saudável quando Postgres e Redis respondem', async () => {
    await expect(service.check()).resolves.toEqual({ healthy: true, checks: { database: 'ok', redis: 'ok' } })
  })

  it('reporta erro do Postgres e fica não saudável', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'))

    const result = await service.check()

    expect(result).toEqual({ healthy: false, checks: { database: { error: 'connection refused' }, redis: 'ok' } })
  })

  it('reporta erro do Redis e fica não saudável', async () => {
    queue.getVersion.mockRejectedValue(new Error('ECONNREFUSED'))

    const result = await service.check()

    expect(result).toEqual({ healthy: false, checks: { database: 'ok', redis: { error: 'ECONNREFUSED' } } })
  })

  it('falha por timeout quando uma dependência trava', async () => {
    jest.useFakeTimers()
    queue.getVersion.mockReturnValue(new Promise(() => undefined))

    const pending = service.check()
    await jest.advanceTimersByTimeAsync(2000)

    await expect(pending).resolves.toMatchObject({
      healthy: false,
      checks: { redis: { error: 'redis check timed out after 2000ms' } },
    })
  })
})
