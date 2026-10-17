import { trace } from '@opentelemetry/api'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import express from 'express'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { Writable } from 'node:stream'
import { setTimeout as sleep } from 'node:timers/promises'
import pino from 'pino'

import { resolveTelemetryConfig } from './infra/telemetry/config'
import { pinoOptions } from './infra/telemetry/logger'
import { startTelemetry } from './infra/telemetry/sdk'

const root = join(__dirname, '..')

function listen(server: ReturnType<typeof createServer>): Promise<number> {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as any).port)))
}

async function closedPort(): Promise<number> {
  const server = createServer()
  const port = await listen(server)
  await new Promise((resolve) => server.close(resolve))
  return port
}

describe('telemetry config', () => {
  it('resolves service name and endpoint defaults and env overrides', () => {
    expect(resolveTelemetryConfig({})).toEqual({
      serviceName: 'anime-rss',
      endpoint: 'http://otel-collector:4318',
    })
    expect(resolveTelemetryConfig({ OTEL_SERVICE_NAME: 'x', OTEL_EXPORTER_OTLP_ENDPOINT: 'http://y:4318' })).toEqual({
      serviceName: 'x',
      endpoint: 'http://y:4318',
    })
  })
})

describe('json logger', () => {
  let provider: NodeTracerProvider

  beforeAll(() => {
    provider = new NodeTracerProvider()
    provider.register()
  })

  afterAll(async () => {
    await provider.shutdown()
    trace.disable()
  })

  function captureLogger() {
    const lines: Record<string, unknown>[] = []
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(JSON.parse(chunk.toString()))
        callback()
      },
    })
    return { logger: pino(pinoOptions(), stream), lines }
  }

  it('writes level msg and time on every line', () => {
    const { logger, lines } = captureLogger()
    logger.info('feed scanned')

    expect(lines[0].level).toBe('info')
    expect(lines[0].msg).toBe('feed scanned')
    expect(new Date(lines[0].time as string).toISOString()).toBe(lines[0].time)
  })

  it('log line carries active span ids', () => {
    const { logger, lines } = captureLogger()
    let spanContext: any
    trace.getTracer('test').startActiveSpan('job', (span) => {
      spanContext = span.spanContext()
      logger.info('inside span')
      span.end()
    })
    logger.info('outside span')

    expect(lines[0].trace_id).toBe(spanContext.traceId)
    expect(lines[0].span_id).toBe(spanContext.spanId)
    expect(lines[1]).not.toHaveProperty('trace_id')
    expect(lines[1]).not.toHaveProperty('span_id')
  })
})

describe('logging surface', () => {
  it('nest uses pino logger and winston is gone', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    for (const name of ['winston', 'winston-loki']) {
      expect(pkg.dependencies ?? {}).not.toHaveProperty(name)
      expect(pkg.devDependencies ?? {}).not.toHaveProperty(name)
    }
    const main = readFileSync(join(root, 'src/main.ts'), 'utf8')
    expect(main).toContain("from 'nestjs-pino'")
    expect(main).toContain('app.useLogger(app.get(Logger))')
    expect(main).not.toMatch(/console\.(log|error)\(/)
  })

  it('the image starts node with the telemetry bootstrap', () => {
    const START = ['node', '--import', './dist/telemetry.js', 'dist/main']
    const cmd = readFileSync(join(root, 'Dockerfile'), 'utf8')
      .split('\n')
      .filter((line) => line.startsWith('CMD '))
      .at(-1) as string
    expect(JSON.parse(cmd.slice('CMD '.length))).toEqual(START)
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    expect(pkg.scripts['start:prod']).toBe(START.join(' '))
  })
})

describe('collector unreachable', () => {
  it('app keeps serving while collector is unreachable', async () => {
    const failures: unknown[] = []
    const onFailure = (error: unknown) => failures.push(error)
    process.on('unhandledRejection', onFailure)
    process.on('uncaughtException', onFailure)

    const sdk = startTelemetry(
      { serviceName: 'anime-rss', endpoint: `http://127.0.0.1:${await closedPort()}` },
      { exportIntervalMillis: 500 }
    )
    const { withJobMetrics } = await import('./infra/telemetry/jobs')

    const app = express()
    app.get('/ping', (_req, res) => res.status(200).send('pong'))
    const server = app.listen(0, '127.0.0.1')
    await new Promise((resolve) => server.once('listening', resolve))
    const response = await fetch(`http://127.0.0.1:${(server.address() as any).port}/ping`)
    const jobResult = await withJobMetrics('Anime process', async () => 'done')({ name: 'probe' } as any)

    await sleep(10_000)
    server.close()
    await sdk.shutdown().catch(() => {})
    process.off('unhandledRejection', onFailure)
    process.off('uncaughtException', onFailure)

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('pong')
    expect(jobResult).toBe('done')
    expect(failures).toEqual([])
  }, 30_000)
})
