import { useEffect, useState } from 'react'

import { rgbToHex } from '@/lib/color'

import ColorThief from 'colorthief'

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
    const colorThief = new ColorThief()

    const img = new Image()

    img.src = url || ''
    img.crossOrigin = 'Anonymous'

    img.onload = () => {
      try {
        setError(null)

        const color = rgbToHex(colorThief.getColor(img))

        setColor(color)

        const palette = colorThief
          .getPalette(img, 8)
          .map((color) => rgbToHex(color))

        setPalette(palette)

        const colorPalette = Array.from(new Set([color, ...palette]))

        setColorPalette(colorPalette)
      } catch (e) {
        setError(e as Error)
      }
    }

    img.onerror = (e) => {
      setError(e)
    }

    return () => {
      img.onload = null
    }
  }, [url])

  return { error, color, palette, colorPalette }
}
