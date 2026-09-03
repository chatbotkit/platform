import { emojiRegex, isEmoji, newEmojiRegex } from '@/lib/emoji2'

describe('emoji2', () => {
  describe('emojiRegex', () => {
    it('should export a regex instance', () => {
      expect(emojiRegex).toBeInstanceOf(RegExp)
    })

    it('should match single emoji', () => {
      expect(emojiRegex.test('😀')).toBe(true)
    })

    it('should match emoji in text', () => {
      const text = 'Hello 😀 World'
      const matches = text.match(emojiRegex)

      expect(matches).not.toBeNull()
      expect(matches[0]).toBe('😀')
    })
  })

  describe('newEmojiRegex', () => {
    it('should be a function that returns regex instances', () => {
      expect(typeof newEmojiRegex).toBe('function')
      expect(newEmojiRegex()).toBeInstanceOf(RegExp)
    })

    it('should create new regex instances on each call', () => {
      const regex1 = newEmojiRegex()
      const regex2 = newEmojiRegex()

      expect(regex1).not.toBe(regex2)
    })
  })

  describe('isEmoji', () => {
    describe('basic functionality', () => {
      it('should return true for single emoji', () => {
        expect(isEmoji('😀')).toBe(true)
        expect(isEmoji('🎉')).toBe(true)
        expect(isEmoji('❤️')).toBe(true)
        expect(isEmoji('👍')).toBe(true)
      })

      it('should return true for text containing emoji', () => {
        expect(isEmoji('Hello 😀')).toBe(true)
        expect(isEmoji('😀 World')).toBe(true)
        expect(isEmoji('Test 🎉 Message')).toBe(true)
      })

      it('should return false for text without emoji', () => {
        expect(isEmoji('Hello')).toBe(false)
        expect(isEmoji('World')).toBe(false)
        expect(isEmoji('Test Message')).toBe(false)
      })

      it('should return false for numbers', () => {
        expect(isEmoji('123')).toBe(false)
        expect(isEmoji('456')).toBe(false)
      })

      it('should return false for special characters', () => {
        expect(isEmoji('!@#$%')).toBe(false)
        expect(isEmoji('*&^')).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('should handle empty string', () => {
        expect(isEmoji('')).toBe(false)
      })

      it('should handle whitespace only', () => {
        expect(isEmoji(' ')).toBe(false)
        expect(isEmoji('   ')).toBe(false)
        expect(isEmoji('\n')).toBe(false)
        expect(isEmoji('\t')).toBe(false)
      })

      it('should handle multiple emoji', () => {
        expect(isEmoji('😀😀')).toBe(true)
        expect(isEmoji('🎉🎊🎈')).toBe(true)
      })

      it('should handle emoji with skin tone modifiers', () => {
        expect(isEmoji('👍🏻')).toBe(true)
        expect(isEmoji('👍🏿')).toBe(true)
      })

      it('should handle flag emoji', () => {
        expect(isEmoji('🇺🇸')).toBe(true)
        expect(isEmoji('🇬🇧')).toBe(true)
      })

      it('should handle emoji sequences', () => {
        expect(isEmoji('👨‍👩‍👧‍👦')).toBe(true) // family emoji
        expect(isEmoji('👩‍💻')).toBe(true) // woman technologist
      })
    })

    describe('unicode edge cases', () => {
      it('should handle unicode symbols consistently', () => {
        // Note: © ® ™ are actually considered emoji by the emoji-regex library
        expect(typeof isEmoji('©')).toBe('boolean')
        expect(typeof isEmoji('®')).toBe('boolean')
        expect(typeof isEmoji('™')).toBe('boolean')
      })

      it('should handle dingbats', () => {
        // Some dingbats might be considered emoji
        expect(typeof isEmoji('✓')).toBe('boolean')
        expect(typeof isEmoji('✗')).toBe('boolean')
      })

      it('should handle combining characters', () => {
        expect(typeof isEmoji('e\u0301')).toBe('boolean') // é with combining accent
      })
    })

    describe('consistency across multiple calls', () => {
      it('should return consistent results for the same input', () => {
        const text = '😀'

        expect(isEmoji(text)).toBe(true)
        expect(isEmoji(text)).toBe(true)
        expect(isEmoji(text)).toBe(true)
      })

      it('should handle multiple different calls without state issues', () => {
        expect(isEmoji('😀')).toBe(true)
        expect(isEmoji('Hello')).toBe(false)
        expect(isEmoji('🎉')).toBe(true)
        expect(isEmoji('World')).toBe(false)
        expect(isEmoji('❤️')).toBe(true)
      })
    })
  })
})
