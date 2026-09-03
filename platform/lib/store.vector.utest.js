// @note this suite used to assert that long text was cut down before it reached
// the service client. That client is now behind `@chatbotkit-dev/vector`, and so
// is the truncation - the token budget belongs to whichever model the installed
// backend embeds with, which is not something a site can know. Both have tests
// of their own.
//
// What is left here is the platform's own half: the search defaults, which
// metadata is worth indexing, the `Date` shape its callers expect, and turning
// a missing record into a 404.

import { VectorServiceStore } from '@/lib/store.vector'

const provider = {
  upsert: jest.fn(),
  fetch: jest.fn(),
  list: jest.fn(),
  count: jest.fn(),
  search: jest.fn(),
  remove: jest.fn(),
  removeBySource: jest.fn(),
  purge: jest.fn(),
}

jest.mock('@chatbotkit-dev/vector', () => ({
  __esModule: true,

  default: {
    upsert: (...args) => provider.upsert(...args),
    fetch: (...args) => provider.fetch(...args),
    list: (...args) => provider.list(...args),
    count: (...args) => provider.count(...args),
    search: (...args) => provider.search(...args),
    remove: (...args) => provider.remove(...args),
    removeBySource: (...args) => provider.removeBySource(...args),
    purge: (...args) => provider.purge(...args),
  },
}))

/** Brands an error the way the contract requires it to be recognised. */
function vectorError(code) {
  const error = new Error(code)

  error.vector = true
  error.code = code

  return error
}

beforeEach(() => {
  jest.clearAllMocks()

  provider.upsert.mockResolvedValue(undefined)
  provider.remove.mockResolvedValue(undefined)
  provider.removeBySource.mockResolvedValue(undefined)
  provider.purge.mockResolvedValue(undefined)
})

describe('writes', () => {
  it('names the dataset it writes to', async () => {
    const store = new VectorServiceStore()

    await store.upsertRecord({
      datasetId: 'd1',
      recordId: 'r1',
      text: 'hello',
    })

    expect(provider.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ datasetId: 'd1' })
    )
  })

  // @note the two used to be functions with byte-identical bodies, which is why
  // one is now the other. The `Store` shape keeps both because its callers do.
  it('creates a record the same way it upserts one', async () => {
    const store = new VectorServiceStore()

    const options = { datasetId: 'd1', recordId: 'r1', text: 'hello' }

    await store.createRecord(options)

    const created = provider.upsert.mock.calls[0][0]

    provider.upsert.mockClear()

    await store.upsertRecord(options)

    expect(provider.upsert.mock.calls[0][0]).toEqual(created)
  })

  // @note deciding what is worth indexing about a record is the platform's
  // judgement, not a backend's - an array of tags becoming a comma-separated
  // string is a choice about search, and it is made here
  it('flattens metadata before handing it over', async () => {
    const store = new VectorServiceStore()

    await store.upsertRecord({
      datasetId: 'd1',
      recordId: 'r1',
      text: 'hello',
      meta: { tags: ['a', 'b'], nested: { dropped: true }, count: 2 },
    })

    expect(provider.upsert.mock.calls[0][0].records[0].meta).toEqual({
      tags: 'a,b',
      count: 2,
    })
  })

  it('passes expiry through unconverted, in milliseconds', async () => {
    const store = new VectorServiceStore()

    await store.upsertRecord({
      datasetId: 'd1',
      recordId: 'r1',
      text: 'hello',
      expiresAt: 1_700_000_000_500,
    })

    expect(provider.upsert.mock.calls[0][0].records[0].expiresAt).toBe(
      1_700_000_000_500
    )
  })

  it('merges an update onto what is already stored', async () => {
    provider.fetch.mockResolvedValue({
      id: 'r1',
      text: 'original',
      source: 'a.txt',
      meta: { kind: 'note' },
    })

    const store = new VectorServiceStore()

    await store.updateRecord({
      datasetId: 'd1',
      recordId: 'r1',
      text: 'replaced',
    })

    expect(provider.upsert.mock.calls[0][0].records[0]).toMatchObject({
      id: 'r1',
      text: 'replaced',
      source: 'a.txt',
      meta: { kind: 'note' },
    })
  })
})

describe('reads', () => {
  it('turns contract milliseconds into the dates callers expect', async () => {
    provider.fetch.mockResolvedValue({
      id: 'r1',
      text: 'hello',
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_060_000,
    })

    const store = new VectorServiceStore()

    const record = await store.accessRecord({
      datasetId: 'd1',
      recordId: 'r1',
    })

    expect(record.createdAt).toEqual(new Date(1_700_000_000_000))
    expect(record.updatedAt).toEqual(new Date(1_700_000_060_000))
  })

  it('leaves timestamps absent when the backend has none', async () => {
    provider.fetch.mockResolvedValue({ id: 'r1', text: 'hello' })

    const store = new VectorServiceStore()

    const record = await store.accessRecord({
      datasetId: 'd1',
      recordId: 'r1',
    })

    expect(record.createdAt).toBeUndefined()
  })

  // @note the one contract error this file translates, because it is the only
  // one a caller of accessRecord can do anything about
  it('turns a missing record into a not found', async () => {
    provider.fetch.mockRejectedValue(vectorError('RECORD_NOT_FOUND'))

    const store = new VectorServiceStore()

    await expect(
      store.accessRecord({ datasetId: 'd1', recordId: 'r1' })
    ).rejects.toThrow(/Record not found: r1/)
  })

  it('lets any other failure through untouched', async () => {
    provider.fetch.mockRejectedValue(vectorError('VECTOR_UNAVAILABLE'))

    const store = new VectorServiceStore()

    await expect(
      store.accessRecord({ datasetId: 'd1', recordId: 'r1' })
    ).rejects.toMatchObject({ code: 'VECTOR_UNAVAILABLE' })
  })

  it('carries pagination through', async () => {
    provider.list.mockResolvedValue({
      records: [{ id: 'r1', text: 'hello' }],
      nextCursor: 'next',
    })

    const store = new VectorServiceStore()

    const result = await store.listRecords({ datasetId: 'd1', limit: 1 })

    expect(result.nextCursor).toBe('next')
    expect(result.records[0].id).toBe('r1')
  })
})

describe('search defaults', () => {
  beforeEach(() => {
    provider.search.mockResolvedValue([])
  })

  it('applies the default minimum score and hybrid weighting', async () => {
    const store = new VectorServiceStore()

    await store.searchRecords({ datasetId: 'd1', search: 'hello' })

    expect(provider.search).toHaveBeenCalledWith(
      expect.objectContaining({ minScore: 0, alpha: 0.9 })
    )
  })

  it('lets the caller override the defaults', async () => {
    const store = new VectorServiceStore()

    await store.searchRecords({
      datasetId: 'd1',
      search: 'hello',
      minScore: 0.1,
      maxRecords: 25,
    })

    expect(provider.search).toHaveBeenCalledWith(
      expect.objectContaining({ minScore: 0.1, topK: 25 })
    )
  })

  it('defaults to three records', async () => {
    const store = new VectorServiceStore()

    await store.searchRecords({ datasetId: 'd1', search: 'hello' })

    expect(provider.search).toHaveBeenCalledWith(
      expect.objectContaining({ topK: 3 })
    )
  })

  it('carries the score onto the result', async () => {
    provider.search.mockResolvedValue([
      { id: 'r1', text: 'hello', score: 0.42 },
    ])

    const store = new VectorServiceStore()

    const [match] = await store.searchRecords({
      datasetId: 'd1',
      search: 'hello',
    })

    expect(match).toMatchObject({ id: 'r1', score: 0.42 })
  })
})

describe('deletes', () => {
  it('removes one record', async () => {
    await new VectorServiceStore().deleteRecord({
      datasetId: 'd1',
      recordId: 'r1',
    })

    expect(provider.remove).toHaveBeenCalledWith(
      expect.objectContaining({ recordIds: ['r1'] })
    )
  })

  it('removes many', async () => {
    await new VectorServiceStore().deleteRecords({
      datasetId: 'd1',
      recordIds: ['r1', 'r2'],
    })

    expect(provider.remove).toHaveBeenCalledWith(
      expect.objectContaining({ recordIds: ['r1', 'r2'] })
    )
  })

  it('removes by source', async () => {
    await new VectorServiceStore().deleteRecordsBySource({
      datasetId: 'd1',
      source: 'a.txt',
    })

    expect(provider.removeBySource).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'a.txt' })
    )
  })

  it('deletes a dataset by purging it', async () => {
    await new VectorServiceStore().deleteDataset({
      datasetId: 'd1',
    })

    expect(provider.purge).toHaveBeenCalledWith(
      expect.objectContaining({ datasetId: 'd1' })
    )
  })

  // @note a dataset comes into existence when a record is put in it, which is
  // what every backend the platform has had already did
  it('creates a dataset without asking the backend for anything', async () => {
    await new VectorServiceStore().createDataset({
      datasetId: 'd1',
    })

    expect(provider.upsert).not.toHaveBeenCalled()
  })
})
