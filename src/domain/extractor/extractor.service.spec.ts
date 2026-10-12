import { ExtractorService } from './extractor.service'

async function* oneItem() {
  yield { title: 'Ep 1', link: 'magnet:?xt=1', date: new Date('2026-10-12T00:00:00Z') }
}

const unusedSource = () => ({ extractor: jest.fn() })

function buildService() {
  const n8nService = { extractor: jest.fn(() => oneItem()), listSeries: jest.fn(), listEps: jest.fn() }
  const service = new ExtractorService(
    { save: jest.fn().mockResolvedValue(undefined) } as any,
    { magnetInfo: jest.fn().mockResolvedValue('hash') } as any,
    unusedSource() as any,
    unusedSource() as any,
    unusedSource() as any,
    unusedSource() as any,
    n8nService as any
  )
  return { service, n8nService }
}

describe('ExtractorService.scanBySite', () => {
  it('scans a supported site', async () => {
    const { service, n8nService } = buildService()
    await expect(service.scanBySite('n8n', undefined)).resolves.toBe(1)
    expect(n8nService.extractor).toHaveBeenCalledTimes(1)
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
