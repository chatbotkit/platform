import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import {
  createOpenApiHandlers,
  executeTemplate,
  setupServer,
} from '@/jest/utils/ability'

import templates from './serper'

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
  'https://raw.githubusercontent.com/janwilmake/handmade-openapis/d654a271b01c6385ed8de06269ed72f2cca9cafc/serper.json'

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
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': 'test-api-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: 'test query' }),
    })

    expect(response.status).toBe(200)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch(
      'https://google.serper.dev/invalid-endpoint-that-does-not-exist',
      {
        method: 'POST',
        headers: {
          'X-API-KEY': 'test-api-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: 'test query' }),
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

  // @note filter out templates that cannot be tested with OpenAPI mocking
  // the OpenAPI spec at openapisearch.com/openapi/serper is missing /patents
  // and /autocomplete endpoints

  const untestableTemplates = [
    'serper/patent/search', // /patents endpoint not defined in OpenAPI spec
    'serper/autocomplete/search', // /autocomplete endpoint not defined in OpenAPI spec
    'serper/api/call',
  ]

  const testableTemplates = Object.keys(templates).filter(
    (template) =>
      !template.startsWith('pack') && !untestableTemplates.includes(template)
  )

  it.each(testableTemplates)(`testing template %s`, async (template) => {
    const { error } = await executeTemplate(user, template)

    expect(error).toBeUndefined()

    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})
