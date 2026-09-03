import { Jimp } from 'jimp'

/**
 * @note Default dimensions for image transformations
 * Values match the original bytescale transformation settings
 */

/**
 * @note Thumbnail: 400x400 square preview, quality 80
 */
export const THUMBNAIL_WIDTH = 400
export const THUMBNAIL_HEIGHT = 400
export const THUMBNAIL_QUALITY = 80

/**
 * @note Portrait: 450x720 portrait image, quality 80
 */
export const PORTRAIT_WIDTH = 450
export const PORTRAIT_HEIGHT = 720
export const PORTRAIT_QUALITY = 80

/**
 * @note Supported MIME types for image transformation
 */
export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/tiff',
] as const

export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number]

// @note output MIME types supported by jimp
export type OutputMimeType = 'image/jpeg' | 'image/png'

/**
 * Get the appropriate output MIME type for a given input content type
 * PNG/GIF preserve transparency, others convert to JPEG for compression
 */
export function getOutputMimeType(contentType: string): OutputMimeType {
  const lower = contentType.toLowerCase().split(';')[0].trim()

  // @note preserve PNG and GIF as PNG to maintain transparency

  if (lower === 'image/png' || lower === 'image/gif') {
    return 'image/png'
  }

  // @note convert JPEG, BMP, TIFF to JPEG for better compression

  return 'image/jpeg'
}

export interface ThumbnailOptions {
  contentType?: string
  width?: number
  height?: number
  quality?: number
}

export interface PortraitOptions {
  contentType?: string
  width?: number
  height?: number
  quality?: number
}

export interface ResizeOptions {
  contentType?: string
  width?: number
  height?: number
  fit?: 'contain' | 'cover'
  quality?: number
}

/**
 * Input types accepted by image transform functions
 */
export type ImageInput = ArrayBuffer | Uint8Array

/**
 * Normalize image input to ArrayBuffer for Jimp
 */
function normalizeImageInput(input: ImageInput): ArrayBuffer {
  if (input instanceof ArrayBuffer) {
    return input
  }

  // @note Uint8Array - get the underlying buffer, accounting for offset

  return (input.buffer as ArrayBuffer).slice(
    input.byteOffset,
    input.byteOffset + input.byteLength
  )
}

/**
 * Check if a content type is supported for image transformation
 */
export function isSupportedImageType(contentType: string): boolean {
  return SUPPORTED_IMAGE_TYPES.includes(
    contentType.toLowerCase() as SupportedImageType
  )
}

/**
 * Create a thumbnail from an image
 *
 * @param imageData - The source image data (ArrayBuffer or Uint8Array)
 * @param options - Options for the thumbnail
 * @returns The thumbnail buffer and its MIME type
 */
export async function createThumbnail(
  imageData: ImageInput,
  options: ThumbnailOptions = {}
): Promise<{ buffer: Buffer; mimeType: OutputMimeType }> {
  const {
    contentType = 'image/jpeg',
    width = THUMBNAIL_WIDTH,
    height = THUMBNAIL_HEIGHT,
    quality = THUMBNAIL_QUALITY,
  } = options

  const image = await Jimp.fromBuffer(normalizeImageInput(imageData))
  const outputMimeType = getOutputMimeType(contentType)

  // @note resize to cover the thumbnail dimensions, maintaining aspect ratio
  const aspectRatio = image.width / image.height
  const targetAspectRatio = width / height

  if (aspectRatio > targetAspectRatio) {
    // image is wider - resize by height, then crop width
    image.resize({ h: height })
  } else {
    // image is taller or same - resize by width, then crop height
    image.resize({ w: width })
  }

  // @note crop to center
  const cropX = Math.max(0, Math.floor((image.width - width) / 2))
  const cropY = Math.max(0, Math.floor((image.height - height) / 2))

  image.crop({
    x: cropX,
    y: cropY,
    w: Math.min(width, image.width),
    h: Math.min(height, image.height),
  })

  // @note output in the appropriate format based on input type
  const buffer =
    outputMimeType === 'image/png'
      ? await image.getBuffer('image/png')
      : await image.getBuffer('image/jpeg', { quality })

  return { buffer, mimeType: outputMimeType }
}

/**
 * Create a portrait image from an image
 *
 * @param imageData - The source image data (ArrayBuffer or Uint8Array)
 * @param options - Options for the portrait
 * @returns The portrait buffer and its MIME type
 */
export async function createPortrait(
  imageData: ImageInput,
  options: PortraitOptions = {}
): Promise<{ buffer: Buffer; mimeType: OutputMimeType }> {
  const {
    contentType = 'image/jpeg',
    width = PORTRAIT_WIDTH,
    height = PORTRAIT_HEIGHT,
    quality = PORTRAIT_QUALITY,
  } = options

  const image = await Jimp.fromBuffer(normalizeImageInput(imageData))
  const outputMimeType = getOutputMimeType(contentType)

  // @note resize to cover the portrait dimensions, maintaining aspect ratio
  const aspectRatio = image.width / image.height
  const targetAspectRatio = width / height

  if (aspectRatio > targetAspectRatio) {
    // image is wider - resize by height, then crop width
    image.resize({ h: height })
  } else {
    // image is taller or same - resize by width, then crop height
    image.resize({ w: width })
  }

  // @note crop to center
  const cropX = Math.max(0, Math.floor((image.width - width) / 2))
  const cropY = Math.max(0, Math.floor((image.height - height) / 2))

  image.crop({
    x: cropX,
    y: cropY,
    w: Math.min(width, image.width),
    h: Math.min(height, image.height),
  })

  // @note output in the appropriate format based on input type
  const buffer =
    outputMimeType === 'image/png'
      ? await image.getBuffer('image/png')
      : await image.getBuffer('image/jpeg', { quality })

  return { buffer, mimeType: outputMimeType }
}

/**
 * Create a resized image, preserving aspect ratio
 *
 * @param imageData - The source image data (ArrayBuffer or Uint8Array)
 * @param options - Options for the resize
 * @returns The resized image buffer and its MIME type
 */
export async function resizeImage(
  imageData: ImageInput,
  options: ResizeOptions
): Promise<{ buffer: Buffer; mimeType: OutputMimeType }> {
  const {
    contentType = 'image/jpeg',
    width,
    height,
    fit = 'contain',
    quality = 80,
  } = options

  const image = await Jimp.fromBuffer(normalizeImageInput(imageData))
  const outputMimeType = getOutputMimeType(contentType)

  if (fit === 'cover' && width && height) {
    // @note resize to cover the dimensions, then crop
    const aspectRatio = image.width / image.height
    const targetAspectRatio = width / height

    if (aspectRatio > targetAspectRatio) {
      // image is wider, resize by height
      image.resize({ h: height })
    } else {
      // image is taller, resize by width
      image.resize({ w: width })
    }

    // center crop
    const cropX = Math.max(0, Math.floor((image.width - width) / 2))
    const cropY = Math.max(0, Math.floor((image.height - height) / 2))

    image.crop({
      x: cropX,
      y: cropY,
      w: Math.min(width, image.width),
      h: Math.min(height, image.height),
    })
  } else if (width && height) {
    // contain - resize to fit within dimensions
    image.resize({ w: width, h: height })
  } else if (width) {
    image.resize({ w: width })
  } else if (height) {
    image.resize({ h: height })
  }

  const buffer =
    outputMimeType === 'image/png'
      ? await image.getBuffer('image/png')
      : await image.getBuffer('image/jpeg', { quality })

  return { buffer, mimeType: outputMimeType }
}
