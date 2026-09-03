import { splitFrontmatter, unsplitFrontmatter } from './frontmatter'

describe('splitFrontmatter', () => {
  describe('basic frontmatter parsing', () => {
    it('should parse markdown with frontmatter', () => {
      const markdown = `---
title: Test Title
description: Test Description
---

# Content Here

This is the body.`

      const result = splitFrontmatter(markdown)

      expect(result.data).toEqual({
        title: 'Test Title',
        description: 'Test Description',
      })
      expect(result.content).toBe('\n# Content Here\n\nThis is the body.')
    })

    it('should parse frontmatter with various data types', () => {
      const markdown = `---
title: Test
count: 42
enabled: true
tags:
  - tag1
  - tag2
metadata:
  key: value
---

Content`

      const result = splitFrontmatter(markdown)

      expect(result.data).toEqual({
        title: 'Test',
        count: 42,
        enabled: true,
        tags: ['tag1', 'tag2'],
        metadata: { key: 'value' },
      })
      expect(result.content).toBe('\nContent')
    })

    it('should parse frontmatter with nested objects', () => {
      const markdown = `---
author:
  name: John Doe
  email: john@example.com
settings:
  theme: dark
  notifications:
    enabled: true
    frequency: daily
---

Body text`

      const result = splitFrontmatter(markdown)

      expect(result.data).toEqual({
        author: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        settings: {
          theme: 'dark',
          notifications: {
            enabled: true,
            frequency: 'daily',
          },
        },
      })
      expect(result.content).toBe('\nBody text')
    })
  })

  describe('edge cases', () => {
    it('should handle markdown without frontmatter', () => {
      const markdown = '# Just Content\n\nNo frontmatter here.'

      const result = splitFrontmatter(markdown)

      expect(result.data).toEqual({})
      expect(result.content).toBe('# Just Content\n\nNo frontmatter here.')
    })

    it('should handle empty frontmatter', () => {
      const markdown = `---
---

Content`

      const result = splitFrontmatter(markdown)

      expect(result.data).toEqual({})
      expect(result.content).toBe('\nContent')
    })

    it('should handle frontmatter with empty content', () => {
      const markdown = `---
title: Test
---`

      const result = splitFrontmatter(markdown)

      expect(result.data).toEqual({ title: 'Test' })
      expect(result.content).toBe('')
    })

    it('should handle empty string', () => {
      const result = splitFrontmatter('')

      expect(result.data).toEqual({})
      expect(result.content).toBe('')
    })

    it('should handle only dashes', () => {
      const markdown = '---'

      const result = splitFrontmatter(markdown)

      expect(result.data).toEqual({})
      // @note the regex captures '---' as body when there's no closing delimiter
      expect(result.content).toBe('---')
    })

    it('should handle frontmatter with only whitespace', () => {
      const markdown = `---
   
---

Content`

      const result = splitFrontmatter(markdown)

      // Whitespace-only YAML should parse to empty object
      expect(result.data).toEqual({})
      expect(result.content).toBe('\nContent')
    })

    it('should throw when frontmatter yaml is invalid', () => {
      const markdown = `---
source: local
share: |
	invalid indentation
---

Content`

      expect(() => splitFrontmatter(markdown)).toThrow(
        'tab characters must not be used in indentation'
      )
    })

    it('should throw when frontmatter does not parse to an object', () => {
      const markdown = `---
hello
---

Content`

      expect(() => splitFrontmatter(markdown)).toThrow(
        'frontmatter must parse to an object'
      )
    })
  })

  describe('frontmatter delimiter variations', () => {
    it('should handle frontmatter with multiple dashes', () => {
      const markdown = `-----
title: Test
-----

Content`

      const result = splitFrontmatter(markdown)

      expect(result.data).toEqual({ title: 'Test' })
      expect(result.content).toBe('\nContent')
    })

    it('should handle frontmatter with newline variations', () => {
      const markdown = `---
title: Test
---
Content without preceding newline`

      const result = splitFrontmatter(markdown)

      expect(result.data).toEqual({ title: 'Test' })
      expect(result.content).toBe('Content without preceding newline')
    })
  })

  describe('special characters in frontmatter', () => {
    it('should handle frontmatter with special characters', () => {
      const markdown = `---
title: "Title with: colons"
description: 'Single quotes'
code: "var x = 'test';"
---

Content`

      const result = splitFrontmatter(markdown)

      expect(result.data.title).toBe('Title with: colons')
      expect(result.data.description).toBe('Single quotes')
      expect(result.data.code).toBe("var x = 'test';")
    })

    it('should handle frontmatter with unicode characters', () => {
      const markdown = `---
title: Unicode Test 中文 日本語
emoji: 🚀 🎉
---

Content`

      const result = splitFrontmatter(markdown)

      expect(result.data.title).toBe('Unicode Test 中文 日本語')
      expect(result.data.emoji).toBe('🚀 🎉')
    })
  })
})

describe('unsplitFrontmatter', () => {
  describe('basic frontmatter reconstruction', () => {
    it('should reconstruct markdown with frontmatter', () => {
      const page = {
        data: {
          title: 'Test Title',
          description: 'Test Description',
        },
        content: '# Content Here\n\nThis is the body.',
      }

      const result = unsplitFrontmatter(page)

      expect(result).toContain('---')
      expect(result).toContain('title: Test Title')
      expect(result).toContain('description: Test Description')
      expect(result).toContain('# Content Here')
      expect(result).toContain('This is the body.')
    })

    it('should reconstruct with nested data', () => {
      const page = {
        data: {
          author: {
            name: 'John Doe',
            email: 'john@example.com',
          },
          tags: ['tag1', 'tag2'],
        },
        content: 'Body text',
      }

      const result = unsplitFrontmatter(page)

      expect(result).toContain('---')
      expect(result).toContain('author:')
      expect(result).toContain('name: John Doe')
      expect(result).toContain('email: john@example.com')
      expect(result).toContain('tags:')
      expect(result).toContain('- tag1')
      expect(result).toContain('- tag2')
      expect(result).toContain('Body text')
    })
  })

  describe('edge cases', () => {
    it('should handle page without data', () => {
      const page = {
        content: '# Just Content',
      }

      const result = unsplitFrontmatter(page)

      expect(result).toBe('# Just Content')
      expect(result).not.toContain('---')
    })

    it('should handle page with empty data object', () => {
      const page = {
        data: {},
        content: 'Content',
      }

      const result = unsplitFrontmatter(page)

      expect(result).toBe('Content')
      expect(result).not.toContain('---')
    })

    it('should handle page with empty content', () => {
      const page = {
        data: { title: 'Test' },
        content: '',
      }

      const result = unsplitFrontmatter(page)

      expect(result).toContain('---')
      expect(result).toContain('title: Test')
    })

    it('should handle page with only whitespace content', () => {
      const page = {
        data: { title: 'Test' },
        content: '   \n  ',
      }

      const result = unsplitFrontmatter(page)

      expect(result).toContain('---')
      expect(result).toContain('title: Test')
      // @note even with only whitespace content, function adds double newline after frontmatter block
      expect(result).toBe('---\ntitle: Test\n---\n\n')
    })
  })

  describe('round-trip consistency', () => {
    it('should maintain data integrity through split and unsplit', () => {
      const original = `---
title: Test Title
count: 42
enabled: true
tags:
  - tag1
  - tag2
---

# Content

Body text here.`

      const split = splitFrontmatter(original)
      const reconstructed = unsplitFrontmatter(split)
      const splitAgain = splitFrontmatter(reconstructed)

      expect(splitAgain.data).toEqual(split.data)
      expect(splitAgain.content.trim()).toBe(split.content.trim())
    })

    it('should handle complex nested structures in round-trip', () => {
      const page = {
        data: {
          metadata: {
            author: {
              name: 'John',
              contacts: {
                email: 'john@example.com',
                social: ['twitter', 'github'],
              },
            },
          },
          settings: {
            theme: 'dark',
            features: {
              comments: true,
              analytics: false,
            },
          },
        },
        content: 'Complex content',
      }

      const reconstructed = unsplitFrontmatter(page)
      const split = splitFrontmatter(reconstructed)

      expect(split.data).toEqual(page.data)
      expect(split.content.trim()).toBe(page.content)
    })
  })

  describe('formatting', () => {
    it('should separate frontmatter and content with double newline', () => {
      const page = {
        data: { title: 'Test' },
        content: 'Content',
      }

      const result = unsplitFrontmatter(page)

      // Should have --- frontmatter --- followed by double newline and content
      expect(result).toMatch(/---\n[\s\S]*?\n---\n\nContent/)
    })

    it('should trim content whitespace', () => {
      const page = {
        data: { title: 'Test' },
        content: '  \n  Content  \n  ',
      }

      const result = unsplitFrontmatter(page)

      expect(result).toContain('Content')
      expect(result).not.toMatch(/Content\s+$/)
    })
  })
})
