import { useEffect, useState } from 'react'

declare global {
  // eslint-disable-next-line no-var
  var __incrementalCache:
    | {
        requestHeaders: {
          cookie: string
        }
      }
    | undefined
}

function findCookie(name: string, cookie: string): string | null {
  const value = cookie.split('; ').find((row) => row.startsWith(`${name}=`))

  if (value) {
    return value.split('=')[1] || null
  } else {
    return null
  }
}

function tryGetInitialCookie(name: string): string | null {
  try {
    return findCookie(name, global.__incrementalCache!.requestHeaders.cookie)
  } catch {
    return null
  }
}

/**
 * This is a hacky solution to get a cookie no matter if the component is on the
 * server or the client.
 */
export default function useCookie(name: string): string | null {
  const [cookie, setCookie] = useState<string | null>(tryGetInitialCookie(name))

  useEffect(() => {
    let documentCookie: string | null

    try {
      documentCookie = document.cookie
    } catch {
      documentCookie = null
    }

    if (!documentCookie) {
      return
    }

    const newCookie = findCookie(name, documentCookie)

    if (newCookie && newCookie !== cookie) {
      setCookie(newCookie)
    }
  }, [name, cookie])

  return cookie
}
