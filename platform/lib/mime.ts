import { getSupportedContentTypes } from '@chatbotkit-dev/file/support'

import { getRandomId } from '@/lib/string'

import mimeTypes from 'mime-types'

export const mime = mimeTypes

/**
 * This type is used to ensure that the given string does not start with a dot.
 */
type NoDotPrefix = string

/**
 * A list of supported file types, derived from what the file module can
 * actually chunk - the implementation is the source of truth, not a parallel
 * hand-maintained list.
 */
const supportedFileTypes: string[] = [
  ...getSupportedContentTypes({ experimental: true }),

  // @note add others from the rest of the system here
]

/**
 * A mapping of known file extensions (without dot prefix) to their
 * corresponding MIME types.
 */
const knownExtensionToTypeMap: Record<NoDotPrefix, string> = {
  ...Object.fromEntries(
    supportedFileTypes
      .map((type) => {
        return [mime.extension(type), type]
      })
      // @note a type the mime database cannot name an extension for would
      // otherwise land under a literal "false" key
      .filter(([ext]) => !!ext)
  ),

  ...{
    mdx: 'text/markdown', // @note MDX files should be treated as markdown for chunking
    md: 'text/markdown', // @note md comes after mdx so it wins in reverse mapping (text/markdown -> md)
    txt: 'text/plain',
    html: 'text/html',

    csv: 'text/csv',
    json: 'application/json',
    jsonl: 'application/jsonl',

    pdf: 'application/pdf',

    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

    // @note legacy office formats keep their extension mappings even though
    // the chunker does not take them - uploads name them, conversions rename
    // them
    xls: 'application/vnd.ms-excel',
    ppt: 'application/vnd.ms-powerpoint',

    mp3: 'audio/mpeg',
    mp4: 'video/mp4',

    m4a: 'audio/mp4',
    mpeg: 'video/mpeg',
    mpga: 'audio/mpeg',

    wav: 'audio/wav',
  },
}

/**
 * A reverse mapping of MIME types to their corresponding file extensions.
 */
export const knownTypeToExtensionMap: Record<string, NoDotPrefix> =
  Object.fromEntries(
    Object.entries(knownExtensionToTypeMap).map(([ext, type]) => {
      return [type, ext]
    })
  )

/**
 * Generates an accept object mapping MIME types to their file extensions.
 *
 * @param exts - Array of file extensions to include. Defaults to all known extensions.
 * @returns An object mapping MIME types to arrays of file extensions (with dots).
 */
export function getAccept(
  exts: string[] = Object.keys(knownExtensionToTypeMap)
): Record<string, string[]> {
  const result: Record<string, string[]> = {}

  exts
    .map((ext) => ext.trim().toLowerCase())
    .filter((ext) => !!ext)
    .forEach((ext) => {
      const extWithDot = ext.startsWith('.') ? ext : `.${ext}`
      const extWithoutDot = ext.startsWith('.') ? ext.slice(1) : ext

      const mimeType =
        knownExtensionToTypeMap[extWithoutDot] || mime.lookup(extWithDot)

      if (!result[mimeType]) {
        result[mimeType] = []
      }

      result[mimeType].push(extWithDot)
    })

  return result
}

/**
 * Represents a file with a MIME type and optional name.
 */
interface File {
  type: string
  name?: string
}

/**
 * Checks if a file matches a given extension.
 *
 * @param file - The file object to check.
 * @param ext - The extension to match against (without dot prefix).
 * @returns True if the file matches the extension.
 */
export function isAnyFile(file: File, ext: NoDotPrefix): boolean {
  if (file.type === 'application/octet-stream') {
    return file.name?.endsWith('.' + ext) || false
  } else {
    return extensionToType(ext) === file.type
  }
}

/**
 * Checks if a file is a Markdown file.
 *
 * @param file - The file object to check.
 * @returns True if the file is a Markdown file.
 */
export function isMdFile(file: File): boolean {
  return isAnyFile(file, '.md')
}

/**
 * Checks if a file is an MDX file.
 *
 * @param file - The file object to check.
 * @returns True if the file is an MDX file.
 */
export function isMdxFile(file: File): boolean {
  return isAnyFile(file, 'mdx')
}

/**
 * Checks if a file is a plain text file.
 *
 * @param file - The file object to check.
 * @returns True if the file is a plain text file.
 */
export function isTxtFile(file: File): boolean {
  return isAnyFile(file, 'txt')
}

/**
 * Checks if a file is a CSV file.
 *
 * @param file - The file object to check.
 * @returns True if the file is a CSV file.
 */
export function isCsvFile(file: File): boolean {
  return isAnyFile(file, 'csv')
}

/**
 * Checks if a file is a JSON file.
 *
 * @param file - The file object to check.
 * @returns True if the file is a JSON file.
 */
export function isJsonFile(file: File): boolean {
  return isAnyFile(file, 'json')
}

/**
 * Checks if a file is a JSON Lines file.
 *
 * @param file - The file object to check.
 * @returns True if the file is a JSON Lines file.
 */
export function isJsonlFile(file: File): boolean {
  return isAnyFile(file, 'jsonl')
}

/**
 * Checks if a file is a YAML file.
 *
 * @param file - The file object to check.
 * @returns True if the file is a YAML file (.yaml or .yml).
 */
export function isYamlFile(file: File): boolean {
  return isAnyFile(file, 'yaml') || isAnyFile(file, 'yml')
}

/**
 * Checks if a file is a PDF file.
 *
 * @param file - The file object to check.
 * @returns True if the file is a PDF file.
 */
export function isPdfFile(file: File): boolean {
  return isAnyFile(file, 'pdf')
}

/**
 * Checks if a file is a Microsoft Word document (.docx).
 *
 * @param file - The file object to check.
 * @returns True if the file is a DOCX file.
 */
export function isDocxFile(file: File): boolean {
  return isAnyFile(file, 'docx')
}

/**
 * Checks if a file is a Microsoft Excel spreadsheet (.xlsx).
 *
 * @param file - The file object to check.
 * @returns True if the file is an XLSX file.
 */
export function isXlsxFile(file: File): boolean {
  return isAnyFile(file, 'xlsx')
}

/**
 * Checks if a file is a Microsoft PowerPoint presentation (.pptx).
 *
 * @param file - The file object to check.
 * @returns True if the file is a PPTX file.
 */
export function isPptxFile(file: File): boolean {
  return isAnyFile(file, 'pptx')
}

/**
 * Checks if a file is an HTML file.
 *
 * @param file - The file object to check.
 * @returns True if the file is an HTML file.
 */
export function isHtmlFile(file: File): boolean {
  return isAnyFile(file, 'html')
}

/**
 * Checks if a file is a text-based file (any MIME type containing "text").
 *
 * @param file - The file object to check.
 * @returns True if the file has a text-based MIME type.
 */
export function isTextFile(file: File): boolean {
  return /text/.test(file.type)
}

/**
 * Checks if a file is an audio file.
 *
 * @param file - The file object to check.
 * @returns True if the file has an audio MIME type.
 */
export function isAudioFile(file: File): boolean {
  return /audio/.test(file.type)
}

/**
 * Checks if a file is a video file.
 *
 * @param file - The file object to check.
 * @returns True if the file has a video MIME type.
 */
export function isVideoFile(file: File): boolean {
  return /video/.test(file.type)
}

/**
 * Converts a file extension to its corresponding MIME type.
 *
 * @param ext - The file extension (without dot prefix).
 * @returns The MIME type, or 'application/octet-stream' if unknown.
 */
export function extensionToType(ext: NoDotPrefix): string {
  return (
    knownExtensionToTypeMap[ext] ||
    mime.lookup(ext) ||
    'application/octet-stream'
  )
}

/**
 * Extracts the MIME type from a filename based on its extension.
 *
 * @param name - The filename to extract the type from.
 * @returns The MIME type corresponding to the file's extension.
 */
export function nameToType(name: string): string {
  return extensionToType(name.split('.').pop() || '') // @todo implement better logic
}

/**
 * Converts a MIME type to its corresponding file extension.
 *
 * @param type - The MIME type to convert.
 * @returns The file extension (without dot), or 'bin' if unknown.
 */
export function typeToExtension(type: string): NoDotPrefix {
  return knownTypeToExtensionMap[type] || mime.extension(type) || 'bin'
}

/**
 * Generates a filename with the appropriate extension for a given MIME type.
 *
 * @param type - The MIME type. Defaults to 'application/octet-stream'.
 * @param name - The base filename. Defaults to a random ID.
 * @returns A complete filename with extension.
 */
export function typeToFileName(
  type?: string | null,
  name?: string | null
): string {
  type = type || 'application/octet-stream'
  name = name || getRandomId('file-')

  return `${name}.${typeToExtension(type)}`
}

export default mime
