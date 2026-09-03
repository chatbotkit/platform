import schema from '@/lib/joi.schema'

import aliasSchema from './alias'

describe('aliasSchema', () => {
  const validate = async (value) => {
    const testSchema = schema.object({
      alias: aliasSchema,
    })

    return testSchema.validateAsync({ alias: value })
  }

  describe('valid aliases', () => {
    it('should accept lowercase alphanumeric alias', async () => {
      const result = await validate('my-bot-123')

      expect(result.alias).toBe('my-bot-123')
    })

    it('should accept alias with underscores', async () => {
      const result = await validate('my_bot_123')

      expect(result.alias).toBe('my_bot_123')
    })

    it('should accept alias with hyphens', async () => {
      const result = await validate('my-bot-alias')

      expect(result.alias).toBe('my-bot-alias')
    })

    it('should accept numeric-only alias', async () => {
      const result = await validate('123456')

      expect(result.alias).toBe('123456')
    })

    it('should accept single character alias', async () => {
      const result = await validate('a')

      expect(result.alias).toBe('a')
    })

    it('should accept null value', async () => {
      const result = await validate(null)

      expect(result.alias).toBeNull()
    })

    it('should convert empty string to null', async () => {
      const result = await validate('')

      expect(result.alias).toBeNull()
    })
  })

  describe('invalid aliases', () => {
    it('should reject alias with uppercase letters', async () => {
      await expect(validate('MyBot')).rejects.toThrow(
        /lowercase letters, numbers, hyphens, and underscores/
      )
    })

    it('should reject alias with spaces', async () => {
      await expect(validate('my bot')).rejects.toThrow(
        /lowercase letters, numbers, hyphens, and underscores/
      )
    })

    it('should reject alias with special characters', async () => {
      await expect(validate('my@bot')).rejects.toThrow(
        /lowercase letters, numbers, hyphens, and underscores/
      )
    })

    it('should reject alias with dots', async () => {
      await expect(validate('my.bot')).rejects.toThrow(
        /lowercase letters, numbers, hyphens, and underscores/
      )
    })

    it('should reject alias longer than 128 characters', async () => {
      const longAlias = 'a'.repeat(129)

      await expect(validate(longAlias)).rejects.toThrow(/must be less than/)
    })
  })

  describe('edge cases', () => {
    it('should accept alias at max length (128 characters)', async () => {
      const maxAlias = 'a'.repeat(128)
      const result = await validate(maxAlias)

      expect(result.alias).toBe(maxAlias)
    })

    it('should accept alias with mixed hyphens and underscores', async () => {
      const result = await validate('my-bot_test-123')

      expect(result.alias).toBe('my-bot_test-123')
    })
  })
})
