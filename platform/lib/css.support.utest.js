import { supports } from '@/lib/css.support'

describe('css.support module', () => {
  const originalWindow = global.window

  afterEach(() => {
    global.window = originalWindow
  })

  describe('supports', () => {
    it('should return false in server-side environment (no window)', () => {
      delete global.window

      const result = supports('display', 'flex')

      expect(result).toBe(false)
    })

    it('should return false when window.CSS is undefined', () => {
      global.window = {}

      const result = supports('display', 'grid')

      expect(result).toBe(false)
    })

    it('should return false when window.CSS.supports is null', () => {
      global.window = {
        CSS: {
          supports: null,
        },
      }

      const result = supports('display', 'grid')

      expect(result).toBe(false)
    })

    it('should return true when CSS property is supported', () => {
      global.window = {
        CSS: {
          supports: jest.fn().mockReturnValue(true),
        },
      }

      const result = supports('display', 'flex')

      expect(result).toBe(true)
      expect(global.window.CSS.supports).toHaveBeenCalledWith('display', 'flex')
    })

    it('should return false when CSS property is not supported', () => {
      global.window = {
        CSS: {
          supports: jest.fn().mockReturnValue(false),
        },
      }

      const result = supports('some-future-property', 'some-value')

      expect(result).toBe(false)
      expect(global.window.CSS.supports).toHaveBeenCalledWith(
        'some-future-property',
        'some-value'
      )
    })

    it('should handle various CSS properties', () => {
      global.window = {
        CSS: {
          supports: jest.fn((prop, val) => {
            const supported = {
              display: ['flex', 'grid', 'block'],
              position: ['sticky', 'fixed', 'absolute'],
            }

            return supported[prop]?.includes(val) || false
          }),
        },
      }

      expect(supports('display', 'flex')).toBe(true)
      expect(supports('display', 'grid')).toBe(true)
      expect(supports('display', 'inline-flex')).toBe(false)
      expect(supports('position', 'sticky')).toBe(true)
      expect(supports('position', 'static')).toBe(false)
    })

    it('should handle empty strings', () => {
      global.window = {
        CSS: {
          supports: jest.fn().mockReturnValue(false),
        },
      }

      expect(supports('', '')).toBe(false)
      expect(supports('display', '')).toBe(false)
      expect(supports('', 'flex')).toBe(false)
    })

    it('should handle special characters in property names', () => {
      global.window = {
        CSS: {
          supports: jest.fn().mockReturnValue(true),
        },
      }

      const result = supports('-webkit-transform', 'rotate(45deg)')

      expect(result).toBe(true)
      expect(global.window.CSS.supports).toHaveBeenCalledWith(
        '-webkit-transform',
        'rotate(45deg)'
      )
    })
  })
})
