import { useEffect, useState } from 'react'

import useTheme from '@/hooks/useTheme'

export default function ThemeColor() {
  const { forcedTheme, theme } = useTheme()

  const [color, setColor] = useState(null)

  useEffect(() => {
    const t = forcedTheme || theme

    switch (t) {
      case 'light': {
        setColor('#ffffff')

        break
      }

      case 'dark': {
        setColor('#000000')

        break
      }
    }
  }, [forcedTheme, theme])

  return color ? <meta name="theme-color" content={color} /> : null
}
