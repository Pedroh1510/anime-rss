import { installMeterProvider } from '../../tests/helpers/meters'

let meters: ReturnType<typeof installMeterProvider>
let business: typeof import('../infra/telemetry/business')

beforeAll(async () => {
  meters = installMeterProvider()
  business = await import('../infra/telemetry/business')
})

afterAll(async () => {
  await meters.uninstall()
})

it.each([['rss.items.fetched'], ['rss.items.saved'], ['rss.torrents.cleaned']])(
  'each pipeline event increments its counter: %s',
  async (name) => {
    business.countPipelineEvent(name as any, { source: 'nyaa', result: 'ok' })

    const points = await meters.points(name)
    expect(points).toHaveLength(1)
    expect(points[0].attributes).toEqual({ source: 'nyaa', result: 'ok' })
    expect(points[0].value).toBe(1)
  }
)

it('counts a source error by source and status', async () => {
  business.countSourceError({ source: 'erai', status: 'locked' })

  const points = await meters.points('rss.source.errors')
  expect(points).toHaveLength(1)
  expect(points[0].attributes).toEqual({ source: 'erai', status: 'locked' })
  expect(points[0].value).toBe(1)
})
