import { getColorFilter } from '@/lib/color.filter'

import { hexToCSSFilter } from 'hex-to-css-filter'

jest.mock('hex-to-css-filter', () => ({
  hexToCSSFilter: jest.fn((color) => {
    // Mock implementation that returns realistic CSS filter strings
    const mockFilters = {
      '#000000': {
        filter:
          'brightness(0) saturate(100%) invert(0%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(0%) contrast(100%);',
      },
      '#ffffff': {
        filter:
          'brightness(0) saturate(100%) invert(100%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(100%);',
      },
      '#ff0000': {
        filter:
          'brightness(0) saturate(100%) invert(21%) sepia(100%) saturate(7426%) hue-rotate(356deg) brightness(103%) contrast(115%);',
      },
      '#00ff00': {
        filter:
          'brightness(0) saturate(100%) invert(75%) sepia(52%) saturate(6079%) hue-rotate(92deg) brightness(119%) contrast(119%);',
      },
      '#0000ff': {
        filter:
          'brightness(0) saturate(100%) invert(12%) sepia(93%) saturate(7497%) hue-rotate(246deg) brightness(101%) contrast(143%);',
      },
    }

    return (
      mockFilters[color] || {
        filter:
          'brightness(0) saturate(100%) invert(50%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(100%);',
      }
    )
  }),
}))

describe('color filter utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getColorFilter', () => {
    describe('basic functionality', () => {
      it('should convert black hex color to CSS filter', () => {
        const result = getColorFilter('#000000')

        expect(hexToCSSFilter).toHaveBeenCalledWith('#000000')
        expect(result).toContain('brightness(0)')
        expect(result).toContain('saturate(100%)')
        expect(result).not.toEndWith(';')
      })

      it('should convert white hex color to CSS filter', () => {
        const result = getColorFilter('#ffffff')

        expect(hexToCSSFilter).toHaveBeenCalledWith('#ffffff')
        expect(result).toContain('invert(100%)')
        expect(result).not.toEndWith(';')
      })

      it('should convert red hex color to CSS filter', () => {
        const result = getColorFilter('#ff0000')

        expect(hexToCSSFilter).toHaveBeenCalledWith('#ff0000')
        expect(result).toContain('hue-rotate')
        expect(result).not.toEndWith(';')
      })

      it('should convert green hex color to CSS filter', () => {
        const result = getColorFilter('#00ff00')

        expect(hexToCSSFilter).toHaveBeenCalledWith('#00ff00')
        expect(result).toContain('hue-rotate')
        expect(result).not.toEndWith(';')
      })

      it('should convert blue hex color to CSS filter', () => {
        const result = getColorFilter('#0000ff')

        expect(hexToCSSFilter).toHaveBeenCalledWith('#0000ff')
        expect(result).toContain('hue-rotate')
        expect(result).not.toEndWith(';')
      })
    })

    describe('semicolon removal', () => {
      it('should remove trailing semicolon from filter string', () => {
        const result = getColorFilter('#000000')

        expect(result).not.toEndWith(';')
      })

      it('should preserve filter content when removing semicolon', () => {
        const result = getColorFilter('#ffffff')

        expect(result).toContain('brightness')
        expect(result).toContain('saturate')
        expect(result).toContain('invert')
        expect(result).not.toEndWith(';')
      })

      it('should work with all color variations', () => {
        const colors = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff']

        colors.forEach((color) => {
          const result = getColorFilter(color)

          expect(result).not.toEndWith(';')
        })
      })
    })

    describe('edge cases', () => {
      it('should handle lowercase hex colors', () => {
        const result = getColorFilter('#ff0000')

        expect(hexToCSSFilter).toHaveBeenCalledWith('#ff0000')
        expect(typeof result).toBe('string')
      })

      it('should handle uppercase hex colors', () => {
        const result = getColorFilter('#FF0000')

        expect(hexToCSSFilter).toHaveBeenCalledWith('#FF0000')
        expect(typeof result).toBe('string')
      })

      it('should handle mixed case hex colors', () => {
        const result = getColorFilter('#Ff0000')

        expect(hexToCSSFilter).toHaveBeenCalledWith('#Ff0000')
        expect(typeof result).toBe('string')
      })

      it('should return string type', () => {
        const result = getColorFilter('#000000')

        expect(typeof result).toBe('string')
      })

      it('should return non-empty string', () => {
        const result = getColorFilter('#000000')

        expect(result.length).toBeGreaterThan(0)
      })
    })

    describe('CSS filter format', () => {
      it('should contain brightness property', () => {
        const result = getColorFilter('#000000')

        expect(result).toContain('brightness')
      })

      it('should contain saturate property', () => {
        const result = getColorFilter('#000000')

        expect(result).toContain('saturate')
      })

      it('should contain multiple filter functions', () => {
        const result = getColorFilter('#ff0000')

        expect(result).toContain('brightness')
        expect(result).toContain('saturate')
        expect(result).toContain('invert')
        expect(result).toContain('sepia')
        expect(result).toContain('hue-rotate')
        expect(result).toContain('contrast')
      })

      it('should have proper CSS filter syntax', () => {
        const result = getColorFilter('#000000')

        // Should contain percentage values
        expect(result).toMatch(/\d+%/)
        // Should contain function calls with parentheses
        expect(result).toMatch(/\w+\([^)]+\)/)
      })
    })

    describe('multiple calls', () => {
      it('should handle multiple sequential calls', () => {
        const result1 = getColorFilter('#000000')
        const result2 = getColorFilter('#ffffff')
        const result3 = getColorFilter('#ff0000')

        expect(result1).not.toEndWith(';')
        expect(result2).not.toEndWith(';')
        expect(result3).not.toEndWith(';')

        expect(hexToCSSFilter).toHaveBeenCalledTimes(3)
      })

      it('should return consistent results for same input', () => {
        const result1 = getColorFilter('#000000')
        const result2 = getColorFilter('#000000')

        expect(result1).toBe(result2)
      })

      it('should return different results for different colors', () => {
        const result1 = getColorFilter('#000000')
        const result2 = getColorFilter('#ffffff')

        expect(result1).not.toBe(result2)
      })
    })

    describe('integration with hexToCSSFilter', () => {
      it('should call hexToCSSFilter with correct argument', () => {
        getColorFilter('#123456')

        expect(hexToCSSFilter).toHaveBeenCalledWith('#123456')
        expect(hexToCSSFilter).toHaveBeenCalledTimes(1)
      })

      it('should extract filter property from hexToCSSFilter result', () => {
        const result = getColorFilter('#000000')

        expect(hexToCSSFilter).toHaveBeenCalled()
        expect(typeof result).toBe('string')
        expect(result.length).toBeGreaterThan(0)
      })

      it('should handle hexToCSSFilter output format', () => {
        const result = getColorFilter('#000000')

        // Result should be a valid CSS filter string
        expect(result).toMatch(/^[\w\s\-%()]+$/)
      })
    })

    describe('real-world color values', () => {
      it('should handle primary colors', () => {
        const red = getColorFilter('#ff0000')
        const green = getColorFilter('#00ff00')
        const blue = getColorFilter('#0000ff')

        expect(red).not.toEndWith(';')
        expect(green).not.toEndWith(';')
        expect(blue).not.toEndWith(';')
      })

      it('should handle grayscale colors', () => {
        const black = getColorFilter('#000000')
        const white = getColorFilter('#ffffff')

        expect(black).toContain('brightness')
        expect(white).toContain('brightness')
      })

      it('should handle common web colors', () => {
        const colors = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff']

        colors.forEach((color) => {
          const result = getColorFilter(color)

          expect(result).toBeTruthy()
          expect(typeof result).toBe('string')
          expect(result).not.toEndWith(';')
        })
      })
    })
  })
})
