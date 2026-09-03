import schema from '@/lib/joi.schema'

import { bodySchema } from '@/pages/api/v1/memory/create'

jest.mock('@/schemas/contactId', () => ({
  __esModule: true,
  default: () => schema.string().allow(null, '').optional(),
}))

jest.mock('@/schemas/botId', () => ({
  __esModule: true,
  default: () => schema.string().allow(null, '').optional(),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {},
}))

describe('Memory Create Schema', () => {
  describe('text field validation', () => {
    it('should accept a valid memory with text', async () => {
      const validBody = {
        name: 'Test Memory',
        text: 'Some memory content',
      }

      const result = await bodySchema.validateAsync(validBody)

      expect(result.text).toBe('Some memory content')
    })

    it('should reject a memory creation when text is missing', async () => {
      const invalidBody = {
        name: 'Test Memory Name',
        // @note text is intentionally missing to reproduce the validation bug
      }

      await expect(bodySchema.validateAsync(invalidBody)).rejects.toThrow(
        '"text" is required'
      )
    })

    it('should accept an empty string for text', async () => {
      const validBody = {
        name: 'Test Memory',
        text: '',
      }

      const result = await bodySchema.validateAsync(validBody)

      expect(result.text).toBe('')
    })

    it('should accept memory with all optional fields', async () => {
      const validBody = {
        name: 'Test Memory',
        description: 'A description',
        text: 'Memory text content',
        meta: { key: 'value' },
      }

      const result = await bodySchema.validateAsync(validBody)

      expect(result.text).toBe('Memory text content')
      expect(result.name).toBe('Test Memory')
    })
  })
})
