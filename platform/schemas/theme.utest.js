import themeSchema from '@/schemas/theme'

describe('themeSchema', () => {
  describe('String theme validation', () => {
    it('should validate null values', () => {
      const result = themeSchema.validate(null)

      expect(result).toEqual({ value: null })
    })

    it('should allow empty strings', () => {
      const result = themeSchema.validate('')

      expect(result).toEqual({ value: '' })
    })

    it('should validate simple theme strings', () => {
      const themeStrings = ['light', 'dark', 'auto', 'custom', 'theme-name']

      themeStrings.forEach((theme) => {
        const result = themeSchema.validate(theme)

        expect(result).toEqual({ value: theme })
      })
    })

    it('should validate structured theme strings', () => {
      const structuredThemes = [
        'theme:light',
        'theme:dark:config',
        'custom:name:value',
        'mode=light',
      ]

      structuredThemes.forEach((theme) => {
        const result = themeSchema.validate(theme)

        expect(result).toEqual({ value: theme })
      })
    })
  })

  describe('Object theme validation', () => {
    it('should validate null objects', () => {
      const result = themeSchema.validate(null)

      expect(result).toEqual({ value: null })
    })

    it('should validate theme objects with name and config', () => {
      const themeObject = {
        name: 'custom',
        config: {
          primaryColor: '#007bff',
          backgroundColor: '#ffffff',
        },
      }

      const result = themeSchema.validate(themeObject)

      // the result should be a built theme string

      expect(result.error).toBeUndefined()
      expect(typeof result.value).toBe('string')
    })

    it('should validate simple theme objects', () => {
      const themeObject = {
        name: 'light',
        config: {},
      }

      const result = themeSchema.validate(themeObject)

      expect(result.error).toBeUndefined()
      expect(typeof result.value).toBe('string')
    })

    it('should handle theme objects with complex config', () => {
      const complexTheme = {
        name: 'custom',
        config: {
          colors: {
            primary: '#007bff',
            secondary: '#6c757d',
          },
          fonts: {
            body: 'Arial, sans-serif',
            heading: 'Georgia, serif',
          },
          spacing: {
            small: '8px',
            medium: '16px',
            large: '24px',
          },
        },
      }

      const result = themeSchema.validate(complexTheme)

      expect(result.error).toBeUndefined()
      expect(typeof result.value).toBe('string')
    })
  })

  describe('Error cases', () => {
    it('should reject non-string, non-object values', () => {
      const result = themeSchema.validate(123)

      expect(result.error).toBeDefined()
    })

    it('should reject arrays', () => {
      const result = themeSchema.validate(['light', 'dark'])

      expect(result.error).toBeDefined()
    })

    it('should reject primitive values other than strings', () => {
      const primitiveValues = [123, true, false]

      primitiveValues.forEach((value) => {
        const result = themeSchema.validate(value)

        expect(result.error).toBeDefined()
      })
    })
  })

  describe('Alternative validation paths', () => {
    it('should accept either string or object format', () => {
      // string format

      const stringResult = themeSchema.validate('light')

      expect(stringResult.error).toBeUndefined()
      expect(stringResult.value).toBe('light')

      // object format

      const objectResult = themeSchema.validate({ name: 'light', config: {} })

      expect(objectResult.error).toBeUndefined()
      expect(typeof objectResult.value).toBe('string')
    })
  })
})
