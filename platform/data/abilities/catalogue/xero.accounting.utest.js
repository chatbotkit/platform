import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import {
  createOpenApiHandlers,
  executeTemplate,
  setupServer,
} from '@/jest/utils/ability'

import templates from './xero.accounting'

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
  'https://raw.githubusercontent.com/XeroAPI/Xero-OpenAPI/master/xero_accounting.yaml'

const server = setupServer()

beforeAll(async () => {
  const { handlers } = await createOpenApiHandlers(DEFINITION, {
    transformDefinition: (definition) => {
      // @note Fix malformed server URL in the YAML (appears on one line with description)

      if (definition.servers?.[0]?.url) {
        // Extract the actual URL if it contains extra text
        const url = definition.servers[0].url

        if (url.includes('https://api.xero.com')) {
          definition.servers[0].url = 'https://api.xero.com/api.xro/2.0'
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
  it('should accept valid Xero API endpoints', async () => {
    const response = await fetch(
      'https://api.xero.com/api.xro/2.0/Organisation',
      {
        headers: {
          Authorization: 'Bearer test-token',
          'Xero-Tenant-Id': 'test-tenant-id',
        },
      }
    )

    expect(response.status).toBe(200)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch(
      'https://api.xero.com/api.xro/2.0/invalid-endpoint-that-does-not-exist',
      {
        headers: {
          Authorization: 'Bearer test-token',
          'Xero-Tenant-Id': 'test-tenant-id',
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

  // @note auxiliary templates use different routing, not testable via OpenAPI mocking
  const untestableTemplates = [
    'xero/accounting/sql/exec', // Uses auxiliary route, not direct API call
  ]

  const testableTemplates = Object.keys(templates).filter(
    (t) => !t.startsWith('pack') && !untestableTemplates.includes(t)
  )

  it.each(testableTemplates)('testing template %s', async (template) => {
    const { error } = await executeTemplate(user, template)

    expect(error).toBeUndefined()

    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})
