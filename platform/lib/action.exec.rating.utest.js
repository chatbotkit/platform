import prisma from '@/prisma/client'

import {
  doRatingCreate,
  doRatingDelete,
  doRatingFetch,
  doRatingList,
  executeRatingAction,
} from '@/lib/action.exec.rating'
import { canUseBot } from '@/lib/bot.access'
import * as context from '@/lib/context.store'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      rating: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      bot: {
        findUnique: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/context.store', () => ({
  getContextBot: jest.fn(),
  getContextUser: jest.fn(),
  getContextContact: jest.fn(),
  getContextConversation: jest.fn(),
}))

jest.mock('@/lib/bot.access', () => ({
  canUseBot: jest.fn(),
}))

describe('action.exec.rating', () => {
  const mockUser = { id: 'user-123' }
  const mockContact = { id: 'contact-123' }
  const mockConversation = { id: 'conversation-123' }
  const mockBot = { id: 'bot-456' }

  const mockOptions = {
    userId: 'user-123',
    linkedResources: {
      botId: 'bot-456',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    context.getContextBot.mockReturnValue(null)
    context.getContextUser.mockReturnValue(mockUser)
    context.getContextContact.mockReturnValue(mockContact)
    context.getContextConversation.mockReturnValue(mockConversation)
    prisma.bot.findUnique.mockResolvedValue(mockBot)
    canUseBot.mockResolvedValue(true)
  })

  describe('doRatingList', () => {
    it('should list ratings scoped to the resolved bot', async () => {
      const mockRatings = [
        {
          id: 'rating-1',
          value: 100,
          botId: 'bot-456',
        },
      ]

      prisma.rating.findMany.mockResolvedValue(mockRatings)

      const result = await doRatingList({
        user: mockUser,
        input: '',
        params: { '@scope': 'user' },
        options: mockOptions,
      })

      expect(result.result).toEqual(mockRatings)
      expect(prisma.rating.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
            botId: 'bot-456',
          }),
          orderBy: { createdAt: 'desc' },
          take: 10,
        })
      )
    })

    it('should apply metadata and value filters', async () => {
      prisma.rating.findMany.mockResolvedValue([])

      await doRatingList({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'contact',
          value: -100,
          meta: {
            category: 'quality',
          },
        },
        options: mockOptions,
      })

      expect(prisma.rating.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
            contactId: 'contact-123',
            botId: 'bot-456',
            value: -100,
            AND: [
              {
                meta: {
                  path: '$.category',
                  equals: 'quality',
                },
              },
            ],
          }),
        })
      )
    })
  })

  describe('doRatingFetch', () => {
    it('should fetch a scoped rating', async () => {
      const mockRating = {
        id: 'rating-1',
        value: 100,
      }

      prisma.rating.findFirst.mockResolvedValue(mockRating)

      const result = await doRatingFetch({
        user: mockUser,
        input: '',
        params: { '@scope': 'user', ratingId: 'rating-1' },
        options: mockOptions,
      })

      expect(result.result).toEqual(mockRating)
    })

    it('should throw when the rating is missing', async () => {
      prisma.rating.findFirst.mockResolvedValue(null)

      await expect(
        doRatingFetch({
          user: mockUser,
          input: '',
          params: { '@scope': 'user', ratingId: 'missing-rating' },
          options: mockOptions,
        })
      ).rejects.toThrow('Rating not found')
    })
  })

  describe('doRatingCreate', () => {
    it('should create a contact-scoped rating and inherit the current conversation', async () => {
      const mockRating = {
        id: 'rating-1',
        contactId: 'contact-123',
        botId: 'bot-456',
        conversationId: 'conversation-123',
        value: 50,
        reason: null,
      }

      prisma.rating.create.mockResolvedValue(mockRating)

      const result = await doRatingCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'contact',
          value: 50,
          reason: '',
        },
        options: mockOptions,
      })

      expect(result.result).toEqual(mockRating)
      expect(prisma.rating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            contactId: 'contact-123',
            botId: 'bot-456',
            conversationId: 'conversation-123',
            reason: null,
            value: 50,
          }),
        })
      )
    })
  })

  describe('doRatingDelete', () => {
    it('should delete a scoped rating', async () => {
      prisma.rating.findFirst.mockResolvedValue({
        id: 'rating-1',
        userId: 'user-123',
      })
      prisma.rating.delete.mockResolvedValue({ id: 'rating-1' })

      const result = await doRatingDelete({
        user: mockUser,
        input: '',
        params: { '@scope': 'user', ratingId: 'rating-1' },
        options: mockOptions,
      })

      expect(result.result).toEqual({ id: 'rating-1' })
      expect(prisma.rating.delete).toHaveBeenCalledWith({
        where: { id: 'rating-1' },
        select: { id: true },
      })
    })
  })

  describe('executeRatingAction', () => {
    it('should route list operations', async () => {
      prisma.rating.findMany.mockResolvedValue([])

      const result = await executeRatingAction(
        '',
        { '@scope': 'user', list: {} },
        mockOptions
      )

      expect(result).toEqual({ result: [], messages: [] })
    })

    it('should route fetch operations', async () => {
      const mockRating = { id: 'rating-1', value: 100 }

      prisma.rating.findFirst.mockResolvedValue(mockRating)

      const result = await executeRatingAction(
        '',
        { '@scope': 'user', fetch: {}, ratingId: 'rating-1' },
        mockOptions
      )

      expect(result).toEqual({ result: mockRating, messages: [] })
    })

    it('should route create operations', async () => {
      const mockRating = { id: 'rating-new', value: 75 }

      prisma.rating.create.mockResolvedValue(mockRating)

      const result = await executeRatingAction(
        '',
        { '@scope': 'user', create: {}, value: 75 },
        mockOptions
      )

      expect(result).toEqual({ result: mockRating, messages: [] })
    })

    it('should route delete operations', async () => {
      prisma.rating.findFirst.mockResolvedValue({ id: 'rating-1' })
      prisma.rating.delete.mockResolvedValue({ id: 'rating-1' })

      const result = await executeRatingAction(
        '',
        { '@scope': 'user', delete: {}, ratingId: 'rating-1' },
        mockOptions
      )

      expect(result).toEqual({ result: { id: 'rating-1' }, messages: [] })
    })

    it('should throw when user is missing from context', async () => {
      context.getContextUser.mockReturnValue(null)

      await expect(
        executeRatingAction('', { '@scope': 'user', list: {} }, mockOptions)
      ).rejects.toThrow('Missing user')
    })

    it('should reject unknown operations', async () => {
      await expect(
        executeRatingAction('', { '@scope': 'user', unknown: {} }, mockOptions)
      ).rejects.toThrow('Unknown operation')
    })
  })

  describe('doRatingList - access control', () => {
    it('should throw when the resolved bot is not found', async () => {
      prisma.bot.findUnique.mockResolvedValue(null)

      await expect(
        doRatingList({
          user: mockUser,
          input: '',
          params: { '@scope': 'user' },
          options: mockOptions,
        })
      ).rejects.toThrow('Bot not found')
    })

    it('should throw when user cannot access the resolved bot', async () => {
      canUseBot.mockResolvedValue(false)

      await expect(
        doRatingList({
          user: mockUser,
          input: '',
          params: { '@scope': 'user' },
          options: mockOptions,
        })
      ).rejects.toThrow('Bot not found')
    })

    it('should list without botId when no linked resources and no context bot', async () => {
      prisma.rating.findMany.mockResolvedValue([])

      await doRatingList({
        user: mockUser,
        input: '',
        params: { '@scope': 'user' },
        options: { userId: 'user-123' },
      })

      expect(prisma.rating.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ botId: expect.anything() }),
        })
      )
      // @note prisma.bot.findUnique should not be called when no botId is resolved
      expect(prisma.bot.findUnique).not.toHaveBeenCalled()
    })

    it('should use context bot as fallback when no linked resources provided', async () => {
      context.getContextBot.mockReturnValue({ id: 'context-bot-789' })
      prisma.bot.findUnique.mockResolvedValue({ id: 'context-bot-789' })
      prisma.rating.findMany.mockResolvedValue([])

      await doRatingList({
        user: mockUser,
        input: '',
        params: { '@scope': 'user' },
        options: { userId: 'user-123' },
      })

      expect(prisma.bot.findUnique).toHaveBeenCalledWith({
        where: { id: 'context-bot-789' },
      })
    })
  })

  describe('doRatingCreate - reason normalization', () => {
    it('should store null when reason is an empty string', async () => {
      prisma.rating.create.mockResolvedValue({ id: 'rating-1', reason: null })

      await doRatingCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'contact',
          value: 50,
          reason: '',
        },
        options: mockOptions,
      })

      expect(prisma.rating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reason: null }),
        })
      )
    })

    it('should preserve a non-empty reason string', async () => {
      prisma.rating.create.mockResolvedValue({
        id: 'rating-1',
        reason: 'too slow',
      })

      await doRatingCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'contact',
          value: -100,
          reason: 'too slow',
        },
        options: mockOptions,
      })

      expect(prisma.rating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reason: 'too slow' }),
        })
      )
    })

    it('should store null when reason is explicitly null', async () => {
      prisma.rating.create.mockResolvedValue({ id: 'rating-1', reason: null })

      await doRatingCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'contact',
          value: 100,
          reason: null,
        },
        options: mockOptions,
      })

      expect(prisma.rating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reason: null }),
        })
      )
    })
  })

  describe('doRatingCreate - context resolution', () => {
    it('should use explicit conversationId when provided instead of context', async () => {
      prisma.rating.create.mockResolvedValue({ id: 'rating-1' })

      await doRatingCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'contact',
          value: 50,
          conversationId: 'explicit-conv-999',
        },
        options: mockOptions,
      })

      expect(prisma.rating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversationId: 'explicit-conv-999',
          }),
        })
      )
    })

    it('should fall back to context conversation when no explicit conversationId', async () => {
      prisma.rating.create.mockResolvedValue({ id: 'rating-1' })

      await doRatingCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'contact',
          value: 50,
        },
        options: mockOptions,
      })

      expect(prisma.rating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ conversationId: 'conversation-123' }),
        })
      )
    })

    it('should store null conversationId when no context and no explicit id', async () => {
      context.getContextConversation.mockReturnValue(null)
      prisma.rating.create.mockResolvedValue({ id: 'rating-1' })

      await doRatingCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'contact',
          value: 50,
        },
        options: mockOptions,
      })

      expect(prisma.rating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ conversationId: null }),
        })
      )
    })

    it('should pass messageId through to the rating record', async () => {
      prisma.rating.create.mockResolvedValue({ id: 'rating-1' })

      await doRatingCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'contact',
          value: 50,
          messageId: 'msg-abc',
        },
        options: mockOptions,
      })

      expect(prisma.rating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ messageId: 'msg-abc' }),
        })
      )
    })

    it('should set null messageId when not provided', async () => {
      prisma.rating.create.mockResolvedValue({ id: 'rating-1' })

      await doRatingCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'contact',
          value: 50,
        },
        options: mockOptions,
      })

      expect(prisma.rating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ messageId: null }),
        })
      )
    })
  })

  describe('doRatingCreate - user scope', () => {
    it('should create rating without contactId for user scope', async () => {
      prisma.rating.create.mockResolvedValue({ id: 'rating-user', value: 50 })

      await doRatingCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          value: 50,
        },
        options: mockOptions,
      })

      expect(prisma.rating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            botId: 'bot-456',
            contactId: null,
          }),
        })
      )
    })
  })

  describe('doRatingDelete - not found', () => {
    it('should throw when the rating to delete does not exist', async () => {
      prisma.rating.findFirst.mockResolvedValue(null)

      await expect(
        doRatingDelete({
          user: mockUser,
          input: '',
          params: { '@scope': 'user', ratingId: 'missing-rating' },
          options: mockOptions,
        })
      ).rejects.toThrow('Rating not found')
    })
  })

  describe('doRatingFetch - scopes', () => {
    it('should fetch a contact-scoped rating using context contactId', async () => {
      const mockRating = {
        id: 'rating-1',
        value: 100,
        contactId: 'contact-123',
      }

      prisma.rating.findFirst.mockResolvedValue(mockRating)

      const result = await doRatingFetch({
        user: mockUser,
        input: '',
        params: { '@scope': 'contact', ratingId: 'rating-1' },
        options: mockOptions,
      })

      expect(result.result).toEqual(mockRating)
      expect(prisma.rating.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contactId: 'contact-123',
            id: 'rating-1',
          }),
        })
      )
    })
  })
})
