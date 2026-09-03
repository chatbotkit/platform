import 'dotenv/config'

import {
  generateFromOpenAPI,
  isSupportedLanguage,
} from '@chatbotkit-dev/openapi-types-generator'

import { log, runScript } from '@/lib/script'

import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(__dirname, '..')

const specPath = path.resolve(workspaceRoot, 'public/api/v1/spec.json')

/**
 * Map file extensions to supported languages.
 */
const extensionToLanguage = {
  '.go': 'go',
  '.py': 'python',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.cs': 'csharp',
  '.ts': 'typescript',
  '.rb': 'ruby',
  '.cpp': 'cpp',
  '.hpp': 'cpp',
  '.h': 'cpp',
}

/**
 * Infer language from file extension.
 */
function inferLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const lang = extensionToLanguage[ext]

  if (!lang) {
    return null
  }

  return lang
}

/**
 * Strip trailing whitespace from every line.
 *
 * @note quicktype leaves trailing spaces on blank comment lines, which fails
 * `gofmt -l` style gates in the Go SDKs
 * @param {string} content
 * @returns {string}
 */
function stripTrailingWhitespace(content) {
  return content.replace(/[ \t]+$/gm, '')
}

/**
 * Run gofmt on a Go file when it is on PATH; a no-op otherwise.
 * @param {string} filePath
 * @returns {boolean} whether gofmt ran
 * @throws {Error} when gofmt is present but fails
 */
function runGofmt(filePath) {
  try {
    execFileSync('gofmt', ['-w', filePath], { stdio: 'pipe' })

    return true
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false
    }

    throw error
  }
}

/**
 * Generate API types from the OpenAPI spec.
 *
 * Usage:
 * ```bash
 * pnpm script:generate-api-types                           # Interactive mode
 * pnpm script:generate-api-types --output ./types.go       # Output Go types
 * pnpm script:generate-api-types -o ./types.py             # Output Python types
 * pnpm script:generate-api-types -o ./types.ts             # Output TypeScript types
 * ```
 *
 * The language is inferred from the file extension:
 * - .go -> Go
 * - .py -> Python
 * - .rs -> Rust
 * - .java -> Java
 * - .kt -> Kotlin
 * - .swift -> Swift
 * - .cs -> C#
 * - .ts -> TypeScript
 * - .rb -> Ruby
 * - .cpp/.hpp/.h -> C++
 *
 * If no output path is provided, types are printed to stdout.
 */
runScript({
  name: 'generate-api-types',
  description: 'Generate typed interfaces from the API spec for any language',
  options: {
    output: {
      type: 'string',
      short: 'o',
      description:
        'Output file path (language inferred from extension, e.g., types.go, types.py)',
      message: 'Where should the types be written? (e.g., ./types.go)',
      required: true,
    },
    package: {
      type: 'string',
      short: 'p',
      description: 'Package name for generated types (default: types)',
    },
    components: {
      type: 'boolean',
      short: 'c',
      description: 'Include component schemas in addition to route types',
      default: true,
    },
  },
  handler: async ({ output, package: packageName, components }) => {
    log('🚀 starting API types generation')

    // Step 1: Infer language from output path
    const language = inferLanguage(output)

    if (!language) {
      const supportedExts = Object.keys(extensionToLanguage).join(', ')

      log(`❌ could not infer language from extension: ${path.extname(output)}`)
      log(`   supported extensions: ${supportedExts}`)

      process.exit(1)
    }

    if (!isSupportedLanguage(language)) {
      log(`❌ unsupported language: ${language}`)

      process.exit(1)
    }

    log(`📝 target language: ${language}`)

    // Step 2: Read the API spec
    log('📖 reading API spec...')

    let specContent

    try {
      specContent = await fs.readFile(specPath, 'utf-8')
    } catch (error) {
      log(`❌ failed to read API spec: ${specPath}`)
      log(`   run 'pnpm script:build-api-spec' first to generate the spec`)

      process.exit(1)
    }

    log('✅ API spec loaded')

    // Step 3: Generate types
    log('🔧 generating types...')

    let generatedTypes

    try {
      generatedTypes = await generateFromOpenAPI(specContent, {
        language,
        packageName: packageName || 'types',
        includeComponents: components !== false,
      })
    } catch (error) {
      log(`❌ failed to generate types: ${error.message}`)

      process.exit(1)
    }

    if (language === 'go') {
      generatedTypes = stripTrailingWhitespace(generatedTypes)
    }

    log('✅ types generated')

    // Step 4: Write output
    log(`📁 writing to ${output}...`)

    const outputPath = path.isAbsolute(output)
      ? output
      : path.resolve(process.cwd(), output)

    const outputDir = path.dirname(outputPath)

    try {
      await fs.mkdir(outputDir, { recursive: true })
      await fs.writeFile(outputPath, generatedTypes, 'utf-8')
    } catch (error) {
      log(`❌ failed to write output: ${error.message}`)

      process.exit(1)
    }

    log(`✅ types written to ${outputPath}`)

    if (language === 'go') {
      if (runGofmt(outputPath)) {
        log('✅ gofmt applied')
      } else {
        log('⚠️  gofmt not found on PATH, skipping')
      }
    }

    log('🎉 done!')
  },
})
