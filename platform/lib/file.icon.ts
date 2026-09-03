import { extname } from '@/lib/path'

/**
 * Generated file icons: a document glyph with a gradient fill, folded corner
 * and an uppercase extension label. This module is the single source of the
 * palette, hashing and svg markup - components/FileIcon.jsx renders the same
 * design as JSX for React trees, while `buildFileIconSvg` produces the
 * standalone markup the file thumbnail/portrait API routes serve and the
 * `fileIconDataUri` helper inlines wherever an image `src` is required. There
 * are no static icon assets; every extension gets an icon automatically.
 */

/**
 * Color palette for file icons. Each color has a gradient (light to dark) and
 * a fold color for the corner.
 */
export const FILE_COLORS = [
  // Red (PDF)
  { gradient: ['#fc6c74', '#d03e4d'], fold: '#d03e4d' },
  // Teal (CSV)
  { gradient: ['#66efdd', '#28a394'], fold: '#9feae0' },
  // Yellow (MD)
  { gradient: ['#fbdc66', '#f2a40f'], fold: '#f2a30e' },
  // Gray (TXT)
  { gradient: ['#ffffff', '#839595'], fold: '#ffffff' },
  // Blue (DOCX)
  { gradient: ['#6394ed', '#164daf'], fold: '#88abeb' },
  // Purple (MP3)
  { gradient: ['#f7b9ff', '#c943db'], fold: '#f7b9ff' },
  // Orange (MP4)
  { gradient: ['#f5cfa8', '#e57d15'], fold: '#f5cfa8' },
  // Green
  { gradient: ['#98fb98', '#228b22'], fold: '#98fb98' },
  // Pink
  { gradient: ['#ffb6c1', '#db7093'], fold: '#ffb6c1' },
  // Indigo
  { gradient: ['#9370db', '#4b0082'], fold: '#9370db' },
]

/**
 * Generates a deterministic hash from a string to pick a consistent color.
 */
export function hashString(str: string): number {
  let hash = 0

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)

    hash = (hash << 5) - hash + char
    hash = hash & hash
  }

  return Math.abs(hash)
}

/**
 * Gets a color scheme based on the file extension (dotted, e.g. ".pdf").
 */
export function getColorForExtension(ext: string) {
  const index = hashString(ext) % FILE_COLORS.length

  return FILE_COLORS[index]
}

// @note the well-known content types whose subtype does not read as a file
// extension; anything else falls back to the subtype itself when it is short
// enough to work as a label
const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'text/plain': 'txt',
  'text/markdown': 'md',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'pptx',
}

/**
 * Derives the dotted extension for the icon from the file name, falling back
 * to the content type. Returns an empty string when neither yields one.
 */
export function getFileIconExtension(
  name?: string | null,
  contentType?: string | null
): string {
  const ext = name ? extname(name) : ''

  if (ext) {
    return ext
  }

  if (contentType) {
    const mapped = CONTENT_TYPE_EXTENSIONS[contentType]

    if (mapped) {
      return `.${mapped}`
    }

    const subtype = contentType.split('/')[1]

    if (subtype && /^[a-z0-9-]{1,5}$/i.test(subtype)) {
      return `.${subtype}`
    }
  }

  return ''
}

/**
 * The label font size, stepped down for longer extensions.
 */
export function getFileIconFontSize(label: string): number {
  return label.length > 4 ? 11 : label.length > 3 ? 13 : 16
}

/**
 * Builds the standalone svg markup for a file icon. Mirrors the JSX in
 * components/FileIcon.jsx - keep the two in step.
 */
export function buildFileIconSvg(
  name?: string | null,
  { contentType }: { contentType?: string | null } = {}
): string {
  const ext = getFileIconExtension(name, contentType)
  // @note the name is user-controlled, so the label must be xml-safe
  const label = (ext ? ext.slice(1).toUpperCase() : '?').replace(
    /[<>&'"]/g,
    ''
  )
  const colors = getColorForExtension(ext || 'unknown')

  const gradientId = `file-gradient-${hashString(name || 'default')}`

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 76.536 85.612">',
    '<defs>',
    `<linearGradient id="${gradientId}" x2="0.923" y2="0.966" gradientUnits="objectBoundingBox">`,
    `<stop offset="0" stop-color="${colors.gradient[0]}"/>`,
    `<stop offset="1" stop-color="${colors.gradient[1]}"/>`,
    '</linearGradient>',
    '</defs>',
    `<path d="M6,0H45.3L73,28.366V76a6,6,0,0,1-6,6H6a6,6,0,0,1-6-6V6A6,6,0,0,1,6,0Z" fill="url(#${gradientId})"/>`,
    `<path d="M23.319,2.309a3,3,0,0,1,4.362,0L46.221,21.94A3,3,0,0,1,44.04,27H6.96a3,3,0,0,1-2.181-5.06Z" transform="translate(57.444 51.542) rotate(-135)" fill="${colors.fold}"/>`,
    `<text x="36.5" y="58" text-anchor="middle" fill="#ffffff" font-size="${getFileIconFontSize(label)}" font-family="Arial, sans-serif" font-weight="bold">${label}</text>`,
    '</svg>',
  ].join('')
}

/**
 * The icon as a data uri, for contexts that require an image `src`.
 */
export function fileIconDataUri(
  name?: string | null,
  options: { contentType?: string | null } = {}
): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    buildFileIconSvg(name, options)
  )}`
}
