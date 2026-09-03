import * as fs from 'fs'

/**
 * Extracts source code between source start/end markers
 */
export function extractSource(input: string): string {
  const lines: string[] = []

  let skip = true

  for (const line of input.split('\n')) {
    if (/\/\/\s*!?source start/.test(line)) {
      skip = false

      continue
    }

    if (/\/\/\s*!?source end/.test(line)) {
      skip = true

      continue
    }

    if (skip) {
      continue
    }

    lines.push(line)
  }

  return lines.join('\n')
}

/**
 * Reads and extracts source code from a file
 */
export function readSource(path: string): string {
  const source = extractSource(fs.readFileSync(path, 'utf8').toString())

  return source
}
