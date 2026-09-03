import {
  BASE_INPUT_PRICE_PER_MILLION,
  BASE_OUTPUT_PRICE_PER_MILLION,
  calculateModelPricingRatios,
  formatPricingBlock,
  parsePriceString,
  sanitizePriceString,
} from '@/lib/model.pricing'

describe('model.pricing', () => {
  describe('constants', () => {
    it('should have correct base input price', () => {
      expect(BASE_INPUT_PRICE_PER_MILLION).toBe(14)
    })

    it('should have correct base output price', () => {
      expect(BASE_OUTPUT_PRICE_PER_MILLION).toBe(18)
    })
  })

  describe('sanitizePriceString', () => {
    it('should remove dollar sign', () => {
      expect(sanitizePriceString('$75.00')).toBe('75.00')
    })

    it('should remove commas', () => {
      expect(sanitizePriceString('1,234.56')).toBe('1234.56')
    })

    it('should remove both dollar sign and commas', () => {
      expect(sanitizePriceString('$1,234.56')).toBe('1234.56')
    })

    it('should handle plain numbers', () => {
      expect(sanitizePriceString('14.00')).toBe('14.00')
    })

    it('should handle empty string', () => {
      expect(sanitizePriceString('')).toBe('')
    })
  })

  describe('parsePriceString', () => {
    it('should parse plain number string', () => {
      expect(parsePriceString('14.00')).toBe(14)
    })

    it('should parse string with dollar sign', () => {
      expect(parsePriceString('$1.75')).toBe(1.75)
    })

    it('should parse string with commas', () => {
      expect(parsePriceString('1,234.56')).toBe(1234.56)
    })

    it('should parse string with dollar sign and commas', () => {
      expect(parsePriceString('$1,234.56')).toBe(1234.56)
    })

    it('should parse zero', () => {
      expect(parsePriceString('0')).toBe(0)
    })

    it('should throw error for invalid price', () => {
      expect(() => parsePriceString('abc')).toThrow('Invalid price: "abc"')
    })

    it('should throw error for empty string', () => {
      expect(() => parsePriceString('')).toThrow('Invalid price: ""')
    })

    it('should throw error for negative price', () => {
      expect(() => parsePriceString('-5.00')).toThrow(
        'Price cannot be negative: "-5.00"'
      )
    })

    it('should throw error for Infinity string', () => {
      expect(() => parsePriceString('Infinity')).toThrow(
        'Price must be a finite number: "Infinity"'
      )
    })

    it('should throw error for -Infinity string', () => {
      expect(() => parsePriceString('-Infinity')).toThrow(
        'Price must be a finite number: "-Infinity"'
      )
    })
  })

  describe('calculateModelPricingRatios', () => {
    it('should calculate correct ratios for gpt-5.2 example', () => {
      const result = calculateModelPricingRatios({
        inputPrice: 1.75,
        outputPrice: 14,
      })

      expect(result.inputTokenRatio).toBe(0.125)
      expect(result.outputTokenRatio).toBe(0.7778)
      expect(result.tokenRatio).toBe(0.7778)
    })

    it('should calculate correct ratios for gpt-5.1 example', () => {
      const result = calculateModelPricingRatios({
        inputPrice: 1.25,
        outputPrice: 10,
      })

      expect(result.inputTokenRatio).toBe(0.0893)
      expect(result.outputTokenRatio).toBe(0.5556)
      expect(result.tokenRatio).toBe(0.5556)
    })

    it('should calculate correct ratios for gpt-5-nano example', () => {
      const result = calculateModelPricingRatios({
        inputPrice: 0.05,
        outputPrice: 0.4,
      })

      expect(result.inputTokenRatio).toBe(0.0036)
      expect(result.outputTokenRatio).toBe(0.0222)
      expect(result.tokenRatio).toBe(0.0222)
    })

    it('should calculate correct ratios for minimax-m2.5 example', () => {
      const result = calculateModelPricingRatios({
        inputPrice: 0.3,
        outputPrice: 1.2,
      })

      expect(result.inputTokenRatio).toBe(0.0214)
      expect(result.outputTokenRatio).toBe(0.0667)
      expect(result.tokenRatio).toBe(0.0667)
    })

    it('should handle zero prices', () => {
      const result = calculateModelPricingRatios({
        inputPrice: 0,
        outputPrice: 0,
      })

      expect(result.inputTokenRatio).toBe(0)
      expect(result.outputTokenRatio).toBe(0)
      expect(result.tokenRatio).toBe(0)
    })

    it('should handle base prices (ratio of 1)', () => {
      const result = calculateModelPricingRatios({
        inputPrice: 14,
        outputPrice: 18,
      })

      expect(result.inputTokenRatio).toBe(1)
      expect(result.outputTokenRatio).toBe(1)
      expect(result.tokenRatio).toBe(1)
    })

    it('should handle prices above base (ratio > 1)', () => {
      const result = calculateModelPricingRatios({
        inputPrice: 28,
        outputPrice: 36,
      })

      expect(result.inputTokenRatio).toBe(2)
      expect(result.outputTokenRatio).toBe(2)
      expect(result.tokenRatio).toBe(2)
    })

    it('should throw error for negative input price', () => {
      expect(() =>
        calculateModelPricingRatios({
          inputPrice: -1,
          outputPrice: 10,
        })
      ).toThrow('Input price cannot be negative: -1')
    })

    it('should throw error for negative output price', () => {
      expect(() =>
        calculateModelPricingRatios({
          inputPrice: 1,
          outputPrice: -10,
        })
      ).toThrow('Output price cannot be negative: -10')
    })

    it('should throw error for NaN input price', () => {
      expect(() =>
        calculateModelPricingRatios({
          inputPrice: NaN,
          outputPrice: 10,
        })
      ).toThrow('Input price must be a finite number: NaN')
    })

    it('should throw error for NaN output price', () => {
      expect(() =>
        calculateModelPricingRatios({
          inputPrice: 1,
          outputPrice: NaN,
        })
      ).toThrow('Output price must be a finite number: NaN')
    })

    it('should throw error for Infinity input price', () => {
      expect(() =>
        calculateModelPricingRatios({
          inputPrice: Infinity,
          outputPrice: 10,
        })
      ).toThrow('Input price must be a finite number: Infinity')
    })

    it('should throw error for Infinity output price', () => {
      expect(() =>
        calculateModelPricingRatios({
          inputPrice: 1,
          outputPrice: Infinity,
        })
      ).toThrow('Output price must be a finite number: Infinity')
    })

    it('should use outputTokenRatio as tokenRatio', () => {
      const result = calculateModelPricingRatios({
        inputPrice: 7,
        outputPrice: 9,
      })

      expect(result.tokenRatio).toBe(result.outputTokenRatio)
    })
  })

  describe('formatPricingBlock', () => {
    it('should format pricing block correctly', () => {
      const result = formatPricingBlock({
        inputTokenRatio: 0.125,
        outputTokenRatio: 0.7778,
        tokenRatio: 0.7778,
      })

      expect(result).toBe(`pricing: {
  tokenRatio: 0.7778,
  inputTokenRatio: 0.125,
  outputTokenRatio: 0.7778,
},`)
    })

    it('should format pricing block with zero values', () => {
      const result = formatPricingBlock({
        inputTokenRatio: 0,
        outputTokenRatio: 0,
        tokenRatio: 0,
      })

      expect(result).toBe(`pricing: {
  tokenRatio: 0,
  inputTokenRatio: 0,
  outputTokenRatio: 0,
},`)
    })

    it('should format pricing block with integer values', () => {
      const result = formatPricingBlock({
        inputTokenRatio: 1,
        outputTokenRatio: 2,
        tokenRatio: 2,
      })

      expect(result).toBe(`pricing: {
  tokenRatio: 2,
  inputTokenRatio: 1,
  outputTokenRatio: 2,
},`)
    })
  })
})
