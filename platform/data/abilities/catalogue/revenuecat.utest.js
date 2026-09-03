import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import {
  createOpenApiHandlers,
  executeTemplate,
  setupServer,
} from '@/jest/utils/ability'

import templates from './revenuecat'

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

const DEFINITION = join(__dirname, 'revenuecat.openapi.yaml')
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
      'https://api.revenuecat.com/v1/subscribers/test-user',
      {
        headers: { Authorization: 'Bearer test-token' },
      }
    )

    expect([200, 404]).toContain(response.status)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch('https://api.revenuecat.com/v999/invalid', {
      headers: { Authorization: 'Bearer test-token' },
    })

    expect(response.status).toBe(404)
  })
})

describe('templates', () => {
  const user = { id: 'user-123' }

  beforeEach(() => {
    // Mock successful auth and limits
    fastGetUserById.mockResolvedValue(user)
    accountLimitsOk.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const untestableTemplates = ['revenuecat/api/call']

  it.each(
    Object.keys(templates).filter(
      (t) => !t.startsWith('pack') && !untestableTemplates.includes(t)
    )
  )(
    'testing template %s',
    async (template) => {
      const { error } = await executeTemplate(user, template, {})

      expect(error).toBeUndefined()
      expect(extractDataFromInput).not.toHaveBeenCalled()
    }
  )
})
