import { chunk, split } from './index'

describe('split', () => {
  it('should return null for invalid JSON', () => {
    expect(split('invalid')).toBeNull()
  })

  it('should return a Chunk with content and meta for valid JSON', () => {
    const line = '{"name": "John", "age": 30}'
    const result = split(line)

    expect(result).toEqual({
      text: 'name: John\nage: 30',
      meta: { age: 30 },
    })
  })

  it('should not move ints represented as strings to meta', () => {
    const line = '{"name": "John", "age": "30"}'
    const result = split(line)

    expect(result).toEqual({
      text: "name: John\nage: '30'",
      meta: {},
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

  it('should move boolean fields to meta', () => {
    const line = '{"name": "John", "active": true}'
    const result = split(line)

    expect(result).toEqual({
      text: 'name: John\nactive: true',
      meta: { active: true },
    })
  })

  it('should return empty content for empty object', () => {
    const line = '{}'
    const result = split(line)

    expect(result).toEqual({
      text: '',
      meta: {},
    })
  })

  it('should return empty content for empty array', () => {
    const line = '[]'
    const result = split(line)

    expect(result).toEqual({
      text: '',
      meta: {},
    })
  })
})

describe('chunk', () => {
  it('should yield Chunks for valid JSON array', async () => {
    const data = '[{"name": "John", "age": 30}, {"name": "Jane", "age": 25}]'
    const chunks = []

    for await (const c of chunk(
      new Blob([data], { type: 'application/json' })
    )) {
      chunks.push(c)
    }

    expect(chunks).toEqual([
      { text: 'name: John\nage: 30', meta: { age: 30 } },
      { text: 'name: Jane\nage: 25', meta: { age: 25 } },
    ])
  })

  it('should yield a Chunk for valid JSON object', async () => {
    const data = '{"name": "John", "age": 30}'
    const chunks = []

    for await (const c of chunk(
      new Blob([data], { type: 'application/json' })
    )) {
      chunks.push(c)
    }

    expect(chunks).toEqual([{ text: 'name: John\nage: 30', meta: { age: 30 } }])
  })

  it('should yield a Chunk for each property array of objects in JSON', async () => {
    const data =
      '{"people": [{"name": "John", "age": 30}, {"name": "Jane", "age": 25}]}'
    const chunks = []

    for await (const c of chunk(
      new Blob([data], { type: 'application/json' })
    )) {
      chunks.push(c)
    }

    expect(chunks).toEqual([
      { text: 'name: John\nage: 30', meta: { age: 30 } },
      { text: 'name: Jane\nage: 25', meta: { age: 25 } },
    ])
  })

  it('should not yield a Chunk for array properties that are not objects', async () => {
    const data = '{"people": [1, 2, 3]}'
    const chunks = []

    for await (const c of chunk(
      new Blob([data], { type: 'application/json' })
    )) {
      chunks.push(c)
    }

    expect(chunks).toEqual([
      {
        text: 'people:\n  - 1\n  - 2\n  - 3',
        meta: {},
      },
    ])
  })

  it('should not yield anything for invalid JSON', async () => {
    const data = 'invalid'
    const chunks = []

    for await (const c of chunk(
      new Blob([data], { type: 'application/json' })
    )) {
      chunks.push(c)
    }

    expect(chunks).toEqual([])
  })

  it('should yield a single Chunk for a multi-key JSON object', async () => {
    const data = '{"name": "John", "city": "NYC"}'
    const chunks = []

    for await (const c of chunk(
      new Blob([data], { type: 'application/json' })
    )) {
      chunks.push(c)
    }

    expect(chunks).toEqual([{ text: 'name: John\ncity: NYC', meta: {} }])
  })

  it('should not throw for JSON object with single null property', async () => {
    const data = JSON.stringify({ items: null })
    const chunks = []

    for await (const c of chunk(
      new Blob([data], { type: 'application/json' })
    )) {
      chunks.push(c)
    }

    expect(chunks.length).toBeGreaterThanOrEqual(0)
  })
})
