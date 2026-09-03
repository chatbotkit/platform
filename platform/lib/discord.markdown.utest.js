import {
  MAX_DISCORD_MESSAGE_LENGTH,
  markdownToMessages,
} from '@/lib/discord.markdown'

describe('markdownToMessages', () => {
  describe('basic functionality', () => {
    it('should convert markdown to array of messages', async () => {
      const markdown = 'Hello world'
      const result = await markdownToMessages(markdown)

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
    })

    it('should create message with text type', async () => {
      const markdown = 'Test message'
      const result = await markdownToMessages(markdown)

      expect(result[0]).toEqual({
        type: 'text',
        text: 'Test message',
      })
    })

    it('should preserve original markdown text', async () => {
      const markdown = '# Heading\n\nParagraph with **bold** and *italic*'
      const result = await markdownToMessages(markdown)

      expect(result[0].text).toBe(markdown)
    })
  })

  describe('markdown content handling', () => {
    it('should handle markdown with headers', async () => {
      const markdown = '# Main Title\n## Subtitle'
      const result = await markdownToMessages(markdown)

      expect(result[0].text).toBe(markdown)
      expect(result[0].type).toBe('text')
    })

    it('should handle markdown with bold and italic', async () => {
      const markdown = '**Bold text** and *italic text*'
      const result = await markdownToMessages(markdown)

      expect(result[0].text).toBe(markdown)
    })

    it('should handle markdown with links', async () => {
      const markdown = '[Link text](https://example.com)'
      const result = await markdownToMessages(markdown)

      expect(result[0].text).toBe(markdown)
    })

    it('should handle markdown with code blocks', async () => {
      const markdown = '```javascript\nconst x = 1;\n```'
      const result = await markdownToMessages(markdown)

      expect(result[0].text).toBe(markdown)
    })

    it('should handle markdown with lists', async () => {
      const markdown = '- Item 1\n- Item 2\n- Item 3'
      const result = await markdownToMessages(markdown)

      expect(result[0].text).toBe(markdown)
    })

    it('should handle markdown with blockquotes', async () => {
      const markdown = '> This is a quote\n> Multi-line quote'
      const result = await markdownToMessages(markdown)

      expect(result[0].text).toBe(markdown)
    })
  })

  describe('edge cases', () => {
    it('should handle empty string', async () => {
      const markdown = ''
      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('')
    })

    it('should handle whitespace-only string', async () => {
      const markdown = '   \n\t\n   '
      const result = await markdownToMessages(markdown)

      expect(result[0].text).toBe(markdown)
    })

    it('should split very long text into multiple messages within the limit', async () => {
      const markdown = 'a'.repeat(10000)
      const result = await markdownToMessages(markdown)

      expect(result.length).toBeGreaterThan(1)

      for (const message of result) {
        expect(message.type).toBe('text')
        expect(message.text.length).toBeLessThanOrEqual(MAX_DISCORD_MESSAGE_LENGTH)
      }

      // @note an unbroken run of characters has no separators to drop, so the
      // chunks recombine exactly into the original text
      expect(result.map((message) => message.text).join('')).toBe(markdown)
    })

    it('should keep text at the limit as a single message', async () => {
      const markdown = 'a'.repeat(MAX_DISCORD_MESSAGE_LENGTH)
      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].text).toBe(markdown)
    })

    it('should respect a custom maxLength', async () => {
      const markdown = 'word '.repeat(50).trim()
      const result = await markdownToMessages(markdown, 40)

      expect(result.length).toBeGreaterThan(1)

      for (const message of result) {
        expect(message.text.length).toBeLessThanOrEqual(40)
      }
    })

    it('should handle multiline markdown', async () => {
      const markdown = 'Line 1\nLine 2\nLine 3\n\nLine 5'
      const result = await markdownToMessages(markdown)

      expect(result[0].text).toBe(markdown)
    })

    it('should handle markdown with special characters', async () => {
      const markdown = 'Test with émojis 🚀 and spëcial çharacters'
      const result = await markdownToMessages(markdown)

      expect(result[0].text).toBe(markdown)
    })

    it('should handle markdown with unicode', async () => {
      const markdown = 'Unicode: 你好世界 مرحبا العالم'
      const result = await markdownToMessages(markdown)

      expect(result[0].text).toBe(markdown)
    })
  })

  describe('message structure', () => {
    it('should have required type property', async () => {
      const result = await markdownToMessages('test')

      expect(result[0]).toHaveProperty('type')
      expect(typeof result[0].type).toBe('string')
    })

    it('should have required text property', async () => {
      const result = await markdownToMessages('test')

      expect(result[0]).toHaveProperty('text')
      expect(typeof result[0].text).toBe('string')
    })

    it('should only have type and text properties', async () => {
      const result = await markdownToMessages('test')

      const keys = Object.keys(result[0])

      expect(keys).toEqual(['type', 'text'])
    })

    it('should return consistent structure for all inputs', async () => {
      const inputs = ['short', 'longer text with more content', '', '🎉']

      for (const input of inputs) {
        const result = await markdownToMessages(input)

        expect(result[0]).toHaveProperty('type', 'text')
        expect(result[0]).toHaveProperty('text')
      }
    })
  })

  describe('async behavior', () => {
    it('should return a Promise', () => {
      const result = markdownToMessages('test')

      expect(result).toBeInstanceOf(Promise)
    })

    it('should resolve with messages array', async () => {
      const promise = markdownToMessages('test')

      await expect(promise).resolves.toEqual([{ type: 'text', text: 'test' }])
    })

    it('should handle multiple concurrent calls', async () => {
      const promises = [
        markdownToMessages('first'),
        markdownToMessages('second'),
        markdownToMessages('third'),
      ]

      const results = await Promise.all(promises)

      expect(results).toHaveLength(3)
      expect(results[0][0].text).toBe('first')
      expect(results[1][0].text).toBe('second')
      expect(results[2][0].text).toBe('third')
    })
  })

  describe('discord-specific formatting', () => {
    it('should handle discord mentions', async () => {
      const markdown = '<@123456789> mentioned'
      const result = await markdownToMessages(markdown)

      expect(result[0].text).toBe(markdown)
    })

    it('should handle discord channel references', async () => {
      const markdown = 'Check <#987654321> channel'
      const result = await markdownToMessages(markdown)

      expect(result[0].text).toBe(markdown)
    })

    it('should handle discord emojis', async () => {
      const markdown = 'Custom emoji: <:emoji_name:123456>'
      const result = await markdownToMessages(markdown)

      expect(result[0].text).toBe(markdown)
    })

    it('should handle discord code formatting', async () => {
      const markdown = '`inline code` and ```block code```'
      const result = await markdownToMessages(markdown)

      expect(result[0].text).toBe(markdown)
    })
  })
})
