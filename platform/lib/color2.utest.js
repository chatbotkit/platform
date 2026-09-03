import {
  blackOrWhite,
  contrastRatio,
  hueAndBrightnessGradient,
  isOpaqueColor,
  legibleTextColor,
  scaleSingleColor,
} from '@/lib/color2'

import chroma from 'chroma-js'

describe('color2 utilities', () => {
  describe('hueAndBrightnessGradient', () => {
    it('should generate gradient with specified number of colors', () => {
      const result = hueAndBrightnessGradient('#ff0000', 5)

      expect(result).toHaveLength(5)
      expect(result).toBeInstanceOf(Array)
    })

    it('should return array with single color when n=1', () => {
      const result = hueAndBrightnessGradient('#00ff00', 1)

      expect(result).toHaveLength(1)
      expect(result[0]).toBeTruthy()
    })

    it('should generate gradient from hex color', () => {
      const result = hueAndBrightnessGradient('#0000ff', 3)

      expect(result).toHaveLength(3)
      expect(typeof result[0]).toBe('string')
      expect(result[0]).toMatch(/^#[0-9a-f]{6}$/i)
    })

    it('should generate gradient from rgb color', () => {
      const result = hueAndBrightnessGradient('rgb(255, 0, 0)', 3)

      expect(result).toHaveLength(3)
      expect(typeof result[0]).toBe('string')
    })

    it('should generate gradient from named color', () => {
      const result = hueAndBrightnessGradient('blue', 4)

      expect(result).toHaveLength(4)
      expect(typeof result[0]).toBe('string')
    })

    it('should create varying colors in gradient', () => {
      const result = hueAndBrightnessGradient('#ff0000', 5)

      // check that colors are different
      const uniqueColors = new Set(result)

      expect(uniqueColors.size).toBeGreaterThan(1)
    })

    it('should handle large number of colors', () => {
      const result = hueAndBrightnessGradient('#00ff00', 100)

      expect(result).toHaveLength(100)
      expect(result[0]).toBeTruthy()
      expect(result[99]).toBeTruthy()
    })
  })

  describe('scaleSingleColor', () => {
    it('should generate scale with specified number of colors', () => {
      const result = scaleSingleColor('#ff0000', 5)

      expect(result).toHaveLength(5)
      expect(result).toBeInstanceOf(Array)
    })

    it('should return array with single color when n=1', () => {
      const result = scaleSingleColor('#00ff00', 1)

      expect(result).toHaveLength(1)
      expect(result[0]).toBeTruthy()
    })

    it('should generate scale from hex color', () => {
      const result = scaleSingleColor('#0000ff', 3)

      expect(result).toHaveLength(3)
      expect(typeof result[0]).toBe('string')
      expect(result[0]).toMatch(/^#[0-9a-f]{6}$/i)
    })

    it('should generate scale from rgb color', () => {
      const result = scaleSingleColor('rgb(100, 150, 200)', 4)

      expect(result).toHaveLength(4)
      expect(typeof result[0]).toBe('string')
    })

    it('should generate scale from named color', () => {
      const result = scaleSingleColor('red', 3)

      expect(result).toHaveLength(3)
      expect(typeof result[0]).toBe('string')
    })

    it('should create brightness variations', () => {
      const result = scaleSingleColor('#888888', 5)

      // check that colors vary in brightness
      const luminances = result.map((color) => chroma(color).luminance())

      // luminance should increase as we brighten
      expect(luminances[luminances.length - 1]).toBeGreaterThan(luminances[0])
    })

    it('should handle large number of colors', () => {
      const result = scaleSingleColor('#0000ff', 50)

      expect(result).toHaveLength(50)
      expect(result[0]).toBeTruthy()
      expect(result[49]).toBeTruthy()
    })
  })

  describe('blackOrWhite', () => {
    describe('light colors should return black', () => {
      it('should return black for white', () => {
        expect(blackOrWhite('#ffffff')).toBe('#000000')
      })

      it('should return black for light gray', () => {
        expect(blackOrWhite('#cccccc')).toBe('#000000')
      })

      it('should return black for light yellow', () => {
        expect(blackOrWhite('#ffff00')).toBe('#000000')
      })

      it('should return black for light cyan', () => {
        expect(blackOrWhite('#00ffff')).toBe('#000000')
      })

      it('should return black for very light colors', () => {
        expect(blackOrWhite('#f0f0f0')).toBe('#000000')
      })
    })

    describe('dark colors should return white', () => {
      it('should return white for black', () => {
        expect(blackOrWhite('#000000')).toBe('#ffffff')
      })

      it('should return white for dark gray', () => {
        expect(blackOrWhite('#333333')).toBe('#ffffff')
      })

      it('should return white for dark blue', () => {
        expect(blackOrWhite('#000080')).toBe('#ffffff')
      })

      it('should return white for dark red', () => {
        expect(blackOrWhite('#800000')).toBe('#ffffff')
      })

      it('should return white for dark green', () => {
        expect(blackOrWhite('#006400')).toBe('#ffffff')
      })
    })

    describe('edge cases', () => {
      it('should handle rgb color format', () => {
        const result = blackOrWhite('rgb(255, 255, 255)')

        expect(result).toBe('#000000')
      })

      it('should handle rgba color format', () => {
        const result = blackOrWhite('rgba(0, 0, 0, 1)')

        expect(result).toBe('#ffffff')
      })

      it('should handle named colors', () => {
        expect(blackOrWhite('white')).toBe('#000000')
        expect(blackOrWhite('black')).toBe('#ffffff')
      })

      it('should handle hsl color format', () => {
        const result = blackOrWhite('hsl(0, 0%, 100%)')

        expect(result).toBe('#000000')
      })

      it('should handle threshold colors near 0.5 luminance', () => {
        // color with luminance around 0.5 should consistently return one or the other
        const result = blackOrWhite('#808080')

        expect(result).toMatch(/^#(000000|ffffff)$/)
      })
    })
  })

  describe('integration tests', () => {
    it('should work together for theme generation', () => {
      const baseColor = '#3b82f6'

      const gradient = hueAndBrightnessGradient(baseColor, 5)
      const scale = scaleSingleColor(baseColor, 5)

      // both should produce valid color arrays
      expect(gradient).toHaveLength(5)
      expect(scale).toHaveLength(5)

      // each color in gradient should have appropriate contrast color
      gradient.forEach((color) => {
        const contrast = blackOrWhite(color)

        expect(contrast).toMatch(/^#(000000|ffffff)$/)
      })
    })

    it('should handle complete color workflow', () => {
      const primaryColor = '#ff6b6b'

      // generate color variations
      const variations = scaleSingleColor(primaryColor, 7)

      // get contrast colors for each variation
      const contrastColors = variations.map((color) => blackOrWhite(color))

      expect(variations).toHaveLength(7)
      expect(contrastColors).toHaveLength(7)

      // all contrast colors should be either black or white
      contrastColors.forEach((color) => {
        expect(color).toMatch(/^#(000000|ffffff)$/)
      })
    })
  })

  describe('isOpaqueColor', () => {
    it('should return true for opaque colors', () => {
      expect(isOpaqueColor('#ffffff')).toBe(true)
      expect(isOpaqueColor('#000')).toBe(true)
      expect(isOpaqueColor('#6366f1')).toBe(true)
      expect(isOpaqueColor('rgb(10, 20, 30)')).toBe(true)
    })

    it('should return false for transparent / semi-transparent colors', () => {
      expect(isOpaqueColor('transparent')).toBe(false)
      expect(isOpaqueColor('rgba(0, 0, 0, 0)')).toBe(false)
      expect(isOpaqueColor('rgba(255, 255, 255, 0.5)')).toBe(false)
      expect(isOpaqueColor('#11223344')).toBe(false)
    })

    it('should return false for unparseable / missing values', () => {
      expect(isOpaqueColor('inherit')).toBe(false)
      expect(isOpaqueColor('currentColor')).toBe(false)
      expect(isOpaqueColor('var(--x)')).toBe(false)
      expect(isOpaqueColor('linear-gradient(red, blue)')).toBe(false)
      expect(isOpaqueColor(undefined)).toBe(false)
      expect(isOpaqueColor('')).toBe(false)
    })
  })

  describe('contrastRatio', () => {
    it('should return the maximum ratio for black on white', () => {
      expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
    })

    it('should return 1 for identical colors', () => {
      expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 5)
    })

    it('should return null when a color cannot be parsed', () => {
      expect(contrastRatio('inherit', '#ffffff')).toBeNull()
      expect(contrastRatio('#ffffff', 'var(--x)')).toBeNull()
    })
  })

  describe('legibleTextColor', () => {
    it('should keep a desired color that already has enough contrast', () => {
      // gray-900 on white is well above 4.5:1
      expect(legibleTextColor('#ffffff', '#111827')).toBe('#111827')
    })

    it('should override a desired color that blends into the background', () => {
      // white text on white background would be invisible -> force black
      expect(legibleTextColor('#ffffff', '#ffffff')).toBe('#000000')
    })

    it('should override a near-transparent desired color even if nominal contrast is high', () => {
      // black-ish text at alpha 0.1 reports high contrast but is invisible
      expect(legibleTextColor('#ffffff', 'rgba(0, 0, 0, 0.1)')).toBe('#000000')
    })

    it('should compute a legible color when no desired color is given', () => {
      expect(legibleTextColor('#000000')).toBe('#ffffff')
      expect(legibleTextColor('#ffffff')).toBe('#000000')
    })

    it('should fall through to a computed color for an unparseable desired', () => {
      expect(legibleTextColor('#000000', 'inherit')).toBe('#ffffff')
    })

    it('should return null when the background is not an opaque color', () => {
      expect(legibleTextColor('transparent', '#000000')).toBeNull()
      expect(legibleTextColor('rgba(0, 0, 0, 0.5)', '#ffffff')).toBeNull()
      expect(legibleTextColor(undefined, '#000000')).toBeNull()
    })

    it('should respect a custom minimum ratio', () => {
      // gray-500 on white is ~4.6:1 - passes at 4.5 but not at 7 (AAA)
      expect(legibleTextColor('#ffffff', '#6b7280', 4.5)).toBe('#6b7280')
      expect(legibleTextColor('#ffffff', '#6b7280', 7)).toBe('#000000')
    })
  })
})
