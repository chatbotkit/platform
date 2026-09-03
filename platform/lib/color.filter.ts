import { hexToCSSFilter } from 'hex-to-css-filter'

/**
 * Converts a hex color to a CSS filter string
 */
export function getColorFilter(color: string): string {
  return hexToCSSFilter(color).filter.replace(/;$/, '')
}
