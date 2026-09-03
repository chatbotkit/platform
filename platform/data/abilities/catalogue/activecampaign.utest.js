import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import {
  createOpenApiHandlers,
  executeTemplate,
  setupServer,
} from '@/jest/utils/ability'

import templates from './activecampaign'

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

const server = setupServer()

beforeAll(async () => {
  // @note load the local OpenAPI spec file since ActiveCampaign doesn't publish
  // an official OpenAPI specification that's easily accessible
  const { handlers } = await createOpenApiHandlers(
    join(__dirname, 'activecampaign.openapi.yaml')
  )

  server.use(...handlers)

  server.listen()
})

afterAll(async () => {
  server.close()
})

describe('litmus tests', () => {
  it('should accept valid endpoints', async () => {
    const response = await fetch(
      'https://yourname.api-us1.com/api/3/contacts',
      {
        headers: {
          'Api-Token': 'YOUR_API_KEY',
        },
      }
    )

    expect(response.status).toBe(200)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch(
      'https://yourname.api-us1.com/api/3/invalid-endpoint-that-does-not-exist',
      {
        headers: {
          'Api-Token': 'YOUR_API_KEY',
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

  // @note filter out templates that cannot be tested with OpenAPI mocking

  const untestableTemplates = [
    'activecampaign/api/call',
  ]

  const testableTemplates = Object.keys(templates).filter(
    (template) =>
      !template.startsWith('pack') && !untestableTemplates.includes(template)
  )

  it.each(testableTemplates)(`testing template %s`, async (template) => {
    const { error } = await executeTemplate(user, template, {
      /**
       * Processes generated input to ensure ActiveCampaign-specific field
       * formats are valid. Ensures that IDs and API URL are properly formatted.
       *
       * @param {Object} input - The generated input object
       * @returns {Object} The processed input with valid ActiveCampaign field formats
       */
      processInput: (input) => {
        // @note ActiveCampaign requires a valid API URL
        if (input.apiUrl) {
          input.apiUrl = 'https://yourname.api-us1.com'
        }

        // @note ensure IDs are valid strings
        if (input.contactId) {
          input.contactId = '123'
        }

        if (input.dealId) {
          input.dealId = '456'
        }

        if (input.tagId) {
          input.tagId = '789'
        }

        if (input.accountId) {
          input.accountId = '101'
        }

        if (input.contactTagId) {
          input.contactTagId = '202'
        }

        // @note ensure email is valid format
        if (input.email !== undefined && typeof input.email !== 'string') {
          input.email = 'test@example.com'
        }

        // @note ensure value is a number for deals
        if (input.value !== undefined && typeof input.value !== 'number') {
          input.value = 10000
        }

        // @note ensure limit is a number
        if (input.limit !== undefined && typeof input.limit !== 'number') {
          input.limit = 20
        }

        return input
      },
    })

    expect(error).toBeUndefined()

    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})
