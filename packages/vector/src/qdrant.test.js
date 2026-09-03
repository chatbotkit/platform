// @note exercises the Qdrant backend against a real server, which is why the
// whole file gates on QDRANT_URL: without a server there is nothing honest to
// test. CI and local runs get one from the docker compose at the repository
// root, or from any Qdrant pointed at by QDRANT_URL.
//
// Only the embedding call is faked - the same deterministic per-letter
// embedder index.test.js uses, so similarity is checkable by hand - and it is
// faked by wrapping fetch rather than replacing it, so every Qdrant round
// trip in these cases is real: collections get created, filters run on the
// server, and the ordering asserted here is the ordering a caller gets.

// @note the ESM jest preset provides no `jest` global in this package's config
import { randomUUID } from 'node:crypto'

import { resetConfig } from './embed'
import { VectorError } from './error'
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
} from './qdrant'

const describeWithQdrant = process.env.QDRANT_URL ? describe : describe.skip

const originalFetch = global.fetch

/** Counts of a, b and c. Enough for meaning to be checkable by eye. */
function vectorFor(text) {
  const lower = String(text).toLowerCase()

  return ['a', 'b', 'c'].map(
    (letter) =>
      lower.split('').filter((character) => character === letter).length
  )
}

// @note dataset ids are unique per run - collections now derive from the
// dataset id alone, and a shared Qdrant server must keep concurrent runs apart
const run = `qdrant-test-${randomUUID()}`

const dataset = (name) => `${run}-${name}`

const scope = { datasetId: dataset('dataset-1') }

const datasets = new Set()

async function seed(records, datasetId = scope.datasetId) {
  datasets.add(datasetId)

  await upsert({ datasetId, records })
}

describeWithQdrant('the qdrant backend', () => {
  beforeAll(() => {
    process.env.OPENAI_API_KEY = 'test-key'

    resetConfig()

    global.fetch = async (url, init) => {
      if (String(url).includes('/embeddings')) {
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
      }

      return originalFetch(url, init)
    }
  })

  afterAll(async () => {
    for (const datasetId of datasets) {
      await purge({ datasetId })
    }

    global.fetch = originalFetch
  })

  afterEach(async () => {
    for (const datasetId of datasets) {
      await purge({ datasetId })
    }

    datasets.clear()
  })

  describe('upsert and fetch', () => {
    it('round trips a record', async () => {
      await seed([
        { id: 'r1', text: 'aaa', source: 'file.txt', meta: { kind: 'note' } },
      ])

      const record = await fetchRecord({ ...scope, recordId: 'r1' })

      expect(record).toMatchObject({
        id: 'r1',
        text: 'aaa',
        source: 'file.txt',
        meta: { kind: 'note' },
      })

      expect(typeof record.createdAt).toBe('number')
      expect(typeof record.updatedAt).toBe('number')
    })

    it('replaces a record with the same id and keeps its creation time', async () => {
      await seed([{ id: 'r1', text: 'aaa' }])

      const created = (await fetchRecord({ ...scope, recordId: 'r1' }))
        .createdAt

      await seed([{ id: 'r1', text: 'bbb' }])

      const after = await fetchRecord({ ...scope, recordId: 'r1' })

      expect(after.text).toBe('bbb')
      expect(after.createdAt).toBe(created)
      expect(await count(scope)).toBe(1)
    })

    it('throws RECORD_NOT_FOUND for a record that is not there', async () => {
      await seed([{ id: 'r1', text: 'aaa' }])

      await expect(
        fetchRecord({ ...scope, recordId: 'missing' })
      ).rejects.toMatchObject({ vector: true, code: 'RECORD_NOT_FOUND' })
    })

    it('throws RECORD_NOT_FOUND for a dataset that has never existed', async () => {
      await expect(
        fetchRecord({ datasetId: dataset('never-written'), recordId: 'r1' })
      ).rejects.toMatchObject({ vector: true, code: 'RECORD_NOT_FOUND' })
    })
  })

  describe('search', () => {
    it('ranks by similarity and honours topK', async () => {
      await seed([
        { id: 'close', text: 'aab' },
        { id: 'closest', text: 'aaa' },
        { id: 'far', text: 'ccc' },
      ])

      const matches = await search({ ...scope, query: 'aaa', topK: 2 })

      expect(matches.map(({ id }) => id)).toEqual(['closest', 'close'])
      expect(matches[0].score).toBeGreaterThan(matches[1].score)
    })

    it('drops matches below minScore', async () => {
      await seed([
        { id: 'closest', text: 'aaa' },
        { id: 'far', text: 'ccc' },
      ])

      const matches = await search({
        ...scope,
        query: 'aaa',
        topK: 10,
        minScore: 0.9,
      })

      expect(matches.map(({ id }) => id)).toEqual(['closest'])
    })

    it('returns nothing for a dataset that has never existed', async () => {
      expect(
        await search({ datasetId: dataset('never-written'), query: 'aaa' })
      ).toEqual([])
    })

    it('filters on metadata equality, including numbers', async () => {
      await seed([
        { id: 'r1', text: 'aaa', meta: { kind: 'note', rank: 1.5 } },
        { id: 'r2', text: 'aaa', meta: { kind: 'page', rank: 2 } },
      ])

      expect(
        (
          await search({
            ...scope,
            query: 'aaa',
            filter: { kind: 'note' },
          })
        ).map(({ id }) => id)
      ).toEqual(['r1'])

      expect(
        (
          await search({
            ...scope,
            query: 'aaa',
            filter: { rank: { $eq: 1.5 } },
          })
        ).map(({ id }) => id)
      ).toEqual(['r1'])
    })

    it('matches $ne on records that lack the key at all', async () => {
      await seed([
        { id: 'tagged', text: 'aaa', meta: { kind: 'note' } },
        { id: 'bare', text: 'aaa' },
      ])

      const matches = await search({
        ...scope,
        query: 'aaa',
        topK: 10,
        filter: { kind: { $ne: 'note' } },
      })

      expect(matches.map(({ id }) => id)).toEqual(['bare'])
    })

    it('compares only numbers with the ordering operators', async () => {
      await seed([
        { id: 'numeric', text: 'aaa', meta: { rank: 10 } },
        { id: 'stringy', text: 'aaa', meta: { rank: '10' } },
      ])

      const matches = await search({
        ...scope,
        query: 'aaa',
        topK: 10,
        filter: { rank: { $gt: 9 } },
      })

      expect(matches.map(({ id }) => id)).toEqual(['numeric'])
    })
  })

  describe('expiry', () => {
    it('never returns an expired record', async () => {
      const now = Date.now()

      await seed([
        { id: 'live', text: 'aaa', expiresAt: now + 60_000 },
        { id: 'dead', text: 'aaa', expiresAt: now - 1 },
        { id: 'forever', text: 'aaa' },
      ])

      expect(await count(scope)).toBe(2)

      expect(
        (await search({ ...scope, query: 'aaa', topK: 10 }))
          .map(({ id }) => id)
          .sort()
      ).toEqual(['forever', 'live'])

      expect(
        (await list(scope)).records.map(({ id }) => id).sort()
      ).toEqual(['forever', 'live'])

      await expect(
        fetchRecord({ ...scope, recordId: 'dead' })
      ).rejects.toMatchObject({ code: 'RECORD_NOT_FOUND' })
    })
  })

  describe('list', () => {
    it('paginates the whole dataset without duplicates', async () => {
      await seed(
        Array.from({ length: 5 }, (_, index) => ({
          id: `r${index}`,
          text: 'aaa',
        }))
      )

      const seen = []

      let cursor

      do {
        const page = await list({ ...scope, cursor, limit: 2 })

        expect(page.records.length).toBeLessThanOrEqual(2)

        seen.push(...page.records.map(({ id }) => id))

        cursor = page.nextCursor
      } while (cursor)

      expect(seen.sort()).toEqual(['r0', 'r1', 'r2', 'r3', 'r4'])
    })

    it('lists nothing for a dataset that has never existed', async () => {
      expect(await list({ datasetId: dataset('never-written') })).toEqual({
        records: [],
      })
    })
  })

  describe('removal', () => {
    it('removes records by id', async () => {
      await seed([
        { id: 'r1', text: 'aaa' },
        { id: 'r2', text: 'aaa' },
      ])

      await remove({ ...scope, recordIds: ['r1'] })

      expect(await count(scope)).toBe(1)

      await expect(
        fetchRecord({ ...scope, recordId: 'r1' })
      ).rejects.toMatchObject({ code: 'RECORD_NOT_FOUND' })
    })

    it('removes records by source', async () => {
      await seed([
        { id: 'r1', text: 'aaa', source: 'a.txt' },
        { id: 'r2', text: 'aaa', source: 'a.txt' },
        { id: 'r3', text: 'aaa', source: 'b.txt' },
      ])

      await removeBySource({ ...scope, source: 'a.txt' })

      expect((await list(scope)).records.map(({ id }) => id)).toEqual(['r3'])
    })

    it('purges a dataset, and purging one that never existed succeeds', async () => {
      await seed([{ id: 'r1', text: 'aaa' }])

      await purge(scope)

      expect(await count(scope)).toBe(0)
      expect(await search({ ...scope, query: 'aaa' })).toEqual([])

      await expect(
        purge({ datasetId: dataset('never-written') })
      ).resolves.toBeUndefined()
    })
  })

  describe('isolation', () => {
    it('keeps datasets apart', async () => {
      await seed([{ id: 'r1', text: 'aaa' }], dataset('dataset-1'))
      await seed([{ id: 'r2', text: 'aaa' }], dataset('dataset-2'))

      expect(
        (await list({ datasetId: dataset('dataset-1') })).records.map(
          ({ id }) => id
        )
      ).toEqual(['r1'])

      expect(
        (await list({ datasetId: dataset('dataset-2') })).records.map(
          ({ id }) => id
        )
      ).toEqual(['r2'])
    })
  })

  describe('assertConfigured', () => {
    it('resolves against a reachable server', async () => {
      await expect(assertConfigured()).resolves.toBeUndefined()
    })
  })

  describe('errors', () => {
    it('brands its failures as vector errors', async () => {
      expect(new VectorError('UNKNOWN', 'x').vector).toBe(true)
    })
  })
})
