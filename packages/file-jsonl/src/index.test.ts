import { chunk, split } from './index'

describe('split', () => {
  it('should return null for invalid JSON', () => {
    const result = split('invalid json')

    expect(result).toBeNull()
  })

  it('should split valid JSON string into content and meta', () => {
    const line = JSON.stringify({
      name: 'John',
      age: 30,
    })
    const result = split(line)

    expect(result).toEqual({
      text: 'name: John\nage: 30',
      meta: { age: 30 },
    })
  })

  it('should move non-alphanumeric fields to meta', () => {
    const line = '{"name": "John", "_age": 30}'
    const result = split(line)

    expect(result).toEqual({
      text: 'name: John',
      meta: { age: 30 },
    })
  })

  it('should handle JSON with only string fields', () => {
    const line = JSON.stringify({ name: 'John', city: 'New York' })
    const result = split(line)

    expect(result).toEqual({
      text: 'name: John\ncity: New York',
      meta: {},
    })
  })

  it('should handle JSON with only non-string fields', () => {
    const line = JSON.stringify({ age: 30, active: true })
    const result = split(line)

    expect(result).toEqual({
      text: 'age: 30\nactive: true',
      meta: { age: 30, active: true },
    })
  })
})

describe('chunk', () => {
  it('should yield chunks for each valid JSON line', async () => {
    const data =
      JSON.stringify({ name: 'John' }) + '\n' + JSON.stringify({ age: 30 })
    const chunks = []

    for await (const c of chunk(
      new Blob([data], { type: 'application/jsonl' })
    )) {
      chunks.push(c)
    }

    expect(chunks).toEqual([
      { text: 'name: John', meta: {} },
      { text: 'age: 30', meta: { age: 30 } },
    ])
  })

  it('should skip empty lines', async () => {
    const data =
      JSON.stringify({ name: 'John' }) + '\n\n' + JSON.stringify({ age: 30 })
    const chunks = []

    for await (const c of chunk(
      new Blob([data], { type: 'application/jsonl' })
    )) {
      chunks.push(c)
    }

    expect(chunks).toEqual([
      { text: 'name: John', meta: {} },
      { text: 'age: 30', meta: { age: 30 } },
    ])
  })

  it('should handle all invalid JSON lines', async () => {
    const data = 'invalid json' + JSON.stringify({ name: 'John' })
    const chunks = []

    for await (const c of chunk(
      new Blob([data], { type: 'application/jsonl' })
    )) {
      chunks.push(c)
    }

    expect(chunks).toEqual([])
  })
})
