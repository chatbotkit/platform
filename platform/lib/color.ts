export type RGB = [number, number, number]

/**
 * Parses a hex or rgb color to a set of 3 integers.
 */
export function parseColor(color: string): RGB {
  if (color.startsWith('#')) {
    return hexToRgb(color)
  }

  const match = color.match(/\d+/g)

  if (match) {
    const colors = match.map(Number)

    colors.push(0, 0, 0)

    return colors.slice(0, 3) as RGB
  }

  return [0, 0, 0]
}

/**
 * Converts a set of 3 integers to a hex color string.
 */
export function rgbToHex(color: RGB): string {
  const [r, g, b] = color

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

/**
 * Converts a hex color string to a set of 3 integers.
 */
export function hexToRgb(hex: string): RGB {
  const bigint = parseInt(hex.replace('#', ''), 16)

  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255]
}

/**
 * Determines if a color is dark.
 */
export function isDarkColor(color: string): boolean {
  const [r, g, b] = parseColor(color)

  return r * 0.299 + g * 0.587 + b * 0.114 < 128
}
