import { Test } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { ServiceUnavailableException } from '@nestjs/common'
import { QueuesSummaryService } from './queues-summary.service'
import { QUEUE_NAMES } from './queue-names'

const COUNTS = { active: 1, waiting: 2, delayed: 0, failed: 3, completed: 4, paused: 0 }

class FakeQueue {
  readonly getJobCounts: jest.Mock
  readonly add = jest.fn()
  readonly remove = jest.fn()
  readonly clean = jest.fn()
  readonly drain = jest.fn()
  readonly obliterate = jest.fn()
  readonly pause = jest.fn()
  readonly resume = jest.fn()

  constructor(
    readonly name: string,
    getJobCounts: () => Promise<unknown> = () => Promise.resolve(COUNTS)
  ) {
    this.getJobCounts = jest.fn(getJobCounts)
  }
}

const buildService = async (makeQueue: (name: string) => FakeQueue = (name) => new FakeQueue(name)) => {
  const queues = Object.fromEntries(QUEUE_NAMES.map((name) => [name, makeQueue(name)]))
  const module = await Test.createTestingModule({
    providers: [
      QueuesSummaryService,
      // Registered in reverse so the service cannot rely on injection order.
      ...[...QUEUE_NAMES].reverse().map((name) => ({ provide: getQueueToken(name), useValue: queues[name] })),
    ],
  }).compile()
  return { service: module.get(QueuesSummaryService), queues }
}

describe('QueuesSummaryService', () => {
  afterEach(() => jest.useRealTimers())

  it('ordena as filas por nome', async () => {
    const { service } = await buildService()

    const summary = await service.summarize()

    expect(summary.map((item) => item.name)).toEqual(['Adm Anime', 'Anime process', 'Scan process'])
    expect(summary[0].counts).toEqual(COUNTS)
  })

  it('rejeita quando getJobCounts não responde em 3000ms', async () => {
    jest.useFakeTimers()
    const { service } = await buildService((name) => new FakeQueue(name, () => new Promise(() => {})))
    let settled: unknown = null
    service.summarize().then(
      () => (settled = 'resolved'),
      (error) => (settled = error)
    )

    await jest.advanceTimersByTimeAsync(2999)
    expect(settled).toBeNull()

    await jest.advanceTimersByTimeAsync(1)
    expect(settled).toBeInstanceOf(ServiceUnavailableException)
    expect((settled as Error).message).toEqual('Queue backend unavailable')
  })

  it('só lê contagens', async () => {
    const { service, queues } = await buildService()

    await service.summarize()

    for (const queue of Object.values(queues)) {
      expect(queue.getJobCounts).toHaveBeenCalledTimes(1)
      for (const method of ['add', 'remove', 'clean', 'drain', 'obliterate', 'pause', 'resume'] as const) {
        expect(queue[method]).not.toHaveBeenCalled()
      }
    }
  })
})
