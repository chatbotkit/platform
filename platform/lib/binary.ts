import { getEncoding } from '@chatbotkit-dev/encoding'

/**
 * Detects whether a buffer contains text (UTF-8 encoded) content.
 *
 * Uses encoding detection via `getEncoding` to analyze the first 24 bytes
 * of the buffer and determine if it appears to be valid UTF-8 text.
 *
 * @note Empty buffers (length 0) are considered text, returning `true`.
 *       This is important for handling newly created or cleared files.
 *
 * @note Only the first 24 bytes are analyzed (`chunkLength: 24`), so very
 *       short text files followed by binary data may be misclassified.
 *
 * @note Buffers containing null bytes (0x00) mixed with text will be
 *       detected as binary, not text.
 *
 * @param buffer - The buffer to analyze, either as Uint8Array or ArrayBuffer
 * @returns `true` if the buffer appears to contain UTF-8 text, `false` otherwise
 *
 * @example
 * ```ts
 * isText(new TextEncoder().encode('Hello'))  // true
 * isText(new Uint8Array([0xff, 0xfe]))       // false (binary)
 * isText(new Uint8Array([]))                  // true (empty = text)
 * ```
 */
export function isText(buffer: Uint8Array | ArrayBuffer): boolean {
  if (buffer instanceof ArrayBuffer) {
    buffer = new Uint8Array(buffer)
  }

  return (
    getEncoding(buffer, {
      chunkLength: 24,
      chunkBegin: 0,
    }) === 'utf8'
  )
}

/**
 * Detects whether a buffer contains binary (non-text) content.
 *
 * This is the inverse of `isText()` - returns `true` when `isText()` returns
 * `false`, and vice versa.
 *
 * @note Empty buffers (length 0) are NOT considered binary (returns `false`).
 *
 * @note Common binary file signatures (JPEG, PNG, etc.) will be correctly
 *       detected as binary.
 *
 * @param buffer - The buffer to analyze, either as Uint8Array or ArrayBuffer
 * @returns `true` if the buffer appears to contain binary data, `false` otherwise
 *
 * @example
 * ```ts
 * isBinary(new Uint8Array([0xff, 0xd8, 0xff])) // true (JPEG signature)
 * isBinary(new TextEncoder().encode('Hello'))   // false (text)
 * isBinary(new Uint8Array([]))                  // false (empty = not binary)
 * ```
 */
export function isBinary(buffer: Uint8Array | ArrayBuffer): boolean {
  return !isText(buffer)
}
