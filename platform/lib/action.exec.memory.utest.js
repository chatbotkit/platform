/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { getContextBot, getContextContact } from '@/lib/context.store'
import { logEvent } from '@/lib/log'
import { rerankMemories } from '@/lib/memory.search'

import {
  doMemoryDelete,
  doMemoryList,
  doMemorySearch,
  doMemoryUpdate,
  executeMemoryAction,
  memoryCreateSchema,
  memoryDeleteSchema,
  memoryListSchema,
  memorySearchSchema,
  memoryUpdateSchema,
} from './action.exec.memory'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    memory: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

jest.mock('@/lib/context.store', () => ({
  getContextBot: jest.fn(),
  getContextContact: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/memory.search', () => ({
  rerankMemories: jest.fn(),
}))

describe('action.exec.memory', () => {
  const userId = 'user-123'
  const memoryId = 'memory-456'

  const baseOptions = {
    userId,
    linkedResources: {
      blueprintId: 'bp-123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getContextContact.mockReturnValue({ id: 'contact-789' })
    getContextBot.mockReturnValue({ id: 'bot-123' })
  })

  describe('schemas', () => {
    describe('memoryCreateSchema', () => {
      it('should require @scope field', () => {
        expect(() =>
          memoryCreateSchema.parse({
            text: 'test memory',
          })
        ).toThrow()
      })

      it('should accept all valid scope values', () => {
        const scopes = ['user', 'contact', 'bot']

        for (const scopeValue of scopes) {
          const result = memoryCreateSchema.parse({
            '@scope': scopeValue,
            text: 'test',
          })

          expect(result['@scope']).toBe(scopeValue)
        }
      })

      it('should reject invalid scope values', () => {
        expect(() =>
          memoryCreateSchema.parse({
            '@scope': 'invalid',
            text: 'test',
          })
        ).toThrow()
      })
    })

    describe('memoryUpdateSchema', () => {
      it('should require @scope field', () => {
        expect(() =>
          memoryUpdateSchema.parse({
            memoryId: 'mem-123',
            text: 'updated text',
          })
        ).toThrow()
      })

      it('should parse with valid @scope', () => {
        const result = memoryUpdateSchema.parse({
          '@scope': 'user',
          memoryId: 'mem-123',
          text: 'updated text',
        })

        expect(result['@scope']).toBe('user')
      })
    })

    describe('memoryDeleteSchema', () => {
      it('should require @scope field', () => {
        expect(() =>
          memoryDeleteSchema.parse({
            memoryId: 'mem-123',
          })
        ).toThrow()
      })

      it('should parse with valid @scope', () => {
        const result = memoryDeleteSchema.parse({
          '@scope': 'contact',
          memoryId: 'mem-123',
        })

        expect(result['@scope']).toBe('contact')
      })
    })

    describe('memorySearchSchema', () => {
      it('should require @scope field', () => {
        expect(() =>
          memorySearchSchema.parse({
            query: 'search term',
          })
        ).toThrow()
      })

      it('should parse with valid @scope', () => {
        const result = memorySearchSchema.parse({
          '@scope': 'bot',
          query: 'search term',
        })

        expect(result['@scope']).toBe('bot')
      })
    })

    describe('memoryListSchema', () => {
      it('should require @scope field', () => {
        expect(() => memoryListSchema.parse({})).toThrow()
      })

      it('should parse with valid @scope', () => {
        const result = memoryListSchema.parse({ '@scope': 'user' })

        expect(result['@scope']).toBe('user')
      })
    })
  })

  describe('doMemoryUpdate', () => {
    it('should find memory with scoped filter', async () => {
      prisma.memory.findFirst.mockResolvedValue({ id: memoryId })
      prisma.memory.update.mockResolvedValue({ id: memoryId })

      await doMemoryUpdate({
        input: 'new text',
        params: { '@scope': 'user', memoryId },
        options: baseOptions,
      })

      expect(prisma.memory.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            id: memoryId,
          }),
        })
      )
    })

    it('should throw UserResourceNotFoundError when memory not found', async () => {
      prisma.memory.findFirst.mockResolvedValue(null)

      await expect(
        doMemoryUpdate({
          input: 'new text',
          params: { '@scope': 'user', memoryId },
          options: baseOptions,
        })
      ).rejects.toThrow('Memory not found')
    })

    it('should update memory with new text', async () => {
      prisma.memory.findFirst.mockResolvedValue({ id: memoryId })
      prisma.memory.update.mockResolvedValue({ id: memoryId })

      await doMemoryUpdate({
        input: 'updated content',
        params: { '@scope': 'user', memoryId },
        options: baseOptions,
      })

      expect(prisma.memory.update).toHaveBeenCalledWith({
        where: { id: memoryId },
        data: { text: 'updated content' },
      })
    })

    it('should return memoryId in result', async () => {
      prisma.memory.findFirst.mockResolvedValue({ id: memoryId })
      prisma.memory.update.mockResolvedValue({ id: memoryId })

      const response = await doMemoryUpdate({
        input: 'text',
        params: { '@scope': 'user', memoryId },
        options: baseOptions,
      })

      expect(response.result).toEqual({ memoryId })
    })

    it('should log event with correct type', async () => {
      prisma.memory.findFirst.mockResolvedValue({ id: memoryId })
      prisma.memory.update.mockResolvedValue({ id: memoryId })

      await doMemoryUpdate({
        input: 'text',
        params: { '@scope': 'user', memoryId },
        options: baseOptions,
      })

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'action.memory.update',
          user: { id: userId },
        })
      )
    })
  })

  describe('doMemoryDelete', () => {
    it('should find memory with scoped filter', async () => {
      prisma.memory.findFirst.mockResolvedValue({ id: memoryId })
      prisma.memory.delete.mockResolvedValue({ id: memoryId })

      await doMemoryDelete({
        input: memoryId,
        params: { '@scope': 'user' },
        options: baseOptions,
      })

      expect(prisma.memory.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            id: memoryId,
          }),
        })
      )
    })

    it('should throw UserResourceNotFoundError when memory not found', async () => {
      prisma.memory.findFirst.mockResolvedValue(null)

      await expect(
        doMemoryDelete({
          input: memoryId,
          params: { '@scope': 'user' },
          options: baseOptions,
        })
      ).rejects.toThrow('Memory not found')
    })

    it('should delete the memory', async () => {
      prisma.memory.findFirst.mockResolvedValue({ id: memoryId })
      prisma.memory.delete.mockResolvedValue({ id: memoryId })

      await doMemoryDelete({
        input: memoryId,
        params: { '@scope': 'user' },
        options: baseOptions,
      })

      expect(prisma.memory.delete).toHaveBeenCalledWith({
        where: { id: memoryId },
      })
    })

    it('should return memoryId in result', async () => {
      prisma.memory.findFirst.mockResolvedValue({ id: memoryId })
      prisma.memory.delete.mockResolvedValue({ id: memoryId })

      const response = await doMemoryDelete({
        input: memoryId,
        params: { '@scope': 'user' },
        options: baseOptions,
      })

      expect(response.result).toEqual({ memoryId })
    })
  })

  describe('doMemorySearch', () => {
    it('should query memories with scoped filter', async () => {
      prisma.memory.findMany.mockResolvedValue([])
      rerankMemories.mockResolvedValue([])

      await doMemorySearch({
        input: 'search term',
        params: { '@scope': 'user' },
        options: baseOptions,
      })

      expect(prisma.memory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
          }),
        })
      )
    })

    it('should include contactId when scope is contact', async () => {
      prisma.memory.findMany.mockResolvedValue([])
      rerankMemories.mockResolvedValue([])

      await doMemorySearch({
        input: 'query',
        params: { '@scope': 'contact' },
        options: baseOptions,
      })

      expect(prisma.memory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            contactId: 'contact-789',
          }),
        })
      )
    })

    it('should call rerankMemories with search term and memories', async () => {
      const mockMemories = [
        { id: 'mem-1', text: 'memory 1' },
        { id: 'mem-2', text: 'memory 2' },
      ]

      prisma.memory.findMany.mockResolvedValue(mockMemories)
      rerankMemories.mockResolvedValue(mockMemories)

      await doMemorySearch({
        input: 'query',
        params: { '@scope': 'user' },
        options: baseOptions,
      })

      expect(rerankMemories).toHaveBeenCalledWith('query', mockMemories, 10, {
        user: { id: userId },
      })
    })

    it('should return mapped text results', async () => {
      prisma.memory.findMany.mockResolvedValue([
        { id: 'mem-1', text: 'memory 1' },
        { id: 'mem-2', text: 'memory 2' },
      ])
      rerankMemories.mockResolvedValue([
        { id: 'mem-1', text: 'memory 1' },
        { id: 'mem-2', text: 'memory 2' },
      ])

      const response = await doMemorySearch({
        input: 'query',
        params: { '@scope': 'user' },
        options: baseOptions,
      })

      expect(response.result).toEqual(['memory 1', 'memory 2'])
    })

    it('should log event with correct type', async () => {
      prisma.memory.findMany.mockResolvedValue([])
      rerankMemories.mockResolvedValue([])

      await doMemorySearch({
        input: 'query',
        params: { '@scope': 'user' },
        options: baseOptions,
      })

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'action.memory.search',
          user: { id: userId },
        })
      )
    })
  })

  describe('doMemoryList', () => {
    it('should find memories with scoped filter', async () => {
      prisma.memory.findMany.mockResolvedValue([])

      await doMemoryList({
        input: '',
        params: { '@scope': 'user' },
        options: baseOptions,
      })

      expect(prisma.memory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
          }),
        })
      )
    })

    it('should order by updatedAt desc', async () => {
      prisma.memory.findMany.mockResolvedValue([])

      await doMemoryList({
        input: '',
        params: { '@scope': 'user' },
        options: baseOptions,
      })

      expect(prisma.memory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { updatedAt: 'desc' },
        })
      )
    })

    it('should limit to 50 results', async () => {
      prisma.memory.findMany.mockResolvedValue([])

      await doMemoryList({
        input: '',
        params: { '@scope': 'user' },
        options: baseOptions,
      })

      expect(prisma.memory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      )
    })

    it('should return memories in result', async () => {
      const mockMemories = [
        {
          id: 'mem-1',
          text: 'first',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'mem-2',
          text: 'second',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      prisma.memory.findMany.mockResolvedValue(mockMemories)

      const response = await doMemoryList({
        input: '',
        params: { '@scope': 'user' },
        options: baseOptions,
      })

      expect(response.result).toEqual(mockMemories)
    })
  })

  describe('executeMemoryAction', () => {
    beforeEach(() => {
      prisma.memory.create.mockResolvedValue({ id: 'new-mem' })
      prisma.memory.findFirst.mockResolvedValue({ id: memoryId })
      prisma.memory.findMany.mockResolvedValue([])
      prisma.memory.update.mockResolvedValue({ id: memoryId })
      prisma.memory.delete.mockResolvedValue({ id: memoryId })
      rerankMemories.mockResolvedValue([])
    })

    it('should route to create operation', async () => {
      const response = await executeMemoryAction(
        'test memory',
        { '@scope': 'user', create: true },
        baseOptions
      )

      expect(prisma.memory.create).toHaveBeenCalled()
      expect(response.result).toHaveProperty('id')
    })

    it('should route to update operation', async () => {
      await executeMemoryAction(
        'updated text',
        { '@scope': 'user', update: true, memoryId },
        baseOptions
      )

      expect(prisma.memory.update).toHaveBeenCalled()
    })

    it('should route to delete operation', async () => {
      await executeMemoryAction(
        memoryId,
        { '@scope': 'user', delete: true },
        baseOptions
      )

      expect(prisma.memory.delete).toHaveBeenCalled()
    })

    it('should route to search operation', async () => {
      await executeMemoryAction(
        'query: query',
        { '@scope': 'user', search: true },
        baseOptions
      )

      expect(rerankMemories).toHaveBeenCalled()
    })

    it('should route to list operation', async () => {
      await executeMemoryAction(
        '',
        { '@scope': 'user', list: true },
        baseOptions
      )

      expect(prisma.memory.findMany).toHaveBeenCalled()
    })

    it('should throw UserInputError for unknown operation', async () => {
      await expect(
        executeMemoryAction(
          '',
          { '@scope': 'user', unknown: true },
          baseOptions
        )
      ).rejects.toThrow('Unknown operation')
    })
  })

  describe('scope behavior integration', () => {
    it('should include contactId from context in list query', async () => {
      prisma.memory.findMany.mockResolvedValue([])

      await doMemoryList({
        input: '',
        params: { '@scope': 'contact' },
        options: baseOptions,
      })

      expect(prisma.memory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            contactId: 'contact-789',
          }),
        })
      )
    })

    it('should use botId in update/delete operations with bot scope', async () => {
      prisma.memory.findFirst.mockResolvedValue({ id: memoryId })
      prisma.memory.update.mockResolvedValue({ id: memoryId })

      await doMemoryUpdate({
        input: 'updated text',
        params: { '@scope': 'bot', memoryId },
        options: {
          ...baseOptions,
          linkedResources: {
            ...baseOptions.linkedResources,
            botId: 'bot-123',
          },
        },
      })

      expect(prisma.memory.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            botId: 'bot-123',
          }),
        })
      )
    })

    it('should use user-only filter in update when scope is user', async () => {
      prisma.memory.findFirst.mockResolvedValue({ id: memoryId })
      prisma.memory.update.mockResolvedValue({ id: memoryId })

      await doMemoryUpdate({
        input: 'updated text',
        params: { '@scope': 'user', memoryId },
        options: baseOptions,
      })

      const callArgs = prisma.memory.findFirst.mock.calls[0][0]

      expect(callArgs.where.userId).toBe(userId)
      // Should NOT have contactId when using user scope
      expect(callArgs.where).not.toHaveProperty('contactId')
      expect(callArgs.where).not.toHaveProperty('botId')
    })
  })
})
