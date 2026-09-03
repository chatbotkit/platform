import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import {
  createOpenApiHandlers,
  executeTemplate,
  setupServer,
} from '@/jest/utils/ability'

import templates from './tally'

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

// @note tally provides an official OpenAPI spec at this URL
const DEFINITION = 'https://api.tally.so/openapi.json'

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
    const response = await fetch('https://api.tally.so/forms', {
      headers: {
        Authorization: 'Bearer YOUR_ACCESS_TOKEN',
      },
    })

    expect(response.status).toBe(200)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch(
      'https://api.tally.so/invalid-endpoint-that-does-not-exist',
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

  beforeEach(() => {
    fastGetUserById.mockResolvedValue(user)
    accountLimitsOk.mockResolvedValue(true)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const untestableTemplates = ['tally/api/call']

  const testableTemplates = Object.keys(templates).filter(
    (template) =>
      !template.startsWith('pack') && !untestableTemplates.includes(template)
  )

  it.each(testableTemplates)(`testing template %s`, async (template) => {
    const { error } = await executeTemplate(user, template, {
      /**
       * Processes generated input to ensure Tally-specific field formats are
       * valid. Ensures that numeric parameters like page and limit are within
       * valid ranges as specified by the Tally API.
       *
       * @param {Object} input - The generated input object
       * @returns {Object} The processed input with valid Tally field formats
       */
      processInput: (input) => {
        // @note ensure page is a positive integer
        if (input.page !== undefined) {
          input.page = Math.max(1, Math.abs(Math.floor(input.page)))
        }

        // @note ensure limit is between 1 and 500 as per Tally API spec
        if (input.limit !== undefined) {
          input.limit = Math.max(
            1,
            Math.min(500, Math.abs(Math.floor(input.limit)))
          )
        }

        // @note ensure formId is a valid string format
        if (input.formId !== undefined && typeof input.formId !== 'string') {
          input.formId = String(input.formId)
        }

        // @note ensure workspaceId is a valid string format
        if (
          input.workspaceId !== undefined &&
          typeof input.workspaceId !== 'string'
        ) {
          input.workspaceId = String(input.workspaceId)
        }

        // @note ensure organizationId is a valid string format
        if (
          input.organizationId !== undefined &&
          typeof input.organizationId !== 'string'
        ) {
          input.organizationId = String(input.organizationId)
        }

        // @note ensure webhookId is a valid string format
        if (
          input.webhookId !== undefined &&
          typeof input.webhookId !== 'string'
        ) {
          input.webhookId = String(input.webhookId)
        }

        // @note ensure submissionId is a valid string format
        if (
          input.submissionId !== undefined &&
          typeof input.submissionId !== 'string'
        ) {
          input.submissionId = String(input.submissionId)
        }

        // @note ensure date fields are valid ISO 8601 strings
        if (
          input.startDate !== undefined &&
          !/^\d{4}-\d{2}-\d{2}/.test(input.startDate)
        ) {
          input.startDate = new Date().toISOString().split('T')[0]
        }

        if (
          input.endDate !== undefined &&
          !/^\d{4}-\d{2}-\d{2}/.test(input.endDate)
        ) {
          input.endDate = new Date().toISOString().split('T')[0]
        }

        // @note ensure afterId is a valid string format
        if (input.afterId !== undefined && typeof input.afterId !== 'string') {
          input.afterId = String(input.afterId)
        }

        return input
      },
    })

    expect(error).toBeUndefined()

    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})
