import { createModeration } from '@/lib/model.provider.openai'

import { detectContentAbuse } from './moderation'

jest.mock('@/lib/model.provider.openai', () => ({
  createModeration: jest.fn(),
}))

describe('moderation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('detectContentAbuse', () => {
    it('should call createModeration with text input', async () => {
      const mockResult = {
        flagged: false,
        categories: {},
      }

      createModeration.mockResolvedValue(mockResult)

      const text = 'This is a test message'
      const result = await detectContentAbuse(text)

      expect(createModeration).toHaveBeenCalledWith(text)
      expect(result).toEqual(mockResult)
    })

    it('should return flagged result for inappropriate content', async () => {
      const mockResult = {
        flagged: true,
        categories: {
          hate: true,
          violence: false,
        },
      }

      createModeration.mockResolvedValue(mockResult)

      const text = 'Inappropriate content'
      const result = await detectContentAbuse(text)

      expect(result.flagged).toBe(true)
      expect(result.categories.hate).toBe(true)
    })

    it('should return non-flagged result for safe content', async () => {
      const mockResult = {
        flagged: false,
        categories: {
          hate: false,
          violence: false,
        },
      }

      createModeration.mockResolvedValue(mockResult)

      const text = 'This is safe content'
      const result = await detectContentAbuse(text)

      expect(result.flagged).toBe(false)
    })

    it('should handle empty string input', async () => {
      const mockResult = {
        flagged: false,
        categories: {},
      }

      createModeration.mockResolvedValue(mockResult)

      const result = await detectContentAbuse('')

      expect(createModeration).toHaveBeenCalledWith('')
      expect(result).toEqual(mockResult)
    })

    it('should handle long text input', async () => {
      const mockResult = {
        flagged: false,
        categories: {},
      }

      createModeration.mockResolvedValue(mockResult)

      const longText = 'a'.repeat(10000)
      const result = await detectContentAbuse(longText)

      expect(createModeration).toHaveBeenCalledWith(longText)
      expect(result).toEqual(mockResult)
    })

    it('should propagate errors from createModeration', async () => {
      const error = new Error('API error')

      createModeration.mockRejectedValue(error)

      await expect(detectContentAbuse('test')).rejects.toThrow('API error')
    })

    it('should handle unicode and special characters', async () => {
      const mockResult = {
        flagged: false,
        categories: {},
      }

      createModeration.mockResolvedValue(mockResult)

      const text = 'Hello 世界 🌍 émojis and spëcial chars!'
      const result = await detectContentAbuse(text)

      expect(createModeration).toHaveBeenCalledWith(text)
      expect(result).toEqual(mockResult)
    })

    it('should handle null input gracefully', async () => {
      const mockResult = {
        flagged: false,
        categories: {},
      }

      createModeration.mockResolvedValue(mockResult)

      const result = await detectContentAbuse(null)

      expect(createModeration).toHaveBeenCalledWith(null)
      expect(result).toEqual(mockResult)
    })
  })
})
