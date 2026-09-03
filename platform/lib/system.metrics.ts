import { debug } from '@/lib/debug'

interface TokenUsage {
  model: string
  totalTokens: number
  promptTokens: number
  completionTokens: number
}

/**
 * Reports token usage metrics
 */
export function reportTokenUsage(usage: TokenUsage): void {
  debug(`reporting token usage`, { usage }).log(
    'system.metrics.reportTokenUsage'
  )
}
