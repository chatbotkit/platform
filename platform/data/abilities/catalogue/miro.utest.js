import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import {
  createOpenApiHandlers,
  executeTemplate,
  setupServer,
} from '@/jest/utils/ability'

import templates from './miro'

jest.mock('@/lib/usage.record', () => ({
  recordFetchUsage: jest.fn(),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

jest.mock('@/lib/limit.core', () => {
  const originalModule = jest.requireActual('@/lib/limit.core')

  return {
    ...originalModule,

    accountLimitsOk: jest.fn(),
  }
})

jest.mock('@/lib/extract.data', () => ({
  extractDataFromInput: jest.fn(),
}))

jest.retryTimes(3)

const DEFINITION =
  'https://raw.githubusercontent.com/miroapp/api-clients/refs/heads/main/packages/generator/spec.json'

const server = setupServer()

beforeAll(async () => {
  const { handlers } = await createOpenApiHandlers(DEFINITION, {
    // @note we must add missing component/responses because of a bug in the
    // published schema
    // @see https://github.com/miroapp/api-clients/issues/447

    transformDefinition: (definition) => {
      definition.components ??= {}
      definition.components.responses ??= {}

      for (const code of ['400', '401', '403', '404', '429', '500']) {
        const descriptions = {
          400: 'Bad Request',
          401: 'Unauthorized',
          403: 'Forbidden',
          404: 'Not Found',
          429: 'Too Many Requests',
          500: 'Internal Server Error',
        }

        const errorSchemas = {
          400: 'Error400',
          401: 'Error401',
          403: 'Error403',
          404: 'Error404',
          429: 'Error429',
          500: 'Error',
        }

        definition.components.responses[code] ??= {
          description: descriptions[code],
          content: {
            'application/json': {
              schema: {
                $ref: `#/components/schemas/${errorSchemas[code]}`,
              },
            },
          },
        }
      }

      return definition
    },
  })

  server.use(...handlers)

  server.listen()
})

afterAll(async () => {
  server.close()
})

describe('litmus tests', () => {
  it('should accept valid endpoints', async () => {
    const response = await fetch(
      'https://api.miro.com/v2/boards/o9J_k1JKioQ=',
      {
        headers: {
          Authorization: 'Bearer YOUR_ACCESS_TOKEN',
        },
      }
    )

    expect(response.status).toBe(200)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch(
      'https://api.miro.com/v2/invalid-endpoint-that-does-not-exist',
      {
        headers: {
          Authorization: 'Bearer YOUR_ACCESS_TOKEN',
        },
      }
    )

    expect(response.status).not.toBe(200)
  })
})

describe('templates', () => {
  const user = {
    id: 'user-123',
  }

  const untestableTemplates = ['miro/api/call']

  beforeEach(() => {
    fastGetUserById.mockResolvedValue(user)
    accountLimitsOk.mockResolvedValue(true)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it.each(
    Object.keys(templates).filter(
      (template) =>
        !template.startsWith('pack') && !untestableTemplates.includes(template)
    )
  )(`testing template %s`, async (template) => {
    const { error } = await executeTemplate(user, template)

    expect(error).toBeUndefined()

    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})
