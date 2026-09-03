import { csv2blocks } from './parse'

export { csv2blocks }

interface Chunk {
  text: string
  meta: Record<string, unknown>
}

export async function* chunk(blob: Blob): AsyncGenerator<Chunk> {
  for (const block of csv2blocks(await blob.text())) {
    yield {
      text: block,
      meta: {},
    }
  }
}
