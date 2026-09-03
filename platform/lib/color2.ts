import chroma from 'chroma-js'

/**
 * Generates a gradient of colors with varying hue and brightness
 */
export function hueAndBrightnessGradient(color: string, n: number): string[] {
  return chroma
    .scale([color, chroma(color).set('hsl.h', '*2').brighten(2)])
    .mode('lab')
    .colors(n)
}

/**
 * Generates a gradient of colors with varying brightness
 */
export function scaleSingleColor(color: string, n: number): string[] {
  return chroma
    .scale([color, chroma(color).brighten(2)])
    .mode('lab')
    .colors(n)
}

/**
 * Returns black or white based on the luminance of the input color
 */
export function blackOrWhite(color: string): '#000000' | '#ffffff' {
  const luminance = chroma(color).luminance()

  return luminance > 0.5 ? '#000000' : '#ffffff'
}

/**
 * Returns true when `color` is an opaque, parseable color.
 *
 * Colors that are `transparent`, use `rgba()`/`#RRGGBBAA` with alpha below 1,
 * or that cannot be parsed at all (gradients, `inherit`, `currentColor`, CSS
 * vars) are treated as "not an opaque surface we can reason about" and return
 * false.
 */
export function isOpaqueColor(color?: string): boolean {
  if (!color) {
    return false
  }

  try {
    return chroma(color).alpha() === 1
  } catch {
    return false
  }
}

/**
 * The WCAG contrast ratio (1..21) between two colors, or null when either color
 * cannot be parsed (e.g. gradients, `inherit`, or CSS vars).
 */
export function contrastRatio(a: string, b: string): number | null {
  try {
    return chroma.contrast(a, b)
  } catch {
    return null
  }
}

/**
 * Returns a text color that is guaranteed to be legible against `bg`.
 *
 * When `desired` is provided and already clears `minRatio` (and is not mostly
 * transparent), it is returned unchanged so brand/theme customization is
 * preserved. Otherwise black or white - whichever contrasts more with `bg` - is
 * returned so the text can never blend into the background.
 *
 * Returns null when `bg` is not an opaque color we can reason about
 * (transparent / gradient / rgba over an unknown surface), so the caller can
 * fall back to a self-contained, opaque style instead of trusting the surface.
 */
export function legibleTextColor(
  bg?: string,
  desired?: string,
  minRatio = 4.5
): string | null {
  if (!isOpaqueColor(bg)) {
    return null
  }

  const surface = bg as string

  if (desired) {
    try {
      // @note chroma.contrast ignores alpha, so a near-transparent text could
      // report a high ratio while being effectively invisible - require it to
      // be mostly opaque before we trust it.
      if (
        chroma(desired).alpha() >= 0.5 &&
        chroma.contrast(surface, desired) >= minRatio
      ) {
        return desired
      }
    } catch {
      // @note desired is unparseable (e.g. `inherit`) - fall through to a
      // computed color.
    }
  }

  return blackOrWhite(surface)
}
