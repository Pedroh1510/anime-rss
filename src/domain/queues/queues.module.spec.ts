import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants'
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
  })

  it('main.ts aplica os pipes globais compartilhados com os testes', () => {
    const main = readFileSync(join(__dirname, '../../main.ts'), 'utf-8')
    expect(main).toMatch(/applyGlobalPipes\(app\)/)
  })
})
