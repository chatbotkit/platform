import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import {
  createOpenApiHandlers,
  executeTemplate,
  setupServer,
} from '@/jest/utils/ability'

import templates from './weatherbit'

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
  'https://api.apis.guru/v2/specs/weatherbit.io/2.0.0/swagger.json'

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
      'https://api.weatherbit.io/v2.0/current?lat=35.5&lon=-78.5&key=test_key',
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    expect(response.status).toBe(200)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch(
      'https://api.weatherbit.io/v2.0/invalid-endpoint-that-does-not-exist',
      {
        headers: {
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

  const untestableTemplates = [
    'weatherbit/history/hourly', // @note requires historical data endpoints which may not be in the OpenAPI spec
    'weatherbit/api/call',
  ]

  const testableTemplates = Object.keys(templates).filter(
    (template) =>
      !template.startsWith('pack') && !untestableTemplates.includes(template)
  )

  it.each(testableTemplates)(`testing template %s`, async (template) => {
    const { error } = await executeTemplate(user, template, {
      processInput: (input) => {
        // @note ensure coordinates are valid numbers
        if (input.latitude !== undefined) {
          input.latitude = 35.5
        }

        if (input.longitude !== undefined) {
          input.longitude = -78.5
        }

        // @note ensure city name is valid
        if (input.city) {
          input.city = 'London'
        }

        // @note ensure country code is valid
        if (input.country) {
          input.country = 'US'
        }

        // @note ensure dates are in valid format
        if (input.startDate) {
          input.startDate = '2023-01-01'
        }

        if (input.endDate) {
          input.endDate = '2023-01-07'
        }

        // @note ensure days is within valid range
        if (input.days !== undefined) {
          input.days = Math.min(Math.max(input.days, 1), 16)
        }

        // @note ensure units is valid enum value
        if (input.units && !['M', 'I', 'S'].includes(input.units)) {
          input.units = 'M'
        }

        return input
      },
    })

    expect(error).toBeUndefined()

    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})
