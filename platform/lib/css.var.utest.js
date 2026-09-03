import { accessVar } from '@/lib/css.var'

describe('accessVar', () => {
  describe('basic functionality', () => {
    it('should wrap CSS custom property with var()', () => {
      const result = accessVar('--primary-color')

      expect(result).toBe('var(--primary-color)')
    })

    it('should return non-CSS-variable strings as-is', () => {
      const result = accessVar('blue')

      expect(result).toBe('blue')
    })

    it('should handle CSS custom property without dashes', () => {
      const result = accessVar('color')

      expect(result).toBe('color')
    })
  })

  describe('fallback handling', () => {
    it('should create var with single fallback', () => {
      const result = accessVar('--primary-color', '--fallback-color')

      expect(result).toBe('var(--primary-color, var(--fallback-color))')
    })

    it('should create var with multiple fallbacks', () => {
      const result = accessVar('--primary', '--secondary', '--tertiary')

      expect(result).toBe('var(--primary, var(--secondary, var(--tertiary)))')
    })

    it('should handle fallback to literal color value', () => {
      const result = accessVar('--primary-color', 'blue')

      expect(result).toBe('var(--primary-color, blue)')
    })

    it('should handle mixed CSS variables and literals', () => {
      const result = accessVar('--primary', '--secondary', 'red')

      expect(result).toBe('var(--primary, var(--secondary, red))')
    })

    it('should handle deeply nested fallbacks', () => {
      const result = accessVar('--a', '--b', '--c', '--d', 'final')

      expect(result).toBe('var(--a, var(--b, var(--c, var(--d, final))))')
    })
  })

  describe('edge cases', () => {
    it('should return empty string for no arguments', () => {
      const result = accessVar()

      expect(result).toBe('')
    })

    it('should return empty string for undefined argument', () => {
      const result = accessVar(undefined)

      expect(result).toBe('')
    })

    it('should return empty string for null argument', () => {
      const result = accessVar(null)

      expect(result).toBe('')
    })

    it('should return empty string for empty string argument', () => {
      const result = accessVar('')

      expect(result).toBe('')
    })

    it('should handle falsy fallback values', () => {
      const result = accessVar('--color', '')

      expect(result).toBe('var(--color, )')
    })
  })

  describe('special formats', () => {
    it('should handle CSS variable with multiple dashes', () => {
      const result = accessVar('----custom-prop')

      expect(result).toBe('var(----custom-prop)')
    })

    it('should handle CSS variables with numbers', () => {
      const result = accessVar('--color-1')

      expect(result).toBe('var(--color-1)')
    })

    it('should handle CSS variables with special characters', () => {
      const result = accessVar('--color_primary')

      expect(result).toBe('var(--color_primary)')
    })

    it('should handle single dash prefix (not CSS custom property)', () => {
      const result = accessVar('-webkit-appearance')

      expect(result).toBe('-webkit-appearance')
    })

    it('should handle hex color values as fallback', () => {
      const result = accessVar('--primary', '#ff0000')

      expect(result).toBe('var(--primary, #ff0000)')
    })

    it('should handle rgb values as fallback', () => {
      const result = accessVar('--primary', 'rgb(255, 0, 0)')

      expect(result).toBe('var(--primary, rgb(255, 0, 0))')
    })
  })

  describe('complex scenarios', () => {
    it('should handle alternating CSS vars and literals', () => {
      const result = accessVar('--a', 'literal', '--b', 'final')

      expect(result).toBe('var(--a, var(literal, var(--b, final)))')
    })

    it('should properly nest when first arg is not CSS var', () => {
      const result = accessVar('blue', '--fallback')

      expect(result).toBe('var(blue, var(--fallback))')
    })

    it('should handle whitespace in variable names', () => {
      const result = accessVar('--primary color')

      expect(result).toBe('var(--primary color)')
    })
  })
})
