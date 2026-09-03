import {
  getCombinedDescription,
  getExtendedDescription,
  getShortDescription,
  parseDescription,
} from './description.parse'

describe('description.parse', () => {
  describe('parseDescription', () => {
    it('should handle empty string', () => {
      const result = parseDescription('')

      expect(result.short).toBe('')
      expect(result.extended).toBe('')
      expect(result.full).toBe('')
    })

    it('should handle null/undefined gracefully', () => {
      // @ts-expect-error testing null input
      const nullResult = parseDescription(null)

      expect(nullResult.short).toBe('')

      // @ts-expect-error testing undefined input
      const undefinedResult = parseDescription(undefined)

      expect(undefinedResult.short).toBe('')
    })

    it('should return full description as short when no separator exists', () => {
      const description = 'A simple weather API for getting forecasts'
      const result = parseDescription(description)

      expect(result.short).toBe(description)
      expect(result.extended).toBe('')
      expect(result.full).toBe(description)
    })

    it('should split description on markdown separator', () => {
      const description = `Weather API for forecasts
---
This API supports multiple locations and provides hourly, daily, and weekly forecasts. It requires an API key for authentication.`

      const result = parseDescription(description)

      expect(result.short).toBe('Weather API for forecasts')
      expect(result.extended).toBe(
        'This API supports multiple locations and provides hourly, daily, and weekly forecasts. It requires an API key for authentication.'
      )
      expect(result.full).toBe(description.trim())
    })

    it('should handle separator with extra whitespace around text', () => {
      const description = `  Short description with spaces  
---
  Extended with leading spaces  `

      const result = parseDescription(description)

      expect(result.short).toBe('Short description with spaces')
      expect(result.extended).toBe('Extended with leading spaces')
    })

    it('should handle multiple separators by joining extended parts', () => {
      const description = `Short part
---
Extended part one
---
Extended part two`

      const result = parseDescription(description)

      expect(result.short).toBe('Short part')
      expect(result.extended).toBe('Extended part one\n---\nExtended part two')
    })

    it('should not split on --- that is not on its own line', () => {
      const description =
        'This is a description with --- inline separator that should not split'
      const result = parseDescription(description)

      expect(result.short).toBe(description)
      expect(result.extended).toBe('')
    })

    it('should handle multiline short descriptions', () => {
      const description = `Line one of short
Line two of short
---
Extended description here`

      const result = parseDescription(description)

      expect(result.short).toBe('Line one of short\nLine two of short')
      expect(result.extended).toBe('Extended description here')
    })

    it('should handle extended description with markdown formatting', () => {
      const description = `Quick API summary
---
## Detailed Information

This API provides:
- Feature 1
- Feature 2

### Usage Notes
Always use HTTPS.`

      const result = parseDescription(description)

      expect(result.short).toBe('Quick API summary')
      expect(result.extended).toContain('## Detailed Information')
      expect(result.extended).toContain('- Feature 1')
    })
  })

  describe('getShortDescription', () => {
    it('should return short description when separator exists', () => {
      const description = 'Short\n---\nExtended'

      expect(getShortDescription(description)).toBe('Short')
    })

    it('should return full description when no separator', () => {
      const description = 'Full description without separator'

      expect(getShortDescription(description)).toBe(description)
    })
  })

  describe('getExtendedDescription', () => {
    it('should return extended description when separator exists', () => {
      const description = 'Short\n---\nExtended part here'

      expect(getExtendedDescription(description)).toBe('Extended part here')
    })

    it('should return empty string when no separator', () => {
      const description = 'No separator here'

      expect(getExtendedDescription(description)).toBe('')
    })
  })

  describe('getCombinedDescription', () => {
    it('should join short and extended with double newline when separator exists', () => {
      const description = `Short part
---
Extended part here`

      expect(getCombinedDescription(description)).toBe(
        'Short part\n\nExtended part here'
      )
    })

    it('should return full description when no separator', () => {
      const description = 'Full description without separator'

      expect(getCombinedDescription(description)).toBe(description)
    })

    it('should handle multiple separators correctly', () => {
      const description = `Short
---
Extended one
---
Extended two`

      expect(getCombinedDescription(description)).toBe(
        'Short\n\nExtended one\n---\nExtended two'
      )
    })

    it('should handle empty description', () => {
      expect(getCombinedDescription('')).toBe('')
    })
  })
})
