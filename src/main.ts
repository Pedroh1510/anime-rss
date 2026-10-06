import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { Queue } from 'bullmq'
import { AppModule } from './app.module'
import { applyGlobalPipes } from './app.setup'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors({ origin: '*' })
  applyGlobalPipes(app)

  const swaggerConfig = new DocumentBuilder().setTitle('Media Server API').setVersion('1.0').build()
  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('docs', app, document,{
    swaggerOptions: {
      docExpansion: 'none', 
    }
  })

  // BullBoard
  const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  }
  const boardAdapter = new ExpressAdapter()
  boardAdapter.setBasePath('/queues')
  createBullBoard({
    queues: [
      new BullMQAdapter(new Queue('Anime process', { connection })),
      new BullMQAdapter(new Queue('Adm Anime', { connection })),
      new BullMQAdapter(new Queue('Scan process', { connection })),
    ],
    serverAdapter: boardAdapter,
  })
  app.use('/queues', boardAdapter.getRouter())

  const port = process.env.port || 3033
  await app.listen(port)
  console.log(`Server listening on port ${port}`)
}

bootstrap()
