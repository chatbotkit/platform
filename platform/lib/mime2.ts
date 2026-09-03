import mimeLib from 'mime'

export const mime = mimeLib

export default mime

const KNOWN_EXTENSION_TO_TYPE = {
  jsonl: 'application/jsonl',
}

// @note patterns the mime library does not recognise, mapped to MIME types
const TEXT_PLAIN_PATTERNS: RegExp[] = [
  // dotfiles: .env, .gitignore, .editorconfig, .npmrc, .nvmrc, etc.
  /^\./,
  // common extensionless config / metadata files
  /^(Makefile|Dockerfile|Procfile|Vagrantfile|Gemfile|Rakefile|Brewfile|LICENSE|CODEOWNERS|OWNERS)$/i,
]

// @note extensions the mime library misidentifies or does not cover
const TEXT_PLAIN_EXTENSIONS = new Set([
  // languages misidentified by the mime library
  'bat', // application/x-msdownload
  'dart', // application/vnd.dart
  'rs', // application/rls-services+xml (not Rust)
  'ts', // video/mp2t (not TypeScript)
  // languages the mime library does not cover
  'bash',
  'cfg',
  'clj',
  'cmd',
  'cs',
  'elm',
  'ex',
  'exs',
  'fish',
  'go',
  'gql',
  'gradle',
  'graphql',
  'groovy',
  'hcl',
  'hs',
  'kt',
  'nim',
  'properties',
  'proto',
  'ps1',
  'py',
  'r',
  'rb',
  'scala',
  'sol',
  'svelte',
  'swift',
  'tf',
  'tsx',
  'vue',
  'zig',
  'zsh',
])

/**
 * Guess type and extension by reconciling the two.
 */
export function reconcileTypeAndExt(
  type: string | null,
  ext: string | null
): {
  type: string | null
  ext: string | null
} {
  type = type?.trim() || null
  ext = ext?.trim().replace(/^\./, '')?.trim() || null

  if (type?.match(/octet-stream/) && ext) {
    type = mime.getType(ext)
  }

  if (ext?.match(/bin/) && type) {
    ext = mime.getExtension(type)
  }

  if (type && !ext) {
    ext = mime.getExtension(type)
  }

  if (ext && !type) {
    type = mime.getType(ext)
  }

  return { type, ext }
}

/**
 * Convert file extension to MIME type.
 */
export function extensionToType(ext: string): string {
  const normalized = ext.replace(/^\./, '').toLowerCase()

  if (normalized in KNOWN_EXTENSION_TO_TYPE) {
    return KNOWN_EXTENSION_TO_TYPE[normalized]
  }

  if (TEXT_PLAIN_EXTENSIONS.has(normalized)) {
    return 'text/plain'
  }

  return mime.getType(normalized) || 'application/octet-stream'
}

/**
 * Get MIME type from file name.
 *
 * Uses the mime library first, then falls back to pattern matching for
 * dotfiles and extensionless config files that the library does not cover.
 */
export function nameToType(name: string): string {
  const base = name.split('/').pop() || name

  const dot = base.lastIndexOf('.')

  if (dot > 0) {
    return extensionToType(base.slice(dot + 1))
  }

  const libResult = mime.getType(base)

  if (libResult) {
    return libResult
  }

  for (const pattern of TEXT_PLAIN_PATTERNS) {
    if (pattern.test(base)) {
      return 'text/plain'
    }
  }

  return 'application/octet-stream'
}
