import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import {
  createOpenApiHandlers,
  executeTemplate,
  setupServer,
} from '@/jest/utils/ability'

import templates from './airtable'

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
  // @note load the local OpenAPI spec file since Airtable doesn't publish
  // an official OpenAPI specification
  const { handlers } = await createOpenApiHandlers(
    join(__dirname, 'airtable.openapi.yaml')
  )

  server.use(...handlers)

  server.listen()
})

afterAll(async () => {
  server.close()
})

describe('litmus tests', () => {
  it('should accept valid endpoints', async () => {
    const response = await fetch('https://api.airtable.com/v0/meta/bases', {
      headers: {
        Authorization: 'Bearer YOUR_ACCESS_TOKEN',
      },
    })

    expect(response.status).toBe(200)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch(
      'https://api.airtable.com/v0/invalid-endpoint-that-does-not-exist',
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

  // @note filter out templates that cannot be tested with OpenAPI mocking

  const untestableTemplates = [
    'airtable/api/call',
  ]

  const testableTemplates = Object.keys(templates).filter(
    (template) =>
      !template.startsWith('pack') && !untestableTemplates.includes(template)
  )

  it.each(testableTemplates)(`testing template %s`, async (template) => {
    const { error } = await executeTemplate(user, template, {
      /**
       * Processes generated input to ensure Airtable-specific field formats are
       * valid. Ensures that IDs and optional object fields are properly
       * formatted.
       *
       * @param {Object} input - The generated input object
       * @returns {Object} The processed input with valid Airtable field formats
       */
      processInput: (input) => {
        // @note Airtable requires specific ID formats

        if (input.baseId) {
          input.baseId = 'app123'
        }

        if (input.tableId) {
          input.tableId = 'tbl123'
        }

        if (input.recordId) {
          input.recordId = 'rec123'
        }

        if (input.fieldId) {
          input.fieldId = 'fld123'
        }

        // @note ensure recordIds is a simple string for batch delete

        if (input.recordIds) {
          input.recordIds = 'rec123,rec456'
        }

        // @note ensure options field is a valid JSON object if present

        if (input.options !== undefined && typeof input.options !== 'object') {
          input.options = {}
        }

        // @note ensure fields is a valid JSON object if present

        if (input.fields !== undefined && typeof input.fields !== 'object') {
          input.fields = { Name: 'Test' }
        }

        // @note ensure records is a valid array if present

        if (input.records !== undefined && !Array.isArray(input.records)) {
          input.records = [{ fields: { Name: 'Test' } }]
        }

        return input
      },
    })

    expect(error).toBeUndefined()

    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})
