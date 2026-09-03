import { split } from '@chatbotkit-dev/file-json'

import jsYaml from 'js-yaml'

// @note yaml is structurally a superset of json so we reuse the exact same
// record splitting as the json chunker (which itself already emits yaml via
// js-yaml). the only difference is that we parse the document with yaml.

export { split } from '@chatbotkit-dev/file-json'

interface Chunk {
  text: string
  meta: Record<string, unknown>
}

export async function* chunk(blob: Blob): AsyncGenerator<Chunk> {
  let doc: unknown

  try {
    const data = await blob.text()

    doc = jsYaml.load(data)
  } catch {
    return
  }

  // @note empty or explicitly null documents have nothing to chunk

  if (doc === null || doc === undefined) {
    return
  }

  // handle arrays
  {
    if (Array.isArray(doc)) {
      for (const item of doc) {
        const result = split(JSON.stringify(item))

        if (result) {
          yield result
        }
      }

      return
    }
  }

  // handle objects with a single property that is an array
  {
    if (typeof doc === 'object' && Object.keys(doc).length === 1) {
      const record = doc as Record<string, unknown>

      const firstValue = record[Object.keys(record)[0]]

      if (
        Array.isArray(firstValue) &&
        typeof firstValue[0] === 'object' &&
        firstValue[0] !== null
      ) {
        for (const item of firstValue) {
          const result = split(JSON.stringify(item))

          if (result) {
            yield result
          }
        }

        return
      } else {
        yield {
          text: jsYaml.dump(doc, { lineWidth: -1 }).trim(),
          meta: {},
        }

        return
      }
    }
  }

  const result = split(JSON.stringify(doc))

  if (result) {
    yield result
  }
}
