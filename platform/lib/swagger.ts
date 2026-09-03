import { join } from 'path'
import swaggerJsdoc from 'swagger-jsdoc'

interface SwaggerDefinition {
  openapi: string
  info: {
    title: string
    version: string
    description?: string
  }
  [key: string]: unknown
}

interface SwaggerOptions {
  apiFolder?: string
  schemaFolders?: string[]
  definition?: SwaggerDefinition
  [key: string]: unknown
}

interface SwaggerSpec {
  openapi: string
  info: {
    title: string
    version: string
    description?: string
  }
  paths?: Record<string, unknown>
  components?: Record<string, unknown>
  [key: string]: unknown
}

const defaultOptions: SwaggerOptions = {
  apiFolder: 'pages/api',

  schemaFolders: [],

  definition: {
    openapi: '3.0.0',

    info: {
      title: 'Next Swagger Doc Demo Api',
      version: '1.0',
    },
  },
}

/**
 * Generates an OpenAPI/Swagger specification by scanning API routes and schema
 * folders for JSDoc annotations and swagger.yaml files. Supports both source
 * and build directories for Next.js applications.
 */
export function createSwaggerSpec({
  apiFolder = 'pages/api',

  schemaFolders = [],

  ...swaggerOptions
}: SwaggerOptions = defaultOptions): SwaggerSpec {
  const scanFolders = [apiFolder, ...schemaFolders]

  const apis = scanFolders.flatMap((folder) => {
    const apiDirectory = join(process.cwd(), folder)
    const publicDirectory = join(process.cwd(), 'public')

    const buildApiDirectory = join(process.cwd(), '.next/server', folder)
    // const buildChunksDirectory = join(process.cwd(), '.next/server', 'chunks')

    const fileTypes = ['ts', 'tsx', 'jsx', 'js', 'json', 'swagger.yaml']

    // @todo only include folder based on environment

    return [
      // scan the api directory for all files

      ...fileTypes.map((fileType) => `${apiDirectory}/**/*.${fileType}`),

      // only scan build directory for *.swagger.yaml and *.js files

      ...['js', 'swagger.yaml', 'json'].map(
        (fileType) => `${buildApiDirectory}/**/*.${fileType}`
      ),

      // support load static files from public directory

      ...['swagger.yaml', 'json'].map(
        (fileType) => `${publicDirectory}/**/*.${fileType}`
      ),

      // scan the chunks

      // ...['js'].map((fileType) => `${buildChunksDirectory}/*.${fileType}`),
    ]
  })

  const options = {
    apis,

    ...swaggerOptions,
  }

  let spec = swaggerJsdoc(options) as SwaggerSpec

  // @todo fix this hack
  {
    spec = JSON.parse(JSON.stringify(spec).replace(/any\/any/g, '*/*'))
  }

  return spec
}
