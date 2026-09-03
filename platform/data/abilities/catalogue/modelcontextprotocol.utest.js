import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import {
  createOpenApiHandlers,
  executeTemplate,
  setupServer,
} from '@/jest/utils/ability'

import templates from './modelcontextprotocol'

jest.mock('@/lib/usage.record', () => ({ recordFetchUsage: jest.fn() }))
jest.mock('@/lib/user.get', () => ({ fastGetUserById: jest.fn() }))
jest.mock('@/lib/limit.core', () => ({
  ...jest.requireActual('@/lib/limit.core'),
  accountLimitsOk: jest.fn(),
}))
jest.mock('@/lib/extract.data', () => ({ extractDataFromInput: jest.fn() }))
jest.retryTimes(3)

const DEFINITION =
  'https://raw.githubusercontent.com/modelcontextprotocol/registry/9afbaacdfdf8966d73de09a795076fb0386c5c3d/docs/reference/api/openapi.yaml'
const server = setupServer()

beforeAll(async () => {
  const { handlers } = await createOpenApiHandlers(DEFINITION)

  server.use(...handlers)
  server.listen()
})

afterAll(() => {
  server.close()
})

describe('litmus tests', () => {
  it('should accept valid endpoints', async () => {
    const response = await fetch(
      'https://registry.modelcontextprotocol.io/v0.1/servers',
      {
        headers: { Accept: 'application/json, application/problem+json' },
      }
    )

    expect(response.status).toBe(200)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch(
      'https://registry.modelcontextprotocol.io/v0.1/invalid',
      {
        headers: { Accept: 'application/json, application/problem+json' },
      }
    )

    expect(response.status).not.toBe(200)
  })
})

describe('templates', () => {
  const user = { id: 'user-123' }

  beforeEach(() => {
    fastGetUserById.mockResolvedValue(user)
    accountLimitsOk.mockResolvedValue(true)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const untestableTemplates = [
    /* none currently */
  ]

  const testableTemplates = Object.keys(templates).filter(
    (t) => !t.startsWith('pack') && !untestableTemplates.includes(t)
  )

  it.each(testableTemplates)('testing template %s', async (template) => {
    const options = {
      processInput: (input) => {
        // @note ensure limit is a valid integer within API bounds (max 100)

        if (input.limit !== undefined) {
          const intLimit = Math.floor(Math.abs(input.limit))

          return {
            ...input,
            limit: Math.min(intLimit, 100),
          }
        }

        return input
      },
    }

    const { error } = await executeTemplate(user, template, options)

    expect(error).toBeUndefined()

    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})
