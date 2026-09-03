import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import {
  createOpenApiHandlers,
  executeTemplate,
  setupServer,
} from '@/jest/utils/ability'

import jsTemplates from './slack'
import yamlTemplates from './slack.yaml'

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

const DEFINITION = 'https://api.apis.guru/v2/specs/slack.com/1.7.0/openapi.json'

const server = setupServer()

beforeAll(async () => {
  const { handlers } = await createOpenApiHandlers(DEFINITION, {
    // @note patch the OpenAPI spec to accept application/json for POST endpoints
    // the official spec uses application/x-www-form-urlencoded but Slack API also
    // accepts JSON which is what our templates use

    transformDefinition: (definition) => {
      for (const path of Object.values(definition.paths || {})) {
        if (
          path.post?.requestBody?.content?.['application/x-www-form-urlencoded']
        ) {
          const formSchema =
            path.post.requestBody.content['application/x-www-form-urlencoded']

          path.post.requestBody.content['application/json'] = { ...formSchema }
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
    const response = await fetch('https://slack.com/api/conversations.list', {
      headers: {
        Authorization: 'Bearer YOUR_ACCESS_TOKEN',
      },
    })

    expect(response.status).toBe(200)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch(
      'https://slack.com/api/invalid-endpoint-that-does-not-exist',
      {
        headers: {
          Authorization: 'Bearer YOUR_ACCESS_TOKEN',
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
    'slack/api/call',

    'slack/webhook', // uses dynamic webhook URLs that MSW can't mock
    'slack/file/download', // uses dynamic file URLs that MSW can't mock

    // @todo fix these because they are important

    'slack/search[all]', // search.all not properly defined in OpenAPI spec (returns ok:false)
    'slack/search[files]', // search.files returns ok:false from OpenAPI mock
  ]

  const testableTemplates = Object.keys({
    ...jsTemplates,
    ...yamlTemplates,
  }).filter(
    (template) =>
      !template.startsWith('pack') && !untestableTemplates.includes(template)
  )

  it.each(testableTemplates)(`testing template %s`, async (template) => {
    const { error } = await executeTemplate(user, template)

    expect(error).toBeUndefined()

    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})
