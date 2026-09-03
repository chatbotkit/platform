import { textToEmojiSpans, wordsToSpans } from './rehype.plugins'

jest.mock('@/lib/emoji2', () => ({
  newEmojiRegex: jest.fn(() => /[\u{1F600}-\u{1F64F}]/u),
}))

describe('wordsToSpans', () => {
  const plugin = wordsToSpans()

  describe('basic functionality', () => {
    it('should wrap words in spans for paragraph text', () => {
      const tree = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'p',
            children: [
              {
                type: 'text',
                value: 'Hello world',
              },
            ],
          },
        ],
      }

      plugin(tree)

      const pElement = tree.children[0]
      const spanWrapper = pElement.children[0]

      expect(spanWrapper.type).toBe('element')
      expect(spanWrapper.tagName).toBe('span')
      expect(spanWrapper.children.length).toBeGreaterThan(0)

      const textValues = spanWrapper.children.map(
        (child) => child.children[0].value
      )

      expect(textValues).toContain('Hello')
      expect(textValues).toContain(' ')
      expect(textValues).toContain('world')
    })

    it('should wrap words in spans for list items', () => {
      const tree = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'li',
            children: [
              {
                type: 'text',
                value: 'Item one',
              },
            ],
          },
        ],
      }

      plugin(tree)

      const liElement = tree.children[0]
      const spanWrapper = liElement.children[0]

      expect(spanWrapper.type).toBe('element')
      expect(spanWrapper.tagName).toBe('span')
      expect(spanWrapper.children.length).toBeGreaterThan(0)
    })

    it('should wrap words in spans for link text', () => {
      const tree = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'a',
            children: [
              {
                type: 'text',
                value: 'Click here',
              },
            ],
          },
        ],
      }

      plugin(tree)

      const aElement = tree.children[0]
      const spanWrapper = aElement.children[0]

      expect(spanWrapper.type).toBe('element')
      expect(spanWrapper.tagName).toBe('span')
    })
  })

  describe('special cases', () => {
    it('should not wrap URLs in link tags', () => {
      const tree = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'a',
            children: [
              {
                type: 'text',
                value: 'https://example.com',
              },
            ],
          },
        ],
      }

      plugin(tree)

      const aElement = tree.children[0]

      expect(aElement.children[0].type).toBe('text')
      expect(aElement.children[0].value).toBe('https://example.com')
    })

    it('should not wrap URLs with http:// prefix', () => {
      const tree = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'a',
            children: [
              {
                type: 'text',
                value: 'http://example.com',
              },
            ],
          },
        ],
      }

      plugin(tree)

      const aElement = tree.children[0]

      expect(aElement.children[0].type).toBe('text')
      expect(aElement.children[0].value).toBe('http://example.com')
    })

    it('should skip text nodes without valid index', () => {
      const tree = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'p',
            children: [
              {
                type: 'text',
                value: 'test',
              },
            ],
          },
        ],
      }

      const textNode = tree.children[0].children[0]

      delete textNode.index

      expect(() => plugin(tree)).not.toThrow()
    })

    it('should skip text nodes without parent', () => {
      const tree = {
        type: 'root',
        children: [
          {
            type: 'text',
            value: 'orphan text',
          },
        ],
      }

      expect(() => plugin(tree)).not.toThrow()
    })

    it('should only process p, li, and a tags', () => {
      const tree = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'div',
            children: [
              {
                type: 'text',
                value: 'Hello world',
              },
            ],
          },
        ],
      }

      plugin(tree)

      const divElement = tree.children[0]

      expect(divElement.children[0].type).toBe('text')
      expect(divElement.children[0].value).toBe('Hello world')
    })
  })

  describe('edge cases', () => {
    it('should handle empty text nodes', () => {
      const tree = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'p',
            children: [
              {
                type: 'text',
                value: '',
              },
            ],
          },
        ],
      }

      expect(() => plugin(tree)).not.toThrow()
    })

    it('should handle text with multiple spaces', () => {
      const tree = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'p',
            children: [
              {
                type: 'text',
                value: 'Hello   world',
              },
            ],
          },
        ],
      }

      plugin(tree)

      const pElement = tree.children[0]
      const spanWrapper = pElement.children[0]

      expect(spanWrapper.children.length).toBeGreaterThan(0)
    })

    it('should handle punctuation correctly', () => {
      const tree = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'p',
            children: [
              {
                type: 'text',
                value: 'Hello, world!',
              },
            ],
          },
        ],
      }

      plugin(tree)

      const pElement = tree.children[0]
      const spanWrapper = pElement.children[0]

      expect(spanWrapper.type).toBe('element')
      expect(spanWrapper.children.length).toBeGreaterThan(0)
    })
  })
})

describe('textToEmojiSpans', () => {
  const plugin = textToEmojiSpans()

  describe('basic functionality', () => {
    it('should wrap emojis in emoji tags', () => {
      const tree = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'p',
            children: [
              {
                type: 'text',
                value: 'Hello 😀 world',
              },
            ],
          },
        ],
      }

      plugin(tree)

      const pElement = tree.children[0]
      const spanWrapper = pElement.children[0]

      expect(spanWrapper.type).toBe('element')
      expect(spanWrapper.tagName).toBe('span')
      expect(
        spanWrapper.children.some((child) => child.tagName === 'emoji')
      ).toBe(true)
    })

    it('should process emojis in headings', () => {
      const tree = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'h1',
            children: [
              {
                type: 'text',
                value: 'Title 😀',
              },
            ],
          },
        ],
      }

      plugin(tree)

      const h1Element = tree.children[0]
      const spanWrapper = h1Element.children[0]

      expect(spanWrapper.type).toBe('element')
      expect(spanWrapper.tagName).toBe('span')
    })

    it('should process emojis in all heading levels', () => {
      const headings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']

      headings.forEach((tagName) => {
        const tree = {
          type: 'root',
          children: [
            {
              type: 'element',
              tagName,
              children: [
                {
                  type: 'text',
                  value: 'Heading 😀',
                },
              ],
            },
          ],
        }

        plugin(tree)

        const headingElement = tree.children[0]
        const spanWrapper = headingElement.children[0]

        expect(spanWrapper.type).toBe('element')
      })
    })

    it('should process emojis in list items, spans, and links', () => {
      const tags = ['li', 'span', 'strong', 'a']

      tags.forEach((tagName) => {
        const tree = {
          type: 'root',
          children: [
            {
              type: 'element',
              tagName,
              children: [
                {
                  type: 'text',
                  value: 'Text 😀',
                },
              ],
            },
          ],
        }

        plugin(tree)

        const element = tree.children[0]
        const spanWrapper = element.children[0]

        expect(spanWrapper.type).toBe('element')
      })
    })
  })

  describe('emoji detection', () => {
    it('should skip text without emojis', () => {
      const tree = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'p',
            children: [
              {
                type: 'text',
                value: 'Plain text',
              },
            ],
          },
        ],
      }

      plugin(tree)

      const pElement = tree.children[0]

      expect(pElement.children[0].type).toBe('text')
      expect(pElement.children[0].value).toBe('Plain text')
    })

    it('should handle multiple emojis in text', () => {
      const tree = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'p',
            children: [
              {
                type: 'text',
                value: '😀 Hello 😁 world 😂',
              },
            ],
          },
        ],
      }

      plugin(tree)

      const pElement = tree.children[0]
      const spanWrapper = pElement.children[0]

      expect(spanWrapper.tagName).toBe('span')

      const emojiElements = spanWrapper.children.filter(
        (child) => child.tagName === 'emoji'
      )

      expect(emojiElements.length).toBeGreaterThan(0)
    })

    it('should preserve text between emojis', () => {
      const tree = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'p',
            children: [
              {
                type: 'text',
                value: '😀 text 😁',
              },
            ],
          },
        ],
      }

      plugin(tree)

      const pElement = tree.children[0]
      const spanWrapper = pElement.children[0]

      const textNodes = spanWrapper.children.filter(
        (child) => child.type === 'text'
      )

      expect(textNodes.some((node) => node.value.includes('text'))).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle empty text nodes', () => {
      const tree = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'p',
            children: [
              {
                type: 'text',
                value: '',
              },
            ],
          },
        ],
      }

      expect(() => plugin(tree)).not.toThrow()
    })

    it('should skip text nodes without index', () => {
      const tree = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'p',
            children: [
              {
                type: 'text',
                value: '😀 test',
              },
            ],
          },
        ],
      }

      const textNode = tree.children[0].children[0]

      delete textNode.index

      expect(() => plugin(tree)).not.toThrow()
    })

    it('should skip text nodes without parent', () => {
      const tree = {
        type: 'root',
        children: [
          {
            type: 'text',
            value: '😀 orphan',
          },
        ],
      }

      expect(() => plugin(tree)).not.toThrow()
    })

    it('should skip unsupported parent tags', () => {
      const tree = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'div',
            children: [
              {
                type: 'text',
                value: '😀 Hello',
              },
            ],
          },
        ],
      }

      plugin(tree)

      const divElement = tree.children[0]

      expect(divElement.children[0].type).toBe('text')
      expect(divElement.children[0].value).toBe('😀 Hello')
    })
  })
})
