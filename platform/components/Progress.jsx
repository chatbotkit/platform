'use client'

import { useEffect, useState } from 'react'

import { AppProgressBar, PagesProgressBar } from 'next-nprogress-bar'

import useIsAppRouter from '@/hooks/useIsAppRouter'
import useTheme from '@/hooks/useTheme'

export default function Progress() {
  const { theme, forceTheme } = useTheme()

  // @note the reason we use useEffect instead of useMemo is not to trip the
  // hydration warnings

  const [color, setColor] = useState('#6366f1')

  useEffect(() => {
    switch (forceTheme ?? theme) {
      case 'dark': {
        setColor('#818cf8')

        break
      }

      case 'light': {
        setColor('#6366f1')

        break
      }

      default: {
        setColor('#6366f1')

        break
      }
    }
  }, [theme, forceTheme])

  const isAppRouter = useIsAppRouter()

  return isAppRouter ? (
    <AppProgressBar
      key={color}
      delay={200}
      color={color}
      height="2px"
      options={{ showSpinner: false }}
      shallowRouting
    />
  ) : (
    <PagesProgressBar
      key={color}
      delay={200}
      color={color}
      height="2px"
      options={{ showSpinner: false }}
      shallowRouting
    />
  )
}
