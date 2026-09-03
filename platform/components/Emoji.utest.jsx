import { getEmojiCodePoint } from '@/lib/emoji'

import Emoji from './Emoji'

import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'

jest.mock('@/lib/emoji', () => ({
  getEmojiCodePoint: jest.fn((emoji) => {
    const codePoints = {
      '😀': 0x1f600,
      '👍': 0x1f44d,
      '❤️': 0x2764,
      '🎉': 0x1f389,
    }

    return codePoints[emoji] || null
  }),
}))

describe('Emoji', () => {
  let originalUserAgent

  const setUserAgent = (value) => {
    Object.defineProperty(navigator, 'userAgent', {
      value,
      configurable: true,
    })
  }

  const IOS_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 13_0 like Mac OS X) AppleWebKit/605.1.15'

  beforeEach(() => {
    jest.clearAllMocks()
    getEmojiCodePoint.mockImplementation((emoji) => {
      const codePoints = {
        '😀': 0x1f600,
        '👍': 0x1f44d,
        '❤️': 0x2764,
        '🎉': 0x1f389,
      }

      return codePoints[emoji] || null
    })
    originalUserAgent = navigator.userAgent
  })

  afterEach(() => {
    setUserAgent(originalUserAgent)
  })

  describe('basic functionality', () => {
    it('should render emoji as plain text by default on initial render', () => {
      render(<Emoji>😀</Emoji>)

      const span = document.querySelector('.emoji')

      expect(span).toBeInTheDocument()
      expect(span.textContent).toBe('😀')
    })

    it('should handle multiple emojis', async () => {
      const { container } = render(<Emoji>😀 👍 ❤️</Emoji>)

      await waitFor(() => {
        expect(container.textContent).toContain('😀')
        expect(container.textContent).toContain('👍')
      })
    })
  })

  describe('CDN rendering on iOS', () => {
    it('should use CDN images on iOS', async () => {
      setUserAgent(IOS_UA)

      render(<Emoji>😀</Emoji>)

      await waitFor(() => {
        const img = document.querySelector('img')

        expect(img).toBeInTheDocument()
        expect(img.src).toBe(
          'https://cdn.jsdelivr.net/npm/@twemoji/svg@15.0.0/1f600.svg'
        )
      })
    })

    it('should convert emoji to CDN image with correct hex code', async () => {
      setUserAgent(IOS_UA)

      render(<Emoji>👍</Emoji>)

      await waitFor(() => {
        const img = document.querySelector('img')

        expect(img).toHaveAttribute(
          'src',
          'https://cdn.jsdelivr.net/npm/@twemoji/svg@15.0.0/1f44d.svg'
        )
      })
    })

    it('should render multiple CDN images for multiple emojis', async () => {
      setUserAgent(IOS_UA)

      render(<Emoji>😀 👍</Emoji>)

      await waitFor(() => {
        const images = document.querySelectorAll('img')

        expect(images).toHaveLength(2)
        expect(images[0].src).toContain('1f600.svg')
        expect(images[1].src).toContain('1f44d.svg')
      })
    })

    it('should have correct CDN image styling', async () => {
      setUserAgent(IOS_UA)

      render(<Emoji>😀</Emoji>)

      await waitFor(() => {
        const img = document.querySelector('img')

        expect(img).toHaveClass('inline-block')
        expect(img.className).toContain('!w-[1em]')
        expect(img.className).toContain('!h-[1em]')
        expect(img).toHaveAttribute('alt', 'emoji')
      })
    })

    it('should filter out non-emoji content', async () => {
      setUserAgent(IOS_UA)
      getEmojiCodePoint.mockReturnValue(null)

      const { container } = render(<Emoji>text</Emoji>)

      await waitFor(() => {
        expect(container.querySelector('img')).not.toBeInTheDocument()
      })
    })
  })

  describe('iOS user agent detection', () => {
    it('should use CDN for iPad user agent', async () => {
      setUserAgent(
        'Mozilla/5.0 (iPad; CPU OS 13_0 like Mac OS X) AppleWebKit/605.1.15'
      )

      render(<Emoji>😀</Emoji>)

      await waitFor(() => {
        const img = document.querySelector('img')

        expect(img).toBeInTheDocument()
        expect(img.src).toContain('1f600.svg')
      })
    })

    it('should use CDN for iPhone user agent', async () => {
      setUserAgent(IOS_UA)

      render(<Emoji>👍</Emoji>)

      await waitFor(() => {
        const img = document.querySelector('img')

        expect(img).toBeInTheDocument()
      })
    })

    it('should not use CDN for non-iOS user agents', async () => {
      setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0'
      )

      const { container } = render(<Emoji>😀</Emoji>)

      // @note need to wait for useEffect to run even though it won't switch to CDN
      await waitFor(
        () => {
          const span = container.querySelector('.emoji')

          expect(span).toBeInTheDocument()
          expect(container.textContent).toBe('😀')

          const img = container.querySelector('img')

          expect(img).toBeNull()
        },
        { timeout: 100 }
      )
    })
  })

  describe('hydration behavior', () => {
    it('should render plain text initially to match SSR', () => {
      setUserAgent(IOS_UA)

      const { container } = render(<Emoji>😀</Emoji>)

      // @note initial render shows children as-is before useEffect runs
      const span = container.querySelector('.emoji')

      expect(span).toBeInTheDocument()
    })

    it('should switch to CDN images after mounting', async () => {
      setUserAgent(IOS_UA)

      render(<Emoji>😀</Emoji>)

      // After effect runs, should have image
      await waitFor(() => {
        const img = document.querySelector('img')

        expect(img).toBeInTheDocument()
      })
    })

    it('should start with hasMounted false and useCDN false', () => {
      // @note verifies initial state logic - the component initializes with:
      // hasMounted: false (always)
      // useCDN: false (always)
      // shouldUseCDN: hasMounted && useCDN = false
      // This means first render always shows children (plain text)

      const { container } = render(<Emoji>test emoji</Emoji>)

      expect(container.firstChild).toBeInTheDocument()
      expect(container.firstChild.tagName).toBe('SPAN')
      expect(container.firstChild).toHaveClass('emoji')
    })
  })

  describe('emoji filtering', () => {
    it('should filter out non-string children', async () => {
      setUserAgent(IOS_UA)

      render(
        <Emoji>
          😀<span>not emoji</span>
        </Emoji>
      )

      await waitFor(() => {
        const images = document.querySelectorAll('img')

        expect(images).toHaveLength(1)
      })
    })

    it('should handle emojis with whitespace splitting', async () => {
      setUserAgent(IOS_UA)

      render(<Emoji>😀 👍 🎉</Emoji>)

      await waitFor(() => {
        const images = document.querySelectorAll('img')

        expect(images).toHaveLength(3)
      })
    })

    it('should filter out invalid emojis', async () => {
      setUserAgent(IOS_UA)

      getEmojiCodePoint.mockImplementation((emoji) => {
        return emoji === '😀' ? 0x1f600 : null
      })

      render(<Emoji>😀 invalid</Emoji>)

      await waitFor(() => {
        const images = document.querySelectorAll('img')

        expect(images).toHaveLength(1)
      })
    })
  })

  describe('props forwarding', () => {
    it('should apply className prop', () => {
      render(<Emoji className="custom-class">👍</Emoji>)

      const span = document.querySelector('.emoji')

      expect(span).toHaveClass('emoji', 'custom-class')
    })

    it('should forward data attributes', () => {
      render(<Emoji data-testid="emoji-span" aria-label="thumbs up">👍</Emoji>)

      const span = screen.getByTestId('emoji-span')

      expect(span).toHaveAttribute('aria-label', 'thumbs up')
    })

    it('should forward multiple props', () => {
      const { container } = render(
        <Emoji id="emoji-id" aria-label="Happy face">
          😀
        </Emoji>
      )
      const span = container.firstChild

      expect(span).toHaveAttribute('id', 'emoji-id')
      expect(span).toHaveAttribute('aria-label', 'Happy face')
    })
  })

  describe('edge cases', () => {
    it('should handle empty children', () => {
      render(<Emoji></Emoji>)

      const span = document.querySelector('.emoji')

      expect(span).toBeInTheDocument()
      expect(span.textContent).toBe('')
    })

    it('should handle null children', () => {
      const { container } = render(<Emoji>{null}</Emoji>)

      expect(container.firstChild).toBeInTheDocument()
    })

    it('should handle undefined children', () => {
      const { container } = render(<Emoji>{undefined}</Emoji>)

      expect(container.firstChild).toBeInTheDocument()
    })

    it('should handle numeric children', () => {
      const { container } = render(<Emoji>{123}</Emoji>)

      // @note Numbers are not strings, so CDN filtering won't process them
      expect(container.textContent).toBe('123')
    })

    it('should handle children with only whitespace', async () => {
      setUserAgent(IOS_UA)

      render(<Emoji> </Emoji>)

      await waitFor(() => {
        const images = document.querySelectorAll('img')

        expect(images).toHaveLength(0)
      })
    })

    it('should convert code points to hex correctly', async () => {
      setUserAgent(IOS_UA)

      getEmojiCodePoint.mockReturnValue(0x1f600)

      render(<Emoji>😀</Emoji>)

      await waitFor(() => {
        const img = document.querySelector('img')

        expect(img.src).toContain('1f600.svg')
      })
    })
  })

  describe('CSS classes', () => {
    it('should apply default emoji classes', () => {
      render(<Emoji>😀</Emoji>)

      const span = document.querySelector('.emoji')

      expect(span).toHaveClass('emoji', 'inline-block')
    })

    it('should merge custom className with default classes', () => {
      render(<Emoji className="my-custom-emoji">😀</Emoji>)

      const span = document.querySelector('.emoji')

      expect(span).toHaveClass('emoji', 'inline-block', 'my-custom-emoji')
    })
  })
})
