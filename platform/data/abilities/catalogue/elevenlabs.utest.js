import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import {
  createOpenApiHandlers,
  executeTemplate,
  setupServer,
} from '@/jest/utils/ability'

import templates from './elevenlabs'

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
const DEFINITION = join(__dirname, 'elevenlabs.openapi.yaml')

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
  it('should accept valid ElevenLabs agents endpoint', async () => {
    const response = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
      headers: {
        'xi-api-key': 'test-api-key',
      },
    })

    expect(response.status).toBe(200)
  })

  it('should accept valid SIP trunk outbound call endpoint', async () => {
    const response = await fetch(
      'https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call',
      {
        method: 'POST',
        headers: {
          'xi-api-key': 'test-api-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_id: 'agent_123',
          agent_phone_number_id: 'phone_123',
          to_number: '+15551234567',
        }),
      }
    )

    expect(response.status).toBe(200)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch(
      'https://api.elevenlabs.io/v1/convai/invalid-endpoint-that-does-not-exist',
      {
        headers: {
          'xi-api-key': 'test-api-key',
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

  it.each(
    Object.keys(templates).filter((template) => !template.startsWith('pack'))
  )('testing template %s', async (template) => {
    const { error } = await executeTemplate(user, template, {
      processInput: (input) => {
        if (input.method) {
          input.method = 'GET'
        }

        if (input.url) {
          input.url = 'https://api.elevenlabs.io/v1/convai/agents'
        }

        if (input.pageSize) {
          input.pageSize = 10
        }

        if (input.createdByUserId) {
          input.createdByUserId = '@me'
        }

        if (input.agentId) {
          input.agentId = 'agent_123'
        }

        if (input.agentPhoneNumberId) {
          input.agentPhoneNumberId = 'phone_123'
        }

        if (input.toNumber) {
          input.toNumber = '+15551234567'
        }

        if (input.conversationInitiationClientData) {
          input.conversationInitiationClientData = {
            user_id: 'user_123',
            environment: 'production',
          }
        }

        if (input.telephonyCallConfig) {
          input.telephonyCallConfig = {
            ringing_timeout_secs: 30,
          }
        }

        return input
      },
    })

    expect(error).toBeUndefined()

    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})
