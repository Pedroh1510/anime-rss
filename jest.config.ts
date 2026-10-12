import type { Config } from 'jest'

const config: Config = {
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      transform: { '^.+\\.ts$': 'ts-jest' },
      moduleFileExtensions: ['ts', 'js', 'json'],
      moduleNameMapper: {
        '^parse-torrent$': '<rootDir>/src/__mocks__/parse-torrent.js',
        '^@ctrl/qbittorrent$': '<rootDir>/src/__mocks__/@ctrl/qbittorrent.js',
      },
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/**/*.spec.ts'],
      testTimeout: 60000,
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
      },
      moduleFileExtensions: ['ts', 'js', 'json'],
    },
  ],
  collectCoverageFrom: [
    'src/domain/**/*.service.ts',
    'src/domain/**/*.repository.ts',
    'src/utils/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/index.ts',
    '!src/domain/extractor/anime-tosho.service.ts',
    '!src/domain/extractor/erai.service.ts',
    '!src/domain/extractor/moe.service.ts',
    '!src/domain/extractor/n8n.service.ts',
    '!src/domain/extractor/nyaa.service.ts',
    '!src/domain/extractor/extractor.service.ts',
    '!src/domain/shared/download-img.service.ts',
  ],
  coverageThreshold: {
    global: { lines: 76, functions: 25, branches: 35, statements: 40 },
  },
}

export default config
