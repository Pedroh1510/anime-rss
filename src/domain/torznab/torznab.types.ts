export interface TorznabQuery {
  t?: string
  q?: string
  season?: string
  ep?: string
  cat?: string
  offset?: string
  limit?: string
}

export interface TorrentRecord {
  id: number
  title: string
  magnet: string
  pubDate: Date
}
