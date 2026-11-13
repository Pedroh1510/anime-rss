import { ExtractorService } from './extractor.service'

async function* oneItem() {
  yield { title: 'Ep 1', link: 'magnet:?xt=1', date: new Date('2026-10-12T00:00:00Z') }
}

async function* noItems() {}

const unusedSource = () => ({ extractor: jest.fn(() => noItems()) })

function buildService() {
  const nyaaService = { extractor: jest.fn(() => oneItem()) }
  const eraiScanJob = { enqueueRecent: jest.fn().mockResolvedValue(undefined), enqueueTerm: jest.fn() }
  const service = new ExtractorService(
    { save: jest.fn().mockResolvedValue(undefined) } as any,
    { magnetInfo: jest.fn().mockResolvedValue('hash') } as any,
    unusedSource() as any,
    nyaaService as any,
    unusedSource() as any,
    eraiScanJob as any
  )
  return { service, nyaaService, eraiScanJob }
}

describe('ExtractorService.scanBySite', () => {
  it('scans a supported site', async () => {
    const { service, nyaaService } = buildService()
    await expect(service.scanBySite('nyaa', undefined)).resolves.toBe(1)
    expect(nyaaService.extractor).toHaveBeenCalledTimes(1)
  })

  // CodeQL js/unvalidated-dynamic-method-call (alert #13): inherited Object.prototype names
  // used to reach the lookup and get invoked instead of being rejected.
  it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__', 'unknown'])(
    'rejects %s as an unsupported site',
    async (site) => {
      const { service } = buildService()
      await expect(service.scanBySite(site, undefined)).rejects.toThrow('Site not supported or invalid method')
    }
  )
})

describe('ExtractorService Erai routing', () => {
  it('queues the recent Erai feed instead of calling it inline from scanBySite', async () => {
    const { service, eraiScanJob } = buildService()
    await expect(service.scanBySite('erai', undefined)).resolves.toBe(0)
    expect(eraiScanJob.enqueueRecent).toHaveBeenCalledTimes(1)
  })

  it('queues an Erai term search for a Sonarr query', async () => {
    const { service, eraiScanJob } = buildService()
    await service.extractorRss({ q: 'frieren' })
    expect(eraiScanJob.enqueueTerm).toHaveBeenCalledWith('frieren')
  })

  it('queues the recent Erai feed on the scheduled scan', async () => {
    const { service, eraiScanJob } = buildService()
    await service.scan({ total: 1 })
    expect(eraiScanJob.enqueueRecent).toHaveBeenCalledTimes(1)
  })
})
