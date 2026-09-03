import { b64d2buf, str2buf } from '@chatbotkit-dev/buffer'

export function isDataURL(dataURL: string | null | undefined): boolean {
  return (
    typeof dataURL === 'string' &&
    dataURL.startsWith('data:') &&
    dataURL.indexOf(',') > 5
  )
}

interface ParsedDataURL {
  data: Uint8Array
  type: string
}

export function parseDataURL(dataURL: string): ParsedDataURL {
  if (!dataURL.startsWith('data:')) {
    throw new Error('Invalid data URL')
  }

  const separatorIndex = dataURL.indexOf(',')

  if (separatorIndex === -1 || separatorIndex === dataURL.length - 1) {
    throw new Error('Invalid data URL')
  }

  const metadata = dataURL.slice(5, separatorIndex)
  const extractedData = dataURL.slice(separatorIndex + 1)

  const metadataParts = metadata.split(';')
  const extractedType = metadataParts[0]

  const isBase64 = metadataParts.includes('base64')

  let decodedData: Uint8Array

  if (isBase64) {
    decodedData = b64d2buf(extractedData)
  } else {
    decodedData = str2buf(decodeURIComponent(extractedData))
  }

  return { data: decodedData, type: extractedType }
}

export function dataURLToBlob(dataURL: string): Blob {
  const { data, type } = parseDataURL(dataURL)

  return new Blob([data.buffer as ArrayBuffer], { type })
}
