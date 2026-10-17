import { ChildProcess, spawn, spawnSync } from 'node:child_process'
import { createServer, Server } from 'node:http'
import { setTimeout as sleep } from 'node:timers/promises'

// The app runs for real (built dist, node --import, Postgres and Redis from
// .env.development) and exports to a capture server here: no collector, no
// sampling, so the joins below are deterministic (app-observability C25, C28).
// Needs the dev Postgres/Redis up and the schema pushed (npm run migration:push).
const ROUTE = '/rss'
const SPAN_KIND = { server: 2, client: 3, consumer: 5 }
const WAIT_MS = 60_000

interface Span {
  traceId: string
  name: string
  kind: number
  attributes?: { key: string; value: Record<string, unknown> }[]
}

const spans: Span[] = []
const stdoutLines: string[] = []
let capture: Server
let app: ChildProcess
let traceId: string | undefined

function attributes(span: Span): Record<string, unknown> {
  return Object.fromEntries((span.attributes ?? []).map(({ key, value }) => [key, Object.values(value)[0]]))
}

function startCapture(): Promise<Server> {
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      if (req.url === '/v1/traces') {
        for (const resourceSpans of JSON.parse(body).resourceSpans ?? []) {
          for (const scopeSpans of resourceSpans.scopeSpans ?? []) spans.push(...scopeSpans.spans)
        }
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{}')
    })
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

async function freePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as { port: number }
  await new Promise((resolve) => server.close(resolve))
  return port
}

const serverSpanOfRoute = () =>
  spans.find((span) => span.kind === SPAN_KIND.server && attributes(span)['http.route'] === ROUTE)
const spansOfTrace = (id: string) => spans.filter((span) => span.traceId === id)
const isJobSpan = (span: Span) => span.kind === SPAN_KIND.consumer && span.name === 'process Scan process'

function jobLogLines(id: string) {
  return stdoutLines
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter((line) => line?.trace_id === id && String(line.msg).startsWith('startCron scanJob'))
}

async function waitFor(check: () => boolean, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  while (!check() && Date.now() < deadline) await sleep(1000)
}

beforeAll(async () => {
  const build = spawnSync('npx', ['nest', 'build'], { stdio: 'inherit' })
  if (build.status !== 0) throw new Error('nest build failed')
  capture = await startCapture()
  const port = await freePort()
  const otlp = `http://127.0.0.1:${(capture.address() as { port: number }).port}`
  app = spawn('node', ['--import', './dist/telemetry.js', 'dist/main'], {
    env: { ...process.env, port: `${port}`, OTEL_EXPORTER_OTLP_ENDPOINT: otlp },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  let pending = ''
  app.stdout?.on('data', (chunk) => {
    const lines = (pending + chunk).split('\n')
    pending = lines.pop() as string
    stdoutLines.push(...lines)
  })
  const base = `http://127.0.0.1:${port}`
  await waitFor(() => stdoutLines.some((line) => line.includes('Server listening')), WAIT_MS)

  // a fresh term each run, so the scan TTL in Redis never skips the enqueue
  const response = await fetch(`${base}${ROUTE}?term=otelprobe-${Date.now()}&isScan=true`)
  expect(response.status).toBe(200)

  // spans are batched every 5 s and the job runs after the response
  await waitFor(() => {
    traceId = serverSpanOfRoute()?.traceId
    return !!traceId && spansOfTrace(traceId).some(isJobSpan) && jobLogLines(traceId).length > 0
  }, WAIT_MS)
}, WAIT_MS * 3)

afterAll(async () => {
  app?.kill('SIGTERM')
  await new Promise((resolve) => capture?.close(resolve))
})

describe('trace join on a real request', () => {
  it('request trace joins http db and redis spans', () => {
    expect(traceId).toBeDefined()
    const systems = spansOfTrace(traceId as string)
      .filter((span) => span.kind === SPAN_KIND.client)
      .map((span) => attributes(span)['db.system.name'] ?? attributes(span)['db.system'])
    expect(systems).toContain('postgresql')
    expect(systems).toContain('redis')
  })

  it('job enqueued by a request shares its trace', () => {
    expect(traceId).toBeDefined()
    expect(spansOfTrace(traceId as string).filter(isJobSpan)).not.toHaveLength(0)
  })

  it('job log line carries the request trace_id', () => {
    expect(traceId).toBeDefined()
    expect(jobLogLines(traceId as string)).not.toHaveLength(0)
  })
})
