import { EraiScanJobService } from './erai-scan-job.service'

class FakeEraiQueue {
  readonly added: { name: string; data: unknown; opts: Record<string, unknown> }[] = []
  failNextAdd = false

  async add(name: string, data: unknown, opts: Record<string, unknown>) {
    if (this.failNextAdd) throw new Error('redis down')
    this.added.push({ name, data, opts })
  }
}

class FakeEraiGuard {
  locked = false
  readonly claimed = new Set<string>()
  readonly released: string[] = []

  async releaseTerm(term: string): Promise<void> {
    this.released.push(term)
    this.claimed.delete(term)
  }

  async isLocked(): Promise<boolean> {
    return this.locked
  }

  async claimTerm(term: string): Promise<boolean> {
    const key = term.trim().toLowerCase()
    if (this.claimed.has(key)) return false
    this.claimed.add(key)
    return true
  }
}

function buildService() {
  const queue = new FakeEraiQueue()
  const guard = new FakeEraiGuard()
  const service = new EraiScanJobService(queue as any, guard as any)
  return { service, queue, guard }
}

describe('EraiScanJobService.enqueueRecent', () => {
  it('enqueues one deduplicated recent-feed job with retries', async () => {
    const { service, queue } = buildService()
    await service.enqueueRecent()
    expect(queue.added).toHaveLength(1)
    expect(queue.added[0].opts).toMatchObject({ jobId: 'erai-recent', attempts: 3 })
    expect(queue.added[0].opts.backoff).toMatchObject({ type: 'exponential' })
  })

  it('skips while the source is locked', async () => {
    const { service, queue, guard } = buildService()
    guard.locked = true
    await service.enqueueRecent()
    expect(queue.added).toHaveLength(0)
  })
})

describe('EraiScanJobService.enqueueTerm', () => {
  it('enqueues a normalized term search', async () => {
    const { service, queue } = buildService()
    await service.enqueueTerm('  Sousou no Frieren ')
    expect(queue.added[0].data).toEqual({ term: 'sousou no frieren' })
    expect(queue.added[0].opts).toMatchObject({ attempts: 3 })
    expect(queue.added[0].opts.jobId).toMatch(/^erai-term-[0-9a-f]{16}$/)
  })

  // Review finding: a slug id collapsed non-Latin titles and punctuation variants into one job id,
  // so the second add() was a silent no-op while its term sat on a 24h cooldown.
  it.each([
    ['葬送のフリーレン', '薬屋のひとりごと'],
    ['re:zero', 're zero'],
  ])('gives distinct terms distinct job ids (%s vs %s)', async (first, second) => {
    const { service, queue } = buildService()
    await service.enqueueTerm(first)
    await service.enqueueTerm(second)
    expect(queue.added[0].opts.jobId).not.toBe(queue.added[1].opts.jobId)
  })

  it('releases the claim and rethrows when the job cannot be added', async () => {
    const { service, queue, guard } = buildService()
    queue.failNextAdd = true
    await expect(service.enqueueTerm('frieren')).rejects.toThrow('redis down')
    expect(guard.released).toEqual(['frieren'])
  })

  it('enqueues the same term only once within the cooldown', async () => {
    const { service, queue } = buildService()
    await service.enqueueTerm('frieren')
    await service.enqueueTerm('Frieren')
    expect(queue.added).toHaveLength(1)
  })

  it('skips while the source is locked without claiming the term', async () => {
    const { service, queue, guard } = buildService()
    guard.locked = true
    await service.enqueueTerm('frieren')
    expect(queue.added).toHaveLength(0)
    expect(guard.claimed.size).toBe(0)
  })

  it.each(['', '   ', undefined])('ignores an empty term (%p)', async (term) => {
    const { service, queue } = buildService()
    await service.enqueueTerm(term)
    expect(queue.added).toHaveLength(0)
  })
})
