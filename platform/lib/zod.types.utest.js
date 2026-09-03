import { timestamp, zstatic } from './zod.types'

describe('zod.types', () => {
  describe('zstatic', () => {
    describe('string literals', () => {
      it('should create schema that returns static string value', () => {
        const schema = zstatic('test-value')
        const result = schema.parse('anything')

        expect(result).toBe('test-value')
      })

      it('should create schema that returns empty string', () => {
        const schema = zstatic('')
        const result = schema.parse('input')

        expect(result).toBe('')
      })

      it('should create schema that returns string with special characters', () => {
        const schema = zstatic('hello@world.com')
        const result = schema.parse(null)

        expect(result).toBe('hello@world.com')
      })
    })

    describe('number literals', () => {
      it('should create schema that returns static number value', () => {
        const schema = zstatic(42)
        const result = schema.parse('anything')

        expect(result).toBe(42)
      })

      it('should create schema that returns zero', () => {
        const schema = zstatic(0)
        const result = schema.parse(123)

        expect(result).toBe(0)
      })

      it('should create schema that returns negative number', () => {
        const schema = zstatic(-100)
        const result = schema.parse(999)

        expect(result).toBe(-100)
      })

      it('should create schema that returns floating point number', () => {
        const schema = zstatic(3.14159)
        const result = schema.parse('pi')

        expect(result).toBe(3.14159)
      })
    })

    describe('boolean literals', () => {
      it('should create schema that returns true', () => {
        const schema = zstatic(true)
        const result = schema.parse(false)

        expect(result).toBe(true)
      })

      it('should create schema that returns false', () => {
        const schema = zstatic(false)
        const result = schema.parse(true)

        expect(result).toBe(false)
      })
    })

    describe('input independence', () => {
      it('should ignore input value completely', () => {
        const schema = zstatic('static')

        expect(schema.parse('input1')).toBe('static')
        expect(schema.parse('input2')).toBe('static')
        expect(schema.parse(123)).toBe('static')
        expect(schema.parse(null)).toBe('static')
        expect(schema.parse(undefined)).toBe('static')
      })
    })
  })

  describe('timestamp', () => {
    describe('valid string timestamps', () => {
      it('should parse ISO 8601 date string', () => {
        const result = timestamp.parse('2024-01-15T10:30:00.000Z')

        expect(result).toBe(new Date('2024-01-15T10:30:00.000Z').getTime())
      })

      it('should parse date string without time', () => {
        const result = timestamp.parse('2024-01-15')

        expect(result).toBe(new Date('2024-01-15').getTime())
      })

      it('should parse date string with timezone', () => {
        const result = timestamp.parse('2024-01-15T10:30:00+05:00')

        expect(result).toBe(new Date('2024-01-15T10:30:00+05:00').getTime())
      })

      it('should parse date string in various formats', () => {
        const formats = [
          '2024-01-15',
          '2024/01/15',
          'January 15, 2024',
          '15 Jan 2024',
          '2024-01-15T10:30:00Z',
        ]

        formats.forEach((format) => {
          const result = timestamp.parse(format)

          expect(typeof result).toBe('number')
          expect(result).toBeGreaterThan(0)
        })
      })
    })

    describe('valid number timestamps', () => {
      it('should parse Unix timestamp in milliseconds', () => {
        const ts = 1705315800000
        const result = timestamp.parse(ts)

        expect(result).toBe(ts)
      })

      it('should parse Unix timestamp in seconds', () => {
        const ts = 1705315800 // seconds
        const result = timestamp.parse(ts)

        expect(result).toBe(ts)
      })

      it('should parse zero timestamp', () => {
        const result = timestamp.parse(0)

        expect(result).toBe(0)
      })

      it('should parse positive timestamp', () => {
        const ts = Date.now()
        const result = timestamp.parse(ts)

        expect(result).toBe(ts)
      })
    })

    describe('edge cases', () => {
      it('should handle epoch time', () => {
        const result = timestamp.parse('1970-01-01T00:00:00.000Z')

        expect(result).toBe(0)
      })

      it('should handle future dates', () => {
        const futureDate = '2099-12-31T23:59:59.999Z'
        const result = timestamp.parse(futureDate)

        expect(result).toBe(new Date(futureDate).getTime())
      })

      it('should handle dates with milliseconds', () => {
        const dateStr = '2024-01-15T10:30:00.123Z'
        const result = timestamp.parse(dateStr)

        expect(result).toBe(new Date(dateStr).getTime())
      })
    })

    describe('invalid inputs', () => {
      it('should throw error for invalid date string', () => {
        expect(() => timestamp.parse('not-a-date')).toThrow('Invalid date')
      })

      it('should throw error for empty string', () => {
        expect(() => timestamp.parse('')).toThrow('Invalid date')
      })

      it('should throw error for malformed date', () => {
        expect(() => timestamp.parse('2024-13-45')).toThrow('Invalid date')
      })

      it('should throw error for NaN', () => {
        expect(() => timestamp.parse(NaN)).toThrow()
      })

      it('should throw error for invalid format', () => {
        expect(() => timestamp.parse('invalid/date/format')).toThrow(
          'Invalid date'
        )
      })
    })

    describe('type conversion', () => {
      it('should convert string to number timestamp', () => {
        const result = timestamp.parse('2024-01-15')

        expect(typeof result).toBe('number')
      })

      it('should preserve number as number timestamp', () => {
        const ts = 1705315800000
        const result = timestamp.parse(ts)

        expect(typeof result).toBe('number')
      })

      it('should return milliseconds since epoch', () => {
        const result = timestamp.parse('2024-01-15T00:00:00.000Z')

        expect(result).toBeGreaterThan(1700000000000)
        expect(result).toBeLessThan(2000000000000)
      })
    })
  })
})
