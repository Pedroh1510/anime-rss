import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import { UnrecoverableError } from 'bullmq'

import { classifyEraiResponse, EraiOutcome } from './erai-response'

export interface EraiHttpResponse {
  status: number
  body: string
}

/** Thin HTTP seam so the client can be tested without the network. */
export interface EraiHttp {
  get(url: string, headers: Record<string, string>): Promise<EraiHttpResponse>
}

export const ERAI_HTTP = Symbol('ERAI_HTTP')

const REQUEST_TIMEOUT_MS = 30_000

/** axios-backed EraiHttp: never throws on HTTP status, only on network failure. */
export class AxiosEraiHttp implements EraiHttp {
  async get(url: string, headers: Record<string, string>): Promise<EraiHttpResponse> {
    const response = await axios.get<string>(url, {
      headers,
      timeout: REQUEST_TIMEOUT_MS,
      responseType: 'text',
      validateStatus: () => true,
    })
    return { status: response.status, body: String(response.data ?? '') }
  }
}

export interface EraiFeedResult {
  outcome: EraiOutcome
  status: number | undefined
  body: string
}

const FEED_BASE_URL = 'https://www.erai-raws.info/feed/?type=magnet&subs%5B0%5D=br'
const ACCEPT_HEADER = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

@Injectable()
export class EraiFeedClient {
  constructor(
    private readonly config: ConfigService,
    @Inject(ERAI_HTTP) private readonly http: EraiHttp
  ) {}

  /**
   * One GET to the Erai br feed; `term` narrows it to a search. Never throws on HTTP errors.
   * @example await client.fetchFeed('frieren') // { outcome: 'ok', status: 200, body: '<rss…' }
   */
  async fetchFeed(term?: string): Promise<EraiFeedResult> {
    const url = this.buildUrl(term)
    try {
      const { status, body } = await this.http.get(url, this.buildHeaders())
      return { outcome: classifyEraiResponse({ status, body }), status, body }
    } catch {
      return { outcome: classifyEraiResponse({ status: undefined, body: '' }), status: undefined, body: '' }
    }
  }

  private buildUrl(term?: string): string {
    const token = this.config.get<string>('ERAI_TOKEN')
    // Unrecoverable: a config error must fail the job once, not retry 3 times.
    if (!token) throw new UnrecoverableError('ERAI_TOKEN is not set; expected the 32-char hex token of the Erai feed')
    const search = term ? `&s=${encodeURIComponent(term)}` : ''
    return `${FEED_BASE_URL}&token=${token}${search}`
  }

  private buildHeaders(): Record<string, string> {
    const userAgent = this.config.get<string>('ERAI_USER_AGENT')
    return userAgent ? { Accept: ACCEPT_HEADER, 'User-Agent': userAgent } : { Accept: ACCEPT_HEADER }
  }
}
