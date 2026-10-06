import { INestApplication, ValidationPipe } from '@nestjs/common'

/**
 * Global pipes shared by main.ts and the HTTP test harnesses, so DTO
 * validation in tests is the same validation production runs.
 * @example applyGlobalPipes(app)
 */
export function applyGlobalPipes(app: INestApplication): void {
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
}
