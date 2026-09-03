import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import {
  createOpenApiHandlers,
  executeTemplate,
  setupServer,
} from '@/jest/utils/ability'

import templates from './docusign.esignature'

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
  'https://raw.githubusercontent.com/docusign/OpenAPI-Specifications/refs/heads/master/esignature.rest.swagger-v2.1.json'

const server = setupServer()

beforeAll(async () => {
  const { handlers } = await createOpenApiHandlers(DEFINITION, {
    transformDefinition: (definition) => {
      // @note DocuSign spec uses www.docusign.net as host but our templates
      // use demo.docusign.net. The paths already include /v2.1/ prefix so
      // server URL should only be base + /restapi
      if (definition.servers) {
        definition.servers = [
          {
            url: 'https://demo.docusign.net/restapi',
          },
        ]
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
      'https://demo.docusign.net/restapi/v2.1/accounts/test-account-id/envelopes',
      {
        headers: {
          Authorization: 'Bearer YOUR_ACCESS_TOKEN',
        },
      }
    )

    // @note MSW returns mock responses, so 200 indicates handlers are working
    expect(response.ok).toBe(true)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch(
      'https://demo.docusign.net/restapi/invalid-endpoint-that-does-not-exist',
      {
        headers: {
          Authorization: 'Bearer YOUR_ACCESS_TOKEN',
        },
      }
    )

    expect(response.ok).not.toBe(true)
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

  // @note docusign/sql/exec uses createAuxiliaryTemplate, not testable here
  // @note All fetch templates use dynamic base_url field which generates random
  // URLs that won't match MSW handlers. These need processInput to override.
  const untestableTemplates = ['docusign/sql/exec']

  const testableTemplates = Object.keys(templates).filter(
    (template) =>
      !template.startsWith('pack') && !untestableTemplates.includes(template)
  )

  it.each(testableTemplates)(`testing template %s`, async (template) => {
    const { error } = await executeTemplate(user, template, {
      // @note override the generated base_url to match our MSW mock server
      processInput: (input) => ({
        ...input,
        base_url: 'https://demo.docusign.net',
      }),
    })

    expect(error).toBeUndefined()

    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})
