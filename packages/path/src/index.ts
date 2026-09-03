// @note bare path shorthands that are valid Unix paths without a slash
const BARE_PATH_RE = /^(\.|\.\.?|~)$/

/**
 * Detects whether a string looks like a Unix-style path with forward slashes.
 *
 * A value is considered a path when it:
 * - Contains at least one forward slash, OR is a bare shorthand (`.`, `..`, `~`)
 * - Is not a URL (no scheme like `https://`)
 * - Contains no null bytes
 *
 * @param value - The string to test
 * @returns `true` when the value resembles a Unix path
 */
export function isPath(value: string): boolean {
  if (!value) {
    return false
  }

  // null bytes are never valid in paths
  if (value.includes('\0')) {
    return false
  }

  // URLs are not paths (e.g. https://, http://, ftp://)
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value)) {
    return false
  }

  // bare unix shorthands: `.`, `..`, `~`
  if (BARE_PATH_RE.test(value)) {
    return true
  }

  // must have at least one forward slash
  if (!value.includes('/')) {
    return false
  }

  return true
}

/**
 * Joins multiple path segments into a single path, ensuring proper slashes.
 *
 * @param paths - The path segments to join
 * @returns The joined path
 */
export function join(...paths: (string | string[])[]): string {
  return paths
    .flatMap((p) => (Array.isArray(p) ? p : [p]))
    .filter((p) => !!p)
    .map((p) => p.trim().replace(/\/+$/, ''))
    .join('/')
    .replace(/\/+/g, '/')
}

/**
 * Extracts the file extension from a path, including the leading dot.
 *
 * @param filePath - The file path to extract the extension from
 * @returns The extension including the dot (e.g., ".txt"), or empty string if none
 */
export function extname(filePath: string): string {
  if (!filePath) {
    return ''
  }

  // get the last segment after the final slash to handle paths like "/path/to/file.txt"

  const basename = filePath.split('/').pop() || ''

  // handle dotfiles like ".gitignore" - these have no extension

  if (basename.startsWith('.') && basename.indexOf('.', 1) === -1) {
    return ''
  }

  const dotIndex = basename.lastIndexOf('.')

  // no dot found or dot is at the start (dotfile with no extension)

  if (dotIndex <= 0) {
    return ''
  }

  return basename.slice(dotIndex)
}

/**
 * Encodes a Unix-style path for use in a URL, encoding each segment individually
 * so that forward slashes remain as real path separators.
 *
 * @param path - The path to encode
 * @returns The URL-encoded path with slashes preserved
 */
export function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}
