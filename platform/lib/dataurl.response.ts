import { buf2b64d } from '@chatbotkit-dev/buffer'

/**
 * Converts a Response object to a data URL
 */
export async function responseToDataUrl(response: Response): Promise<string> {
  const contentType =
    response.headers.get('content-type') || 'application/octet-stream'

  const bytes = new Uint8Array(await response.arrayBuffer())

  return `data:${contentType};base64,${buf2b64d(bytes)}`
}
