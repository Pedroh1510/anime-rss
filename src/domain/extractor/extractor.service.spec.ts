import { ExtractorService } from './extractor.service'

async function* oneItem() {
  yield { title: 'Ep 1', link: 'magnet:?xt=1', date: new Date('2026-10-12T00:00:00Z') }
}

const unusedSource = () => ({ extractor: jest.fn() })

function buildService() {
  const nyaaService = { extractor: jest.fn(() => oneItem()) }
  const service = new ExtractorService(
    { save: jest.fn().mockResolvedValue(undefined) } as any,
    { magnetInfo: jest.fn().mockResolvedValue('hash') } as any,
    unusedSource() as any,
    nyaaService as any,
    unusedSource() as any
  )
  return { service, nyaaService }
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
