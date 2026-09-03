import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import { executeTemplate, setupServer } from '@/jest/utils/ability'

import templates from './betterstack.clickhouse'

import { HttpResponse, http } from 'msw'

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

const clickhouseHandlers = [
  http.post('https://clickhouse.betterstack.com', async ({ request }) => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return new HttpResponse('Unauthorized', { status: 401 })
    }

    const body = await request.text()

    // Validate it looks like a SQL query
    if (!body || body.trim().length === 0) {
      return new HttpResponse('Query is empty', { status: 400 })
    }

    // Return mock ClickHouse response
    return HttpResponse.json({
      meta: [
        { name: 'dt', type: 'DateTime64(6)' },
        { name: 'raw', type: 'String' },
      ],
      data: [
        {
          dt: '2026-01-10 12:00:00.000000',
          raw: '{"level":"info","message":"Test log entry"}',
        },
      ],
      rows: 1,
      statistics: {
        elapsed: 0.001,
        rows_read: 1,
        bytes_read: 100,
      },
    })
  }),
]

beforeAll(() => {
  server.use(...clickhouseHandlers)

  server.listen()
})

afterAll(() => {
  server.close()
})

describe('litmus tests', () => {
  it('should accept valid endpoints with authentication', async () => {
    const response = await fetch('https://clickhouse.betterstack.com', {
      method: 'POST',
      headers: {
        Authorization: 'Basic dGVzdDp0ZXN0',
        'Content-Type': 'text/plain',
      },
      body: 'SELECT 1',
    })

    expect(response.status).toBe(200)
  })

  it('should reject requests without authentication', async () => {
    const response = await fetch('https://clickhouse.betterstack.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: 'SELECT 1',
    })

    expect(response.status).toBe(401)
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

  const testableTemplates = Object.keys(templates).filter(
    (template) => !template.startsWith('pack')
  )

  it.each(testableTemplates)(`testing template %s`, async (template) => {
    const { error } = await executeTemplate(user, template, {
      // @note provide Basic auth to match the MSW mock server expectations
      secret: 'Basic dGVzdDp0ZXN0',
      // @note override the generated host to match our MSW mock server
      processInput: (input) => ({
        ...input,
        baseUrl: 'https://clickhouse.betterstack.com',
      }),
    })

    expect(error).toBeUndefined()

    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})
