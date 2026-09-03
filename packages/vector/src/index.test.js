// @note the seam here is the global fetch that the embedding call uses, and the
// data directory. Everything else runs for real: records land on disk, the
// cosine is computed, and the ordering these cases assert is the ordering a
// caller gets.
//
// The fake embedder is deterministic and one-dimensional per letter, so
// similarity is something a reader can work out by hand rather than a number
// that happens to come back. `aaa` is closer to `aab` than to `ccc`, and that
// is the whole model.

import { jest } from '@jest/globals'

import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resetConfig } from './embed'
import { resetDirectory } from './files'
import {
  assertConfigured,
  count,
  fetch as fetchRecord,
  list,
  purge,
  remove,
  removeBySource,
  search,
  upsert,
} from './index'

const originalFetch = global.fetch

/** Counts of a, b and c. Enough for meaning to be checkable by eye. */
function vectorFor(text) {
  const lower = String(text).toLowerCase()

  return ['a', 'b', 'c'].map(
    (letter) =>
      lower.split('').filter((character) => character === letter).length
  )
}

function respondWithEmbeddings() {
  global.fetch.mockImplementation(async (_url, init) => {
    const { input } = JSON.parse(init.body)

    return {
      ok: true,
      status: 200,

      json: async () => ({
        data: input.map((text, index) => ({
          index,
          embedding: vectorFor(text),
        })),
      }),
    }
  })
}

let directory

beforeEach(async () => {
  global.fetch = jest.fn()

  directory = await mkdtemp(join(tmpdir(), 'vector-'))

  process.env.VECTOR_DATA_DIR = directory
  process.env.OPENAI_API_KEY = 'test-key'

  // @note pinned to the file backend - a QDRANT_URL leaking in from the
  // environment would switch every case onto the other backend
  delete process.env.QDRANT_URL

  resetDirectory()
  resetConfig()

  respondWithEmbeddings()
})

afterEach(() => {
  global.fetch = originalFetch
})

const scope = { datasetId: 'dataset-1' }

async function seed(records) {
  await upsert({ ...scope, records })
}

describe('upsert and fetch', () => {
  it('round trips a record through the filesystem', async () => {
    await seed([
      { id: 'r1', text: 'aaa', source: 'file.txt', meta: { kind: 'note' } },
    ])

    expect(await fetchRecord({ ...scope, recordId: 'r1' })).toMatchObject({
      id: 'r1',
      text: 'aaa',
      source: 'file.txt',
      meta: { kind: 'note' },
    })
  })

  it('replaces a record with the same id and keeps its creation time', async () => {
    await seed([{ id: 'r1', text: 'aaa' }])

    const created = (await fetchRecord({ ...scope, recordId: 'r1' })).createdAt

    await seed([{ id: 'r1', text: 'bbb' }])

    const after = await fetchRecord({ ...scope, recordId: 'r1' })

    expect(after.text).toBe('bbb')
    expect(after.createdAt).toBe(created)
  })

  it('reports a record that is not there', async () => {
    await expect(
      fetchRecord({ ...scope, recordId: 'missing' })
    ).rejects.toMatchObject({ vector: true, code: 'RECORD_NOT_FOUND' })
  })

  it('does not call the embedding endpoint for an empty batch', async () => {
    await seed([])

    expect(global.fetch).not.toHaveBeenCalled()
  })

  // @note the API documents that embeddings may come back out of order, and a
  // permuted batch attaches each record's text to another record's vector -
  // which nothing would notice until search results made no sense
  it('matches vectors to records by index rather than by arrival order', async () => {
    global.fetch.mockImplementation(async (_url, init) => {
      const { input } = JSON.parse(init.body)

      const data = input.map((text, index) => ({
        index,
        embedding: vectorFor(text),
      }))

      return {
        ok: true,
        status: 200,
        json: async () => ({ data: data.reverse() }),
      }
    })

    await seed([
      { id: 'a', text: 'aaa' },
      { id: 'c', text: 'ccc' },
    ])

    const [match] = await search({ ...scope, query: 'aaa', topK: 1 })

    expect(match.id).toBe('a')
  })
})

describe('search', () => {
  beforeEach(async () => {
    await seed([
      { id: 'a', text: 'aaa', meta: { rank: 1, kind: 'note' } },
      { id: 'b', text: 'aab', meta: { rank: 2, kind: 'note' } },
      { id: 'c', text: 'ccc', meta: { rank: 3, kind: 'other' } },
    ])
  })

  it('orders by similarity', async () => {
    const matches = await search({ ...scope, query: 'aaa', topK: 3 })

    expect(matches.map(({ id }) => id)).toEqual(['a', 'b', 'c'])
  })

  it('scores an exact match at 1', async () => {
    const [match] = await search({ ...scope, query: 'aaa', topK: 1 })

    expect(match.score).toBeCloseTo(1)
  })

  it('drops matches below minScore', async () => {
    const matches = await search({ ...scope, query: 'aaa', minScore: 0.99 })

    expect(matches.map(({ id }) => id)).toEqual(['a'])
  })

  it('returns at most topK', async () => {
    expect(await search({ ...scope, query: 'aaa', topK: 2 })).toHaveLength(2)
  })

  it('returns nothing for a dataset that has never existed', async () => {
    expect(
      await search({ datasetId: 'nope', query: 'aaa' })
    ).toEqual([])
  })

  // @note an empty dataset is the normal state of a new one, and paying for an
  // embedding to search it is a cost nobody asked for
  it('does not embed the query when there is nothing to compare', async () => {
    global.fetch.mockClear()

    await search({ datasetId: 'nope', query: 'aaa' })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  describe('filters', () => {
    it.each([
      [{ kind: 'note' }, ['a', 'b']],
      [{ kind: { $eq: 'other' } }, ['c']],
      [{ kind: { $ne: 'note' } }, ['c']],
      [{ rank: { $gt: 2 } }, ['c']],
      [{ rank: { $gte: 2 } }, ['b', 'c']],
      [{ rank: { $lt: 2 } }, ['a']],
      [{ rank: { $lte: 2 } }, ['a', 'b']],
    ])('applies %o', async (filter, expected) => {
      const matches = await search({ ...scope, query: 'aaa', topK: 10, filter })

      expect(matches.map(({ id }) => id).sort()).toEqual(expected)
    })

    it('combines entries with and', async () => {
      const matches = await search({
        ...scope,
        query: 'aaa',
        topK: 10,
        filter: { kind: 'note', rank: { $gte: 2 } },
      })

      expect(matches.map(({ id }) => id)).toEqual(['b'])
    })

    // @note `'10' > 9` is true in JavaScript and false in a real index, and a
    // default that disagrees about which records match is worse than one that
    // returns fewer
    it('does not coerce a string into an ordering comparison', async () => {
      await seed([{ id: 'd', text: 'aaa', meta: { rank: '10' } }])

      const matches = await search({
        ...scope,
        query: 'aaa',
        topK: 10,
        filter: { rank: { $gt: 9 } },
      })

      expect(matches.map(({ id }) => id)).not.toContain('d')
    })
  })
})

describe('expiry', () => {
  it('hides an expired record from fetch, search, list and count', async () => {
    await seed([
      { id: 'live', text: 'aaa' },
      { id: 'gone', text: 'aaa', expiresAt: Date.now() - 1000 },
    ])

    await expect(
      fetchRecord({ ...scope, recordId: 'gone' })
    ).rejects.toMatchObject({ code: 'RECORD_NOT_FOUND' })

    const matches = await search({ ...scope, query: 'aaa', topK: 10 })

    expect(matches.map(({ id }) => id)).toEqual(['live'])

    expect((await list(scope)).records.map(({ id }) => id)).toEqual(['live'])

    expect(await count(scope)).toBe(1)
  })

  it('keeps a record whose expiry is still ahead', async () => {
    await seed([{ id: 'r1', text: 'aaa', expiresAt: Date.now() + 60_000 }])

    expect(await count(scope)).toBe(1)
  })
})

describe('list', () => {
  beforeEach(async () => {
    await seed(
      ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, text: `aa${id}` }))
    )
  })

  it('paginates over a stable order', async () => {
    const first = await list({ ...scope, limit: 2 })

    expect(first.records.map(({ id }) => id)).toEqual(['a', 'b'])
    expect(first.nextCursor).toBeDefined()

    const second = await list({ ...scope, limit: 2, cursor: first.nextCursor })

    expect(second.records.map(({ id }) => id)).toEqual(['c', 'd'])
  })

  it('omits the cursor on the last page', async () => {
    const last = await list({ ...scope, limit: 10 })

    expect(last.records).toHaveLength(5)
    expect(last.nextCursor).toBeUndefined()
  })

  it('rejects a cursor it cannot read', async () => {
    await expect(
      list({ ...scope, cursor: 'not-a-number' })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
  })
})

describe('removal', () => {
  beforeEach(async () => {
    await seed([
      { id: 'a', text: 'aaa', source: 'one.txt' },
      { id: 'b', text: 'bbb', source: 'one.txt' },
      { id: 'c', text: 'ccc', source: 'two.txt' },
    ])
  })

  it('removes by id', async () => {
    await remove({ ...scope, recordIds: ['a', 'c'] })

    expect((await list(scope)).records.map(({ id }) => id)).toEqual(['b'])
  })

  it('removes by source', async () => {
    await removeBySource({ ...scope, source: 'one.txt' })

    expect((await list(scope)).records.map(({ id }) => id)).toEqual(['c'])
  })

  it('empties a dataset', async () => {
    await purge(scope)

    expect(await count(scope)).toBe(0)
  })

  it('succeeds purging a dataset that never existed', async () => {
    await expect(
      purge({ datasetId: 'nope' })
    ).resolves.toBeUndefined()
  })
})

describe('concurrent writes', () => {
  // @note the failure this protects against is silent: both writers read the
  // same file, and the second writes away the first's record without any error
  it('does not lose a record when two upserts race', async () => {
    await Promise.all([
      upsert({ ...scope, records: [{ id: 'a', text: 'aaa' }] }),
      upsert({ ...scope, records: [{ id: 'b', text: 'bbb' }] }),
      upsert({ ...scope, records: [{ id: 'c', text: 'ccc' }] }),
    ])

    expect(await count(scope)).toBe(3)
  })

  it('keeps serving later writes after one fails', async () => {
    await upsert({ ...scope, records: [{ id: 'a', text: 'aaa' }] })

    await writeFile(join(directory, 'dataset-1.json'), 'not json', 'utf8')

    await expect(
      upsert({ ...scope, records: [{ id: 'b', text: 'bbb' }] })
    ).rejects.toMatchObject({ code: 'VECTOR_UNAVAILABLE' })

    await writeFile(join(directory, 'dataset-1.json'), '{"records":{}}', 'utf8')

    await expect(
      upsert({ ...scope, records: [{ id: 'c', text: 'ccc' }] })
    ).resolves.toBeUndefined()
  })
})

describe('storage', () => {
  // @note a dataset id containing a path separator would otherwise decide
  // where the file lands
  it('does not let a name escape the data directory', async () => {
    await upsert({
      datasetId: '../../etc/passwd',
      records: [{ id: 'r1', text: 'aaa' }],
    })

    const file = join(directory, `${encodeURIComponent('../../etc/passwd')}.json`)

    await expect(readFile(file, 'utf8')).resolves.toContain('r1')
  })

  it('reports a dataset file that cannot be parsed', async () => {
    await seed([{ id: 'a', text: 'aaa' }])

    await writeFile(join(directory, 'dataset-1.json'), '{', 'utf8')

    await expect(count(scope)).rejects.toMatchObject({
      code: 'VECTOR_UNAVAILABLE',
    })
  })
})

describe('embedding failures', () => {
  it('reports a rejected key as NOT_AUTHORIZED', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'invalid api key',
    })

    await expect(seed([{ id: 'a', text: 'aaa' }])).rejects.toMatchObject({
      vector: true,
      code: 'NOT_AUTHORIZED',
    })
  })

  it('reports an unreachable endpoint as EMBEDDING_FAILED', async () => {
    global.fetch.mockRejectedValue(new TypeError('fetch failed'))

    await expect(seed([{ id: 'a', text: 'aaa' }])).rejects.toMatchObject({
      code: 'EMBEDDING_FAILED',
    })
  })

  it('refuses a short batch rather than misattributing vectors', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ index: 0, embedding: [1, 0, 0] }] }),
    })

    await expect(
      seed([
        { id: 'a', text: 'aaa' },
        { id: 'b', text: 'bbb' },
      ])
    ).rejects.toMatchObject({ code: 'EMBEDDING_FAILED' })
  })
})

describe('assertConfigured', () => {
  it('resolves when the directory is writable and the key works', async () => {
    await expect(assertConfigured()).resolves.toBeUndefined()
  })

  it('names OPENAI_API_KEY when it is missing', async () => {
    delete process.env.OPENAI_API_KEY

    resetConfig()

    await expect(assertConfigured()).rejects.toThrow(/OPENAI_API_KEY/)
  })

  it('names the data directory when embedding fails', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'boom',
    })

    await expect(assertConfigured()).rejects.toThrow(directory)
  })

  // @note the guarantee the whole module shape rests on
  it('does not read the environment at import', async () => {
    delete process.env.OPENAI_API_KEY
    delete process.env.VECTOR_DATA_DIR

    resetConfig()
    resetDirectory()

    await expect(import('./index')).resolves.toBeDefined()
  })
})
