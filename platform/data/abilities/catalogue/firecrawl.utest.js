import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import {
  createOpenApiHandlers,
  executeTemplate,
  setupServer,
} from '@/jest/utils/ability'

import templates from './firecrawl'

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
  'https://raw.githubusercontent.com/firecrawl/firecrawl/2e07269bfa8a5420bf09c79475361c5f340d6b17/apps/api/openapi.json'

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
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer YOUR_ACCESS_TOKEN',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://example.com',
      }),
    })

    expect(response.status).toBe(200)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch(
      'https://api.firecrawl.dev/v1/invalid-endpoint-that-does-not-exist',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer YOUR_ACCESS_TOKEN',
          'Content-Type': 'application/json',
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

  const untestableTemplates = ['firecrawl/api/call']

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
