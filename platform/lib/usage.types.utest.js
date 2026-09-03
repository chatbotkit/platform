import { UseType } from './usage.types'

describe('usage.types', () => {
  describe('UseType', () => {
    it('should export UseType object', () => {
      expect(UseType).toBeDefined()
      expect(typeof UseType).toBe('object')
    })

    it('should contain conversation use types', () => {
      expect(UseType.CHATBOTKIT_CONVERSATION).toBe('CHATBOTKIT_CONVERSATION')
      expect(UseType.CHATBOTKIT_MESSAGE).toBe('CHATBOTKIT_MESSAGE')
    })

    it('should contain media use types', () => {
      expect(UseType.CHATBOTKIT_IMAGE).toBe('CHATBOTKIT_IMAGE')
      expect(UseType.CHATBOTKIT_VIDEO).toBe('CHATBOTKIT_VIDEO')
      expect(UseType.CHATBOTKIT_AUDIO).toBe('CHATBOTKIT_AUDIO')
    })

    it('should contain fetch use type', () => {
      expect(UseType.CHATBOTKIT_FETCH).toBe('CHATBOTKIT_FETCH')
    })

    it('should contain email use type', () => {
      expect(UseType.CHATBOTKIT_EMAIL).toBe('CHATBOTKIT_EMAIL')
    })

    it('should contain base token types', () => {
      expect(UseType.CHATBOTKIT_BASE_TOKEN).toBe('CHATBOTKIT_BASE_TOKEN')
      expect(UseType.CHATBOTKIT_CUSTOM_TOKEN).toBe('CHATBOTKIT_CUSTOM_TOKEN')
    })

    it('should have string values matching their keys', () => {
      Object.entries(UseType).forEach(([key, value]) => {
        expect(value).toBe(key)
      })
    })

    it('should have all expected use types', () => {
      const expectedKeys = [
        'CHATBOTKIT_CONVERSATION',
        'CHATBOTKIT_MESSAGE',
        'CHATBOTKIT_IMAGE',
        'CHATBOTKIT_VIDEO',
        'CHATBOTKIT_AUDIO',
        'CHATBOTKIT_FETCH',
        'CHATBOTKIT_EMAIL',
        'CHATBOTKIT_BASE_TOKEN',
        'CHATBOTKIT_CUSTOM_TOKEN',
      ]

      expectedKeys.forEach((key) => {
        expect(UseType).toHaveProperty(key)
        expect(UseType[key]).toBe(key)
      })
    })
  })
})
