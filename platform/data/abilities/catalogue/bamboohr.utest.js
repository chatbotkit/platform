import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import {
  createOpenApiHandlers,
  executeTemplate,
  setupServer,
} from '@/jest/utils/ability'

import templates from './bamboohr'

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

// @see https://openapi.bamboohr.io/main/latest/docs/openapi/public-openapi.yaml
const DEFINITION = join(__dirname, 'bamboohr.openapi.yaml')

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
    const response = await fetch(
      'https://api.bamboohr.com/api/gateway.php/test/v1/employees/directory',
      {
        headers: {
          Accept: 'application/json',
          Authorization: 'Basic dGVzdDp4',
        },
      }
    )

    expect(response.status).toBe(200)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch(
      'https://api.bamboohr.com/api/gateway.php/test/v1/invalid-endpoint-that-does-not-exist',
      {
        headers: {
          Accept: 'application/json',
          Authorization: 'Basic dGVzdDp4',
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

  const untestableTemplates = ['bamboohr/api/call']

  const testableTemplates = Object.keys(templates).filter(
    (template) =>
      !template.startsWith('pack') && !untestableTemplates.includes(template)
  )

  it.each(testableTemplates)(`testing template %s`, async (template) => {
    const { error } = await executeTemplate(user, template, {
      processInput: (input) => {
        // @note always use 'test' subdomain to match the MSW handler configuration
        // the subdomain is part of the URL path and must match the transformDefinition value
        input.subdomain = 'test'

        // provide required employee ID for templates that need it
        if (
          template.includes('employee/fetch') ||
          template.includes('employee/update')
        ) {
          input.employeeId = '123'
        }

        // provide required fields for employee create
        if (template === 'bamboohr/employee/create') {
          input.firstName = 'John'
          input.lastName = 'Doe'
        }

        // provide required fields for report fetch
        if (template === 'bamboohr/report/fetch') {
          input.fields = ['firstName', 'lastName']
        }

        // provide required date range for time-off requests
        if (template === 'bamboohr/time-off/request/list') {
          input.startDate = '2024-01-01'
          input.endDate = '2024-12-31'
        }

        return input
      },
    })

    expect(error).toBeUndefined()

    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})
