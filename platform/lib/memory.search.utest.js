/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { rerank } from '@/lib/rerank'
import { recordRerankTokenUsage } from '@/lib/usage.record'

import { searchMemories } from './memory.search'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    memory: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/rerank', () => ({
  rerank: jest.fn(),
}))

jest.mock('@/lib/usage.record', () => ({
  recordRerankTokenUsage: jest.fn(),
}))

function mockRerank(documents, outputTokens = 1) {
  rerank.mockResolvedValue({
    documents,
    usage: { model: 'rerank-v4-fast', inputTokens: 0, outputTokens },
  })
}

describe('searchMemories', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should search memories and return reranked results', async () => {
      const user = { id: 'user-123' }
      const searchQuery = 'test query'
      const mockMemories = [
        { id: 'mem-1', text: 'First memory' },
        { id: 'mem-2', text: 'Second memory' },
        { id: 'mem-3', text: 'Third memory' },
      ]

      prisma.memory.findMany.mockResolvedValue(mockMemories)

      mockRerank([{ id: 'mem-2' }, { id: 'mem-1' }, { id: 'mem-3' }])

      const result = await searchMemories(user, searchQuery, {})

      expect(prisma.memory.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          contactId: undefined,
          botId: undefined,
        },
        select: {
          id: true,
          text: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 50,
      })

      expect(rerank).toHaveBeenCalledWith(searchQuery, mockMemories, {
        topN: 10,
      })

      expect(result).toEqual([
        { id: 'mem-2', text: 'Second memory' },
        { id: 'mem-1', text: 'First memory' },
        { id: 'mem-3', text: 'Third memory' },
      ])
    })

    it('should record rerank usage against the user', async () => {
      const user = { id: 'user-123' }

      prisma.memory.findMany.mockResolvedValue([
        { id: 'mem-1', text: 'First memory' },
      ])

      mockRerank([{ id: 'mem-1' }])

      await searchMemories(user, 'test', {})

      expect(recordRerankTokenUsage).toHaveBeenCalledWith({
        user,
        count: 1,
        model: 'rerank-v4-fast',
      })
    })

    it('should filter by contactId when provided', async () => {
      const user = { id: 'user-123' }
      const searchQuery = 'test'
      const options = { contactId: 'contact-456' }

      prisma.memory.findMany.mockResolvedValue([])

      mockRerank([])

      await searchMemories(user, searchQuery, options)

      expect(prisma.memory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contactId: 'contact-456',
          }),
        })
      )
    })

    it('should filter by botId when provided', async () => {
      const user = { id: 'user-123' }
      const searchQuery = 'test'
      const options = { botId: 'bot-789' }

      prisma.memory.findMany.mockResolvedValue([])

      mockRerank([])

      await searchMemories(user, searchQuery, options)

      expect(prisma.memory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            botId: 'bot-789',
          }),
        })
      )
    })

    it('should respect custom take and limit parameters', async () => {
      const user = { id: 'user-123' }
      const searchQuery = 'test'
      const options = { take: 100, limit: 10 }
      const mockMemories = [{ id: 'mem-1', text: 'memory' }]

      prisma.memory.findMany.mockResolvedValue(mockMemories)

      mockRerank([{ id: 'mem-1' }])

      await searchMemories(user, searchQuery, options)

      expect(prisma.memory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      )

      expect(rerank).toHaveBeenCalledWith(searchQuery, mockMemories, {
        topN: 10,
      })
    })

    it('should use default take of 50 and limit of 10 when not provided', async () => {
      const user = { id: 'user-123' }
      const searchQuery = 'test'
      const mockMemories = [{ id: 'mem-1', text: 'memory' }]

      prisma.memory.findMany.mockResolvedValue(mockMemories)

      mockRerank([{ id: 'mem-1' }])

      await searchMemories(user, searchQuery, {})

      expect(prisma.memory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      )

      expect(rerank).toHaveBeenCalledWith(searchQuery, mockMemories, {
        topN: 10,
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty memory list without calling the reranker', async () => {
      const user = { id: 'user-123' }
      const searchQuery = 'test'

      prisma.memory.findMany.mockResolvedValue([])

      const result = await searchMemories(user, searchQuery, {})

      expect(rerank).not.toHaveBeenCalled()
      expect(recordRerankTokenUsage).not.toHaveBeenCalled()
      expect(result).toEqual([])
    })

    it('should handle reranked items not found in original memories', async () => {
      const user = { id: 'user-123' }
      const searchQuery = 'test'
      const mockMemories = [{ id: 'mem-1', text: 'First memory' }]

      prisma.memory.findMany.mockResolvedValue(mockMemories)

      mockRerank([{ id: 'mem-1' }, { id: 'mem-999' }])

      const result = await searchMemories(user, searchQuery, {})

      expect(result).toEqual([
        { id: 'mem-1', text: 'First memory' },
        { id: 'mem-999', text: '' },
      ])
    })

    it('should handle empty search query', async () => {
      const user = { id: 'user-123' }
      const searchQuery = ''
      const mockMemories = [{ id: 'mem-1', text: 'First memory' }]

      prisma.memory.findMany.mockResolvedValue(mockMemories)

      mockRerank([{ id: 'mem-1' }])

      const result = await searchMemories(user, searchQuery, {})

      expect(rerank).toHaveBeenCalledWith('', mockMemories, { topN: 10 })
      expect(result).toEqual([{ id: 'mem-1', text: 'First memory' }])
    })

    it('should handle all filter options combined', async () => {
      const user = { id: 'user-123' }
      const searchQuery = 'test'
      const options = {
        contactId: 'contact-456',
        botId: 'bot-789',
        take: 100,
        limit: 25,
      }
      const mockMemories = [{ id: 'mem-1', text: 'memory' }]

      prisma.memory.findMany.mockResolvedValue(mockMemories)

      mockRerank([{ id: 'mem-1' }])

      await searchMemories(user, searchQuery, options)

      expect(prisma.memory.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          contactId: 'contact-456',
          botId: 'bot-789',
        },
        select: {
          id: true,
          text: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 100,
      })

      expect(rerank).toHaveBeenCalledWith(searchQuery, mockMemories, {
        topN: 25,
      })
    })
  })

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      const user = { id: 'user-123' }
      const searchQuery = 'test'

      prisma.memory.findMany.mockRejectedValue(new Error('Database error'))

      await expect(searchMemories(user, searchQuery, {})).rejects.toThrow(
        'Database error'
      )
    })

    it('should propagate reranker errors', async () => {
      const user = { id: 'user-123' }
      const searchQuery = 'test'

      prisma.memory.findMany.mockResolvedValue([
        { id: 'mem-1', text: 'memory' },
      ])

      rerank.mockRejectedValue(new Error('Reranker error'))

      await expect(searchMemories(user, searchQuery, {})).rejects.toThrow(
        'Reranker error'
      )
    })
  })
})
