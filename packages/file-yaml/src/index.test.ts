import { chunk, split } from './index'

async function collect(data: string, type = 'text/yaml') {
  const chunks = []

  for await (const c of chunk(new Blob([data], { type }))) {
    chunks.push(c)
  }

  return chunks
}

describe('split', () => {
  it('should be re-exported from the json chunker', () => {
    expect(typeof split).toBe('function')

    expect(split('{"name": "John", "age": 30}')).toEqual({
      text: 'name: John\nage: 30',
      meta: { age: 30 },
    })
  })
})

describe('chunk', () => {
  it('should yield a chunk per item for a top level list of maps', async () => {
    const data = '- name: John\n  age: 30\n- name: Jane\n  age: 25'

    expect(await collect(data)).toEqual([
      { text: 'name: John\nage: 30', meta: { age: 30 } },
      { text: 'name: Jane\nage: 25', meta: { age: 25 } },
    ])
  })

  it('should yield a single chunk for a multi-key map', async () => {
    const data = 'name: John\nage: 30'

    expect(await collect(data)).toEqual([
      { text: 'name: John\nage: 30', meta: { age: 30 } },
    ])
  })

  it('should yield a chunk per item for a single array property map', async () => {
    const data =
      'people:\n  - name: John\n    age: 30\n  - name: Jane\n    age: 25'

    expect(await collect(data)).toEqual([
      { text: 'name: John\nage: 30', meta: { age: 30 } },
      { text: 'name: Jane\nage: 25', meta: { age: 25 } },
    ])
  })

  it('should round-trip a nested map into yaml text', async () => {
    const data = "name: John\naddress:\n  city: NYC\n  zip: '10001'"

    expect(await collect(data)).toEqual([
      {
        text: "name: John\naddress:\n  city: NYC\n  zip: '10001'",
        meta: {},
      },
    ])
  })

  it('should also accept json (yaml is a json superset)', async () => {
    const data = '{"name": "John", "age": 30}'

    expect(await collect(data, 'application/yaml')).toEqual([
      { text: 'name: John\nage: 30', meta: { age: 30 } },
    ])
  })

  it('should yield nothing for an empty document', async () => {
    expect(await collect('')).toEqual([])
  })

  it('should yield nothing for a null document', async () => {
    expect(await collect('null')).toEqual([])
  })

  it('should yield nothing for malformed yaml', async () => {
    expect(await collect('key: [unclosed')).toEqual([])
  })
})
