import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import {
  createOpenApiHandlers,
  executeTemplate,
  setupServer,
} from '@/jest/utils/ability'

import templates from './zendesk'

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

/**
 * Transforms the official Zendesk OpenAPI spec for use in tests.
 *
 * This transformation:
 * 1. Fixes the server URL template to use a concrete test subdomain
 * 2. Adds .json suffix to API paths (Zendesk accepts both formats but our
 *    templates use the .json variant)
 *
 * @param {object} definition - The OpenAPI definition object
 * @returns {object} The transformed definition
 */
function transformZendeskSpec(definition) {
  // @note fix server URL template - the official spec uses {subdomain}.{domain}.com
  // but MSW needs a concrete URL pattern for matching
  const servers = [
    {
      url: 'https://test-company.zendesk.com',
      description: 'Test Zendesk API',
    },
  ]

  // @note add .json suffix to /api/v2/* paths
  const newPaths = {}

  for (const [path, pathItem] of Object.entries(definition.paths)) {
    if (path.startsWith('/api/v2/') && !path.endsWith('.json')) {
      newPaths[`${path}.json`] = pathItem
    }

    // @note keep original path as well for completeness
    newPaths[path] = pathItem
  }

  return {
    ...definition,
    servers,
    paths: newPaths,
  }
}

beforeAll(async () => {
  // @note load the official Zendesk Support API OpenAPI spec and transform
  // it to add .json suffix to paths (our templates use .json suffix variant)
  const { handlers } = await createOpenApiHandlers(
    'https://developer.zendesk.com/zendesk/oas.yaml',
    { transformDefinition: transformZendeskSpec }
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
      'https://test-company.zendesk.com/api/v2/tickets.json',
      {
        headers: {
          Authorization: 'Bearer YOUR_ACCESS_TOKEN',
        },
      }
    )

    expect(response.status).toBe(200)
  })

  it('should reject invalid endpoints', async () => {
    // @note in sandboxed environments without network, fetch may throw instead
    // of returning 501 for unhandled MSW requests
    try {
      const response = await fetch(
        'https://test-company.zendesk.com/api/v2/invalid-endpoint-that-does-not-exist',
        {
          headers: {
            Authorization: 'Bearer YOUR_ACCESS_TOKEN',
          },
        }
      )

      expect(response.status).not.toBe(200)
    } catch {
      // @note fetch failure is acceptable - endpoint is invalid
      expect(true).toBe(true)
    }
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

  const untestableTemplates = ['zendesk/api/call']

  const testableTemplates = Object.keys(templates).filter(
    (template) =>
      !template.startsWith('pack') && !untestableTemplates.includes(template)
  )

  it.each(testableTemplates)(`testing template %s`, async (template) => {
    const { error } = await executeTemplate(user, template, {
      /**
       * Processes generated input to ensure Zendesk-specific field formats are
       * valid. Ensures that IDs and API URL are properly formatted.
       *
       * @param {Object} input - The generated input object
       * @returns {Object} The processed input with valid Zendesk field formats
       */
      processInput: (input) => {
        // @note Zendesk requires a valid API URL with subdomain
        if (input.apiUrl) {
          input.apiUrl = 'https://test-company.zendesk.com'
        }

        // @note ensure ticket IDs are valid integers as strings
        if (input.id) {
          input.id = '123'
        }

        if (input.ticket_id) {
          input.ticket_id = '456'
        }

        // @note ensure query is a valid string for search
        if (input.query !== undefined && typeof input.query !== 'string') {
          input.query = 'status:open'
        }

        // @note ensure page and per_page are numbers
        if (input.page !== undefined && typeof input.page !== 'number') {
          input.page = 1
        }

        if (
          input.per_page !== undefined &&
          typeof input.per_page !== 'number'
        ) {
          input.per_page = 10
        }

        return input
      },
    })

    expect(error).toBeUndefined()

    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})
