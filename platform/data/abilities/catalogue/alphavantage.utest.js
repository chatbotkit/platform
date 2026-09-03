import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import {
  createOpenApiHandlers,
  executeTemplate,
  setupServer,
} from '@/jest/utils/ability'

import templates from './alphavantage'

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
  // @note load the local OpenAPI spec file
  const { handlers } = await createOpenApiHandlers(
    join(__dirname, 'alphavantage.openapi.yaml')
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
      'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=test',
      {
        headers: {
          Accept: 'application/json',
        },
      }
    )

    expect(response.status).toBe(200)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch(
      'https://www.alphavantage.co/invalid-endpoint-that-does-not-exist',
      {
        headers: {
          Accept: 'application/json',
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

  const untestableTemplates = ['alphavantage/api/call']

  it.each(
    Object.keys(templates).filter(
      (template) =>
        !template.startsWith('pack') && !untestableTemplates.includes(template)
    )
  )(`testing template %s`, async (template) => {
    const { error } = await executeTemplate(user, template)

    expect(error).toBeUndefined()

    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})
