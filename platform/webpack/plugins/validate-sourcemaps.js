/**
 * Webpack plugin to validate that source maps do not contain source content.
 *
 * This plugin runs after source maps are emitted but before uploads them. If
 * any source map contains `sourcesContent` (actual source code), the build will
 * fail to prevent accidental source code exposure.
 *
 * @example
 * ```js
 * import { ValidateSourceMapsPlugin } from './webpack/plugins/validate-sourcemaps.js'
 *
 * config.plugins.unshift(new ValidateSourceMapsPlugin())
 * ```
 */
import { glob } from 'glob'
import fs from 'node:fs/promises'
import path from 'node:path'

const PLUGIN_NAME = 'ValidateSourceMapsPlugin'

/**
 * Check if a source map file contains sourcesContent
 *
 * @param {string} filePath - Path to the .map file
 * @returns {Promise<{ hasSourcesContent: boolean, sourcesCount?: number }>}
 */
async function checkSourceMap(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const sourceMap = JSON.parse(content)

    if (sourceMap.sourcesContent && Array.isArray(sourceMap.sourcesContent)) {
      const nonEmptyCount = sourceMap.sourcesContent.filter(
        (s) => s !== null && s !== ''
      ).length

      if (nonEmptyCount > 0) {
        return { hasSourcesContent: true, sourcesCount: nonEmptyCount }
      }
    }

    return { hasSourcesContent: false }
  } catch {
    // If we can't parse the file, assume it's safe (might not be a JSON source map)
    return { hasSourcesContent: false }
  }
}

/**
 * Validate all source maps in a directory
 *
 * @param {string} outputPath - The webpack output directory
 * @returns {Promise<{ violations: string[], totalChecked: number }>}
 */
async function validateSourceMaps(outputPath) {
  const mapFiles = await glob('**/*.map', {
    cwd: outputPath,
    absolute: true,
  })

  const violations = []

  for (const mapFile of mapFiles) {
    const result = await checkSourceMap(mapFile)

    if (result.hasSourcesContent) {
      violations.push({
        file: path.relative(outputPath, mapFile),
        sourcesCount: result.sourcesCount,
      })
    }
  }

  return {
    violations,
    totalChecked: mapFiles.length,
  }
}

class ValidateSourceMapsPlugin {
  /**
   * @param {Object} options
   * @param {boolean} [options.failOnViolation=true] - Whether to fail the build on violation
   * @param {string} [options.phase] - Optional phase identifier for logging (e.g., 'sentry', 'generic')
   */
  constructor(options = {}) {
    this.failOnViolation = options.failOnViolation !== false
    this.phase = options.phase
  }

  /**
   * Get the log prefix including optional phase
   *
   * @returns {string}
   */
  getLogPrefix() {
    return this.phase ? `[${PLUGIN_NAME}:${this.phase}]` : `[${PLUGIN_NAME}]`
  }

  /**
   * Check if the devtool setting is safe (doesn't include source content)
   *
   * @param {string | false} devtool - The webpack devtool setting
   * @returns {{ isSafe: boolean, warning?: string }}
   */
  checkDevtool(devtool) {
    const safeDevtools = [
      'nosources-source-map',
      'nosources-cheap-source-map',
      'nosources-cheap-module-source-map',
      'hidden-nosources-source-map',
      'hidden-nosources-cheap-source-map',
      'hidden-nosources-cheap-module-source-map',
      false, // No source maps at all
    ]

    if (safeDevtools.includes(devtool)) {
      return { isSafe: true }
    }

    return {
      isSafe: false,
      warning:
        `devtool is '${devtool}', which may include sourcesContent. ` +
        `Expected one of: ${safeDevtools.filter(Boolean).join(', ')}`,
    }
  }

  apply(compiler) {
    compiler.hooks.afterEmit.tapAsync(
      PLUGIN_NAME,
      async (compilation, callback) => {
        const outputPath = compilation.outputOptions.path
        const prefix = this.getLogPrefix()

        // Check devtool setting first

        const devtool = compilation.options.devtool
        const devtoolCheck = this.checkDevtool(devtool)

        if (!devtoolCheck.isSafe) {
          // eslint-disable-next-line no-console
          console.warn(`${prefix} ⚠️ Warning: ${devtoolCheck.warning}`)
        }

        try {
          const { violations, totalChecked } = await validateSourceMaps(
            outputPath
          )

          if (violations.length > 0) {
            const message =
              `${prefix} SECURITY VIOLATION: The following source maps contain sourcesContent (actual source code). ` +
              `This should never happen with devtool: 'nosources-source-map'. ` +
              `Failing build to prevent source code upload to Sentry:\n` +
              violations
                .map((v) => `  - ${v.file} (${v.sourcesCount} sources)`)
                .join('\n')

            if (this.failOnViolation) {
              callback(new Error(message))

              return
            } else {
              // eslint-disable-next-line no-console
              console.warn(message)
            }
          } else {
            // eslint-disable-next-line no-console
            console.log(
              `${prefix} ✓ Validated ${totalChecked} source maps - no sourcesContent found`
            )
          }

          callback()
        } catch (error) {
          callback(error)
        }
      }
    )
  }
}

export {
  ValidateSourceMapsPlugin,
  checkSourceMap,
  validateSourceMaps,
  PLUGIN_NAME,
}
