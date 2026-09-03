import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import {
  createOpenApiHandlers,
  executeTemplate,
  setupServer,
} from '@/jest/utils/ability'

import templates from './discord'

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
  'https://raw.githubusercontent.com/discord/discord-api-spec/refs/heads/main/specs/openapi.json'

const server = setupServer()

beforeAll(async () => {
  const { handlers } = await createOpenApiHandlers(DEFINITION, {
    transformDefinition: (definition) => {
      // @note fix union types like ["array", "null"] that cause JSONSchemaFaker
      // to randomly generate null instead of arrays, breaking JSON parsing

      for (const path of Object.values(definition.paths || {})) {
        for (const method of Object.values(path)) {
          if (!method?.responses) {
            continue
          }

          for (const response of Object.values(method.responses)) {
            if (!response?.content?.['application/json']?.schema) {
              continue
            }

            const schema = response.content['application/json'].schema

            // @note if type is an array like ["array", "null"], prefer the
            // non-null type

            if (Array.isArray(schema.type)) {
              const nonNullTypes = schema.type.filter((t) => t !== 'null')

              if (nonNullTypes.length > 0) {
                schema.type = nonNullTypes[0]
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
  it('should accept valid endpoints', async () => {
    const response = await fetch(
      'https://discord.com/api/v10/channels/123456789',
      {
        headers: {
          Authorization: 'Bot YOUR_BOT_TOKEN',
        },
      }
    )

    expect(response.status).toBe(200)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch(
      'https://discord.com/api/v9/invalid-endpoint-that-does-not-exist',
      {
        headers: {
          Authorization: 'Bot YOUR_BOT_TOKEN',
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
    'discord/webhook/trigger', // uses dynamic webhook URLs that MSW can't mock
    'discord/message/react', // emoji field requires special URL encoding that JSONSchemaFaker can't generate
    'discord/api/call',
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
