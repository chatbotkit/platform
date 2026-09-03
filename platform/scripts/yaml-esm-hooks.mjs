/**
 * ESM loader hooks for yaml files.
 *
 * Handles .yaml and .yml imports when running scripts with tsx by converting
 * yaml file content to a JavaScript module with a default export.
 *
 * Used by yaml-esm-register.mjs which is loaded via tsx --import.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

// @note: use createRequire to synchronously load js-yaml in the hooks worker context
const yaml = require('js-yaml')

export async function load(url, context, nextLoad) {
  if (url.endsWith('.yaml') || url.endsWith('.yml')) {
    const filePath = fileURLToPath(url)
    const content = readFileSync(filePath, 'utf8')
    const data = yaml.load(content)

    return {
      format: 'module',
      shortCircuit: true,
      source: `const data = ${JSON.stringify(data)};\nexport default data;\n`,
    }
  }

  return nextLoad(url, context)
}
