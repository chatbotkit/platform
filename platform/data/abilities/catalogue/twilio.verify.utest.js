import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import {
  createOpenApiHandlers,
  executeTemplate,
  setupServer,
} from '@/jest/utils/ability'

import templates from './twilio.verify'

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
  'https://api.apis.guru/v2/specs/twilio.com/twilio_verify_v2/1.42.0/openapi.json'

const server = setupServer()

beforeAll(async () => {
  const { handlers } = await createOpenApiHandlers(DEFINITION, {
    // @note Twilio uses application/x-www-form-urlencoded for POST requests
    // Ensure the OpenAPI spec properly handles this content type
    transformDefinition: (definition) => {
      for (const path in definition.paths) {
        for (const method in definition.paths[path]) {
          const operation = definition.paths[path][method]

          if (operation.requestBody?.content) {
            const content = operation.requestBody.content

            // If form-urlencoded is present, ensure it has a schema
            if (content['application/x-www-form-urlencoded']) {
              if (!content['application/x-www-form-urlencoded'].schema) {
                content['application/x-www-form-urlencoded'].schema = {
                  type: 'object',
                  properties: {},
                }
              }
            }
          }
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
  it('should accept valid Twilio Verify endpoints', async () => {
    const response = await fetch(
      'https://verify.twilio.com/v2/Services/VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/Verifications',
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic dGVzdDp0ZXN0',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'To=%2B15108675310&Channel=sms',
      }
    )

    expect(response.status).toBe(201)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch(
      'https://verify.twilio.com/invalid-endpoint-that-does-not-exist',
      {
        headers: {
          Authorization: 'Basic dGVzdDp0ZXN0',
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

  /**
   * Processes generated input to ensure Twilio-specific field formats are valid.
   *
   * @param {Object} input - The generated input object
   * @returns {Object} The processed input with valid Twilio field formats
   */
  const processTwilioInput = (input) => {
    if (input.serviceSid) {
      input.serviceSid = 'VA123'
    }

    if (input.to) {
      input.to = '+15108675310'
    }

    return input
  }

  const testableTemplates = Object.keys(templates).filter(
    (template) => !template.startsWith('pack')
  )

  it.each(testableTemplates)(`testing template %s`, async (template) => {
    const { error } = await executeTemplate(user, template, {
      processInput: processTwilioInput,
    })

    expect(error).toBeUndefined()

    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})
