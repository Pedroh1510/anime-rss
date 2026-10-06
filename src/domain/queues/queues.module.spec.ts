import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { getQueueToken } from '@nestjs/bullmq'
import { AppModule } from '../../app.module'
import { QueuesModule } from './queues.module'
import { QueuesSummaryController } from './queues-summary.controller'

describe('QueuesModule', () => {
  it('AppModule expõe GET /queues-summary', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule)
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, QueuesModule)

    expect(imports).toContain(QueuesModule)
    expect(controllers).toContain(QueuesSummaryController)
    expect(Reflect.getMetadata(PATH_METADATA, QueuesSummaryController)).toEqual('queues-summary')

    const registered = Reflect.getMetadata(MODULE_METADATA.IMPORTS, QueuesModule).flatMap(
      (dynamicModule: { providers?: { provide: unknown }[] }) =>
        (dynamicModule.providers ?? []).map((provider) => provider.provide)
    )
    for (const name of ['Anime process', 'Adm Anime', 'Scan process']) {
      expect(registered).toContain(getQueueToken(name))
    }

    const main = readFileSync(join(__dirname, '../../main.ts'), 'utf-8')
    expect(main).toMatch(/applyGlobalPipes\(app\)/)
  })
})
