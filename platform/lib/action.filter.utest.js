import { getContextBot, getContextContact } from '@/lib/context.store'
import { UserConfigError } from '@/lib/error'

import { getScopedResourceFilter } from './action.filter'

jest.mock('@/lib/context.store', () => ({
  getContextBot: jest.fn(),
  getContextContact: jest.fn(),
}))

describe('getScopedResourceFilter', () => {
  const userId = 'user-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('scope: user', () => {
    it('should return filter with only userId', () => {
      const result = getScopedResourceFilter({
        userId,
        scope: 'user',
      })

      expect(result).toEqual({ userId })
    })

    it('should ignore linkedResources and contextResources when scope is user', () => {
      const result = getScopedResourceFilter({
        userId,
        scope: 'user',
        linkedResources: { spaceId: 'space-456' },
        contextResources: { blueprintId: 'bp-123' },
      })

      expect(result).toEqual({ userId })
    })
  })

  describe('scope: blueprint', () => {
    it('should return filter with userId and blueprintId when blueprintId is provided', () => {
      const result = getScopedResourceFilter({
        userId,
        scope: 'blueprint',
        contextResources: { blueprintId: 'bp-123' },
      })

      expect(result).toEqual({ userId, blueprintId: 'bp-123' })
    })

    it('should return filter with blueprintId from context when not in contextResources', () => {
      getContextBot.mockReturnValue({ blueprintId: 'bp-from-context' })

      const result = getScopedResourceFilter({
        userId,
        scope: 'blueprint',
        contextResources: {},
      })

      expect(result).toEqual({ userId, blueprintId: 'bp-from-context' })
    })

    it('should prefer contextResources over context bot', () => {
      getContextBot.mockReturnValue({ blueprintId: 'bp-from-context' })

      const result = getScopedResourceFilter({
        userId,
        scope: 'blueprint',
        contextResources: { blueprintId: 'bp-from-context-resources' },
      })

      expect(result).toEqual({
        userId,
        blueprintId: 'bp-from-context-resources',
      })
    })

    it('should throw when blueprintId is not provided in either contextResources or context', () => {
      getContextBot.mockReturnValue(null)

      const call = () =>
        getScopedResourceFilter({
          userId,
          scope: 'blueprint',
          contextResources: {},
        })

      expect(call).toThrow(UserConfigError)
      expect(call).toThrow('No blueprintId provided for blueprint scope')
    })

    it('should throw when contextResources is undefined and no context', () => {
      getContextBot.mockReturnValue(null)

      expect(() =>
        getScopedResourceFilter({
          userId,
          scope: 'blueprint',
        })
      ).toThrow('No blueprintId provided for blueprint scope')
    })
  })

  describe('scope: bot', () => {
    it('should return filter with userId and botId when botId is provided', () => {
      const result = getScopedResourceFilter({
        userId,
        scope: 'bot',
        linkedResources: { botId: 'bot-123' },
      })

      expect(result).toEqual({ userId, botId: 'bot-123' })
    })

    it('should return filter with botId from context when not in linkedResources', () => {
      getContextBot.mockReturnValue({ id: 'bot-from-context' })

      const result = getScopedResourceFilter({
        userId,
        scope: 'bot',
        linkedResources: {},
      })

      expect(result).toEqual({ userId, botId: 'bot-from-context' })
    })

    it('should prefer linkedResources over context', () => {
      getContextBot.mockReturnValue({ id: 'bot-from-context' })

      const result = getScopedResourceFilter({
        userId,
        scope: 'bot',
        linkedResources: { botId: 'bot-from-linked' },
      })

      expect(result).toEqual({ userId, botId: 'bot-from-linked' })
    })

    it('should throw when botId is not provided in either linkedResources or context', () => {
      getContextBot.mockReturnValue(null)

      const call = () =>
        getScopedResourceFilter({
          userId,
          scope: 'bot',
          linkedResources: {},
        })

      expect(call).toThrow(UserConfigError)
      expect(call).toThrow('No botId provided for bot scope')
    })

    it('should throw when linkedResources is undefined and no context', () => {
      getContextBot.mockReturnValue(null)

      expect(() =>
        getScopedResourceFilter({
          userId,
          scope: 'bot',
        })
      ).toThrow('No botId provided for bot scope')
    })
  })

  describe('scope: contact', () => {
    it('should return filter with userId and contactId when contact is in context', () => {
      const contact = { id: 'contact-123' }

      getContextContact.mockReturnValue(contact)

      const result = getScopedResourceFilter({
        userId,
        scope: 'contact',
      })

      expect(result).toEqual({ userId, contactId: 'contact-123' })
    })

    it('should throw when no contact is in context', () => {
      getContextContact.mockReturnValue(null)

      const call = () =>
        getScopedResourceFilter({
          userId,
          scope: 'contact',
        })

      expect(call).toThrow(UserConfigError)
      expect(call).toThrow('No contactId provided for contact scope')
    })

    it('should handle contact with additional properties', () => {
      const contact = {
        id: 'contact-456',
        name: 'Test Contact',
        email: 'test@example.com',
        metadata: { key: 'value' },
      }

      getContextContact.mockReturnValue(contact)

      const result = getScopedResourceFilter({
        userId,
        scope: 'contact',
      })

      expect(result).toEqual({ userId, contactId: 'contact-456' })
    })
  })

  describe('userId is always included', () => {
    it('should include userId in user scope', () => {
      const result = getScopedResourceFilter({ userId, scope: 'user' })

      expect(result.userId).toBe(userId)
    })

    it('should include userId in blueprint scope', () => {
      getContextBot.mockReturnValue(null)

      const result = getScopedResourceFilter({
        userId,
        scope: 'blueprint',
        contextResources: { blueprintId: 'bp-123' },
      })

      expect(result.userId).toBe(userId)
    })

    it('should include userId in bot scope', () => {
      getContextBot.mockReturnValue(null)

      const result = getScopedResourceFilter({
        userId,
        scope: 'bot',
        linkedResources: { botId: 'bot-123' },
      })

      expect(result.userId).toBe(userId)
    })

    it('should include userId in contact scope', () => {
      getContextContact.mockReturnValue({ id: 'contact-123' })

      const result = getScopedResourceFilter({ userId, scope: 'contact' })

      expect(result.userId).toBe(userId)
    })
  })

  describe('edge cases', () => {
    it('should handle contact being undefined gracefully', () => {
      getContextContact.mockReturnValue(undefined)

      expect(() =>
        getScopedResourceFilter({ userId, scope: 'contact' })
      ).toThrow('No contactId provided for contact scope')
    })

    it('should handle empty contextResources for blueprint scope when no context', () => {
      getContextBot.mockReturnValue(null)

      expect(() =>
        getScopedResourceFilter({
          userId,
          scope: 'blueprint',
          contextResources: {},
        })
      ).toThrow('No blueprintId provided for blueprint scope')
    })

    it('should handle empty linkedResources for bot scope when no context', () => {
      getContextBot.mockReturnValue(null)

      expect(() =>
        getScopedResourceFilter({
          userId,
          scope: 'bot',
          linkedResources: {},
        })
      ).toThrow('No botId provided for bot scope')
    })
  })

  describe('Prisma filter structure', () => {
    it('should return valid Prisma filter structure for user scope', () => {
      const result = getScopedResourceFilter({ userId, scope: 'user' })

      expect(result).toMatchObject({
        userId: expect.any(String),
      })
    })

    it('should return valid Prisma filter structure for blueprint scope', () => {
      getContextBot.mockReturnValue(null)

      const result = getScopedResourceFilter({
        userId,
        scope: 'blueprint',
        contextResources: { blueprintId: 'bp-123' },
      })

      expect(result).toMatchObject({
        userId: expect.any(String),
        blueprintId: expect.any(String),
      })
    })

    it('should return valid Prisma filter structure for bot scope', () => {
      getContextBot.mockReturnValue(null)

      const result = getScopedResourceFilter({
        userId,
        scope: 'bot',
        linkedResources: { botId: 'bot-123' },
      })

      expect(result).toMatchObject({
        userId: expect.any(String),
        botId: expect.any(String),
      })
    })

    it('should return valid Prisma filter structure for contact scope', () => {
      getContextContact.mockReturnValue({ id: 'contact-123' })

      const result = getScopedResourceFilter({ userId, scope: 'contact' })

      expect(result).toMatchObject({
        userId: expect.any(String),
        contactId: expect.any(String),
      })
    })
  })
})
