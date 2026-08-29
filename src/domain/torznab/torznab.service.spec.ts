import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { TorznabService } from './torznab.service'
import { TorznabRepository } from './torznab.repository'

const makeRepository = () => ({
  search: jest.fn().mockResolvedValue([]),
  count: jest.fn().mockResolvedValue(0),
})

const makeConfigService = () => ({
  get: jest.fn().mockImplementation((_key: string, def: any) => def),
})

const buildModule = async (overrides: Record<string, any> = {}) => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      TorznabService,
      { provide: TorznabRepository, useValue: overrides.repository ?? makeRepository() },
      { provide: ConfigService, useValue: overrides.configService ?? makeConfigService() },
    ],
  }).compile()

  return {
    service: module.get(TorznabService),
    repository: module.get(TorznabRepository) as jest.Mocked<TorznabRepository>,
  }
}

describe('TorznabService', () => {
  describe('handle - caps', () => {
    it('retorna xml de caps com searching e categories', async () => {
      const { service } = await buildModule()
      const result = await service.handle({ t: 'caps' })

      expect(result).toContain('<caps>')
      expect(result).toContain('<limits max="100" default="50"')
      expect(result).toContain('<search available="yes" supportedParams="q"')
      expect(result).toContain('<tv-search available="yes" supportedParams="q,season,ep"')
      expect(result).toContain('<category id="5000" name="TV"')
      expect(result).toContain('<subcat id="5070" name="Anime"')
    })

    it('não consulta o repositório para t=caps', async () => {
      const { service, repository } = await buildModule()
      await service.handle({ t: 'caps' })
      expect(repository.search).not.toHaveBeenCalled()
    })
  })

  describe('handle - search', () => {
    it('usa search como default quando t ausente', async () => {
      const { service, repository } = await buildModule()
      await service.handle({})
      expect(repository.search).toHaveBeenCalled()
    })

    it('aplica limit default 50 e offset 0 quando não informados', async () => {
      const { service, repository } = await buildModule()
      await service.handle({ t: 'search', q: 'naruto' })
      expect(repository.search).toHaveBeenCalledWith({ term: 'naruto', skip: 0, take: 50 })
    })

    it('respeita offset e limit informados, limitando ao MAX_LIMIT', async () => {
      const { service, repository } = await buildModule()
      await service.handle({ t: 'tvsearch', q: 'naruto', offset: '20', limit: '500' })
      expect(repository.search).toHaveBeenCalledWith({ term: 'naruto', skip: 20, take: 100 })
    })

    it('remove sufixo de season do termo de busca', async () => {
      const { service, repository } = await buildModule()
      await service.handle({ t: 'search', q: 'One Piece S01 - 05' })
      expect(repository.search).toHaveBeenCalledWith({ term: 'One Piece', skip: 0, take: 50 })
    })

    it('inclui torznab:response com offset e total no xml', async () => {
      const repository = makeRepository()
      ;(repository.count as jest.Mock).mockResolvedValue(123)
      const { service } = await buildModule({ repository })

      const result = await service.handle({ t: 'search', q: 'naruto', offset: '20' })
      expect(result).toContain('<torznab:response offset="20" total="123"')
    })

    it('inclui torznab:attr para cada item retornado', async () => {
      const repository = makeRepository()
      ;(repository.search as jest.Mock).mockResolvedValue([
        { id: 1, title: 'Naruto - 01', magnet: 'magnet:?xt=urn:btih:abc', pubDate: new Date('2024-01-01T00:00:00Z') },
      ])
      const { service } = await buildModule({ repository })

      const result = await service.handle({ t: 'search', q: 'naruto' })
      expect(result).toContain('<title>Naruto - 01</title>')
      expect(result).toContain('name="category" value="5070"')
      expect(result).toContain('name="magneturl" value="magnet:?xt=urn:btih:abc"')
    })

    it('retorna xml sem items quando repositório retorna vazio', async () => {
      const { service } = await buildModule()
      const result = await service.handle({ t: 'search', q: 'inexistente' })
      expect(result).toContain('<rss')
      expect(result).not.toContain('<item>')
    })
  })
})
