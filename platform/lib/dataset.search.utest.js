/**
 * @jest-environment node
 */
import { captureError, captureException } from '@/lib/error'
import { logEvent } from '@/lib/log'
import { rerank } from '@/lib/rerank'
import { getStore } from '@/lib/store.types'
import { recordRerankTokenUsage } from '@/lib/usage.record'

import { searchDataset } from './dataset.search'

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
  captureException: jest.fn(),
}))

jest.mock('@/lib/store.types', () => ({
  getStore: jest.fn(),
}))

jest.mock('@/lib/rerank', () => ({
  rerank: jest.fn(),
}))

jest.mock('@/lib/usage.record', () => ({
  recordRerankTokenUsage: jest.fn(),
}))

describe('searchDataset', () => {
  const userId = 'user-123'
  const mockDataset = {
    id: 'dataset-123',
    userId: 'user-123',
    blueprintId: 'blueprint-123',
    searchMinScore: 0.7,
    searchMaxRecords: 10,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should search dataset without reranker', async () => {
      const mockRecords = [
        { id: 'record-1', text: 'test content 1', score: 0.9 },
        { id: 'record-2', text: 'test content 2', score: 0.8 },
      ]

      const mockStore = {
        searchRecords: jest.fn().mockResolvedValue(mockRecords),
      }

      getStore.mockResolvedValue(mockStore)

      const result = await searchDataset(userId, mockDataset, 'test query')

      expect(getStore).toHaveBeenCalledWith()
      expect(mockStore.searchRecords).toHaveBeenCalledWith({
        datasetId: 'dataset-123',
        search: 'test query',
        minScore: 0.7,
        maxRecords: 10,
        filter: undefined,
      })
      expect(result).toEqual(mockRecords)
      expect(logEvent).toHaveBeenCalledWith({
        user: { id: 'user-123' },
        type: 'dataset.search',
        relations: {
          blueprintId: 'blueprint-123',
          datasetId: 'dataset-123',
        },
        meta: {
          search: 'test query',
          records: ['record-1', 'record-2'],
        },
      })
    })

    it('should search dataset with filter', async () => {
      const mockRecords = [
        { id: 'record-1', text: 'filtered content', score: 0.9 },
      ]
      const filter = { category: 'test' }

      const mockStore = {
        searchRecords: jest.fn().mockResolvedValue(mockRecords),
      }

      getStore.mockResolvedValue(mockStore)

      const result = await searchDataset(userId, mockDataset, 'query', filter)

      expect(mockStore.searchRecords).toHaveBeenCalledWith({
        datasetId: 'dataset-123',
        search: 'query',
        minScore: 0.7,
        maxRecords: 10,
        filter: { category: 'test' },
      })
      expect(result).toEqual(mockRecords)
    })

    it('should handle empty search results', async () => {
      const mockStore = {
        searchRecords: jest.fn().mockResolvedValue([]),
      }

      getStore.mockResolvedValue(mockStore)

      const result = await searchDataset(userId, mockDataset, 'no match')

      expect(result).toEqual([])
    })
  })

  describe('reranker functionality', () => {
    const datasetWithReranker = {
      ...mockDataset,
      reranker: 'rerank-v4-fast',
    }

    function mockRerank(documents, outputTokens = 1) {
      rerank.mockResolvedValue({
        documents,
        usage: { model: 'rerank-v4-fast', inputTokens: 0, outputTokens },
      })
    }

    it('should use reranker when specified', async () => {
      const mockRecords = [
        { id: 'record-1', text: 'content 1', score: 0.9 },
        { id: 'record-2', text: 'content 2', score: 0.8 },
        { id: 'record-3', text: 'content 3', score: 0.75 },
      ]

      const mockStore = {
        searchRecords: jest.fn().mockResolvedValue(mockRecords),
      }

      getStore.mockResolvedValue(mockStore)
      mockRerank([{ id: 'record-3' }, { id: 'record-1' }])

      const result = await searchDataset(
        userId,
        datasetWithReranker,
        'test query'
      )

      // @note with no maxRecords in the reranker config, the prefetch cap falls
      // back to the RERANK_PREFETCH_MAX_RECORDS default (20).
      expect(mockStore.searchRecords).toHaveBeenCalledWith({
        datasetId: 'dataset-123',
        search: 'test query',
        minScore: 0.7,
        maxRecords: 20,
        filter: undefined,
      })
      expect(rerank).toHaveBeenCalledWith('test query', mockRecords, {
        model: 'rerank-v4-fast',
        topN: 10,
      })
      expect(recordRerankTokenUsage).toHaveBeenCalledWith({
        user: { id: userId },
        count: 1,
        model: 'rerank-v4-fast',
      })
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('record-3')
      expect(result[1].id).toBe('record-1')
    })

    it('should filter out records not in reranked results', async () => {
      const mockRecords = [
        { id: 'record-1', text: 'content 1', score: 0.9 },
        { id: 'record-2', text: 'content 2', score: 0.8 },
      ]

      const mockStore = {
        searchRecords: jest.fn().mockResolvedValue(mockRecords),
      }

      getStore.mockResolvedValue(mockStore)
      mockRerank([{ id: 'record-1' }])

      const result = await searchDataset(userId, datasetWithReranker, 'query')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('record-1')
    })

    it('should honor a configured maxRecords from the reranker config', async () => {
      const mockStore = {
        searchRecords: jest.fn().mockResolvedValue([]),
      }

      getStore.mockResolvedValue(mockStore)
      mockRerank([], 0)

      await searchDataset(
        userId,
        { ...mockDataset, reranker: 'rerank-v4-fast/maxRecords=50' },
        'query'
      )

      expect(mockStore.searchRecords).toHaveBeenCalledWith(
        expect.objectContaining({ maxRecords: 50 })
      )
    })

    it('does not fail the search when usage recording throws', async () => {
      const mockRecords = [{ id: 'record-1', text: 'content', score: 0.9 }]

      const mockStore = {
        searchRecords: jest.fn().mockResolvedValue(mockRecords),
      }

      getStore.mockResolvedValue(mockStore)
      mockRerank([{ id: 'record-1' }])
      recordRerankTokenUsage.mockRejectedValueOnce(new Error('usage down'))

      const result = await searchDataset(userId, datasetWithReranker, 'query')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('record-1')
    })

    it('falls back to store order when reranking fails', async () => {
      const mockRecords = [
        { id: 'record-1', text: 'content 1', score: 0.9 },
        { id: 'record-2', text: 'content 2', score: 0.8 },
        { id: 'record-3', text: 'content 3', score: 0.75 },
      ]

      const mockStore = {
        searchRecords: jest.fn().mockResolvedValue(mockRecords),
      }

      getStore.mockResolvedValue(mockStore)
      rerank.mockRejectedValueOnce(new Error('TimeoutError'))

      const result = await searchDataset(
        userId,
        { ...datasetWithReranker, searchMaxRecords: 2 },
        'query'
      )

      // @note the search must not throw - it degrades to the store's own score
      // order, capped to searchMaxRecords, and reports the failure.
      expect(captureException).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(2)
      expect(result.map((r) => r.id)).toEqual(['record-1', 'record-2'])
    })

    it('returns all prefetched records on rerank failure when searchMaxRecords is unset', async () => {
      const mockRecords = [
        { id: 'record-1', text: 'content 1', score: 0.9 },
        { id: 'record-2', text: 'content 2', score: 0.8 },
      ]

      const mockStore = {
        searchRecords: jest.fn().mockResolvedValue(mockRecords),
      }

      getStore.mockResolvedValue(mockStore)
      rerank.mockRejectedValueOnce(new Error('TimeoutError'))

      const result = await searchDataset(
        userId,
        { ...datasetWithReranker, searchMaxRecords: undefined },
        'query'
      )

      expect(captureException).toHaveBeenCalledTimes(1)
      expect(result).toEqual(mockRecords)
    })
  })

  describe('database validation', () => {
    it('should verify records exist in database', async () => {
      const mockRecords = [
        { id: 'record-1', text: 'content 1', score: 0.9 },
        { id: 'record-2', text: 'content 2', score: 0.8 },
      ]

      const mockStore = {
        searchRecords: jest.fn().mockResolvedValue(mockRecords),
      }

      getStore.mockResolvedValue(mockStore)

      const result = await searchDataset(userId, mockDataset, 'query')

      // @note no longer verifying records in database since records are now only in the store
      expect(result).toHaveLength(2)
    })

    it('should not capture error when all records exist', async () => {
      const mockRecords = [{ id: 'record-1', text: 'content 1', score: 0.9 }]

      const mockStore = {
        searchRecords: jest.fn().mockResolvedValue(mockRecords),
      }

      getStore.mockResolvedValue(mockStore)

      await searchDataset(userId, mockDataset, 'query')

      // @note no dangling records check since we no longer verify against database
      expect(captureError).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle dataset without min score', async () => {
      const datasetNoMinScore = { ...mockDataset, searchMinScore: null }
      const mockRecords = [{ id: 'record-1', text: 'content', score: 0.5 }]

      const mockStore = {
        searchRecords: jest.fn().mockResolvedValue(mockRecords),
      }

      getStore.mockResolvedValue(mockStore)

      await searchDataset(userId, datasetNoMinScore, 'query')

      expect(mockStore.searchRecords).toHaveBeenCalledWith({
        datasetId: 'dataset-123',
        search: 'query',
        minScore: undefined,
        maxRecords: 10,
        filter: undefined,
      })
    })

    it('should handle dataset without max records', async () => {
      const datasetNoMaxRecords = { ...mockDataset, searchMaxRecords: null }
      const mockRecords = [{ id: 'record-1', text: 'content', score: 0.9 }]

      const mockStore = {
        searchRecords: jest.fn().mockResolvedValue(mockRecords),
      }

      getStore.mockResolvedValue(mockStore)

      await searchDataset(userId, datasetNoMaxRecords, 'query')

      expect(mockStore.searchRecords).toHaveBeenCalledWith({
        datasetId: 'dataset-123',
        search: 'query',
        minScore: 0.7,
        maxRecords: undefined,
        filter: undefined,
      })
    })

    it('should handle empty string search', async () => {
      const mockStore = {
        searchRecords: jest.fn().mockResolvedValue([]),
      }

      getStore.mockResolvedValue(mockStore)

      const result = await searchDataset(userId, mockDataset, '')

      expect(mockStore.searchRecords).toHaveBeenCalledWith(
        expect.objectContaining({ search: '' })
      )
      expect(result).toEqual([])
    })

    it('should handle dataset without blueprint', async () => {
      const datasetNoBlueprint = { ...mockDataset, blueprintId: null }
      const mockRecords = [{ id: 'record-1', text: 'content', score: 0.9 }]

      const mockStore = {
        searchRecords: jest.fn().mockResolvedValue(mockRecords),
      }

      getStore.mockResolvedValue(mockStore)

      await searchDataset(userId, datasetNoBlueprint, 'query')

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: {
            blueprintId: null,
            datasetId: 'dataset-123',
          },
        })
      )
    })
  })
})
