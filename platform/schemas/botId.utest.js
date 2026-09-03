/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { canManipulateBot, canUseBot } from '@/lib/bot.access'
import { schema } from '@/lib/joi.handler'
import {
  throwNotAuthenticated,
  throwNotAuthorized,
  throwNotFound,
} from '@/lib/response'

import botIdSchema from '@/schemas/botId'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/bot.access', () => ({
  canUseBot: jest.fn(),
  canManipulateBot: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  throwNotAuthenticated: jest.fn(),
  throwNotAuthorized: jest.fn(),
  throwNotFound: jest.fn(),
}))

describe('botIdSchema', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockReset(prisma)
  })

  describe('basic validation', () => {
    const validate = async (schema, input, expected) => {
      const response = await schema.validateAsync(input)

      expect(response).toEqual(expected)
    }

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should correctly handle falsy values', async () => {
      const s = schema.object({
        botId: botIdSchema('use'),
      })

      await validate(s, {}, {})
      await validate(s, { botId: null }, { botId: null })
      await validate(s, { botId: '' }, { botId: null })
      await validate(s, { botId: '  ' }, { botId: null })
    })
  })

  describe('with accessType "use"', () => {
    const useSchema = botIdSchema('use')

    it('should allow null values', async () => {
      const result = await useSchema.validateAsync(null)

      expect(result).toBeNull()
      expect(prisma.bot.findUniqueByIdentifier).not.toHaveBeenCalled()
    })

    it('should throw not authenticated when no user in session', async () => {
      const mockError = new Error('Not authenticated')

      throwNotAuthenticated.mockImplementation(() => {
        throw mockError
      })

      const context = { session: {} }

      await expect(
        useSchema.validateAsync('bot-123', { context })
      ).rejects.toThrow('Not authenticated')

      expect(throwNotAuthenticated).toHaveBeenCalledWith()
    })

    it('should find and return bot for valid user and bot id', async () => {
      const mockUser = { id: 'user-123' }
      const mockBot = { id: 'bot-123', name: 'Test Bot', userId: 'user-123' }
      const context = { session: { user: mockUser } }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      canUseBot.mockResolvedValue(true)

      const result = await useSchema.validateAsync('bot-123', { context })

      expect(result).toEqual(mockBot)
      expect(prisma.bot.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockUser,
        'bot-123'
      )
      expect(canUseBot).toHaveBeenCalledWith(mockUser.id, mockBot)
    })

    it('should throw not found when bot does not exist', async () => {
      const mockUser = { id: 'user-123' }
      const context = { session: { user: mockUser } }
      const mockError = new Error('Bot not found')

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(null)
      throwNotFound.mockImplementation(() => {
        throw mockError
      })

      await expect(
        useSchema.validateAsync('non-existent-bot', { context })
      ).rejects.toThrow('Bot not found')

      expect(throwNotFound).toHaveBeenCalledWith('Bot not found')
    })

    it('should throw not authorized when user cannot use bot', async () => {
      const mockUser = { id: 'user-123' }
      const mockBot = { id: 'bot-123', name: 'Test Bot', userId: 'other-user' }
      const context = { session: { user: mockUser } }
      const mockError = new Error('You are not authorized to use this bot')

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      canUseBot.mockResolvedValue(false)
      throwNotAuthorized.mockImplementation(() => {
        throw mockError
      })

      await expect(
        useSchema.validateAsync('bot-123', { context })
      ).rejects.toThrow('You are not authorized to use this bot')

      expect(throwNotAuthorized).toHaveBeenCalledWith(
        'You are not authorized to use this bot'
      )
    })
  })

  describe('with accessType "manipulate"', () => {
    const manipulateSchema = botIdSchema('manipulate')

    it('should allow null values', async () => {
      const result = await manipulateSchema.validateAsync(null)

      expect(result).toBeNull()
      expect(prisma.bot.findUniqueByIdentifier).not.toHaveBeenCalled()
    })

    it('should find and return bot when user can manipulate it', async () => {
      const mockUser = { id: 'user-123' }
      const mockBot = { id: 'bot-123', name: 'Test Bot', userId: 'user-123' }
      const context = { session: { user: mockUser } }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      canManipulateBot.mockResolvedValue(true)

      const result = await manipulateSchema.validateAsync('bot-123', {
        context,
      })

      expect(result).toEqual(mockBot)
      expect(canManipulateBot).toHaveBeenCalledWith(mockUser.id, mockBot)
    })

    it('should throw not authorized when user cannot manipulate bot', async () => {
      const mockUser = { id: 'user-123' }
      const mockBot = { id: 'bot-123', name: 'Test Bot', userId: 'other-user' }
      const context = { session: { user: mockUser } }
      const mockError = new Error(
        'You are not authorized to manipulate this bot'
      )

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      canManipulateBot.mockResolvedValue(false)
      throwNotAuthorized.mockImplementation(() => {
        throw mockError
      })

      await expect(
        manipulateSchema.validateAsync('bot-123', { context })
      ).rejects.toThrow('You are not authorized to manipulate this bot')

      expect(throwNotAuthorized).toHaveBeenCalledWith(
        'You are not authorized to manipulate this bot'
      )
    })
  })
})
