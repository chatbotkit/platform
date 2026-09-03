import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import {
  createOpenApiHandlers,
  executeTemplate,
  setupServer,
} from '@/jest/utils/ability'

import templates from './devto'

import { join } from 'path'

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

// @note load the local OpenAPI spec file
const DEFINITION = join(__dirname, 'devto.openapi.yaml')

const server = setupServer()

beforeAll(async () => {
  const { handlers } = await createOpenApiHandlers(DEFINITION)

  server.use(...handlers)

  server.listen()
})

afterAll(async () => {
  server.close()
})

describe('litmus tests', () => {
  it('should accept valid endpoints', async () => {
    const response = await fetch('https://dev.to/api/articles', {
      headers: {
        'api-key': 'YOUR_API_KEY',
      },
    })

    expect(response.status).toBe(200)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch(
      'https://dev.to/api/invalid-endpoint-that-does-not-exist',
      {
        headers: {
          'api-key': 'YOUR_API_KEY',
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

  beforeEach(() => {
    fastGetUserById.mockResolvedValue(user)
    accountLimitsOk.mockResolvedValue(true)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // @note these templates cannot be tested with OpenAPI mocking
  const untestableTemplates = [
    'devto/article/get', // requires existing article ID
    'devto/user/get', // requires existing username
    'devto/me/articles', // requires authentication
    'devto/api/call',
  ]

  const testableTemplates = Object.keys(templates).filter(
    (template) =>
      !template.startsWith('pack') && !untestableTemplates.includes(template)
  )

  it.each(testableTemplates)(`testing template %s`, async (template) => {
    // @note processInput allows us to provide specific values for parameters
    // that need to match the OpenAPI spec expectations
    const options = {
      processInput: (input) => {
        // @note for article/list, omit optional tag/username params since
        // faker-generated values (lorem ipsum phrases with spaces) cause MSW
        // to forward the request to the real API which returns 404
        if (template === 'devto/article/list') {
          return {
            page: 1,
            perPage: 30,
          }
        }

        if (template === 'devto/article/search') {
          return {
            ...input,
            query: 'javascript',
            page: 1,
          }
        }

        return input
      },
    }

    const { error } = await executeTemplate(user, template, options)

    expect(error).toBeUndefined()

    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})
