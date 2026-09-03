import {
  PLUGIN_NAME,
  ValidateSourceMapsPlugin,
  checkSourceMap,
  validateSourceMaps,
} from './validate-sourcemaps'

import fs from 'fs/promises'
import os from 'os'
import path from 'path'

/**
 * Creates a mock webpack compiler for testing plugin.apply()
 *
 * @param {object} options
 * @param {string} options.outputPath - The output directory path
 * @param {string | false} [options.devtool='nosources-source-map'] - The devtool setting
 * @returns {object} Mock compiler with hooks
 */
function createMockCompiler(options) {
  const { outputPath, devtool = 'nosources-source-map' } = options

  let afterEmitCallback = null

  return {
    hooks: {
      afterEmit: {
        tapAsync: (name, callback) => {
          afterEmitCallback = callback
        },
      },
    },
    // Trigger the registered callback with a mock compilation
    triggerAfterEmit: async () => {
      if (!afterEmitCallback) {
        throw new Error('No afterEmit callback registered')
      }

      const compilation = {
        outputOptions: { path: outputPath },
        options: { devtool },
      }

      return new Promise((resolve, reject) => {
        afterEmitCallback(compilation, (error) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        })
      })
    },
    getRegisteredCallback: () => afterEmitCallback,
  }
}

describe('validate-sourcemaps', () => {
  let tempDir

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'validate-sourcemaps-'))
  })

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  describe('PLUGIN_NAME', () => {
    it('should export the plugin name', () => {
      expect(PLUGIN_NAME).toBe('ValidateSourceMapsPlugin')
    })
  })

  describe('ValidateSourceMapsPlugin', () => {
    it('should return default log prefix without phase', () => {
      const plugin = new ValidateSourceMapsPlugin()

      expect(plugin.getLogPrefix()).toBe('[ValidateSourceMapsPlugin]')
    })

    it('should include phase in log prefix when provided', () => {
      const plugin = new ValidateSourceMapsPlugin({ phase: 'sentry' })

      expect(plugin.getLogPrefix()).toBe('[ValidateSourceMapsPlugin:sentry]')
    })

    it('should include custom phase in log prefix', () => {
      const plugin = new ValidateSourceMapsPlugin({ phase: 'generic' })

      expect(plugin.getLogPrefix()).toBe('[ValidateSourceMapsPlugin:generic]')
    })

    describe('checkDevtool', () => {
      it('should return safe for nosources-source-map', () => {
        const plugin = new ValidateSourceMapsPlugin()

        expect(plugin.checkDevtool('nosources-source-map')).toEqual({
          isSafe: true,
        })
      })

      it('should return safe for hidden-nosources-source-map', () => {
        const plugin = new ValidateSourceMapsPlugin()

        expect(plugin.checkDevtool('hidden-nosources-source-map')).toEqual({
          isSafe: true,
        })
      })

      it('should return safe for nosources-cheap-source-map', () => {
        const plugin = new ValidateSourceMapsPlugin()

        expect(plugin.checkDevtool('nosources-cheap-source-map')).toEqual({
          isSafe: true,
        })
      })

      it('should return safe for false (no source maps)', () => {
        const plugin = new ValidateSourceMapsPlugin()

        expect(plugin.checkDevtool(false)).toEqual({ isSafe: true })
      })

      it('should return unsafe for source-map', () => {
        const plugin = new ValidateSourceMapsPlugin()
        const result = plugin.checkDevtool('source-map')

        expect(result.isSafe).toBe(false)
        expect(result.warning).toContain("devtool is 'source-map'")
      })

      it('should return unsafe for hidden-source-map', () => {
        const plugin = new ValidateSourceMapsPlugin()
        const result = plugin.checkDevtool('hidden-source-map')

        expect(result.isSafe).toBe(false)
        expect(result.warning).toContain("devtool is 'hidden-source-map'")
      })

      it('should return unsafe for eval-source-map', () => {
        const plugin = new ValidateSourceMapsPlugin()
        const result = plugin.checkDevtool('eval-source-map')

        expect(result.isSafe).toBe(false)
        expect(result.warning).toContain("devtool is 'eval-source-map'")
      })

      it('should return unsafe for cheap-module-source-map', () => {
        const plugin = new ValidateSourceMapsPlugin()
        const result = plugin.checkDevtool('cheap-module-source-map')

        expect(result.isSafe).toBe(false)
        expect(result.warning).toContain("devtool is 'cheap-module-source-map'")
      })
    })
  })

  describe('checkSourceMap', () => {
    it('should return false for source map without sourcesContent', async () => {
      const mapContent = {
        version: 3,
        sources: ['src/app.ts', 'src/utils.ts'],
        names: ['init', 'helper'],
        mappings: 'AAAA,SAAS',
      }

      const mapPath = path.join(tempDir, 'app.js.map')

      await fs.writeFile(mapPath, JSON.stringify(mapContent))

      const result = await checkSourceMap(mapPath)

      expect(result.hasSourcesContent).toBe(false)
    })

    it('should return false for source map with empty sourcesContent', async () => {
      const mapContent = {
        version: 3,
        sources: ['src/app.ts'],
        names: ['init'],
        mappings: 'AAAA',
        sourcesContent: [null],
      }

      const mapPath = path.join(tempDir, 'app.js.map')

      await fs.writeFile(mapPath, JSON.stringify(mapContent))

      const result = await checkSourceMap(mapPath)

      expect(result.hasSourcesContent).toBe(false)
    })

    it('should return false for source map with empty string sourcesContent', async () => {
      const mapContent = {
        version: 3,
        sources: ['src/app.ts'],
        names: ['init'],
        mappings: 'AAAA',
        sourcesContent: [''],
      }

      const mapPath = path.join(tempDir, 'app.js.map')

      await fs.writeFile(mapPath, JSON.stringify(mapContent))

      const result = await checkSourceMap(mapPath)

      expect(result.hasSourcesContent).toBe(false)
    })

    it('should return true for source map with actual source content', async () => {
      const mapContent = {
        version: 3,
        sources: ['src/app.ts', 'src/utils.ts'],
        names: ['init', 'helper'],
        mappings: 'AAAA,SAAS',
        sourcesContent: [
          'export function init() { console.log("hello"); }',
          'export function helper() { return 42; }',
        ],
      }

      const mapPath = path.join(tempDir, 'app.js.map')

      await fs.writeFile(mapPath, JSON.stringify(mapContent))

      const result = await checkSourceMap(mapPath)

      expect(result.hasSourcesContent).toBe(true)
      expect(result.sourcesCount).toBe(2)
    })

    it('should return true for source map with mixed content (some null, some actual)', async () => {
      const mapContent = {
        version: 3,
        sources: ['src/app.ts', 'node_modules/lib.js'],
        names: ['init'],
        mappings: 'AAAA',
        sourcesContent: [
          'export function init() { console.log("secret code"); }',
          null,
        ],
      }

      const mapPath = path.join(tempDir, 'app.js.map')

      await fs.writeFile(mapPath, JSON.stringify(mapContent))

      const result = await checkSourceMap(mapPath)

      expect(result.hasSourcesContent).toBe(true)
      expect(result.sourcesCount).toBe(1)
    })

    it('should return false for non-JSON file', async () => {
      const mapPath = path.join(tempDir, 'weird.map')

      await fs.writeFile(mapPath, 'this is not json')

      const result = await checkSourceMap(mapPath)

      expect(result.hasSourcesContent).toBe(false)
    })

    it('should return false for non-existent file', async () => {
      const result = await checkSourceMap('/nonexistent/path.map')

      expect(result.hasSourcesContent).toBe(false)
    })
  })

  describe('validateSourceMaps', () => {
    it('should return no violations for directory with safe source maps', async () => {
      const safeMap = {
        version: 3,
        sources: ['src/app.ts'],
        names: ['init'],
        mappings: 'AAAA',
      }

      await fs.writeFile(
        path.join(tempDir, 'app.js.map'),
        JSON.stringify(safeMap)
      )
      await fs.writeFile(
        path.join(tempDir, 'vendor.js.map'),
        JSON.stringify(safeMap)
      )

      const result = await validateSourceMaps(tempDir)

      expect(result.violations).toHaveLength(0)
      expect(result.totalChecked).toBe(2)
    })

    it('should detect violations in nested directories', async () => {
      const safeMap = {
        version: 3,
        sources: ['src/app.ts'],
        names: ['init'],
        mappings: 'AAAA',
      }

      const unsafeMap = {
        version: 3,
        sources: ['src/secret.ts'],
        names: ['secret'],
        mappings: 'AAAA',
        sourcesContent: ['export const SECRET_KEY = "abc123";'],
      }

      await fs.mkdir(path.join(tempDir, 'static', 'chunks'), {
        recursive: true,
      })
      await fs.writeFile(
        path.join(tempDir, 'static', 'chunks', 'main.js.map'),
        JSON.stringify(safeMap)
      )
      await fs.writeFile(
        path.join(tempDir, 'static', 'chunks', 'pages.js.map'),
        JSON.stringify(unsafeMap)
      )

      const result = await validateSourceMaps(tempDir)

      expect(result.violations).toHaveLength(1)
      expect(result.violations[0].file).toBe('static/chunks/pages.js.map')
      expect(result.violations[0].sourcesCount).toBe(1)
      expect(result.totalChecked).toBe(2)
    })

    it('should return empty results for directory with no map files', async () => {
      await fs.writeFile(path.join(tempDir, 'app.js'), 'console.log("hi")')

      const result = await validateSourceMaps(tempDir)

      expect(result.violations).toHaveLength(0)
      expect(result.totalChecked).toBe(0)
    })

    it('should handle multiple violations', async () => {
      const unsafeMap1 = {
        version: 3,
        sources: ['a.ts'],
        mappings: 'AAAA',
        sourcesContent: ['code1'],
      }

      const unsafeMap2 = {
        version: 3,
        sources: ['b.ts', 'c.ts'],
        mappings: 'AAAA',
        sourcesContent: ['code2', 'code3'],
      }

      await fs.writeFile(
        path.join(tempDir, 'a.js.map'),
        JSON.stringify(unsafeMap1)
      )
      await fs.writeFile(
        path.join(tempDir, 'b.js.map'),
        JSON.stringify(unsafeMap2)
      )

      const result = await validateSourceMaps(tempDir)

      expect(result.violations).toHaveLength(2)
      expect(result.totalChecked).toBe(2)
    })
  })

  describe('plugin.apply() integration', () => {
    it('should register on compiler.hooks.afterEmit', () => {
      const plugin = new ValidateSourceMapsPlugin()
      const compiler = createMockCompiler({ outputPath: tempDir })

      plugin.apply(compiler)

      expect(compiler.getRegisteredCallback()).toBeInstanceOf(Function)
    })

    it('should succeed with safe source maps', async () => {
      const safeMap = {
        version: 3,
        sources: ['src/app.ts'],
        names: ['init'],
        mappings: 'AAAA',
      }

      await fs.writeFile(
        path.join(tempDir, 'app.js.map'),
        JSON.stringify(safeMap)
      )

      const plugin = new ValidateSourceMapsPlugin()
      const compiler = createMockCompiler({ outputPath: tempDir })

      plugin.apply(compiler)

      await expect(compiler.triggerAfterEmit()).resolves.toBeUndefined()
    })

    it('should fail build when sourcesContent is found and failOnViolation is true', async () => {
      const unsafeMap = {
        version: 3,
        sources: ['src/secret.ts'],
        names: ['secret'],
        mappings: 'AAAA',
        sourcesContent: ['export const SECRET = "leaked";'],
      }

      await fs.writeFile(
        path.join(tempDir, 'secret.js.map'),
        JSON.stringify(unsafeMap)
      )

      const plugin = new ValidateSourceMapsPlugin({ failOnViolation: true })
      const compiler = createMockCompiler({ outputPath: tempDir })

      plugin.apply(compiler)

      await expect(compiler.triggerAfterEmit()).rejects.toThrow(
        'SECURITY VIOLATION'
      )
    })

    it('should not fail build when failOnViolation is false', async () => {
      const unsafeMap = {
        version: 3,
        sources: ['src/secret.ts'],
        names: ['secret'],
        mappings: 'AAAA',
        sourcesContent: ['export const SECRET = "leaked";'],
      }

      await fs.writeFile(
        path.join(tempDir, 'warning.js.map'),
        JSON.stringify(unsafeMap)
      )

      const plugin = new ValidateSourceMapsPlugin({ failOnViolation: false })
      const compiler = createMockCompiler({ outputPath: tempDir })

      plugin.apply(compiler)

      // Should not throw, just warn
      await expect(compiler.triggerAfterEmit()).resolves.toBeUndefined()
    })

    it('should warn when devtool is unsafe', async () => {
      const safeMap = {
        version: 3,
        sources: ['src/app.ts'],
        mappings: 'AAAA',
      }

      await fs.writeFile(
        path.join(tempDir, 'app.js.map'),
        JSON.stringify(safeMap)
      )

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      try {
        const plugin = new ValidateSourceMapsPlugin()
        const compiler = createMockCompiler({
          outputPath: tempDir,
          devtool: 'source-map', // Unsafe - includes sourcesContent
        })

        plugin.apply(compiler)
        await compiler.triggerAfterEmit()

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("devtool is 'source-map'")
        )
      } finally {
        warnSpy.mockRestore()
      }
    })

    it('should not warn when devtool is safe', async () => {
      const safeMap = {
        version: 3,
        sources: ['src/app.ts'],
        mappings: 'AAAA',
      }

      await fs.writeFile(
        path.join(tempDir, 'app.js.map'),
        JSON.stringify(safeMap)
      )

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      try {
        const plugin = new ValidateSourceMapsPlugin()
        const compiler = createMockCompiler({
          outputPath: tempDir,
          devtool: 'nosources-source-map',
        })

        plugin.apply(compiler)
        await compiler.triggerAfterEmit()

        expect(warnSpy).not.toHaveBeenCalled()
      } finally {
        warnSpy.mockRestore()
      }
    })

    it('should include phase in error message', async () => {
      const unsafeMap = {
        version: 3,
        sources: ['src/secret.ts'],
        mappings: 'AAAA',
        sourcesContent: ['code'],
      }

      await fs.writeFile(
        path.join(tempDir, 'secret.js.map'),
        JSON.stringify(unsafeMap)
      )

      const plugin = new ValidateSourceMapsPlugin({ phase: 'sentry' })
      const compiler = createMockCompiler({ outputPath: tempDir })

      plugin.apply(compiler)

      await expect(compiler.triggerAfterEmit()).rejects.toThrow(
        '[ValidateSourceMapsPlugin:sentry]'
      )
    })

    it('should log success message with source map count', async () => {
      const safeMap = {
        version: 3,
        sources: ['src/app.ts'],
        mappings: 'AAAA',
      }

      await fs.writeFile(
        path.join(tempDir, 'app.js.map'),
        JSON.stringify(safeMap)
      )
      await fs.writeFile(
        path.join(tempDir, 'vendor.js.map'),
        JSON.stringify(safeMap)
      )

      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      try {
        const plugin = new ValidateSourceMapsPlugin({ phase: 'generic' })
        const compiler = createMockCompiler({ outputPath: tempDir })

        plugin.apply(compiler)
        await compiler.triggerAfterEmit()

        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Validated 2 source maps')
        )
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('[ValidateSourceMapsPlugin:generic]')
        )
      } finally {
        logSpy.mockRestore()
      }
    })
  })
})
