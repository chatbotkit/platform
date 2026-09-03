import { useEffect, useState } from 'react'

function getInitialMatch(query: string, defaultValue: boolean): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return defaultValue
  }

  return window.matchMedia(query).matches
}

export default function useMediaQuery(
  query: string,
  defaultValue: boolean = false
): boolean {
  const [matches, setMatches] = useState(() =>
    getInitialMatch(query, defaultValue)
  )

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      setMatches(defaultValue)

      return undefined
    }

    const mediaQueryList = window.matchMedia(query)

    const handleChange = (): void => {
      setMatches(mediaQueryList.matches)
    }

    handleChange()

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handleChange)

      return () => {
        mediaQueryList.removeEventListener('change', handleChange)
      }
    }

    window.addEventListener('resize', handleChange)

    return () => {
      window.removeEventListener('resize', handleChange)
    }
  }, [query, defaultValue])

  return matches
}
