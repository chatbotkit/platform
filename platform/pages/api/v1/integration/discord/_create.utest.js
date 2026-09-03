import { bodySchema } from '@/pages/api/v1/integration/discord/create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {},
}))

jest.mock('@prisma/client', () => ({
  __esModule: true,
}))

describe('Discord Integration Create Schema', () => {
  describe('basic functionality', () => {
    it('should accept valid Discord integration with minimal required fields', async () => {
      const validBody = {
        name: 'Support Bot',
        description: 'Customer support bot',
        appId: '1234567890123456789',
        botToken: 'DISCORD_BOT_TOKEN_HERE',
        publicKey:
          'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      }

      const result = await bodySchema.validateAsync(validBody)

      expect(result.error).toBeUndefined()
      expect(result.name).toBe('Support Bot')
      expect(result.appId).toBe('1234567890123456789')
    })

    it('should accept integration with optional handle parameter', async () => {
      const validBody = {
        name: 'Bot with Handle',
        description: 'Test bot',
        appId: '9876543210987654321',
        botToken: 'TOKEN',
        publicKey: 'KEY',
        handle: 'support',
      }

      const result = await bodySchema.validateAsync(validBody)

      expect(result.error).toBeUndefined()
      expect(result.handle).toBe('support')
    })
  })

  describe('optional configuration fields', () => {
    it('should accept ephemeral setting', async () => {
      const validBody = {
        name: 'Ephemeral Bot',
        description: 'Private responses',
        appId: '123456',
        botToken: 'TOKEN',
        publicKey: 'KEY',
        ephemeral: true,
      }

      const result = await bodySchema.validateAsync(validBody)

      expect(result.error).toBeUndefined()
      expect(result.ephemeral).toBe(true)
    })

    it('should accept contactCollection setting', async () => {
      const validBody = {
        name: 'Contact Bot',
        description: 'Collects contacts',
        appId: '123456',
        botToken: 'TOKEN',
        publicKey: 'KEY',
        contactCollection: true,
      }

      const result = await bodySchema.validateAsync(validBody)

      expect(result.error).toBeUndefined()
      expect(result.contactCollection).toBe(true)
    })

    it('should accept sessionDuration within valid range', async () => {
      const validBody = {
        name: 'Session Bot',
        description: 'With session duration',
        appId: '123456',
        botToken: 'TOKEN',
        publicKey: 'KEY',
        sessionDuration: 3600000,
      }

      const result = await bodySchema.validateAsync(validBody)

      expect(result.error).toBeUndefined()
      expect(result.sessionDuration).toBe(3600000)
    })

    it('should accept attachments setting', async () => {
      const validBody = {
        name: 'Attachment Bot',
        description: 'Supports attachments',
        appId: '123456',
        botToken: 'TOKEN',
        publicKey: 'KEY',
        attachments: true,
      }

      const result = await bodySchema.validateAsync(validBody)

      expect(result.error).toBeUndefined()
      expect(result.attachments).toBe(true)
    })

    it('should accept meta field', async () => {
      const validBody = {
        name: 'Meta Bot',
        description: 'With metadata',
        appId: '123456',
        botToken: 'TOKEN',
        publicKey: 'KEY',
        meta: { environment: 'production' },
      }

      const result = await bodySchema.validateAsync(validBody)

      expect(result.error).toBeUndefined()
      expect(result.meta).toEqual({ environment: 'production' })
    })
  })

  describe('handle validation', () => {
    it('should accept alphanumeric handle', async () => {
      const validBody = {
        name: 'Test Bot',
        description: 'Test',
        appId: '123456',
        botToken: 'TOKEN',
        publicKey: 'KEY',
        handle: 'support123',
      }

      const result = await bodySchema.validateAsync(validBody)

      expect(result.error).toBeUndefined()
      expect(result.handle).toBe('support123')
    })

    it('should accept underscore in handle', async () => {
      const validBody = {
        name: 'Test Bot',
        description: 'Test',
        appId: '123456',
        botToken: 'TOKEN',
        publicKey: 'KEY',
        handle: 'support_bot',
      }

      const result = await bodySchema.validateAsync(validBody)

      expect(result.error).toBeUndefined()
      expect(result.handle).toBe('support_bot')
    })

    it('should reject handle with special characters', async () => {
      const invalidBody = {
        name: 'Test Bot',
        description: 'Test',
        appId: '123456',
        botToken: 'TOKEN',
        publicKey: 'KEY',
        handle: 'support-bot',
      }

      await expect(bodySchema.validateAsync(invalidBody)).rejects.toThrow()
    })

    it('should accept empty handle', async () => {
      const validBody = {
        name: 'Test Bot',
        description: 'Test',
        appId: '123456',
        botToken: 'TOKEN',
        publicKey: 'KEY',
        handle: '',
      }

      const result = await bodySchema.validateAsync(validBody)

      expect(result.error).toBeUndefined()
    })

    it('should accept null handle', async () => {
      const validBody = {
        name: 'Test Bot',
        description: 'Test',
        appId: '123456',
        botToken: 'TOKEN',
        publicKey: 'KEY',
        handle: null,
      }

      const result = await bodySchema.validateAsync(validBody)

      expect(result.error).toBeUndefined()
    })
  })

  describe('sessionDuration validation', () => {
    it('should accept zero sessionDuration', async () => {
      const validBody = {
        name: 'Test Bot',
        description: 'Test',
        appId: '123456',
        botToken: 'TOKEN',
        publicKey: 'KEY',
        sessionDuration: 0,
      }

      const result = await bodySchema.validateAsync(validBody)

      expect(result.error).toBeUndefined()
      expect(result.sessionDuration).toBe(0)
    })

    it('should accept sessionDuration at max limit (one month)', async () => {
      const oneMonth = 30 * 24 * 60 * 60 * 1000

      const validBody = {
        name: 'Test Bot',
        description: 'Test',
        appId: '123456',
        botToken: 'TOKEN',
        publicKey: 'KEY',
        sessionDuration: oneMonth,
      }

      const result = await bodySchema.validateAsync(validBody)

      expect(result.error).toBeUndefined()
      expect(result.sessionDuration).toBe(oneMonth)
    })

    it('should reject negative sessionDuration', async () => {
      const invalidBody = {
        name: 'Test Bot',
        description: 'Test',
        appId: '123456',
        botToken: 'TOKEN',
        publicKey: 'KEY',
        sessionDuration: -100,
      }

      await expect(bodySchema.validateAsync(invalidBody)).rejects.toThrow()
    })

    it('should reject sessionDuration exceeding one month', async () => {
      const overOneMonth = 31 * 24 * 60 * 60 * 1000

      const invalidBody = {
        name: 'Test Bot',
        description: 'Test',
        appId: '123456',
        botToken: 'TOKEN',
        publicKey: 'KEY',
        sessionDuration: overOneMonth,
      }

      await expect(bodySchema.validateAsync(invalidBody)).rejects.toThrow()
    })

    it('should accept null sessionDuration', async () => {
      const validBody = {
        name: 'Test Bot',
        description: 'Test',
        appId: '123456',
        botToken: 'TOKEN',
        publicKey: 'KEY',
        sessionDuration: null,
      }

      const result = await bodySchema.validateAsync(validBody)

      expect(result.error).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('should accept empty string for optional fields', async () => {
      const validBody = {
        name: 'Test Bot',
        description: '',
        appId: '',
        botToken: '',
        publicKey: '',
      }

      const result = await bodySchema.validateAsync(validBody)

      expect(result.error).toBeUndefined()
    })

    it('should accept all boolean fields as false', async () => {
      const validBody = {
        name: 'Test Bot',
        description: 'Test',
        appId: '123456',
        botToken: 'TOKEN',
        publicKey: 'KEY',
        ephemeral: false,
        contactCollection: false,
        attachments: false,
      }

      const result = await bodySchema.validateAsync(validBody)

      expect(result.error).toBeUndefined()
      expect(result.ephemeral).toBe(false)
      expect(result.contactCollection).toBe(false)
      expect(result.attachments).toBe(false)
    })

    it('should accept null for boolean fields', async () => {
      const validBody = {
        name: 'Test Bot',
        description: 'Test',
        appId: '123456',
        botToken: 'TOKEN',
        publicKey: 'KEY',
        ephemeral: null,
      }

      const result = await bodySchema.validateAsync(validBody)

      expect(result.error).toBeUndefined()
    })
  })
})
