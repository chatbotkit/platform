import { canChunkContentType, chunk } from './index2'

const yamlContentTypes = [
  'application/yaml',
  'application/x-yaml',
  'text/yaml',
  'text/x-yaml',
]

async function collect(data: string, type: string) {
  const chunks = []

  for await (const c of chunk(new Blob([data], { type }), {})) {
    chunks.push(c)
  }

  return chunks
}

describe('yaml content type support', () => {
  // @note this is the map used by the /api/auxiliary/dataset/chunk endpoint;
  // before yaml was wired in, a text/yaml url served through chunkUrl threw
  // "Unsupported content type text/yaml"

  it.each(yamlContentTypes)('chunks a %s document as core', async (type) => {
    expect(canChunkContentType(type)).toBe(true)

    expect(await collect('name: John\nage: 30', type)).toEqual([
      { text: 'name: John\nage: 30', meta: { age: 30 } },
    ])
  })

  it('normalises a content type with charset params', async () => {
    expect(
      await collect('name: John\nage: 30', 'text/yaml; charset=utf-8')
    ).toEqual([{ text: 'name: John\nage: 30', meta: { age: 30 } }])
  })

  it('still throws for a genuinely unsupported content type', async () => {
    await expect(collect('hello', 'text/vnd.unknown')).rejects.toThrow(
      'Unsupported content type text/vnd.unknown'
    )
  })
})
