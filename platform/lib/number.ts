export function toNumber(
  value: bigint | number | null | undefined | { toNumber?: () => number }
): number {
  if (value == null) {
    return 0
  }

  if (
    value &&
    typeof value === 'object' &&
    'toNumber' in value &&
    typeof value.toNumber === 'function'
  ) {
    return value.toNumber()
  }

  return typeof value === 'bigint' ? Number(value) : (value as number)
}

/**
 * Parses a `display` format token into `Intl.NumberFormat` options.
 *
 * The token syntax follows a minimal subset of the ICU number-skeleton style so
 * it can be extended in the future (e.g. `compact-short`, `unit/kilometer`)
 * without changing the field shape:
 *
 * - `number` (or empty/undefined) → plain grouped number
 * - `percent` → percentage (note: Intl expects fractions, so `0.45` → `45%`)
 * - `currency/USD` → currency using the ISO 4217 code after the slash
 *
 * Unknown or malformed tokens fall back to plain number formatting so a schema
 * typo never breaks rendering.
 */
export function parseDisplayFormat(display?: string): Intl.NumberFormatOptions {
  if (!display || typeof display !== 'string') {
    return {}
  }

  const token = display.trim()

  if (token === '' || token === 'number') {
    return {}
  }

  if (token === 'percent') {
    return { style: 'percent' }
  }

  const currencyMatch = /^currency\/([A-Za-z]{3})$/.exec(token)

  if (currencyMatch) {
    return { style: 'currency', currency: currencyMatch[1].toUpperCase() }
  }

  return {}
}

/**
 * Builds a number formatter from a `display` format token. See
 * {@link parseDisplayFormat} for the supported tokens.
 */
export function getDisplayFormatter(
  display?: string
): (value: number) => string {
  const formatter = new Intl.NumberFormat('en-US', parseDisplayFormat(display))

  return (value: number) => formatter.format(value)
}

export function shortFormat(metric: number, type?: string): string {
  const baseFormatter = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
  })

  if (type === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      compactDisplay: 'short',
    }).format(metric)
  } else {
    return baseFormatter.format(metric)
  }
}
