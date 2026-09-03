import { extractData } from '@/lib/extract.data'
import type { ExtractDataOptions, Message } from '@/lib/extract.data'
import type { JsonSchemaObject } from '@/lib/jsonschema'
import { Usage } from '@/lib/usage.model'

export const COMPACT_SCHEMA: JsonSchemaObject = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description:
        'A comprehensive summary of the conversation suitable for use as a context checkpoint. Capture key topics, decisions, facts shared, and the overall state of the conversation.',
    },
  },
  required: ['summary'],
}

/**
 * Summarizes conversation messages into a compact checkpoint string using AI.
 * Returns the summary string (or null if messages are empty or summarization
 * fails) alongside the token usage incurred by the summarization.
 */
export async function compactMessages(
  messages: Message[],
  options: Pick<ExtractDataOptions, 'user' | 'usageReferences'>
): Promise<{ summary: string | null; usage: Usage }> {
  if (!messages.length) {
    return { summary: null, usage: new Usage() }
  }

  const { data, usage } = await extractData(messages, COMPACT_SCHEMA, options)

  const summary = typeof data?.summary === 'string' ? data.summary.trim() : ''

  return { summary: summary || null, usage }
}
