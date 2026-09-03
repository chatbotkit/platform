/**
 * Model pricing calculation utilities.
 *
 * This module provides functions to calculate pricing ratios for model configurations
 * based on input and output token prices per million tokens.
 *
 * Base prices (per million tokens):
 * - Input: $14.00
 * - Output: $18.00
 */

export const BASE_INPUT_PRICE_PER_MILLION = 14
export const BASE_OUTPUT_PRICE_PER_MILLION = 18

export interface ModelPricingInput {
  inputPrice: number
  outputPrice: number
}

export interface ModelPricingRatios {
  inputTokenRatio: number
  outputTokenRatio: number
  tokenRatio: number
}

/**
 * Sanitizes a price string by removing currency symbols and commas.
 *
 * @example
 * sanitizePriceString('$75.00') // '75.00'
 * sanitizePriceString('1,234.56') // '1234.56'
 */
export function sanitizePriceString(price: string): string {
  return price.replace(/[$,]/g, '')
}

/**
 * Parses a price string into a number, handling currency symbols and commas.
 *
 * @throws {Error} if the price string is invalid, non-finite, or negative
 */
export function parsePriceString(price: string): number {
  const sanitized = sanitizePriceString(price)
  const parsed = parseFloat(sanitized)

  if (isNaN(parsed)) {
    throw new Error(`Invalid price: "${price}"`)
  }

  if (!isFinite(parsed)) {
    throw new Error(`Price must be a finite number: "${price}"`)
  }

  if (parsed < 0) {
    throw new Error(`Price cannot be negative: "${price}"`)
  }

  return parsed
}

/**
 * Calculates model pricing ratios from input and output token prices.
 *
 * Formulas:
 * - inputTokenRatio = inputPrice / BASE_INPUT_PRICE_PER_MILLION
 * - outputTokenRatio = outputPrice / BASE_OUTPUT_PRICE_PER_MILLION
 * - tokenRatio = outputTokenRatio (uses output as primary ratio)
 *
 * @throws {Error} if input or output price is not a finite non-negative number
 *
 * @example
 * // gpt-5.2: Input $1.75, Output $14.00
 * calculateModelPricingRatios({ inputPrice: 1.75, outputPrice: 14 })
 * // { inputTokenRatio: 0.125, outputTokenRatio: 0.7778, tokenRatio: 0.7778 }
 */
export function calculateModelPricingRatios(
  input: ModelPricingInput
): ModelPricingRatios {
  const { inputPrice, outputPrice } = input

  if (!isFinite(inputPrice) || isNaN(inputPrice)) {
    throw new Error(`Input price must be a finite number: ${inputPrice}`)
  }

  if (!isFinite(outputPrice) || isNaN(outputPrice)) {
    throw new Error(`Output price must be a finite number: ${outputPrice}`)
  }

  if (inputPrice < 0) {
    throw new Error(`Input price cannot be negative: ${inputPrice}`)
  }

  if (outputPrice < 0) {
    throw new Error(`Output price cannot be negative: ${outputPrice}`)
  }

  // @note round to 4 decimal places to match existing model config precision
  const inputTokenRatio =
    Math.round((inputPrice / BASE_INPUT_PRICE_PER_MILLION) * 10000) / 10000
  const outputTokenRatio =
    Math.round((outputPrice / BASE_OUTPUT_PRICE_PER_MILLION) * 10000) / 10000

  // @note tokenRatio uses the output ratio as the primary ratio
  const tokenRatio = outputTokenRatio

  return {
    inputTokenRatio,
    outputTokenRatio,
    tokenRatio,
  }
}

/**
 * Formats pricing ratios as a model config pricing block string.
 */
export function formatPricingBlock(ratios: ModelPricingRatios): string {
  return `pricing: {
  tokenRatio: ${ratios.tokenRatio},
  inputTokenRatio: ${ratios.inputTokenRatio},
  outputTokenRatio: ${ratios.outputTokenRatio},
},`
}
