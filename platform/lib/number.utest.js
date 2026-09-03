/* eslint-disable no-undef */
import {
  getDisplayFormatter,
  parseDisplayFormat,
  shortFormat,
  toNumber,
} from '@/lib/number'

describe('number utilities', () => {
  describe('toNumber', () => {
    describe('basic functionality', () => {
      it('should convert regular number to number', () => {
        expect(toNumber(42)).toBe(42)
        expect(toNumber(0)).toBe(0)
        expect(toNumber(-100)).toBe(-100)
        expect(toNumber(3.14159)).toBe(3.14159)
      })

      it('should convert bigint to number', () => {
        expect(toNumber(BigInt(42))).toBe(42)
        expect(toNumber(BigInt(0))).toBe(0)
        expect(toNumber(BigInt(-100))).toBe(-100)
        expect(toNumber(BigInt(999999))).toBe(999999)
      })

      it('should call toNumber method on objects that have it', () => {
        const obj = {
          toNumber: () => 123,
        }

        expect(toNumber(obj)).toBe(123)
      })

      it('should handle objects with toNumber returning various values', () => {
        expect(toNumber({ toNumber: () => 0 })).toBe(0)
        expect(toNumber({ toNumber: () => -50 })).toBe(-50)
        expect(toNumber({ toNumber: () => 3.14 })).toBe(3.14)
      })
    })

    describe('edge cases', () => {
      it('should handle very large bigints', () => {
        const largeBigInt = BigInt(Number.MAX_SAFE_INTEGER)

        expect(toNumber(largeBigInt)).toBe(Number.MAX_SAFE_INTEGER)
      })

      it('should handle negative bigints', () => {
        expect(toNumber(BigInt(-1))).toBe(-1)
        expect(toNumber(BigInt(-1000))).toBe(-1000)
      })

      it('should handle decimal numbers', () => {
        expect(toNumber(0.1)).toBe(0.1)
        expect(toNumber(99.99)).toBe(99.99)
        expect(toNumber(-0.5)).toBe(-0.5)
      })

      it('should handle objects without toNumber method', () => {
        const obj = { value: 42 }

        expect(toNumber(obj)).toBe(obj)
      })

      it('should handle objects with non-function toNumber property', () => {
        const obj = { toNumber: 'not a function' }

        expect(toNumber(obj)).toBe(obj)
      })
    })
  })

  describe('shortFormat', () => {
    describe('basic functionality', () => {
      it('should format small numbers without modification', () => {
        expect(shortFormat(0)).toBe('0')
        expect(shortFormat(1)).toBe('1')
        expect(shortFormat(10)).toBe('10')
        expect(shortFormat(100)).toBe('100')
        expect(shortFormat(999)).toBe('999')
      })

      it('should format thousands with K notation', () => {
        expect(shortFormat(1000)).toBe('1K')
        expect(shortFormat(1500)).toBe('1.5K')
        expect(shortFormat(9999)).toBe('10K')
      })

      it('should format millions with M notation', () => {
        expect(shortFormat(1000000)).toBe('1M')
        expect(shortFormat(1500000)).toBe('1.5M')
        expect(shortFormat(9999999)).toBe('10M')
      })

      it('should format billions with B notation', () => {
        expect(shortFormat(1000000000)).toBe('1B')
        expect(shortFormat(1500000000)).toBe('1.5B')
      })

      it('should format trillions with T notation', () => {
        expect(shortFormat(1000000000000)).toBe('1T')
        expect(shortFormat(1500000000000)).toBe('1.5T')
      })
    })

    describe('USD currency formatting', () => {
      it('should format small amounts with dollar sign', () => {
        expect(shortFormat(0, 'USD')).toBe('$0')
        expect(shortFormat(1, 'USD')).toBe('$1')
        expect(shortFormat(100, 'USD')).toBe('$100')
        expect(shortFormat(999, 'USD')).toBe('$999')
      })

      it('should format thousands with dollar sign and K notation', () => {
        expect(shortFormat(1000, 'USD')).toBe('$1K')
        expect(shortFormat(1500, 'USD')).toBe('$1.5K')
        expect(shortFormat(9999, 'USD')).toBe('$10K')
      })

      it('should format millions with dollar sign and M notation', () => {
        expect(shortFormat(1000000, 'USD')).toBe('$1M')
        expect(shortFormat(1500000, 'USD')).toBe('$1.5M')
      })

      it('should format billions with dollar sign and B notation', () => {
        expect(shortFormat(1000000000, 'USD')).toBe('$1B')
        expect(shortFormat(1500000000, 'USD')).toBe('$1.5B')
      })

      it('should format trillions with dollar sign and T notation', () => {
        expect(shortFormat(1000000000000, 'USD')).toBe('$1T')
      })
    })

    describe('edge cases', () => {
      it('should handle negative numbers', () => {
        expect(shortFormat(-100)).toBe('-100')
        expect(shortFormat(-1000)).toBe('-1K')
        expect(shortFormat(-1000000)).toBe('-1M')
      })

      it('should handle negative numbers with USD', () => {
        expect(shortFormat(-100, 'USD')).toBe('-$100')
        expect(shortFormat(-1000, 'USD')).toBe('-$1K')
        expect(shortFormat(-1000000, 'USD')).toBe('-$1M')
      })

      it('should handle decimal numbers', () => {
        expect(shortFormat(0.5)).toBe('0.5')
        expect(shortFormat(99.99)).toBe('100')
      })

      it('should handle decimal numbers with USD', () => {
        expect(shortFormat(0.5, 'USD')).toBe('$0.5')
        expect(shortFormat(99.99, 'USD')).toBe('$100')
      })

      it('should handle very large numbers', () => {
        const veryLarge = 999999999999999
        const result = shortFormat(veryLarge)

        expect(result).toBeTruthy()
        expect(typeof result).toBe('string')
      })

      it('should handle type parameter case-sensitivity', () => {
        expect(shortFormat(1000, 'USD')).toBe('$1K')
        // Non-USD type should use default formatting
        expect(shortFormat(1000, 'usd')).toBe('1K')
        expect(shortFormat(1000, 'EUR')).toBe('1K')
      })
    })

    describe('rounding behavior', () => {
      it('should round appropriately for compact notation', () => {
        expect(shortFormat(1499)).toBe('1.5K')
        expect(shortFormat(1449)).toBe('1.4K')
        expect(shortFormat(9500)).toBe('9.5K')
        expect(shortFormat(9999)).toBe('10K')
      })

      it('should round appropriately for USD compact notation', () => {
        expect(shortFormat(1499, 'USD')).toBe('$1.5K')
        expect(shortFormat(1449, 'USD')).toBe('$1.4K')
        expect(shortFormat(9999, 'USD')).toBe('$10K')
      })
    })
  })

  describe('parseDisplayFormat', () => {
    it('should return empty options for number, empty, or missing tokens', () => {
      expect(parseDisplayFormat('number')).toEqual({})
      expect(parseDisplayFormat('')).toEqual({})
      expect(parseDisplayFormat(undefined)).toEqual({})
      expect(parseDisplayFormat('  ')).toEqual({})
    })

    it('should parse percent', () => {
      expect(parseDisplayFormat('percent')).toEqual({ style: 'percent' })
    })

    it('should parse currency with an ISO code', () => {
      expect(parseDisplayFormat('currency/USD')).toEqual({
        style: 'currency',
        currency: 'USD',
      })
      expect(parseDisplayFormat('currency/eur')).toEqual({
        style: 'currency',
        currency: 'EUR',
      })
    })

    it('should tolerate surrounding whitespace', () => {
      expect(parseDisplayFormat('  currency/GBP  ')).toEqual({
        style: 'currency',
        currency: 'GBP',
      })
    })

    it('should fall back to plain number for unknown or malformed tokens', () => {
      expect(parseDisplayFormat('currency')).toEqual({})
      expect(parseDisplayFormat('currency/US')).toEqual({})
      expect(parseDisplayFormat('currency/USDD')).toEqual({})
      expect(parseDisplayFormat('bananas')).toEqual({})
      expect(parseDisplayFormat(42)).toEqual({})
    })
  })

  describe('getDisplayFormatter', () => {
    it('should format plain numbers by default', () => {
      expect(getDisplayFormatter('number')(1234.5)).toBe('1,234.5')
    })

    it('should format currency', () => {
      expect(getDisplayFormatter('currency/USD')(1234.5)).toBe('$1,234.50')
    })

    it('should format percent from a fraction', () => {
      expect(getDisplayFormatter('percent')(0.45)).toBe('45%')
    })

    it('should fall back to plain number on an unknown token', () => {
      expect(getDisplayFormatter('nonsense')(1000)).toBe('1,000')
    })
  })
})
