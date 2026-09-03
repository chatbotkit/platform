import yaml from '@/lib/yaml'

import { jsonrepair } from 'jsonrepair'

/**
 * Repairs a broken json document. The method returns a single line JSON string.
 *
 * @throws Error if the JSON cannot be repaired
 */
export function repair(input: string): string {
  try {
    const obj = yaml.parse(input) // @todo this seems to be dangerous and unnecessary

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
 * Tries to repair a broken JSON document.
 */
export function tryRepair(input: unknown): string | null {
  try {
    return repair(String(input))
  } catch {
    return null
  }
}
