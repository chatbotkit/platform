import { useEffect, useState } from 'react'

import { getColor, getPalette } from 'colorthief'

interface UseImageColorPaletteResult {
  error: Error | Event | null
  color: string | null
  palette: string[] | null
  colorPalette: string[] | null
}

export default function useImageColorPalette(
  url: string | null | undefined
): UseImageColorPaletteResult {
  const [error, setError] = useState<Error | Event | null>(null)
  const [color, setColor] = useState<string | null>(null)
  const [palette, setPalette] = useState<string[] | null>(null)
  const [colorPalette, setColorPalette] = useState<string[] | null>(null)

  useEffect(() => {
    let cancelled = false

    const img = new Image()

    img.src = url || ''
    img.crossOrigin = 'Anonymous'

    img.onload = async () => {
      try {
        setError(null)

        const [dominant, swatches] = await Promise.all([
          getColor(img),
          getPalette(img, { colorCount: 8 }),
        ])

        if (cancelled) {
          return
        }

        const color = dominant ? dominant.hex() : null

        setColor(color)

        const palette = (swatches || []).map((swatch) => swatch.hex())

        setPalette(palette)

        const colorPalette = Array.from(
          new Set([...(color ? [color] : []), ...palette])
        )

        setColorPalette(colorPalette)
      } catch (e) {
        if (!cancelled) {
          setError(e as Error)
        }
      }
    }

    img.onerror = (e) => {
      setError(e)
    }

    return () => {
      cancelled = true

      img.onload = null
    }
  }, [url])

  return { error, color, palette, colorPalette }
}
