import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import {
  createOpenApiHandlers,
  executeTemplate,
  setupServer,
} from '@/jest/utils/ability'

import templates from './vapi'

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

const DEFINITION = 'https://api.vapi.ai/api-json'

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
  it('should accept valid Vapi outbound call endpoint', async () => {
    const response = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-api-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistantId: 'assistant_123',
        phoneNumberId: 'phone_123',
        customer: {
          number: '+15551234567',
        },
      }),
    })

    expect(response.status).toBe(201)
  })

  it('should accept valid Vapi outbound batch call endpoint', async () => {
    const response = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-api-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistantId: 'assistant_123',
        phoneNumberId: 'phone_123',
        customers: [{ number: '+15551234567' }, { number: '+15557654321' }],
      }),
    })

    expect(response.status).toBe(201)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch(
      'https://api.vapi.ai/invalid-endpoint-that-does-not-exist',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
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

  it.each(
    Object.keys(templates).filter((template) => !template.startsWith('pack'))
  )('testing template %s', async (template) => {
    const { error } = await executeTemplate(user, template, {
      processInput: (input) => {
        if (input.method) {
          input.method = 'POST'
        }

        if (input.url) {
          input.url = 'https://api.vapi.ai/call'
        }

        if (Object.prototype.hasOwnProperty.call(input, 'body')) {
          input.body = JSON.stringify({
            assistantId: 'assistant_123',
            phoneNumberId: 'phone_123',
            customer: {
              number: '+15551234567',
            },
          })
        }

        if (input.assistantId) {
          input.assistantId = 'assistant_123'
        }

        if (input.phoneNumberId) {
          input.phoneNumberId = 'phone_123'
        }

        if (input.customer) {
          input.customer = {
            number: '+15551234567',
            name: 'Alex Doe',
          }
        }

        if (input.customers) {
          input.customers = [
            {
              number: '+15551234567',
              name: 'Alex Doe',
            },
            {
              number: '+15557654321',
              name: 'Taylor Doe',
            },
          ]
        }

        if (input.schedulePlan) {
          input.schedulePlan = {
            earliestAt: '2026-04-15T00:00:00Z',
          }
        }

        return input
      },
    })

    expect(error).toBeUndefined()

    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})
