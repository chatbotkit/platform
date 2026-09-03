import {
  getEmojiCodePoint,
  isEmojiCodePoint,
  isEmojiShortCode,
  text2emoji,
} from '@/lib/emoji'

import emojiFromText from 'emoji-from-text'
import emojiNameMap from 'emoji-name-map'

jest.mock('emoji-name-map')
jest.mock('emoji-from-text')

describe('emoji', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('text2emoji', () => {
    describe('emoji code point handling', () => {
      it('should return emoji if input is already an emoji code point', () => {
        const emoji = '😀'
        const result = text2emoji(emoji)

        expect(result).toBe(emoji)
      })

      it('should return first array element if it is an emoji code point', () => {
        const emoji = '🎉'
        const result = text2emoji([emoji, 'fallback'])

        expect(result).toBe(emoji)
      })

      it('should handle various emoji code points', () => {
        // Note: ❤️ is excluded because it's two code points (heart + variation selector)
        // which doesn't pass isEmojiCodePoint check
        const emojis = ['👍', '🔥', '✨', '🚀']

        emojis.forEach((emoji) => {
          expect(text2emoji(emoji)).toBe(emoji)
        })
      })
    })

    describe('emoji short code handling', () => {
      it('should convert emoji short code to emoji using emojiNameMap', () => {
        emojiNameMap.get = jest
          .fn()
          .mockReturnValueOnce(undefined) // first call for code point check
          .mockReturnValueOnce('😀') // second call for short code

        const result = text2emoji('smile')

        expect(result).toBe('😀')
      })

      it('should handle array with short code as first element', () => {
        emojiNameMap.get = jest
          .fn()
          .mockReturnValueOnce(undefined)
          .mockReturnValueOnce('🎉')

        const result = text2emoji(['tada', 'fallback'])

        expect(result).toBe('🎉')
      })
    })

    describe('text to emoji conversion with emojiFromText', () => {
      it('should convert text to emoji using emojiFromText', () => {
        // The function calls emojiNameMap.get multiple times:
        // 1. For isEmojiShortCode check (text[0] = 'happy face')
        // 2. For the emojiFromText result (the match.toString() result)
        emojiNameMap.get = jest
          .fn()
          .mockReturnValueOnce(undefined) // isEmojiShortCode check returns falsy
          .mockReturnValueOnce('😊') // get emoji for emojiFromText match result

        emojiFromText.mockReturnValue({
          match: {
            toString: () => 'happy',
          },
        })

        const result = text2emoji('happy face')

        expect(emojiFromText).toHaveBeenCalledWith('happy face', true)
        expect(result).toBe('😊')
      })

      it('should join array elements for text conversion', () => {
        // The function calls emojiNameMap.get:
        // 1. For isEmojiShortCode check on first array element ('art')
        // 2. For the emojiFromText match result
        emojiNameMap.get = jest
          .fn()
          .mockReturnValueOnce(undefined) // isEmojiShortCode('art') returns falsy
          .mockReturnValueOnce('🎨') // get emoji for match result

        emojiFromText.mockReturnValue({
          match: {
            toString: () => 'art',
          },
        })

        const result = text2emoji(['art', 'creative', 'design'])

        expect(emojiFromText).toHaveBeenCalled()
        expect(result).toBe('🎨')
      })

      it('should use default text when input array is empty or all empty strings', () => {
        // The function calls emojiNameMap.get:
        // 1. For isEmojiShortCode check on first array element ('')
        // 2. For the emojiFromText match result
        emojiNameMap.get = jest
          .fn()
          .mockReturnValueOnce(undefined) // isEmojiShortCode('') returns falsy
          .mockReturnValueOnce('🌟') // get emoji for match result

        emojiFromText.mockReturnValue({
          match: {
            toString: () => 'star',
          },
        })

        const result = text2emoji(['', '', ''], 'default star')

        expect(emojiFromText).toHaveBeenCalledWith('default star', true)
        expect(result).toBe('🌟')
      })
    })

    describe('default fallback', () => {
      it('should return robot emoji as default when all conversions fail', () => {
        emojiNameMap.get = jest.fn().mockReturnValue(undefined)
        emojiFromText.mockReturnValue(null)

        const result = text2emoji('unknown text')

        expect(result).toBe('🤖')
      })

      it('should return robot emoji for empty string', () => {
        emojiNameMap.get = jest.fn().mockReturnValue(undefined)
        emojiFromText.mockReturnValue(null)

        const result = text2emoji('')

        expect(result).toBe('🤖')
      })

      it('should return robot emoji for empty array', () => {
        emojiNameMap.get = jest.fn().mockReturnValue(undefined)
        emojiFromText.mockReturnValue(null)

        const result = text2emoji([])

        expect(result).toBe('🤖')
      })

      it('should handle null match from emojiFromText', () => {
        emojiNameMap.get = jest.fn().mockReturnValue(undefined)
        emojiFromText.mockReturnValue({
          match: null,
        })

        const result = text2emoji('test')

        expect(result).toBe('🤖')
      })
    })
  })

  describe('isEmojiCodePoint', () => {
    it('should return true for valid emoji code points', () => {
      expect(isEmojiCodePoint('😀')).toBe(true)
      expect(isEmojiCodePoint('👍')).toBe(true)
      expect(isEmojiCodePoint('🎉')).toBe(true)
      // Note: ❤️ is actually two code points (heart + variation selector)
      // so it doesn't match the single emoji code point regex
      expect(isEmojiCodePoint('❤')).toBe(true)
    })

    it('should return false for non-emoji text', () => {
      expect(isEmojiCodePoint('a')).toBe(false)
      expect(isEmojiCodePoint('hello')).toBe(false)
      expect(isEmojiCodePoint('123')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isEmojiCodePoint('')).toBe(false)
    })

    it('should return false for null or undefined', () => {
      expect(isEmojiCodePoint(null)).toBe(false)
      expect(isEmojiCodePoint(undefined)).toBe(false)
    })

    it('should return false for multi-character strings', () => {
      expect(isEmojiCodePoint('😀😀')).toBe(false)
      expect(isEmojiCodePoint('emoji')).toBe(false)
    })
  })

  describe('isEmojiShortCode', () => {
    it('should return true when emojiNameMap has the short code', () => {
      emojiNameMap.get = jest.fn().mockReturnValue('😀')

      expect(isEmojiShortCode('smile')).toBe(true)
      expect(emojiNameMap.get).toHaveBeenCalledWith('smile')
    })

    it('should return false when emojiNameMap does not have the short code', () => {
      emojiNameMap.get = jest.fn().mockReturnValue(undefined)

      expect(isEmojiShortCode('not-a-code')).toBe(false)
    })

    it('should handle empty string', () => {
      emojiNameMap.get = jest.fn().mockReturnValue(undefined)

      expect(isEmojiShortCode('')).toBe(false)
      expect(emojiNameMap.get).toHaveBeenCalledWith('')
    })

    it('should handle null or undefined', () => {
      emojiNameMap.get = jest.fn().mockReturnValue(undefined)

      expect(isEmojiShortCode(null)).toBe(false)
      expect(isEmojiShortCode(undefined)).toBe(false)
    })

    it('should return false for emoji code points', () => {
      emojiNameMap.get = jest.fn().mockReturnValue(undefined)

      expect(isEmojiShortCode('😀')).toBe(false)
    })
  })

  describe('getEmojiCodePoint', () => {
    it('should return code point of first character in emoji', () => {
      const codePoint = getEmojiCodePoint('😀')

      expect(codePoint).toBe(128512) // code point for 😀
    })

    it('should return 0 for empty string', () => {
      expect(getEmojiCodePoint('')).toBe(0)
    })

    it('should return code point for simple ASCII character', () => {
      const codePoint = getEmojiCodePoint('A')

      expect(codePoint).toBe(65) // code point for 'A'
    })

    it('should skip variation selector (65039) and return emoji code point', () => {
      // ❤️ is often followed by variation selector 65039 (️)
      const heart = '❤️'
      const codePoint = getEmojiCodePoint(heart)

      // should return code point of ❤ (10084), not variation selector
      expect(codePoint).toBe(10084)
    })

    it('should handle multi-character emoji sequences', () => {
      // 👨‍👩‍👧‍👦 family emoji (composed of multiple code points)
      const family = '👨‍👩‍👧‍👦'
      const codePoint = getEmojiCodePoint(family)

      // should return first code point
      expect(codePoint).toBeGreaterThan(0)
      expect(codePoint).not.toBe(65039)
    })

    it('should return 0 when all characters are variation selectors', () => {
      // edge case: string with only variation selectors
      const text = String.fromCodePoint(65039)
      const codePoint = getEmojiCodePoint(text)

      expect(codePoint).toBe(0)
    })

    it('should handle various emoji types', () => {
      const emojis = [
        { emoji: '🎉', expected: 127881 },
        { emoji: '👍', expected: 128077 },
        { emoji: '🚀', expected: 128640 },
      ]

      emojis.forEach(({ emoji, expected }) => {
        expect(getEmojiCodePoint(emoji)).toBe(expected)
      })
    })

    it('should handle regular text', () => {
      expect(getEmojiCodePoint('hello')).toBe(104) // 'h' code point
      expect(getEmojiCodePoint('123')).toBe(49) // '1' code point
    })
  })
})
