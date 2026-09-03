/* eslint-disable @typescript-eslint/no-require-imports */
import { gzip } from '@/lib/zlib'

const jsonGzLoader = require('./json-gz.cjs')

describe('json-gz-loader', () => {
  function createLoaderContext(options = {}) {
    return {
      cacheable: jest.fn(),
      emitError: jest.fn(),
      emitWarning: jest.fn(),

      resourcePath: '/path/to/file.json.gz',

      ...options,
    }
  }

  it('should decompress and load a simple JSON object', () => {
    const jsonData = { name: 'Test', value: 123, enabled: true }
    const jsonString = JSON.stringify(jsonData)
    const gzippedBuffer = Buffer.from(gzip(jsonString))

    const context = createLoaderContext()
    const result = jsonGzLoader.call(context, gzippedBuffer)

    expect(result).toMatch(/^export default /)

    const jsonMatch = result.match(/export default ([\s\S]+);$/)

    expect(jsonMatch).toBeTruthy()

    const loadedData = JSON.parse(jsonMatch[1])

    expect(loadedData).toEqual(jsonData)
  })

  it('should decompress and load a JSON array', () => {
    const jsonData = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 3, name: 'Item 3' },
    ]
    const jsonString = JSON.stringify(jsonData)
    const gzippedBuffer = Buffer.from(gzip(jsonString))

    const context = createLoaderContext()
    const result = jsonGzLoader.call(context, gzippedBuffer)

    const jsonMatch = result.match(/export default ([\s\S]+);$/)
    const loadedData = JSON.parse(jsonMatch[1])

    expect(Array.isArray(loadedData)).toBe(true)
    expect(loadedData).toHaveLength(3)
    expect(loadedData[0]).toEqual({ id: 1, name: 'Item 1' })
  })

  it('should handle nested JSON structures', () => {
    const jsonData = {
      user: {
        name: 'John Doe',
        email: 'john@example.com',
        settings: {
          theme: 'dark',
          notifications: {
            email: true,
            push: false,
          },
        },
      },
      items: [1, 2, 3],
    }
    const jsonString = JSON.stringify(jsonData)
    const gzippedBuffer = Buffer.from(gzip(jsonString))

    const context = createLoaderContext()
    const result = jsonGzLoader.call(context, gzippedBuffer)

    const jsonMatch = result.match(/export default ([\s\S]+);$/)
    const loadedData = JSON.parse(jsonMatch[1])

    expect(loadedData).toEqual(jsonData)
    expect(loadedData.user.settings.notifications.email).toBe(true)
  })

  it('should call cacheable', () => {
    const jsonData = { test: 'data' }
    const jsonString = JSON.stringify(jsonData)
    const gzippedBuffer = Buffer.from(gzip(jsonString))

    const context = createLoaderContext()

    jsonGzLoader.call(context, gzippedBuffer)

    expect(context.cacheable).toHaveBeenCalled()
  })

  it('should handle when cacheable is not available', () => {
    const jsonData = { name: 'Test', value: 123 }
    const jsonString = JSON.stringify(jsonData)
    const gzippedBuffer = Buffer.from(gzip(jsonString))

    const context = createLoaderContext()

    delete context.cacheable

    const result = jsonGzLoader.call(context, gzippedBuffer)

    expect(result).toBeDefined()

    const jsonMatch = result.match(/export default ([\s\S]+);$/)
    const loadedData = JSON.parse(jsonMatch[1])

    expect(loadedData).toEqual(jsonData)
  })

  it('should emit error on invalid gzip data', () => {
    const invalidBuffer = Buffer.from('not gzipped data')

    const context = createLoaderContext()
    const result = jsonGzLoader.call(context, invalidBuffer)

    expect(context.emitError).toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('should emit error on invalid JSON after decompression', () => {
    const invalidJson = 'not valid json { unclosed'
    const gzippedBuffer = Buffer.from(gzip(invalidJson))

    const context = createLoaderContext()
    const result = jsonGzLoader.call(context, gzippedBuffer)

    expect(context.emitError).toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('should handle empty JSON object', () => {
    const jsonData = {}
    const jsonString = JSON.stringify(jsonData)
    const gzippedBuffer = Buffer.from(gzip(jsonString))

    const context = createLoaderContext()
    const result = jsonGzLoader.call(context, gzippedBuffer)

    const jsonMatch = result.match(/export default ([\s\S]+);$/)
    const loadedData = JSON.parse(jsonMatch[1])

    expect(loadedData).toEqual({})
  })

  it('should handle empty JSON array', () => {
    const jsonData = []
    const jsonString = JSON.stringify(jsonData)
    const gzippedBuffer = Buffer.from(gzip(jsonString))

    const context = createLoaderContext()
    const result = jsonGzLoader.call(context, gzippedBuffer)

    const jsonMatch = result.match(/export default ([\s\S]+);$/)
    const loadedData = JSON.parse(jsonMatch[1])

    expect(Array.isArray(loadedData)).toBe(true)
    expect(loadedData).toHaveLength(0)
  })

  it('should handle JSON with null values', () => {
    const jsonData = { name: 'Test', value: null, optional: undefined }
    const jsonString = JSON.stringify(jsonData)
    const gzippedBuffer = Buffer.from(gzip(jsonString))

    const context = createLoaderContext()
    const result = jsonGzLoader.call(context, gzippedBuffer)

    const jsonMatch = result.match(/export default ([\s\S]+);$/)
    const loadedData = JSON.parse(jsonMatch[1])

    // @note undefined values are not serialized in JSON
    expect(loadedData).toEqual({ name: 'Test', value: null })
  })

  it('should handle JSON with special characters', () => {
    const jsonData = {
      text: 'Hello "World" with \n newlines and \t tabs',
      unicode: '你好世界 🌍',
      symbols: '!@#$%^&*()',
    }
    const jsonString = JSON.stringify(jsonData)
    const gzippedBuffer = Buffer.from(gzip(jsonString))

    const context = createLoaderContext()
    const result = jsonGzLoader.call(context, gzippedBuffer)

    const jsonMatch = result.match(/export default ([\s\S]+);$/)
    const loadedData = JSON.parse(jsonMatch[1])

    expect(loadedData).toEqual(jsonData)
  })

  it('should handle large JSON data', () => {
    // create a large JSON object
    const jsonData = {
      items: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: `Description for item ${i}`,
        metadata: {
          created: new Date().toISOString(),
          tags: [`tag-${i}`, `category-${i % 10}`],
        },
      })),
    }
    const jsonString = JSON.stringify(jsonData)
    const gzippedBuffer = Buffer.from(gzip(jsonString))

    const context = createLoaderContext()
    const result = jsonGzLoader.call(context, gzippedBuffer)

    const jsonMatch = result.match(/export default ([\s\S]+);$/)
    const loadedData = JSON.parse(jsonMatch[1])

    expect(loadedData.items).toHaveLength(1000)
    expect(loadedData.items[500].id).toBe(500)
  })

  it('should verify raw flag is set', () => {
    // @note webpack needs to know this loader expects raw buffer input
    expect(jsonGzLoader.raw).toBe(true)
  })

  it('should load a realistic gzipped JSON file with nested data', () => {
    const testData = {
      name: 'Test Data',
      items: [
        { id: 1, value: 'Item 1' },
        { id: 2, value: 'Item 2' },
        { id: 3, value: 'Item 3' },
      ],
      metadata: {
        version: '1.0',
        timestamp: '2025-01-09T00:00:00Z',
      },
    }

    const jsonString = JSON.stringify(testData)
    const gzippedBuffer = Buffer.from(gzip(jsonString))

    const context = createLoaderContext()
    const result = jsonGzLoader.call(context, gzippedBuffer)

    expect(result).toBeDefined()
    expect(result).toMatch(/^export default /)

    const jsonMatch = result.match(/export default ([\s\S]+);$/)
    const loadedData = JSON.parse(jsonMatch[1])

    expect(loadedData).toEqual(testData)
    expect(context.emitError).not.toHaveBeenCalled()
  })

  it('should handle deeply nested JSON structures', () => {
    const testData = {
      test: true,
      numbers: [1, 2, 3, 4, 5],
      nested: {
        deep: {
          value: 'deeply nested',
        },
      },
    }

    const jsonString = JSON.stringify(testData)
    const gzippedBuffer = Buffer.from(gzip(jsonString))

    const context = createLoaderContext()
    const result = jsonGzLoader.call(context, gzippedBuffer)

    const jsonMatch = result.match(/export default ([\s\S]+);$/)
    const loadedData = JSON.parse(jsonMatch[1])

    expect(loadedData).toEqual(testData)
  })
})
