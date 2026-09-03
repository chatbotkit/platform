/* eslint-disable no-console */

/**
 * @file post-generate-zod.js
 *
 * Post-generation script for prisma-zod-generator compatibility.
 *
 * Creates re-export files at the old zod-prisma output paths so that
 * existing consumer imports (e.g. `from 'prisma/zod/schemas/bot'`)
 * continue to work without changes.
 *
 * Also patches the 4 models that use custom Zod types for their
 * `config` JSON field (Secret, Portal, Policy, Token).
 *
 * Run after `prisma generate`:
 *   node prisma/post-generate-zod.js
 *
 * @todo Simplify this script by migrating all consumer imports to use the new
 * prisma-zod-generator paths directly (e.g. `from 'prisma/zod/schemas/models/Bot'`).
 * Once imports are updated, remove the lowercase re-export logic. Consider using
 * a codemod or find-replace to update ~100+ import statements across the codebase.
 * The custom config type overrides (Secret, Portal, Policy, Token) will still need
 * special handling - explore if prisma-zod-generator supports custom type injection
 * via schema annotations or generator options.
 */
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { basename, join } from 'path'

// @note the prisma directory to post-process comes from the caller - this
// script is shared by every db module, each of which generates its own zod
// output next to its own schema
const PRISMA_DIR = process.argv[2]

if (!PRISMA_DIR) {
  console.error('usage: node post-generate-zod.js <prisma-dir>')

  process.exit(1)
}

const SCHEMAS_DIR = new URL(
  'zod/schemas',
  `file://${PRISMA_DIR.endsWith('/') ? PRISMA_DIR : PRISMA_DIR + '/'}`
).pathname
const MODELS_DIR = join(SCHEMAS_DIR, 'models')

/**
 * Models that need custom type overrides for their `config` field.
 * Maps model file name (in models/) to the custom type import.
 */
const CUSTOM_CONFIG_MODELS = {
  'secret.ts': { type: 'SecretConfig', nullable: true },
  'portal.ts': { type: 'PortalConfig', nullable: true },
  'policy.ts': { type: 'PolicyConfig', nullable: true },
  'token.ts': { type: 'TokenConfig', nullable: true },
}

// Read all generated model files
const modelFiles = readdirSync(MODELS_DIR).filter(
  (f) => f.endsWith('.ts') && f !== 'index.ts'
)

// @note Patch models whose exported type name shadows a TypeScript built-in.
// The zod generator creates `export type Record = z.infer<...>` which shadows
// the global `Record<K,V>` utility type, breaking any `Record<string, unknown>`
// usage inside the same file's refinement functions.

const TS_BUILTIN_SHADOWS = ['record.ts']

for (const shadowFile of TS_BUILTIN_SHADOWS) {
  const filePath = join(MODELS_DIR, shadowFile)

  try {
    let content = readFileSync(filePath, 'utf-8')

    // Replace `Record<` with `globalThis.Record<` inside refinement code
    // but NOT in the `export type Record = ...` line
    content = content.replace(/(\bas\s+)Record</g, '$1globalThis.Record<')

    writeFileSync(filePath, content)
  } catch {
    // file may not exist if model was removed
  }
}

for (const file of modelFiles) {
  const modelBaseName = basename(file, '.ts')

  // Derive the lowercase filename that old zod-prisma used
  const lowercaseName = modelBaseName.toLowerCase()
  const outputPath = join(SCHEMAS_DIR, `${lowercaseName}.ts`)

  if (CUSTOM_CONFIG_MODELS[file]) {
    const { type, nullable } = CUSTOM_CONFIG_MODELS[file]
    const modelName =
      modelBaseName.charAt(0).toUpperCase() + modelBaseName.slice(1)
    const nullishSuffix = nullable ? '.nullish()' : ''

    // Create a wrapper that imports the generated model and overrides the config field
    const content = [
      `// Auto-generated compatibility re-export - do not edit`,
      `// @see prisma/post-generate-zod.js`,
      ``,
      `import { ${modelName}Model as _Base } from './models/${modelBaseName}'`,
      `import { ${type} } from '../types'`,
      ``,
      `export const ${modelName}Model = _Base.extend({`,
      `  config: ${type}${nullishSuffix},`,
      `})`,
      ``,
    ].join('\n')

    writeFileSync(outputPath, content)
  } else {
    // Simple re-export
    const content = [
      `// Auto-generated compatibility re-export - do not edit`,
      `// @see prisma/post-generate-zod.js`,
      `export * from './models/${modelBaseName}'`,
      ``,
    ].join('\n')

    writeFileSync(outputPath, content)
  }
}

// Create a barrel index.ts at schemas/ level
const barrelLines = [
  `// Auto-generated barrel - do not edit`,
  `// @see prisma/post-generate-zod.js`,
  ``,
]

for (const file of modelFiles) {
  const lowercaseName = basename(file, '.ts').toLowerCase()

  barrelLines.push(`export * from './${lowercaseName}'`)
}

barrelLines.push(``)

writeFileSync(join(SCHEMAS_DIR, 'index.ts'), barrelLines.join('\n'))

console.log(
  `✅ Created ${modelFiles.length} compatibility re-exports in prisma/zod/schemas/`
)
