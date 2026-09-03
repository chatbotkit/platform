import { encodeUint8Array } from '@/lib/b64'

/**
 * Converts a Blob to a data URL string
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const contentType = blob.type || 'application/octet-stream'

  return `data:${contentType};base64,${encodeUint8Array(
    new Uint8Array(await blob.arrayBuffer())
  )}`
}
