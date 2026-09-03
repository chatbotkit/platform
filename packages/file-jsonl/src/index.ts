import { split } from '@chatbotkit-dev/file-json'

export { split } from '@chatbotkit-dev/file-json'

interface Chunk {
  text: string
  meta: Record<string, unknown>
}

export async function* chunk(blob: Blob): AsyncGenerator<Chunk> {
  let lines

  try {
    const data = await blob.text()

    lines = data.split('\n')
  } catch {
    return
  }

  for (const line of lines) {
    if (!line) {
      continue
    }

    const item = split(line)

    if (item) {
      yield item
    }
  }
}
