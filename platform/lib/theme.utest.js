import {
  COLOR_BLACK,
  COLOR_GRAY_100,
  COLOR_INDIGO_500,
  COLOR_WHITE,
  availableThemes,
  buildTheme,
  decodePart,
  defaultTheme,
  encodePart,
  parseTheme,
  themes,
} from './theme'

jest.mock('@/lib/structstr', () => ({
  parse: jest.fn((input, defaultName) => {
    if (input === 'default') {
      return { name: 'default', config: {} }
    }

    if (input === 'dark') {
      return { name: 'dark', config: {} }
    }

    if (input === 'modern/fontSize=1.5rem') {
      return { name: 'modern', config: { fontSize: '1.5rem' } }
    }

    if (input === 'custom/fontSize=2rem/lineHeight=2rem') {
      return {
        name: 'custom',
        config: { fontSize: '2rem', lineHeight: '2rem' },
      }
    }

    return { name: defaultName, config: {} }
  }),
  build: jest.fn((name, config, baseConfig) => {
    const diff = Object.entries(config).filter(
      ([key, value]) => baseConfig?.[key] !== value
    )

    if (diff.length === 0) {
      return name
    }

    return `${name}/${diff.map(([k, v]) => `${k}=${v}`).join('/')}`
  }),
}))

describe('theme', () => {
  describe('constants', () => {
    it('should export color constants', () => {
      expect(COLOR_WHITE).toBe('#ffffff')
      expect(COLOR_BLACK).toBe('#000000')
      expect(COLOR_INDIGO_500).toBe('#6366f1')
      expect(COLOR_GRAY_100).toBe('#f3f4f6')
    })

    it('should export themes object', () => {
      expect(themes).toBeDefined()
      expect(themes.default).toBeDefined()
      expect(themes.light).toBeDefined()
      expect(themes.dark).toBeDefined()
      expect(themes.modern).toBeDefined()
      expect(themes.stack).toBeDefined()
    })

    it('should export available themes array', () => {
      expect(availableThemes).toContain('default')
      expect(availableThemes).toContain('light')
      expect(availableThemes).toContain('dark')
      expect(availableThemes).toContain('modern')
      expect(availableThemes).toContain('stack')
    })

    it('should export default theme', () => {
      expect(defaultTheme).toBe('blank')
    })
  })

  describe('themes structure', () => {
    it('should have blank theme as empty object', () => {
      expect(themes.blank).toEqual({})
    })

    it('should have version v2 for all non-blank themes', () => {
      expect(themes.default.version).toBe('v2')
      expect(themes.light.version).toBe('v2')
      expect(themes.dark.version).toBe('v2')
      expect(themes.modern.version).toBe('v2')
      expect(themes.stack.version).toBe('v2')
    })

    it('should have required color properties in default theme', () => {
      const defaultThemeConfig = themes.default

      expect(defaultThemeConfig.conversationText).toBeDefined()
      expect(defaultThemeConfig.conversationPrimary).toBeDefined()
      expect(defaultThemeConfig.userMessageText).toBeDefined()
      expect(defaultThemeConfig.botMessageText).toBeDefined()
      expect(defaultThemeConfig.inputText).toBeDefined()
      expect(defaultThemeConfig.buttonText).toBeDefined()
    })

    it('should have messageStyle property', () => {
      expect(themes.default.messageStyle).toBe('bubble')
      expect(themes.light.messageStyle).toBe('bubble')
      expect(themes.dark.messageStyle).toBe('bubble')
      expect(themes.modern.messageStyle).toBe('bubble')
      expect(themes.stack.messageStyle).toBe('stack')
    })
  })

  describe('encodePart', () => {
    it('should encode forward slashes', () => {
      expect(encodePart('path/to/file')).toBe('path%2Fto%2Ffile')
    })

    it('should encode equals signs', () => {
      expect(encodePart('key=value')).toBe('key%3Dvalue')
    })

    it('should encode both slashes and equals', () => {
      expect(encodePart('path/key=value')).toBe('path%2Fkey%3Dvalue')
    })

    it('should handle empty string', () => {
      expect(encodePart('')).toBe('')
    })

    it('should handle string without special characters', () => {
      expect(encodePart('simple')).toBe('simple')
    })

    it('should handle null gracefully', () => {
      expect(encodePart(null)).toBeUndefined()
    })

    it('should handle undefined gracefully', () => {
      expect(encodePart(undefined)).toBeUndefined()
    })

    it('should handle numbers by converting to string', () => {
      expect(encodePart(123)).toBe('123')
    })
  })

  describe('decodePart', () => {
    it('should decode %2F to forward slash', () => {
      expect(decodePart('path%2Fto%2Ffile')).toBe('path/to/file')
    })

    it('should decode %3D to equals sign', () => {
      expect(decodePart('key%3Dvalue')).toBe('key=value')
    })

    it('should decode both %2F and %3D', () => {
      expect(decodePart('path%2Fkey%3Dvalue')).toBe('path/key=value')
    })

    it('should be case insensitive for %2f', () => {
      expect(decodePart('path%2fto')).toBe('path/to')
    })

    it('should be case insensitive for %3d', () => {
      expect(decodePart('key%3dvalue')).toBe('key=value')
    })

    it('should handle empty string', () => {
      expect(decodePart('')).toBe('')
    })

    it('should handle string without encoded characters', () => {
      expect(decodePart('simple')).toBe('simple')
    })

    it('should handle null gracefully', () => {
      expect(decodePart(null)).toBeUndefined()
    })

    it('should handle undefined gracefully', () => {
      expect(decodePart(undefined)).toBeUndefined()
    })
  })

  describe('encodePart and decodePart roundtrip', () => {
    it('should roundtrip correctly', () => {
      const input = 'path/to/key=value'
      const encoded = encodePart(input)
      const decoded = decodePart(encoded)

      expect(decoded).toBe(input)
    })
  })

  describe('parseTheme', () => {
    it('should parse default theme with no config', () => {
      const result = parseTheme('default')

      expect(result.name).toBe('default')
      expect(result.config).toEqual(themes.default)
    })

    it('should parse dark theme', () => {
      const result = parseTheme('dark')

      expect(result.name).toBe('dark')
      expect(result.config).toEqual(themes.dark)
    })

    it('should merge custom config with base theme', () => {
      const result = parseTheme('modern/fontSize=1.5rem')

      expect(result.name).toBe('modern')
      expect(result.config).toMatchObject({
        ...themes.modern,
        fontSize: '1.5rem',
      })
    })

    it('should use default theme when no theme provided', () => {
      const result = parseTheme()

      expect(result.name).toBe(defaultTheme)
    })

    it('should use default theme for undefined input', () => {
      const result = parseTheme(undefined)

      expect(result.name).toBe(defaultTheme)
    })

    it('should allow custom themes object', () => {
      const customThemes = {
        custom: { color: 'red' },
      }
      const result = parseTheme(
        'custom/fontSize=2rem/lineHeight=2rem',
        customThemes
      )

      expect(result.name).toBe('custom')
      expect(result.config).toEqual({
        color: 'red',
        fontSize: '2rem',
        lineHeight: '2rem',
      })
    })
  })

  describe('buildTheme', () => {
    it('should build theme name when config matches base', () => {
      const result = buildTheme('default', themes.default)

      expect(result).toBe('default')
    })

    it('should build theme string with custom config', () => {
      const config = { ...themes.modern, fontSize: '1.5rem' }
      const result = buildTheme('modern', config)

      expect(result).toBe('modern/fontSize=1.5rem')
    })

    it('should handle multiple config overrides', () => {
      const config = {
        ...themes.default,
        fontSize: '2rem',
        lineHeight: '2rem',
      }
      const result = buildTheme('default', config)

      expect(result).toContain('fontSize=2rem')
      expect(result).toContain('lineHeight=2rem')
    })

    it('should use custom themes object', () => {
      const customThemes = {
        custom: { color: 'blue' },
      }
      const config = { color: 'red' }
      const result = buildTheme('custom', config, customThemes)

      expect(result).toBe('custom/color=red')
    })

    it('should handle empty config', () => {
      const result = buildTheme('blank', {})

      expect(result).toBe('blank')
    })
  })

  describe('parseTheme and buildTheme roundtrip', () => {
    it('should roundtrip correctly', () => {
      const original = 'modern/fontSize=1.5rem'
      const parsed = parseTheme(original)
      const built = buildTheme(parsed.name, parsed.config)

      expect(built).toBe(original)
    })
  })
})
