/**
 * CDN Bundle Validation Script
 *
 * This script validates that CDN bundles are correctly built and functional.
 * Run after `pnpm build:cdn` to verify the output.
 *
 * Checks performed:
 * 1. Bundle files exist
 * 2. Bundle files are valid JavaScript (can be parsed)
 * 3. Manifest files exist and contain valid JSON
 * 4. Manifests have required fields
 * 5. Custom element registration code is present
 * 6. Loader files are valid JavaScript
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CDN_DIR = path.join(__dirname, '..', 'cdn')
const WIDGETS_CDN_DIR = path.join(CDN_DIR, 'widgets')
const LOADERS_CDN_DIR = path.join(CDN_DIR, 'loaders')

/** Required fields in manifest */
const REQUIRED_MANIFEST_FIELDS = [
  'name',
  'displayName',
  'description',
  'version',
  'tagName',
  'framework',
  'propsSchema',
]

let hasErrors = false

function logSuccess(message) {
  console.log(`  ✓ ${message}`)
}

function logError(message) {
  console.error(`  ✗ ${message}`)
  hasErrors = true
}

function logInfo(message) {
  console.log(`  ℹ ${message}`)
}

/**
 * Check if a file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Validate a JavaScript bundle
 */
async function validateBundle(widgetName) {
  const bundlePath = path.join(WIDGETS_CDN_DIR, `${widgetName}.js`)

  // Check file exists
  if (!(await fileExists(bundlePath))) {
    logError(`Bundle not found: ${widgetName}.js`)
    return false
  }

  const content = await fs.readFile(bundlePath, 'utf8')
  const stats = await fs.stat(bundlePath)

  // Check file is not empty
  if (content.length === 0) {
    logError(`Bundle is empty: ${widgetName}.js`)
    return false
  }

  // Check it's valid JavaScript by attempting to parse
  // We can't fully execute it without a browser, but we can check syntax
  try {
    // Use Function constructor to parse (doesn't execute)
    // eslint-disable-next-line no-new-func
    new Function(content)
    logSuccess(
      `Bundle is valid JS: ${widgetName}.js (${formatSize(stats.size)})`
    )
  } catch (err) {
    logError(`Bundle has syntax errors: ${widgetName}.js - ${err.message}`)
    return false
  }

  // Check for custom element registration
  const tagName = `mcp-${widgetName}`
  if (!content.includes(tagName) && !content.includes('customElements')) {
    logError(`Bundle may not register custom element: ${widgetName}.js`)
    return false
  }

  return true
}

/**
 * Validate a manifest file
 */
async function validateManifest(widgetName) {
  const manifestPath = path.join(WIDGETS_CDN_DIR, `${widgetName}.manifest.json`)

  // Check file exists
  if (!(await fileExists(manifestPath))) {
    logError(`Manifest not found: ${widgetName}.manifest.json`)
    return false
  }

  const content = await fs.readFile(manifestPath, 'utf8')

  // Check it's valid JSON
  let manifest
  try {
    manifest = JSON.parse(content)
    logSuccess(`Manifest is valid JSON: ${widgetName}.manifest.json`)
  } catch (err) {
    logError(
      `Manifest has invalid JSON: ${widgetName}.manifest.json - ${err.message}`
    )
    return false
  }

  // Check required fields
  const missingFields = REQUIRED_MANIFEST_FIELDS.filter(
    (field) => !(field in manifest)
  )
  if (missingFields.length > 0) {
    logError(`Manifest missing fields: ${missingFields.join(', ')}`)
    return false
  }

  // Check tagName format
  if (!manifest.tagName.startsWith('mcp-')) {
    logError(`Manifest tagName should start with 'mcp-': ${manifest.tagName}`)
    return false
  }

  // Check propsSchema has expected structure
  if (typeof manifest.propsSchema !== 'object') {
    logError(`Manifest propsSchema should be an object`)
    return false
  }

  logSuccess(`Manifest has all required fields`)
  logInfo(
    `  → ${manifest.displayName} v${manifest.version} (${manifest.framework})`
  )

  return true
}

/**
 * Validate a loader file
 */
async function validateLoader(loaderName) {
  const loaderPath = path.join(LOADERS_CDN_DIR, `${loaderName}.js`)

  // Check file exists
  if (!(await fileExists(loaderPath))) {
    logError(`Loader not found: loaders/${loaderName}.js`)
    return false
  }

  const content = await fs.readFile(loaderPath, 'utf8')
  const stats = await fs.stat(loaderPath)

  // Check file is not empty
  if (content.length === 0) {
    logError(`Loader is empty: loaders/${loaderName}.js`)
    return false
  }

  // Check it's valid JavaScript
  try {
    // eslint-disable-next-line no-new-func
    new Function(content)
    logSuccess(
      `Loader is valid JS: loaders/${loaderName}.js (${formatSize(stats.size)})`
    )
  } catch (err) {
    logError(
      `Loader has syntax errors: loaders/${loaderName}.js - ${err.message}`
    )
    return false
  }

  // Check for MCPWidgets global
  if (!content.includes('MCPWidgets')) {
    logError(
      `Loader may not expose MCPWidgets global: loaders/${loaderName}.js`
    )
    return false
  }

  return true
}

/**
 * Format file size
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Check for expected directory structure
 */
async function checkDirectoryStructure() {
  // Check widgets directory
  if (!(await fileExists(WIDGETS_CDN_DIR))) {
    logError('cdn/widgets/ directory not found')
    return
  }

  const widgetFiles = await fs.readdir(WIDGETS_CDN_DIR)
  logInfo(`Found ${widgetFiles.length} files in cdn/widgets/`)

  // Check loaders directory
  if (!(await fileExists(LOADERS_CDN_DIR))) {
    logError('cdn/loaders/ directory not found')
    return
  }

  const loaderFiles = await fs.readdir(LOADERS_CDN_DIR)
  logInfo(`Found ${loaderFiles.length} files in cdn/loaders/`)

  logSuccess('Directory structure is correct')
}

/**
 * Discover widgets from the cdn/widgets directory
 * Widgets are identified by .manifest.json files
 */
async function discoverWidgets() {
  if (!(await fileExists(WIDGETS_CDN_DIR))) {
    return []
  }

  const files = await fs.readdir(WIDGETS_CDN_DIR)
  return files
    .filter((f) => f.endsWith('.manifest.json'))
    .map((f) => f.replace('.manifest.json', ''))
}

/**
 * Discover loaders from the cdn/loaders directory
 * Loaders are identified by .js files
 */
async function discoverLoaders() {
  if (!(await fileExists(LOADERS_CDN_DIR))) {
    return []
  }

  const files = await fs.readdir(LOADERS_CDN_DIR)
  return files.filter((f) => f.endsWith('.js')).map((f) => f.replace('.js', ''))
}

/**
 * Main validation
 */
async function main() {
  console.log('\n🔍 Validating CDN bundles...\n')

  // Check CDN directory exists
  if (!(await fileExists(CDN_DIR))) {
    console.error('❌ CDN directory not found. Run `pnpm build:cdn` first.')
    process.exit(1)
  }

  // Discover and validate widgets
  const widgets = await discoverWidgets()

  if (widgets.length === 0) {
    logError('No widgets found in cdn/widgets/')
  }

  for (const widget of widgets) {
    console.log(`\n📦 Widget: ${widget}`)
    await validateBundle(widget)
    await validateManifest(widget)
  }

  // Discover and validate loaders
  const loaders = await discoverLoaders()

  if (loaders.length === 0) {
    logError('No loaders found in cdn/loaders/')
  }

  for (const loader of loaders) {
    console.log(`\n🔌 Loader: ${loader}`)
    await validateLoader(loader)
  }

  // Check directory structure
  console.log('\n📁 Directory structure:')
  await checkDirectoryStructure()

  // Summary
  console.log('\n' + '─'.repeat(50))
  if (hasErrors) {
    console.error('\n❌ Validation failed! See errors above.\n')
    process.exit(1)
  } else {
    console.log('\n✅ All CDN bundles validated successfully!\n')
  }
}

main().catch((err) => {
  console.error('Validation script error:', err)
  process.exit(1)
})
