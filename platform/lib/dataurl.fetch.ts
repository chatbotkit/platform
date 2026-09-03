import { blobToDataUrl } from '@/lib/dataurl.blob'
import fetch from '@/lib/egress.fetch'

export async function fetchDataUrl(url: string): Promise<string | null> {
  const response = await fetch(url)

  if (!response.ok) {
    return null
  }

  const blob = await response.blob()

  return blobToDataUrl(blob)
}
