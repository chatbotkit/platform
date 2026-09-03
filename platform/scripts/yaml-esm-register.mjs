/**
 * Registers the yaml ESM hooks so that tsx can handle .yaml imports.
 *
 * Usage (via tsx --import):
 * ```bash
 * tsx --import ./scripts/yaml-esm-register.mjs scripts/some-script.js
 * ```
 */
import { register } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

register(
  pathToFileURL(resolve(__dirname, 'yaml-esm-hooks.mjs')).href,
  import.meta.url
)
