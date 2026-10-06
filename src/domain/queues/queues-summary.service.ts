import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { JobType, Queue } from 'bullmq'

const COUNT_TYPES: JobType[] = ['active', 'waiting', 'delayed', 'failed', 'completed', 'paused']
// BullMQ commands never reject while Redis is down, so the read is bounded
// instead of hanging the Status screen.
const SUMMARY_TIMEOUT_MS = 3000

export interface QueueSummary {
  name: string
  counts: Record<string, number>
}

@Injectable()
export class QueuesSummaryService {
  private readonly queues: Queue[]

  constructor(
    @InjectQueue('Anime process') animeQueue: Queue,
    @InjectQueue('Adm Anime') admAnimeQueue: Queue,
    @InjectQueue('Scan process') scanQueue: Queue
  ) {
    this.queues = [animeQueue, admAnimeQueue, scanQueue]
  }

  /**
   * Job counts per state for each queue, sorted by name.
   * @example await queuesSummaryService.summarize()
   */
  async summarize(): Promise<QueueSummary[]> {
    let timer: NodeJS.Timeout
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new ServiceUnavailableException('Queue backend unavailable')), SUMMARY_TIMEOUT_MS)
    })
    try {
      const summary = await Promise.race([Promise.all(this.queues.map((queue) => this.readCounts(queue))), timeout])
      return summary.sort((a, b) => a.name.localeCompare(b.name))
    } finally {
      clearTimeout(timer)
    }
  }

  private async readCounts(queue: Queue): Promise<QueueSummary> {
    return { name: queue.name, counts: await queue.getJobCounts(...COUNT_TYPES) }
  }
}
