import { Job } from 'bullmq'

import { EraiScanProcessor, eraiRateMs } from './erai-scan.processor'

class FakeErai {
  readonly runs: (string | undefined)[] = []

  async runErai(term?: string): Promise<number> {
    this.runs.push(term)
    return 1
  }
}

class FakeGuard {
  locked = false
  readonly released: string[] = []

  async isLocked(): Promise<boolean> {
    return this.locked
  }

  async releaseTerm(term: string): Promise<void> {
    this.released.push(term)
  }
}

function buildProcessor() {
  const erai = new FakeErai()
  const guard = new FakeGuard()
  const processor = new EraiScanProcessor(erai as any, guard as any)
  return { processor, erai, guard }
}

function job(data: { term?: string }, attemptsMade = 0, attempts = 3): Job {
  return { name: data.term ? 'term' : 'recent', data, attemptsMade, opts: { attempts } } as unknown as Job
}

describe('EraiScanProcessor.process', () => {
  it('runs the Erai request for the job term', async () => {
    const { processor, erai } = buildProcessor()
    await processor.process(job({ term: 'frieren' }))
    expect(erai.runs).toEqual(['frieren'])
  })

  it('drops the job without a request while the source is locked', async () => {
    const { processor, erai, guard } = buildProcessor()
    guard.locked = true
    await processor.process(job({}))
    expect(erai.runs).toEqual([])
  })
})

describe('EraiScanProcessor.onFailed', () => {
  it('releases the term cooldown once the last attempt failed', async () => {
    const { processor, guard } = buildProcessor()
    await processor.onFailed(job({ term: 'frieren' }, 3, 3))
    expect(guard.released).toEqual(['frieren'])
  })

  it('keeps the cooldown while retries remain', async () => {
    const { processor, guard } = buildProcessor()
    await processor.onFailed(job({ term: 'frieren' }, 1, 3))
    expect(guard.released).toEqual([])
  })

  it('has nothing to release for the recent feed', async () => {
    const { processor, guard } = buildProcessor()
    await processor.onFailed(job({}, 3, 3))
    expect(guard.released).toEqual([])
  })
})

describe('eraiRateMs', () => {
  it('defaults to one request per minute', () => {
    expect(eraiRateMs({})).toBe(60_000)
  })

  it('reads ERAI_RATE_MS', () => {
    expect(eraiRateMs({ ERAI_RATE_MS: '120000' })).toBe(120_000)
  })

  it('falls back to the default on an invalid value', () => {
    expect(eraiRateMs({ ERAI_RATE_MS: 'abc' })).toBe(60_000)
  })
})
