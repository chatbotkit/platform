import fetch from '@/lib/egress.fetch'

/**
 * The function fetches the content type of the given URL. It handles special
 * cases such as redirects as well as when dealing with services that do not
 * support the HEAD method - i.e. AWS S3.
 */
export async function getUrlContentType(url: string): Promise<string | null> {
  // first we try to get the content type using the HEAD method
  {
    const response = await fetch(url, {
      method: 'HEAD',
    })

    if (response.ok) {
      return response.headers.get('Content-Type') || null
    }
  }

  // if the HEAD method fails, we try to get the content type using the GET
  // method with a range of 0-0 bytes
  {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Range: 'bytes=0-0',
      },
    })

    if (response.ok) {
      return response.headers.get('Content-Type') || null
    }
  }

  // if both methods fail, we return null

  return null
}
