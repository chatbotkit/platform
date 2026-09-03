/**
 * Extracts the file extension from a path
 */
export function extname(path: string): string | null {
  const e = path
    .split('/')
    .pop()
    ?.match(/(\.[^.]+)$/)

  if (e) {
    return e[1]
  } else {
    return null
  }
}

/**
 * Safely extracts the file extension from a path, returning null on error
 */
export function tryExtname(path: string): string | null {
  try {
    return extname(path)
  } catch {
    return null
  }
}

/**
 * Joins a filename with an extension
 */
export function joinName(name: string, ext: string | null | undefined): string {
  if (ext) {
    if (ext[0] !== '.') {
      ext = `.${ext}`
    }
  } else {
    ext = ''
  }

  return `${name}${ext}`
}
