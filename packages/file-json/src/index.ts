import jsYaml from 'js-yaml'

interface Chunk {
  text: string
  meta: Record<string, unknown>
}

export function split(input: string): Chunk | null {
  let data

  try {
    data = JSON.parse(input)
  } catch {
    return null
  }

  const meta: Record<string, unknown> = {}

  // any field that starts with non-alphanumeric character should go into the meta data object

  for (const key in data) {
    if (!/^[a-zA-Z]/.test(key)) {
      meta[key.replace(/^([^a-zA-Z0-9]+)(.*)$/, '$2')] = data[key]

      delete data[key]
    }
  }

  // any field that is a number or a boolean should go into the meta data object

  for (const key in data) {
    if (typeof data[key] === 'number' || typeof data[key] === 'boolean') {
      meta[key] = data[key]
    }
  }

  // the final content is trimmed

  let text = jsYaml.dump(data, { lineWidth: -1 }).trim()

  // if the content is empty object or array, it should be an empty string

  text = text === '{}' || text === '[]' ? '' : text

  return {
    text: text,
    meta: meta,
  }
}

export async function* chunk(blob: Blob): AsyncGenerator<Chunk> {
  let json

  try {
    const data = await blob.text()

    json = JSON.parse(data)
  } catch {
    return
  }

  // handle arrays
  {
    if (Array.isArray(json)) {
      for (const item of json) {
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
    if (Object.keys(json).length === 1) {
      const firstValue = json[Object.keys(json)[0]]

      if (Array.isArray(firstValue) && typeof firstValue[0] === 'object' && firstValue[0] !== null) {
        for (const item of firstValue) {
          const result = split(JSON.stringify(item))

          if (result) {
            yield result
          }
        }

        return
      } else {
        yield {
          text: jsYaml.dump(json, { lineWidth: -1 }).trim(),
          meta: {},
        }

        return
      }
    }
  }

  const result = split(JSON.stringify(json))

  if (result) {
    yield result
  }
}
