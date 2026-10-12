import { ConfigService } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'

import { XmlService } from './xml.service'

describe('XmlService', () => {
  let service: XmlService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        XmlService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(3033) },
        },
      ],
    }).compile()

    service = module.get<XmlService>(XmlService)
  })

  describe('parserToJson', () => {
    it('should return empty object for null input', () => {
      expect(service.parserToJson(null)).toEqual({})
    })

    it('should return empty object for undefined input', () => {
      expect(service.parserToJson(undefined)).toEqual({})
    })

    it('should parse valid XML into an object', () => {
      const xml = '<root><name>test</name></root>'
      const result = service.parserToJson(xml) as { root: { name: string } }
      expect(result.root.name).toBe('test')
    })
  })

  describe('buildToRss', () => {
    it('should return a non-empty XML string', () => {
      const result = service.buildToRss({ items: [] })
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
      expect(result).toContain('<rss')
    })

    it('should include item title in the output when items are provided', () => {
      const items = [
        {
          title: 'Test Anime Episode 01',
          magnet: 'magnet:?xt=urn:btih:abc123',
          page: 'https://nyaa.si/view/1',
          pubDate: new Date('2024-01-01T00:00:00Z'),
          id: 'abc123',
        },
      ]
      const result = service.buildToRss({ items })
      expect(result).toContain('<title>Test Anime Episode 01</title>')
    })
  })
})
