import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import { executeTemplate, setupServer } from '@/jest/utils/ability'

import templates from './snowflake'

import { HttpResponse, http } from 'msw'

// @todo these tests are not good - needs to be replaced with proper test using
// openapi schema validation and more thorough checks of responses

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

const snowflakeHandlers = [
  // Execute query endpoint
  http.post(
    'https://test-account.snowflakecomputing.com/api/v2/statements',
    async ({ request }) => {
      const authHeader = request.headers.get('Authorization')

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new HttpResponse('Unauthorized', { status: 401 })
      }

      const tokenType = request.headers.get(
        'X-Snowflake-Authorization-Token-Type'
      )

      if (tokenType !== 'KEYPAIR_JWT') {
        return new HttpResponse('Invalid token type', { status: 400 })
      }

      const body = await request.json()

      if (!body.statement) {
        return new HttpResponse('Statement is required', { status: 400 })
      }

      // Return mock Snowflake response
      return HttpResponse.json({
        resultSetMetaData: {
          numRows: 1,
          format: 'jsonv2',
          rowType: [
            { name: 'ID', type: 'fixed' },
            { name: 'NAME', type: 'text' },
          ],
        },
        data: [['1', 'Test Row']],
        code: '090001',
        statementStatusUrl:
          '/api/v2/statements/01b28f4e-0001-0000-0000-000000000001',
        requestId: 'test-request-id',
        sqlState: '00000',
        statementHandle: '01b28f4e-0001-0000-0000-000000000001',
        message: 'Statement executed successfully.',
        createdOn: Date.now(),
      })
    }
  ),

  // Get query status endpoint
  http.get(
    'https://test-account.snowflakecomputing.com/api/v2/statements/:statementHandle',
    async ({ request }) => {
      const authHeader = request.headers.get('Authorization')

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new HttpResponse('Unauthorized', { status: 401 })
      }

      return HttpResponse.json({
        resultSetMetaData: {
          numRows: 1,
          format: 'jsonv2',
        },
        data: [['1', 'Test Row']],
        code: '090001',
        statementHandle: '01b28f4e-0001-0000-0000-000000000001',
        message: 'Statement executed successfully.',
      })
    }
  ),

  // Cancel query endpoint
  http.post(
    'https://test-account.snowflakecomputing.com/api/v2/statements/:statementHandle/cancel',
    async ({ request }) => {
      const authHeader = request.headers.get('Authorization')

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new HttpResponse('Unauthorized', { status: 401 })
      }

      return HttpResponse.json({
        code: '090001',
        message: 'Statement cancelled.',
        statementHandle: '01b28f4e-0001-0000-0000-000000000001',
      })
    }
  ),
]

beforeAll(() => {
  server.use(...snowflakeHandlers)

  server.listen()
})

afterAll(() => {
  server.close()
})

describe('litmus tests', () => {
  it('should accept valid endpoints with authentication', async () => {
    const response = await fetch(
      'https://test-account.snowflakecomputing.com/api/v2/statements',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-jwt-token',
          'Content-Type': 'application/json',
          'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT',
        },
        body: JSON.stringify({ statement: 'SELECT 1' }),
      }
    )

    expect(response.status).toBe(200)
  })

  it('should reject requests without authentication', async () => {
    const response = await fetch(
      'https://test-account.snowflakecomputing.com/api/v2/statements',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT',
        },
        body: JSON.stringify({ statement: 'SELECT 1' }),
      }
    )

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

  const untestableTemplates = ['snowflake/api/call']

  const testableTemplates = Object.keys(templates).filter(
    (template) =>
      !template.startsWith('pack') && !untestableTemplates.includes(template)
  )

  it.each(testableTemplates)(`testing template %s`, async (template) => {
    const { error } = await executeTemplate(user, template, {
      secret: 'Bearer test-jwt-token',
      processInput: (input) => {
        // Map the different URL fields based on template type
        if (template === 'snowflake/query/execute') {
          return {
            ...input,
            accountUrl:
              'https://test-account.snowflakecomputing.com/api/v2/statements',
          }
        } else if (template === 'snowflake/query/status') {
          return {
            ...input,
            statusUrl:
              'https://test-account.snowflakecomputing.com/api/v2/statements/01b28f4e-0001-0000-0000-000000000001',
          }
        } else if (template === 'snowflake/query/cancel') {
          return {
            ...input,
            cancelUrl:
              'https://test-account.snowflakecomputing.com/api/v2/statements/01b28f4e-0001-0000-0000-000000000001/cancel',
          }
        }

        return input
      },
    })

    expect(error).toBeUndefined()

    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})
