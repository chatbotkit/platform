/* eslint-disable custom-eslint-rules/no-global-fetch -- browser-only module: runs in the page, downloads via the user's own browser session */
import { nameToType, typeToFileName } from '@/lib/mime'
import { tryFilename } from '@/lib/url'

/**
 * Checks if a URL is same-origin (download attribute works reliably).
 */
function isSameOrigin(url: string): boolean {
  try {
    const urlObj = new URL(url, window.location.href)

    return urlObj.origin === window.location.origin
  } catch {
    // @note relative URLs are same-origin
    return true
  }
}

/**
 * Internal function to trigger download via anchor element.
 * Only works reliably for same-origin URLs (including blob: URLs).
 */
function triggerDownload(url: string, name: string): void {
  const link = document.createElement('a')

  link.href = url
  link.download = name

  if (!link.download) {
    // @note no filename - open in new tab to prevent current page navigation
    window.open(url, '_blank', 'noopener,noreferrer')

    return
  }

  link.click()
}

/**
 * Triggers a download of a file from a given URL.
 *
 * This function creates a temporary anchor element and programmatically clicks
 * it to initiate a download. For cross-origin URLs, it fetches the content
 * first and downloads as a blob to prevent page navigation.
 *
 * @param url - The URL of the file to download
 * @param options - Configuration options for the download
 * @param options.name - The name to use for the downloaded file. If not provided, attempts to extract the filename from the URL.
 *
 * @note Cross-origin URLs are fetched and converted to blobs to ensure
 *       download works without redirecting the user away from the page.
 *
 * @example
 * ```ts
 * saveUrl('https://example.com/file.pdf')
 * saveUrl('https://example.com/file.pdf', { name: 'my-document.pdf' })
 * ```
 */
export async function saveUrl(
  url: string,
  { name }: { name?: string } = {}
): Promise<void> {
  const downloadName = name || tryFilename(url) || ''

  // @note cross-origin URLs don't respect the download attribute and will
  // navigate the page instead - fetch as blob to ensure proper download

  if (!isSameOrigin(url)) {
    try {
      // eslint-disable-next-line no-restricted-globals
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`)
      }

      const blob = await response.blob()

      saveBlob(blob, { name: downloadName })

      return
    } catch {
      // @note fallback to opening in new tab if fetch fails (e.g., CORS)
      window.open(url, '_blank', 'noopener,noreferrer')

      return
    }
  }

  triggerDownload(url, downloadName)
}

/**
 * Triggers a download of a Blob object.
 *
 * This function creates a temporary object URL for the blob, initiates the
 * download, and then revokes the URL after a short delay to free up memory.
 * The delay ensures the download has started before the URL is invalidated.
 *
 * @param blob - The Blob object to download
 * @param options - Configuration options for the download
 * @param options.name - The name to use for the downloaded file. If not provided, uses the File's name if the blob is a File, otherwise uses a name based on the blob's MIME type.
 *
 * @example
 * ```ts
 * const blob = new Blob(['Hello, World!'], { type: 'text/plain' })
 * saveBlob(blob, { name: 'hello.txt' })
 * ```
 */
export function saveBlob(blob: Blob, { name }: { name?: string } = {}) {
  const url = URL.createObjectURL(blob)

  if (name) {
    if (!/[^/\\]+\.[^./\\]+$/.test(name)) {
      name += '.' + typeToFileName(blob.type)
    }
  } else {
    if (blob instanceof File && blob.name) {
      name = blob.name
    } else {
      name = typeToFileName(blob.type)
    }
  }

  // @note blob URLs are always same-origin, so triggerDownload works reliably

  triggerDownload(url, name)

  // @note revoke URL after a delay to ensure download has started

  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 100)
}

/**
 * Triggers a download of raw data as a file.
 *
 * This function wraps the data in a Blob with the appropriate MIME type
 * (either specified or inferred from the filename) and initiates the download.
 *
 * @param data - The data to download (string, ArrayBuffer, etc.)
 * @param options - Configuration options for the download
 * @param options.name - The name to use for the downloaded file. Used to infer the MIME type if type is not provided.
 * @param options.type - The MIME type of the data. If not provided, inferred from the filename.
 *
 * @example
 * ```ts
 * saveData('{"name": "John"}', { name: 'data.json', type: 'application/json' })
 * saveData('Hello, World!', { name: 'hello.txt' })
 * ```
 */
export function saveData(
  data: BlobPart,
  { name, type }: { name?: string; type?: string } = {}
) {
  const blob = new Blob([data], {
    type: type || nameToType(name || 'file'),
  })

  saveBlob(blob, { name })
}
