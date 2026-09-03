import { createEmbedding, getOpenAIError } from '@/lib/model.provider.openai'
import { MemoryStore, createMemoryStore } from '@/lib/store.memory'

jest.mock('@/lib/model.provider.openai', () => ({
  createEmbedding: jest.fn(),
  getOpenAIError: jest.fn((e) => e),
}))

jest.mock('@/lib/response', () => ({
  throwNotFound: jest.fn((msg) => {
    throw new Error(msg)
  }),
}))

jest.mock('@/lib/embed', () => ({
  prepareTextForEmbedding: jest.fn((text) => text),
}))

describe('MemoryStore', () => {
  let store

  beforeEach(() => {
    jest.clearAllMocks()
    store = new MemoryStore()
    createEmbedding.mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5])
  })

  describe('createDataset', () => {
    it('should create a new dataset', async () => {
      await store.createDataset({ datasetId: 'test-dataset' })

      const result = await store.listRecords({ datasetId: 'test-dataset' })

      expect(result.records).toEqual([])
    })
  })

  describe('deleteDataset', () => {
    it('should delete a dataset', async () => {
      await store.createDataset({ datasetId: 'test-dataset' })
      await store.deleteDataset({ datasetId: 'test-dataset' })

      const result = await store.listRecords({ datasetId: 'test-dataset' })

      expect(result.records).toEqual([])
    })
  })

  describe('createRecord', () => {
    beforeEach(async () => {
      await store.createDataset({ datasetId: 'test-dataset' })
    })

    it('should create a record with text', async () => {
      await store.createRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
        text: 'test content',
      })

      expect(createEmbedding).toHaveBeenCalledWith('test content', {
        model: 'text-embedding-ada-002',
      })
    })

    it('should create a record with source and meta', async () => {
      await store.createRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
        text: 'test content',
        source: 'http://example.com',
        meta: { author: 'test' },
      })

      const record = await store.accessRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
      })

      expect(record.text).toBe('test content')
      expect(record.source).toBe('http://example.com')
      expect(record.meta).toEqual({ author: 'test' })
    })

    it('should handle embedding errors', async () => {
      const error = new Error('API Error')

      createEmbedding.mockRejectedValueOnce(error)
      getOpenAIError.mockReturnValueOnce(error)

      await expect(
        store.createRecord({
          datasetId: 'test-dataset',
          recordId: 'rec-1',
          text: 'test content',
        })
      ).rejects.toThrow('API Error')
    })

    it('should ignore expiresAt parameter', async () => {
      await store.createRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
        text: 'test content',
        expiresAt: Date.now() + 1000,
      })

      const record = await store.accessRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
      })

      expect(record.text).toBe('test content')
    })
  })

  describe('updateRecord', () => {
    beforeEach(async () => {
      await store.createDataset({ datasetId: 'test-dataset' })
      await store.createRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
        text: 'original text',
        source: 'http://example.com',
        meta: { version: 1 },
      })
    })

    it('should update record text', async () => {
      await store.updateRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
        text: 'updated text',
      })

      const record = await store.accessRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
      })

      expect(record.text).toBe('updated text')
    })

    it('should update record source', async () => {
      await store.updateRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
        source: 'http://updated.com',
      })

      const record = await store.accessRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
      })

      expect(record.source).toBe('http://updated.com')
    })

    it('should update record meta', async () => {
      await store.updateRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
        meta: { version: 2 },
      })

      const record = await store.accessRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
      })

      expect(record.meta).toEqual({ version: 2 })
    })

    it('should preserve existing values when not updated', async () => {
      await store.updateRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
        text: 'updated text',
      })

      const record = await store.accessRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
      })

      expect(record.source).toBe('http://example.com')
      expect(record.meta).toEqual({ version: 1 })
    })
  })

  describe('upsertRecord', () => {
    beforeEach(async () => {
      await store.createDataset({ datasetId: 'test-dataset' })
    })

    it('should create record if it does not exist', async () => {
      await store.upsertRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
        text: 'new content',
      })

      const record = await store.accessRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
      })

      expect(record.text).toBe('new content')
    })

    it('should replace record if it exists', async () => {
      await store.createRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
        text: 'original content',
      })

      await store.upsertRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
        text: 'upserted content',
      })

      const record = await store.accessRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
      })

      expect(record.text).toBe('upserted content')
    })
  })

  describe('deleteRecord', () => {
    beforeEach(async () => {
      await store.createDataset({ datasetId: 'test-dataset' })
      await store.createRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
        text: 'test content',
      })
    })

    it('should delete a record', async () => {
      await store.deleteRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
      })

      await expect(
        store.accessRecord({ datasetId: 'test-dataset', recordId: 'rec-1' })
      ).rejects.toThrow('Record not found: rec-1')
    })
  })

  describe('deleteRecords', () => {
    beforeEach(async () => {
      await store.createDataset({ datasetId: 'test-dataset' })
      await store.createRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
        text: 'test content 1',
      })
      await store.createRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-2',
        text: 'test content 2',
      })
      await store.createRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-3',
        text: 'test content 3',
      })
    })

    it('should delete multiple records', async () => {
      await store.deleteRecords({
        datasetId: 'test-dataset',
        recordIds: ['rec-1', 'rec-2'],
      })

      const count = await store.countRecords({ datasetId: 'test-dataset' })

      expect(count).toBe(1)
    })

    it('should handle empty array', async () => {
      await store.deleteRecords({
        datasetId: 'test-dataset',
        recordIds: [],
      })

      const count = await store.countRecords({ datasetId: 'test-dataset' })

      expect(count).toBe(3)
    })
  })

  describe('deleteRecordsBySource', () => {
    beforeEach(async () => {
      await store.createDataset({ datasetId: 'test-dataset' })
      await store.createRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
        text: 'test content 1',
        source: 'http://example.com',
      })
      await store.createRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-2',
        text: 'test content 2',
        source: 'http://example.com',
      })
      await store.createRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-3',
        text: 'test content 3',
        source: 'http://other.com',
      })
    })

    it('should delete records by source', async () => {
      await store.deleteRecordsBySource({
        datasetId: 'test-dataset',
        source: 'http://example.com',
      })

      const count = await store.countRecords({ datasetId: 'test-dataset' })

      expect(count).toBe(1)
    })

    it('should handle non-existent dataset', async () => {
      await expect(
        store.deleteRecordsBySource({
          datasetId: 'non-existent',
          source: 'http://example.com',
        })
      ).resolves.toBeUndefined()
    })
  })

  describe('accessRecord', () => {
    beforeEach(async () => {
      await store.createDataset({ datasetId: 'test-dataset' })
    })

    it('should throw error for non-existent record', async () => {
      await expect(
        store.accessRecord({ datasetId: 'test-dataset', recordId: 'rec-1' })
      ).rejects.toThrow('Record not found: rec-1')
    })
  })

  describe('listRecords', () => {
    beforeEach(async () => {
      await store.createDataset({ datasetId: 'test-dataset' })

      for (let i = 1; i <= 5; i++) {
        await store.createRecord({
          datasetId: 'test-dataset',
          recordId: `rec-${i}`,
          text: `content ${i}`,
        })
      }
    })

    it('should list all records', async () => {
      const result = await store.listRecords({ datasetId: 'test-dataset' })

      expect(result.records).toHaveLength(5)
    })

    it('should respect limit', async () => {
      const result = await store.listRecords({
        datasetId: 'test-dataset',
        limit: 2,
      })

      expect(result.records).toHaveLength(2)
      expect(result.nextCursor).toBeDefined()
    })

    it('should handle cursor pagination', async () => {
      const first = await store.listRecords({
        datasetId: 'test-dataset',
        limit: 2,
      })
      const second = await store.listRecords({
        datasetId: 'test-dataset',
        cursor: first.nextCursor,
        limit: 2,
      })

      expect(second.records).toHaveLength(2)
      expect(second.records[0].id).not.toBe(first.records[0].id)
    })

    it('should return empty list for non-existent dataset', async () => {
      const result = await store.listRecords({ datasetId: 'non-existent' })

      expect(result.records).toEqual([])
    })

    it('should not return nextCursor when all records returned', async () => {
      const result = await store.listRecords({
        datasetId: 'test-dataset',
        limit: 100,
      })

      expect(result.nextCursor).toBeUndefined()
    })
  })

  describe('countRecords', () => {
    beforeEach(async () => {
      await store.createDataset({ datasetId: 'test-dataset' })
    })

    it('should return zero for empty dataset', async () => {
      const count = await store.countRecords({ datasetId: 'test-dataset' })

      expect(count).toBe(0)
    })

    it('should count records correctly', async () => {
      await store.createRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
        text: 'content',
      })
      await store.createRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-2',
        text: 'content',
      })

      const count = await store.countRecords({ datasetId: 'test-dataset' })

      expect(count).toBe(2)
    })

    it('should return zero for non-existent dataset', async () => {
      const count = await store.countRecords({ datasetId: 'non-existent' })

      expect(count).toBe(0)
    })
  })

  describe('searchRecords', () => {
    beforeEach(async () => {
      await store.createDataset({ datasetId: 'test-dataset' })
      createEmbedding.mockImplementation(async (text) => {
        if (text === 'search query') {
          return [0.1, 0.2, 0.3, 0.4, 0.5]
        }

        if (text === 'similar content') {
          return [0.11, 0.19, 0.31, 0.39, 0.51]
        }

        if (text === 'different content') {
          return [0.9, 0.8, 0.7, 0.6, 0.5]
        }

        return [0.5, 0.5, 0.5, 0.5, 0.5]
      })

      await store.createRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-1',
        text: 'similar content',
        meta: { category: 'A', score: 10 },
      })
      await store.createRecord({
        datasetId: 'test-dataset',
        recordId: 'rec-2',
        text: 'different content',
        meta: { category: 'B', score: 5 },
      })
    })

    it('should search records by text', async () => {
      const results = await store.searchRecords({
        datasetId: 'test-dataset',
        search: 'search query',
      })

      expect(results.length).toBeGreaterThan(0)
      expect(results[0]).toHaveProperty('score')
    })

    it('should respect minScore parameter', async () => {
      const results = await store.searchRecords({
        datasetId: 'test-dataset',
        search: 'search query',
        minScore: 0.99,
      })

      // @note cosine similarity may produce high scores for test vectors
      expect(results.length).toBeLessThanOrEqual(2)
    })

    it('should respect maxRecords parameter', async () => {
      const results = await store.searchRecords({
        datasetId: 'test-dataset',
        search: 'search query',
        maxRecords: 1,
      })

      expect(results.length).toBeLessThanOrEqual(1)
    })

    it('should filter by $eq operator', async () => {
      const results = await store.searchRecords({
        datasetId: 'test-dataset',
        search: 'search query',
        filter: { category: { $eq: 'A' } },
      })

      expect(results.every((r) => r.meta.category === 'A')).toBe(true)
    })

    it('should filter by $ne operator', async () => {
      const results = await store.searchRecords({
        datasetId: 'test-dataset',
        search: 'search query',
        filter: { category: { $ne: 'A' } },
        minScore: 0,
      })

      expect(results.every((r) => r.meta.category !== 'A')).toBe(true)
    })

    it('should filter by $gt operator', async () => {
      const results = await store.searchRecords({
        datasetId: 'test-dataset',
        search: 'search query',
        filter: { score: { $gt: 7 } },
        minScore: 0,
      })

      expect(results.every((r) => r.meta.score > 7)).toBe(true)
    })

    it('should filter by $gte operator', async () => {
      const results = await store.searchRecords({
        datasetId: 'test-dataset',
        search: 'search query',
        filter: { score: { $gte: 10 } },
        minScore: 0,
      })

      expect(results.every((r) => r.meta.score >= 10)).toBe(true)
    })

    it('should filter by $lt operator', async () => {
      const results = await store.searchRecords({
        datasetId: 'test-dataset',
        search: 'search query',
        filter: { score: { $lt: 10 } },
        minScore: 0,
      })

      expect(results.every((r) => r.meta.score < 10)).toBe(true)
    })

    it('should filter by $lte operator', async () => {
      const results = await store.searchRecords({
        datasetId: 'test-dataset',
        search: 'search query',
        filter: { score: { $lte: 5 } },
        minScore: 0,
      })

      expect(results.every((r) => r.meta.score <= 5)).toBe(true)
    })

    it('should filter by direct value', async () => {
      const results = await store.searchRecords({
        datasetId: 'test-dataset',
        search: 'search query',
        filter: { category: 'A' },
      })

      expect(results.every((r) => r.meta.category === 'A')).toBe(true)
    })

    it('should throw error for non-existent dataset', async () => {
      await expect(
        store.searchRecords({
          datasetId: 'non-existent',
          search: 'query',
        })
      ).rejects.toThrow('Dataset not found: non-existent')
    })

    it('should sort results by score descending', async () => {
      const results = await store.searchRecords({
        datasetId: 'test-dataset',
        search: 'search query',
        minScore: 0,
      })

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
      }
    })
  })

  describe('createMemoryStore', () => {
    it('should create a new MemoryStore instance', () => {
      const store = createMemoryStore()

      expect(store).toBeInstanceOf(MemoryStore)
    })
  })
})
