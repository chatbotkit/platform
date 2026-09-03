import { timestamp, zstatic } from '@/lib/zod.types'

import { ZodError, z } from 'zod'

describe('zstatic', () => {
  describe('basic functionality', () => {
    it('should return the static value when parsing empty input', () => {
      const schema = z.object({
        service: zstatic('jira'),
        path: zstatic('/rest/api/3/search'),
      })

      const result = schema.parse({})

      expect(result).toEqual({
        service: 'jira',
        path: '/rest/api/3/search',
      })
    })

    it('should return the static value regardless of provided input', () => {
      const schema = z.object({
        service: zstatic('jira'),
        path: zstatic('/rest/api/3/search'),
      })

      const result = schema.parse({
        service: 'confluence',
        path: '/other/path',
      })

      expect(result).toEqual({
        service: 'jira',
        path: '/rest/api/3/search',
      })
    })

    it('should work with string values', () => {
      const schema = zstatic('hello')
      const result = schema.parse(undefined)

      expect(result).toBe('hello')
    })

    it('should work with number values', () => {
      const schema = zstatic(42)
      const result = schema.parse(undefined)

      expect(result).toBe(42)
    })

    it('should work with boolean values', () => {
      const schemaTrue = zstatic(true)
      const schemaFalse = zstatic(false)

      expect(schemaTrue.parse(undefined)).toBe(true)
      expect(schemaFalse.parse(undefined)).toBe(false)
    })
  })

  describe('type inference', () => {
    it('should infer literal type for strings', () => {
      const schema = zstatic('jira')

      type SchemaType = z.infer<typeof schema>

      const value: SchemaType = 'jira'

      expect(schema.parse(value)).toBe('jira')

      // @note TypeScript should error on this line if types are correct:
      // const wrong: SchemaType = 'other' // would be a compile error
    })

    it('should infer literal type for numbers', () => {
      const schema = zstatic(100)

      type SchemaType = z.infer<typeof schema>

      const value: SchemaType = 100

      expect(schema.parse(value)).toBe(100)
    })

    it('should infer literal type for booleans', () => {
      const schema = zstatic(true)

      type SchemaType = z.infer<typeof schema>

      const value: SchemaType = true

      expect(schema.parse(value)).toBe(true)
    })
  })

  describe('input handling', () => {
    it('should ignore null input and return static value', () => {
      const schema = zstatic('static-value')
      const result = schema.parse(null)

      expect(result).toBe('static-value')
    })

    it('should ignore undefined input and return static value', () => {
      const schema = zstatic('static-value')
      const result = schema.parse(undefined)

      expect(result).toBe('static-value')
    })

    it('should ignore object input and return static value', () => {
      const schema = zstatic('static-value')
      const result = schema.parse({ key: 'value' })

      expect(result).toBe('static-value')
    })

    it('should ignore array input and return static value', () => {
      const schema = zstatic('static-value')
      const result = schema.parse([1, 2, 3])

      expect(result).toBe('static-value')
    })
  })

  describe('integration with complex schemas', () => {
    it('should work alongside regular zod fields', () => {
      const schema = z.object({
        staticField: zstatic('always-this'),
        dynamicField: z.string(),
        optionalField: z.number().optional(),
      })

      const result = schema.parse({
        staticField: 'ignored',
        dynamicField: 'user-provided',
        optionalField: 42,
      })

      expect(result).toEqual({
        staticField: 'always-this',
        dynamicField: 'user-provided',
        optionalField: 42,
      })
    })

    it('should work in nested objects', () => {
      const schema = z.object({
        outer: z.object({
          staticValue: zstatic('nested-static'),
          dynamicValue: z.string(),
        }),
      })

      const result = schema.parse({
        outer: {
          staticValue: 'ignored',
          dynamicValue: 'provided',
        },
      })

      expect(result).toEqual({
        outer: {
          staticValue: 'nested-static',
          dynamicValue: 'provided',
        },
      })
    })
  })

  describe('safe parsing', () => {
    it('should work with safeParse', () => {
      const schema = zstatic('safe-value')
      const result = schema.safeParse('anything')

      expect(result.success).toBe(true)

      if (result.success) {
        expect(result.data).toBe('safe-value')
      }
    })

    it('should work with safeParseAsync', async () => {
      const schema = zstatic('async-value')
      const result = await schema.safeParseAsync('anything')

      expect(result.success).toBe(true)

      if (result.success) {
        expect(result.data).toBe('async-value')
      }
    })
  })
})

describe('timestamp', () => {
  describe('valid inputs', () => {
    it('should transform valid string dates to timestamps', () => {
      const testCases = [
        ['2023-01-01', new Date('2023-01-01').getTime()],
        ['2023-12-31T23:59:59Z', new Date('2023-12-31T23:59:59Z').getTime()],
        ['January 1, 2023', new Date('January 1, 2023').getTime()],
        [
          '2023-01-01T12:00:00.000Z',
          new Date('2023-01-01T12:00:00.000Z').getTime(),
        ],
      ]

      testCases.forEach(([input, expected]) => {
        const result = timestamp.parse(input)

        expect(result).toBe(expected)
        expect(typeof result).toBe('number')
      })
    })

    it('should transform valid number timestamps', () => {
      const testCases = [
        [1672531200000, 1672531200000], // 2023-01-01 timestamp
        [0, 0], // Unix epoch
        [Date.now(), Date.now()], // current time
        [1640995200000, 1640995200000], // 2022-01-01 timestamp
      ]

      testCases.forEach(([input, expected]) => {
        const result = timestamp.parse(input)

        expect(result).toBe(expected)
        expect(typeof result).toBe('number')
      })
    })

    it('should handle edge case timestamps', () => {
      // test various edge cases that should be valid

      const validInputs = [
        '1970-01-01T00:00:00.000Z', // unix epoch as string
        8640000000000000, // max safe date value
        -8640000000000000, // min safe date value
      ]

      validInputs.forEach((input) => {
        const result = timestamp.parse(input)

        expect(typeof result).toBe('number')
        expect(isNaN(result)).toBe(false)
      })
    })
  })

  describe('invalid inputs', () => {
    it('should throw ZodError for non-string, non-number inputs', () => {
      const invalidInputs = [
        null,
        undefined,
        {},
        [],
        true,
        false,
        Symbol('test'),
      ]

      invalidInputs.forEach((input) => {
        expect(() => timestamp.parse(input)).toThrow(ZodError)
      })
    })

    it('should throw Error for invalid date strings', () => {
      const invalidDateStrings = [
        'invalid-date',
        'not a date',
        '2023-13-01', // invalid month
        '2023-01-32', // invalid day
        // @note '2023-02-30' is actually interpreted as a valid date (March
        // 2nd) by JavaScript
        '', // empty string creates NaN
        'abc123',
        'NaN',
        '1672531200000', // string representation of number creates NaN in Date constructor
      ]

      invalidDateStrings.forEach((input) => {
        expect(() => timestamp.parse(input)).toThrow('Invalid date')
      })
    })

    it('should handle edge case valid date strings that JavaScript accepts', () => {
      // some date strings that might seem invalid are actually accepted by JavaScript

      const edgeCaseValidDates = [
        '2023-02-30', // JavaScript interprets this as March 2nd, 2023
      ]

      edgeCaseValidDates.forEach((input) => {
        const result = timestamp.parse(input)

        expect(typeof result).toBe('number')
        expect(isNaN(result)).toBe(false)
      })
    })

    it('should throw Error for invalid number timestamps', () => {
      const invalidNumbers = [Infinity, -Infinity]

      invalidNumbers.forEach((input) => {
        expect(() => timestamp.parse(input)).toThrow('Invalid date') // these pass union check but create invalid dates
      })
    })

    it('should throw ZodError for NaN (which fails union validation)', () => {
      expect(() => timestamp.parse(NaN)).toThrow(ZodError) // NaN fails the union check
    })

    it('should preserve original ZodError details for type validation', () => {
      try {
        timestamp.parse(null)

        // eslint-disable-next-line no-undef
        fail('Expected ZodError to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError)
        expect((error as ZodError).errors).toHaveLength(1)
        expect((error as ZodError).errors[0].code).toBe('invalid_union')
      }
    })

    it('should throw Error with specific message for invalid dates', () => {
      expect(() => timestamp.parse('invalid-date')).toThrow('Invalid date')
      expect(() => timestamp.parse('')).toThrow('Invalid date') // Empty string creates NaN
    })
  })

  describe('transform behavior', () => {
    it('should return the same timestamp for already valid timestamps', () => {
      const now = Date.now()
      const result = timestamp.parse(now)

      expect(result).toBe(now)
    })

    it('should convert string dates to equivalent number timestamps', () => {
      const dateString = '2023-06-15T14:30:00Z'
      const expectedTimestamp = new Date(dateString).getTime()
      const result = timestamp.parse(dateString)

      expect(result).toBe(expectedTimestamp)
    })

    it('should handle timezone information in date strings', () => {
      const testCases = [
        '2023-01-01T00:00:00Z',
        '2023-01-01T00:00:00+00:00',
        '2023-01-01T05:00:00+05:00', // Same as UTC midnight
      ]

      testCases.forEach((dateString) => {
        const result = timestamp.parse(dateString)

        expect(typeof result).toBe('number')
        expect(isNaN(result)).toBe(false)
      })
    })
  })

  describe('async parsing', () => {
    it('should work with safeParseAsync for valid inputs', async () => {
      const result = await timestamp.safeParseAsync('2023-01-01')

      expect(result.success).toBe(true)

      if (result.success) {
        expect(typeof result.data).toBe('number')
        expect(result.data).toBe(new Date('2023-01-01').getTime())
      }
    })

    it('should throw error for invalid inputs with safeParseAsync', async () => {
      // @note safeParse and safeParseAsync still throw when transform functions throw custom errors

      await expect(timestamp.safeParseAsync('invalid-date')).rejects.toThrow(
        'Invalid date'
      )
    })
  })

  describe('safe parsing', () => {
    it('should return success result for valid inputs', () => {
      const validInputs = [
        '2023-01-01',
        1672531200000,
        '2023-12-31T23:59:59Z',
        0,
      ]

      validInputs.forEach((input) => {
        const result = timestamp.safeParse(input)

        expect(result.success).toBe(true)

        if (result.success) {
          expect(typeof result.data).toBe('number')
          expect(isNaN(result.data)).toBe(false)
        }
      })
    })

    it('should return error result for invalid type inputs', () => {
      const invalidInputs = [null, undefined, {}, [], true]

      invalidInputs.forEach((input) => {
        const result = timestamp.safeParse(input)

        expect(result.success).toBe(false)

        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError)
        }
      })
    })

    it('should throw error for invalid date inputs in safeParse', () => {
      const invalidDateInputs = ['invalid-date', '', 'not-a-date']

      invalidDateInputs.forEach((input) => {
        // @note safeParse still throws when transform functions throw custom errors

        expect(() => timestamp.safeParse(input)).toThrow('Invalid date')
      })
    })
  })

  describe('edge cases and performance', () => {
    it('should handle very large valid timestamps', () => {
      const largeTimestamp = 8640000000000000 // Max safe date
      const result = timestamp.parse(largeTimestamp)

      expect(result).toBe(largeTimestamp)
    })

    it('should handle very small valid timestamps', () => {
      const smallTimestamp = -8640000000000000 // Min safe date
      const result = timestamp.parse(smallTimestamp)

      expect(result).toBe(smallTimestamp)
    })

    it('should handle string representations of number timestamps', () => {
      // String representations of numbers result in NaN when passed to Date
      // constructor - so they should throw an "Invalid date" error
      const timestampString = '1672531200000'

      expect(() => timestamp.parse(timestampString)).toThrow('Invalid date')
    })

    it('should throw for timestamps beyond safe integer range', () => {
      const unsafeTimestamp = Number.MAX_SAFE_INTEGER + 1

      // this should create an invalid date

      expect(() => timestamp.parse(unsafeTimestamp)).toThrow('Invalid date')
    })
  })
})
