import { split } from '@chatbotkit-dev/gpt'
import { splitTextRecursiveByTokens } from '@chatbotkit-dev/gpt/text-splitter'

interface Chunk {
  text: string
  meta: Record<string, unknown>
}

interface Options {
  size?: number
  overlap?: number
  separators?: string[]
}

export async function* chunk(
  blob: Blob,
  options: Options
): AsyncGenerator<Chunk> {
  const text = await blob.text()

  // @note when separators are provided use recursive character splitting with
  // token-based length which matches the original Python service behavior
  const blocks = options.separators
    ? splitTextRecursiveByTokens(text, {
        chunkSize: options.size || 512,
        chunkOverlap: options.overlap || 0,
        separators: options.separators,
      })
    : split(text, options.size || 512, options.overlap || 0)

  for (const block of blocks) {
    yield {
      text: block,
      meta: {},
    }
  }
}
