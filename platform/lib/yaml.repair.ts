import yaml from '@/lib/yaml'

import { jsonrepair } from 'jsonrepair'

/**
 * Repairs a broken yaml document. The method returns a single line JSON string.
 *
 * @throws
 */
export function repair(input: string): string {
  try {
    const obj = yaml.parse(input)

    return JSON.stringify(obj)
  } catch (e) {
    try {
      return JSON.stringify(JSON.parse(jsonrepair(input)))
    } catch {
      throw e
    }
  }
}

/**
 * Tries to repair a broken YAML document.
 */
export function tryRepair(input: unknown): string | null {
  try {
    return repair(input as string)
  } catch {
    return null
  }
}
