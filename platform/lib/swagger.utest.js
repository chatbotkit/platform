import { createSwaggerSpec } from './swagger'

import { join } from 'path'
import swaggerJsdoc from 'swagger-jsdoc'

jest.mock('swagger-jsdoc')

describe('createSwaggerSpec', () => {
  const originalCwd = process.cwd()

  beforeEach(() => {
    jest.clearAllMocks()
    swaggerJsdoc.mockReturnValue({
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0' },
      paths: {},
    })
  })

  describe('basic functionality', () => {
    it('should create spec with default options', () => {
      createSwaggerSpec()

      expect(swaggerJsdoc).toHaveBeenCalledWith({
        apis: expect.any(Array),
        definition: {
          openapi: '3.0.0',
          info: {
            title: 'Next Swagger Doc Demo Api',
            version: '1.0',
          },
        },
      })
    })

    it('should return swagger spec object', () => {
      const result = createSwaggerSpec()

      expect(result).toHaveProperty('openapi', '3.0.0')
      expect(result).toHaveProperty('info')
      expect(result).toHaveProperty('paths')
    })

    it('should use custom apiFolder', () => {
      createSwaggerSpec({ apiFolder: 'custom/api' })

      const call = swaggerJsdoc.mock.calls[0][0]
      const apis = call.apis

      expect(apis.some((path) => path.includes('custom/api'))).toBe(true)
    })

    it('should include custom schemaFolders', () => {
      createSwaggerSpec({
        apiFolder: 'pages/api',
        schemaFolders: ['schemas', 'types'],
      })

      const call = swaggerJsdoc.mock.calls[0][0]
      const apis = call.apis

      expect(apis.some((path) => path.includes('schemas'))).toBe(true)
      expect(apis.some((path) => path.includes('types'))).toBe(true)
    })

    it('should pass through custom swagger options', () => {
      createSwaggerSpec({
        definition: {
          openapi: '3.1.0',
          info: {
            title: 'Custom API',
            version: '2.0',
          },
        },
      })

      const call = swaggerJsdoc.mock.calls[0][0]

      expect(call.definition.openapi).toBe('3.1.0')
      expect(call.definition.info.title).toBe('Custom API')
    })
  })

  describe('file path scanning', () => {
    it('should scan api directory for all supported file types', () => {
      createSwaggerSpec({ apiFolder: 'pages/api' })

      const call = swaggerJsdoc.mock.calls[0][0]
      const apis = call.apis
      const apiDirectory = join(originalCwd, 'pages/api')

      expect(apis).toContain(`${apiDirectory}/**/*.ts`)
      expect(apis).toContain(`${apiDirectory}/**/*.tsx`)
      expect(apis).toContain(`${apiDirectory}/**/*.jsx`)
      expect(apis).toContain(`${apiDirectory}/**/*.js`)
      expect(apis).toContain(`${apiDirectory}/**/*.json`)
      expect(apis).toContain(`${apiDirectory}/**/*.swagger.yaml`)
    })

    it('should scan build directory for specific file types', () => {
      createSwaggerSpec({ apiFolder: 'pages/api' })

      const call = swaggerJsdoc.mock.calls[0][0]
      const apis = call.apis
      const buildDirectory = join(originalCwd, '.next/server/pages/api')

      expect(apis).toContain(`${buildDirectory}/**/*.js`)
      expect(apis).toContain(`${buildDirectory}/**/*.swagger.yaml`)
      expect(apis).toContain(`${buildDirectory}/**/*.json`)
    })

    it('should scan public directory for static files', () => {
      createSwaggerSpec({ apiFolder: 'pages/api' })

      const call = swaggerJsdoc.mock.calls[0][0]
      const apis = call.apis
      const publicDirectory = join(originalCwd, 'public')

      expect(apis).toContain(`${publicDirectory}/**/*.swagger.yaml`)
      expect(apis).toContain(`${publicDirectory}/**/*.json`)
    })

    it('should include all schema folders in scan', () => {
      createSwaggerSpec({
        apiFolder: 'pages/api',
        schemaFolders: ['schemas', 'models', 'types'],
      })

      const call = swaggerJsdoc.mock.calls[0][0]
      const apis = call.apis

      const schemasDir = join(originalCwd, 'schemas')
      const modelsDir = join(originalCwd, 'models')
      const typesDir = join(originalCwd, 'types')

      expect(apis.some((path) => path.includes(schemasDir))).toBe(true)
      expect(apis.some((path) => path.includes(modelsDir))).toBe(true)
      expect(apis.some((path) => path.includes(typesDir))).toBe(true)
    })
  })

  describe('content type hack', () => {
    it('should replace any/any with */* in spec', () => {
      swaggerJsdoc.mockReturnValue({
        openapi: '3.0.0',
        paths: {
          '/test': {
            post: {
              requestBody: {
                content: {
                  'any/any': {
                    schema: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      })

      const result = createSwaggerSpec()

      expect(result.paths['/test'].post.requestBody.content).toHaveProperty(
        '*/*'
      )
      expect(result.paths['/test'].post.requestBody.content).not.toHaveProperty(
        'any/any'
      )
    })

    it('should handle multiple any/any occurrences', () => {
      swaggerJsdoc.mockReturnValue({
        openapi: '3.0.0',
        paths: {
          '/test1': {
            post: {
              requestBody: {
                content: {
                  'any/any': { schema: {} },
                },
              },
            },
          },
          '/test2': {
            get: {
              responses: {
                200: {
                  content: {
                    'any/any': { schema: {} },
                  },
                },
              },
            },
          },
        },
      })

      const result = createSwaggerSpec()

      expect(result.paths['/test1'].post.requestBody.content).toHaveProperty(
        '*/*'
      )
      expect(
        result.paths['/test2'].get.responses['200'].content
      ).toHaveProperty('*/*')
    })

    it('should preserve valid content types', () => {
      swaggerJsdoc.mockReturnValue({
        openapi: '3.0.0',
        paths: {
          '/test': {
            post: {
              requestBody: {
                content: {
                  'application/json': { schema: {} },
                  'text/plain': { schema: {} },
                },
              },
            },
          },
        },
      })

      const result = createSwaggerSpec()

      expect(result.paths['/test'].post.requestBody.content).toHaveProperty(
        'application/json'
      )
      expect(result.paths['/test'].post.requestBody.content).toHaveProperty(
        'text/plain'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle empty schemaFolders array', () => {
      const result = createSwaggerSpec({ schemaFolders: [] })

      expect(result).toBeDefined()
      expect(swaggerJsdoc).toHaveBeenCalled()
    })

    it('should handle undefined options', () => {
      const result = createSwaggerSpec(undefined)

      expect(result).toBeDefined()

      const call = swaggerJsdoc.mock.calls[0][0]

      expect(call.apis).toBeDefined()
      expect(call.apis.length).toBeGreaterThan(0)
    })

    it('should handle spec with no paths', () => {
      swaggerJsdoc.mockReturnValue({
        openapi: '3.0.0',
        info: { title: 'Empty API', version: '1.0' },
        paths: {},
      })

      const result = createSwaggerSpec()

      expect(result.paths).toEqual({})
    })

    it('should handle nested any/any in complex structures', () => {
      swaggerJsdoc.mockReturnValue({
        openapi: '3.0.0',
        components: {
          schemas: {
            TestSchema: {
              properties: {
                data: {
                  type: 'string',
                  format: 'any/any',
                },
              },
            },
          },
        },
      })

      const result = createSwaggerSpec()

      expect(result.components.schemas.TestSchema.properties.data.format).toBe(
        '*/*'
      )
    })
  })

  describe('option inheritance', () => {
    it('should merge custom options with defaults', () => {
      createSwaggerSpec({
        apiFolder: 'custom/api',
        customOption: 'value',
      })

      const call = swaggerJsdoc.mock.calls[0][0]

      expect(call.customOption).toBe('value')
      expect(call.apis).toBeDefined()
      expect(call.apis.some((path) => path.includes('custom/api'))).toBe(true)
    })

    it('should override default definition with custom', () => {
      createSwaggerSpec({
        definition: {
          openapi: '3.1.0',
          info: {
            title: 'Override',
            version: '3.0',
            description: 'Custom description',
          },
        },
      })

      const call = swaggerJsdoc.mock.calls[0][0]

      expect(call.definition.openapi).toBe('3.1.0')
      expect(call.definition.info.title).toBe('Override')
      expect(call.definition.info.description).toBe('Custom description')
    })
  })
})
