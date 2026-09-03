// @ts-nocheck
import { str2buf } from '@chatbotkit-dev/buffer'
import { html2text } from '@chatbotkit-dev/file-html/parse'

import {
  DEFAULT_RERANK_TOP_N,
  FETCH_RESPONSE_SIZE,
  FETCH_TIMEOUT_MAX,
  FETCH_TIMEOUT_MIN,
  executeFetchAction,
  insertSearchParams,
  normalizeRequest,
  parseRequest,
  rerankResult,
} from '@/lib/action.exec.fetch'
import { getContextContact, getContextTimezone } from '@/lib/context.store'
import { chunkFile, isSupportedContentType } from '@/lib/dsd2'
import { captureObservation } from '@/lib/error'
import fetch, {
  HEADER_CONTENT_ORIGINAL_SIZE,
  HEADER_CONTENT_ORIGINAL_TYPE,
  HEADER_CONTENT_TRUNCATED,
} from '@/lib/fetch'
import { parseRequest as parseHttpRequest } from '@/lib/http'
import matchJmespath from '@/lib/jmespath'
import matchJsonpath from '@/lib/jsonpath'
import { accountLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import { rerank } from '@/lib/rerank'
import { swapSecrets } from '@/lib/secret.value'
import { getTemporaryUserToken } from '@/lib/session.temp'
import { recordFetchUsage } from '@/lib/usage.record'
import { fastGetUserById } from '@/lib/user.get'

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

jest.mock('@/lib/limit.core', () => ({
  accountLimitsOk: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/fetch', () => {
  const mockFetch = jest.fn()
  const mockWithLimit = jest.fn((fetch) => fetch) // Pass-through for tests

  mockFetch.default = mockFetch
  mockFetch.withLimit = mockWithLimit

  return Object.assign(mockFetch, {
    __esModule: true,

    ...jest.requireActual('@/lib/fetch'),

    default: mockFetch,
    withLimit: mockWithLimit,
  })
})

jest.mock('@/lib/context.store', () => ({
  getContextContact: jest.fn(),
  getContextTimezone: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  ...jest.requireActual('@/lib/error'),
  captureObservation: jest.fn(),
}))

jest.mock('@/lib/secret.value', () => ({
  swapSecrets: jest.fn(),
}))

jest.mock('@/lib/session.temp', () => ({
  getTemporaryUserToken: jest.fn(),
}))

jest.mock('@/lib/usage.record', () => ({
  recordFetchUsage: jest.fn(),
  recordRerankTokenUsage: jest.fn(),
}))

jest.mock('@/lib/dsd2', () => ({
  chunkFile: jest.fn(),
  isSupportedContentType: jest.fn(),
}))

jest.mock('@/lib/rerank', () => ({
  rerank: jest.fn(),
}))

jest.mock('@chatbotkit-dev/file-html/parse', () => ({
  html2text: jest.fn(),
}))

jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
}))

jest.mock('@/lib/jsonpath', () => jest.fn())
jest.mock('@/lib/jmespath', () => jest.fn())

describe('rerankResult', () => {
  // @note rerankResult now delegates to lib/rerank.ts via transform.applyRerank,
  // which returns { documents: [{ id }], usage }.
  function mockRerank(documents, outputTokens = 1) {
    rerank.mockResolvedValue({
      documents,
      usage: { model: 'rerank-v4-fast', inputTokens: 0, outputTokens },
    })
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should return result unchanged if not array or object', async () => {
      const query = 'test query'
      const result = 'simple string'
      const userId = 'user-123'
      const params = {}

      const output = await rerankResult(query, result, userId, params)

      expect(output).toBe(result)
      expect(rerank).not.toHaveBeenCalled()
    })

    it('should return result unchanged if no valid root array found', async () => {
      const query = 'test query'
      const result = { invalidKey: 'value' }
      const userId = 'user-123'
      const params = {}

      const output = await rerankResult(query, result, userId, params)

      expect(output).toBe(result)
      expect(rerank).not.toHaveBeenCalled()
    })

    it('should rerank array result', async () => {
      const query = 'test query'

      const result = [
        { id: 1, name: 'item1' },
        { id: 2, name: 'item2' },
      ]

      const userId = 'user-123'
      const params = {}

      mockRerank([{ id: '1' }, { id: '0' }])

      const output = await rerankResult(query, result, userId, params)

      expect(rerank).toHaveBeenCalledWith(
        query,
        [
          { id: '0', text: JSON.stringify(result[0]) },
          { id: '1', text: JSON.stringify(result[1]) },
        ],
        { topN: DEFAULT_RERANK_TOP_N }
      )
      expect(output).toEqual([result[1], result[0]])
    })

    it('should rerank object with results array', async () => {
      const query = 'test query'

      const items = [
        { id: 1, name: 'item1' },
        { id: 2, name: 'item2' },
      ]

      const result = { results: items }
      const userId = 'user-123'
      const params = {}

      mockRerank([{ id: '0' }])

      const output = await rerankResult(query, result, userId, params)

      expect(output).toEqual([items[0]])
    })

    it('should handle nested arrays by flattening', async () => {
      const query = 'test query'

      const result = [
        [{ id: 1, name: 'item1' }],
        [
          { id: 2, name: 'item2' },
          { id: 3, name: 'item3' },
        ],
      ]

      const userId = 'user-123'
      const params = {}

      mockRerank([{ id: '2' }, { id: '0' }])

      const output = await rerankResult(query, result, userId, params)

      expect(output).toHaveLength(2)
      expect(output[0]).toEqual({ id: 3, name: 'item3' })
      expect(output[1]).toEqual({ id: 1, name: 'item1' })
    })
  })

  describe('object property detection', () => {
    it.each([
      ['results', { results: [{ id: 1 }] }],
      ['items', { items: [{ id: 1 }] }],
      ['documents', { documents: [{ id: 1 }] }],
      ['files', { files: [{ id: 1 }] }],
      ['records', { records: [{ id: 1 }] }],
      ['data', { data: [{ id: 1 }] }],
    ])('should detect %s property', async (property, result) => {
      const query = 'test query'
      const userId = 'user-123'
      const params = {}

      mockRerank([{ id: '0' }])

      const output = await rerankResult(query, result, userId, params)

      expect(output).toEqual([{ id: 1 }])
    })
  })

  describe('edge cases', () => {
    it('should handle empty array', async () => {
      const query = 'test query'
      const result = []
      const userId = 'user-123'
      const params = {}

      mockRerank([], 0)

      const output = await rerankResult(query, result, userId, params)

      expect(output).toEqual([])

      expect(rerank).toHaveBeenCalledWith(query, [], {
        topN: DEFAULT_RERANK_TOP_N,
      })
    })

    it('should filter out items not found in ranked results', async () => {
      const query = 'test query'
      const result = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const userId = 'user-123'
      const params = {}

      mockRerank([{ id: '999' }, { id: '0' }])

      const output = await rerankResult(query, result, userId, params)

      expect(output).toEqual([{ id: 1 }]) // Only item with id '0' found
    })

    it('should handle null/undefined inputs', async () => {
      const query = 'test query'
      const userId = 'user-123'
      const params = {}

      expect(await rerankResult(query, null, userId, params)).toBeNull()

      expect(
        await rerankResult(query, undefined, userId, params)
      ).toBeUndefined()
    })
  })
})

describe('executeFetchAction', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  }

  const mockOptions = {
    userId: 'user-123',
    contextResources: {
      blueprintId: 'blueprint-123',
      skillsetId: 'skillset-123',
      abilityId: 'ability-123',
    },
    linkedResources: {
      secretId: 'secret-123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()

    fastGetUserById.mockResolvedValue(mockUser)
    accountLimitsOk.mockResolvedValue(true)
    logEvent.mockResolvedValue(undefined)
    recordFetchUsage.mockResolvedValue(undefined)
    swapSecrets.mockResolvedValue({})
    getContextContact.mockReturnValue(null)
    getContextTimezone.mockReturnValue(null)
    captureObservation.mockResolvedValue(undefined)
  })

  describe('user validation', () => {
    it('should throw error if user not found', async () => {
      fastGetUserById.mockResolvedValue(null)

      const input = 'GET https://api.example.com'
      const params = {}

      await expect(
        executeFetchAction(input, params, mockOptions)
      ).rejects.toThrow('User not found')

      expect(fastGetUserById).toHaveBeenCalledWith(mockOptions.userId)
    })

    it('should return error if fetch limits exceeded', async () => {
      accountLimitsOk.mockResolvedValue(false)

      const input = 'GET https://api.example.com'
      const params = {}

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result).toEqual({
        error: 'You have reached your fetch limit.',
      })
      expect(accountLimitsOk).toHaveBeenCalledWith(mockUser, ['fetch'])
    })
  })

  describe('request parsing and normalization', () => {
    it('should parse and normalize basic request', async () => {
      const input = 'GET https://api.example.com/data'
      const params = {}

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest
          .fn()
          .mockResolvedValue(str2buf('{"result": "success"}')),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result).toEqual({
        result: {
          result: 'success',
        },
      })
    })

    it('should handle timeout parameter', async () => {
      const input = 'GET https://api.example.com'
      const params = { timeout: '30000' }

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('response')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com',
        expect.objectContaining({
          timeout: 30000,
        })
      )
    })

    it('should enforce timeout limits', async () => {
      const input = 'GET https://api.example.com'

      let params = { timeout: '5000' }

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('response')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: FETCH_TIMEOUT_MIN })
      )

      params = { timeout: '600000' }

      await executeFetchAction(input, params, mockOptions)

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: FETCH_TIMEOUT_MAX })
      )
    })

    it('should strip trailing ? from query and body parameters when not provided', async () => {
      const input = `method: POST
uri: https://api.example.com/test
headers:
  Content-Type: application/json
body:
  requiredParam: value
  optionalParam?: null
  emptyArrayParam?: []
  emptyObjectParam?: {}
  providedOptionalParam?: provided`

      const params = {}

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('{"success": true}')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      // verify that the fetch was called with the normalized body where
      // optional parameters ending with ? are stripped when not provided

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            requiredParam: 'value',
            providedOptionalParam: 'provided',
            // optionalParam, emptyArrayParam, emptyObjectParam should be stripped
          }),
        })
      )
    })

    it('should strip trailing ? from query parameters when not provided', async () => {
      const input = `method: GET
uri: https://api.example.com/search
query:
  required: test
  optional?: null
  emptyArray?: []
  emptyObject?: {}
  provided?: value`

      const params = {}

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('{"results": []}')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      // verify that the fetch was called with normalized query parameters
      // where optional parameters ending with ? are stripped when not provided

      const expectedUrl =
        'https://api.example.com/search?required=test&provided=value'

      expect(fetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({
          method: 'GET',
        })
      )
    })
  })

  describe('internal authentication', () => {
    beforeEach(() => {
      getTemporaryUserToken.mockResolvedValue('temp-token-123')
    })

    // @note the allowlist derives from the deployment's own configuration
    // (SITE_URL and the api host convention), never from literal hosts

    it('adds internal auth toward the deployment site origin', async () => {
      const input = `GET ${process.env.SITE_URL}/api/test`
      const params = { auth: 'internal' }

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('response')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      expect(getTemporaryUserToken).toHaveBeenCalledWith(mockOptions.userId, {
        durationInSeconds: expect.any(Number),
      })

      expect(swapSecrets).toHaveBeenCalledWith(
        expect.objectContaining({
          authorization: 'Bearer temp-token-123',
        }),
        expect.anything()
      )
    })

    it('adds internal auth toward the deployment api paths', async () => {
      const input = `GET ${process.env.SITE_URL}/v1/test`
      const params = { auth: 'internal' }

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('response')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      expect(getTemporaryUserToken).toHaveBeenCalledWith(mockOptions.userId, {
        durationInSeconds: expect.any(Number),
      })
    })

    it('never injects credentials toward a foreign origin', async () => {
      const input = 'GET https://external-api.com/test'
      const params = { auth: 'internal' }

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('response')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      expect(getTemporaryUserToken).not.toHaveBeenCalled()
    })
  })

  describe('secrets handling', () => {
    it('should pass inline secrets to swapSecrets function', async () => {
      const input = 'GET https://api.example.com'
      const params = {}

      const mockOptionsWithSecrets = {
        ...mockOptions,
        inlineSecrets: {
          'api-key': 'secret-value-123',
          'auth-token': 'token-456',
        },
      }

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('response')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptionsWithSecrets)

      expect(swapSecrets).toHaveBeenCalledWith(
        {},
        {
          userId: mockOptionsWithSecrets.userId,
          abilityId: mockOptionsWithSecrets.contextResources?.abilityId,
          secretId: mockOptionsWithSecrets.linkedResources?.secretId,
          inlineSecrets: {
            'api-key': 'secret-value-123',
            'auth-token': 'token-456',
          },
        }
      )
    })

    it('should pass undefined inline secrets when not provided', async () => {
      const input = 'GET https://api.example.com'
      const params = {}

      const mockOptionsWithoutSecrets = {
        userId: 'user-123',
        contextResources: {
          blueprintId: 'blueprint-123',
          skillsetId: 'skillset-123',
          abilityId: 'ability-123',
        },
        linkedResources: {
          secretId: 'secret-123',
        },
        // no inlineSecrets property
      }

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('response')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptionsWithoutSecrets)

      expect(swapSecrets).toHaveBeenCalledWith(
        {},
        {
          userId: mockOptionsWithoutSecrets.userId,
          abilityId: mockOptionsWithoutSecrets.contextResources?.abilityId,
          secretId: mockOptionsWithoutSecrets.linkedResources?.secretId,
          inlineSecrets: undefined,
        }
      )
    })

    it('should pass empty inline secrets object when explicitly set', async () => {
      const input = 'GET https://api.example.com'
      const params = {}

      const mockOptionsWithEmptySecrets = {
        ...mockOptions,
        inlineSecrets: {},
      }

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('response')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptionsWithEmptySecrets)

      expect(swapSecrets).toHaveBeenCalledWith(
        {},
        {
          userId: mockOptionsWithEmptySecrets.userId,
          abilityId: mockOptionsWithEmptySecrets.contextResources?.abilityId,
          secretId: mockOptionsWithEmptySecrets.linkedResources?.secretId,
          inlineSecrets: {},
        }
      )
    })

    it('should pass all swapSecrets parameters correctly with inline secrets', async () => {
      const input =
        'POST https://api.example.com\nContent-Type: application/json\n\n{"data": "test"}'

      const params = {}

      const mockOptionsWithSecrets = {
        userId: 'user-456',
        contextResources: {
          blueprintId: 'blueprint-456',
          skillsetId: 'skillset-456',
          abilityId: 'ability-456',
        },
        linkedResources: {
          secretId: 'secret-456',
        },
        inlineSecrets: {
          'database-password': 'super-secret-password',
          'api-endpoint': 'https://internal.api.com',
        },
      }

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('response')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptionsWithSecrets)

      // @note verify that all parameters are passed correctly to swapSecrets including inline secrets

      expect(swapSecrets).toHaveBeenCalledWith(
        { 'content-type': 'application/json' },
        {
          userId: 'user-456',
          abilityId: 'ability-456',
          secretId: 'secret-456',
          inlineSecrets: {
            'database-password': 'super-secret-password',
            'api-endpoint': 'https://internal.api.com',
          },
        }
      )
    })
  })

  describe('context parameters', () => {
    it('should add user context', async () => {
      const input = 'GET https://api.example.com'
      const params = { context: 'user' }

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('response')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-chatbotkit-user-id': mockOptions.userId,
          }),
        })
      )
    })

    it('should add conversation context', async () => {
      const mockContact = { id: 'conversation-123' }

      getContextContact.mockReturnValue(mockContact)

      const input = 'GET https://api.example.com'
      const params = { context: 'conversation' }

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('response')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-chatbotkit-conversation-id': 'conversation-123',
          }),
        })
      )
    })

    it('should add contact context with all fields', async () => {
      const mockContact = {
        id: 'contact-123',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        nick: 'johndoe',
      }

      getContextContact.mockReturnValue(mockContact)

      const input = 'GET https://api.example.com'
      const params = { context: 'contact' }

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('response')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-chatbotkit-contact-id': 'contact-123',
            'x-chatbotkit-contact-name': 'John Doe',
            'x-chatbotkit-contact-email': 'john@example.com',
            'x-chatbotkit-contact-phone': '+1234567890',
            'x-chatbotkit-contact-nick': 'johndoe',
          }),
        })
      )
    })

    it('should add timezone context', async () => {
      getContextTimezone.mockReturnValue('America/New_York')

      const input = 'GET https://api.example.com'
      const params = {}

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('response')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-timezone': 'America/New_York',
          }),
        })
      )
    })

    it('should handle multiple context types', async () => {
      const input = 'GET https://api.example.com'
      const params = { context: 'user,conversation,contact' }

      const mockContact = { id: 'contact-123' }

      getContextContact.mockReturnValue(mockContact)

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('response')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-chatbotkit-user-id': mockOptions.userId,
            'x-chatbotkit-conversation-id': 'contact-123',
            'x-chatbotkit-contact-id': 'contact-123',
          }),
        })
      )
    })
  })

  describe('fetch error handling', () => {
    it('should handle fetch network errors', async () => {
      const input = 'GET https://api.example.com'
      const params = {}

      const networkError = new Error('Network error')

      fetch.mockRejectedValue(networkError)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result).toEqual({
        error: 'Network error',
      })

      expect(logEvent).toHaveBeenCalledWith({
        user: { id: mockOptions.userId },
        type: 'action.fetch',
        relations: {
          abilityId: 'ability-123',
          blueprintId: 'blueprint-123',
          skillsetId: 'skillset-123',
        },
        meta: expect.objectContaining({
          request: expect.objectContaining({
            status: 0,
            error: 'Network error',
          }),
        }),
      })
    })

    it('should handle HTTP error status codes', async () => {
      const input = 'GET https://api.example.com'
      const params = {}

      const mockResponse = {
        ok: false,
        status: 404,
        headers: new Map(),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('Not Found')),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result).toEqual({
        result: {
          status: 404,
          body: 'Not Found',
        },
        error: 'Status code: 404',
      })
    })

    it('should capture an observation for template bad request errors', async () => {
      const input = `method: GET
url: https://api.example.com
options:
  _internal:
    template: true`

      const params = {}

      const mockResponse = {
        ok: false,
        status: 400,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest
          .fn()
          .mockResolvedValue(str2buf('{"error":"Bad Request"}')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      expect(captureObservation).toHaveBeenCalledWith(
        'template fetch execution failed',
        expect.objectContaining({
          status: 400,
          url: 'https://api.example.com/',
          isTemplate: true,
          abilityId: 'ability-123',
        })
      )
    })

    it('should ignore template auth errors for observation', async () => {
      const input = `method: GET
url: https://api.example.com
options:
  _internal:
    template: true`

      const params = {}

      const mockResponse = {
        ok: false,
        status: 401,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest
          .fn()
          .mockResolvedValue(str2buf('{"error":"Unauthorized"}')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      expect(captureObservation).not.toHaveBeenCalled()
    })

    it('should capture an observation for template network errors', async () => {
      const input = `method: GET
url: https://api.example.com
options:
  _internal:
    template: true`

      const params = {}

      fetch.mockRejectedValue(new Error('Network error'))

      await executeFetchAction(input, params, mockOptions)

      expect(captureObservation).toHaveBeenCalledWith(
        'template fetch execution failed',
        expect.objectContaining({
          status: 0,
          url: 'https://api.example.com/',
          error: 'Network error',
          isTemplate: true,
          abilityId: 'ability-123',
        })
      )
    })
  })

  describe('binary content handling', () => {
    it('should handle binary content with text conversion', async () => {
      isSupportedContentType.mockReturnValue(true)

      const mockChunkResponse = {
        items: [{ text: 'Converted text content' }],
      }

      chunkFile.mockResolvedValue(mockChunkResponse)

      const input = 'GET https://api.example.com/file.pdf'
      const params = { text: true }

      const binaryData = new ArrayBuffer(8)

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/pdf']]),
        arrayBuffer: jest.fn().mockResolvedValue(binaryData),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(chunkFile).toHaveBeenCalledWith(expect.any(Blob), {
        userId: mockOptions.userId,
        size: Number.MAX_SAFE_INTEGER,
        overlap: 0,
      })
      expect(result).toEqual({
        result: {
          status: 200,
          body: 'Converted text content',
        },
      })
    })

    it('should return error for unsupported binary content', async () => {
      isSupportedContentType.mockReturnValue(false)

      const input = 'GET https://api.example.com/file.bin'
      const params = { text: true }

      const binaryData = new ArrayBuffer(8)

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/octet-stream']]),
        arrayBuffer: jest.fn().mockResolvedValue(binaryData),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result).toEqual({
        error: 'Unsupported content type application/octet-stream',
      })
    })

    it('should return error for binary content without text flag', async () => {
      const input = 'GET https://api.example.com/file.bin'
      const params = {}

      const binaryData = new ArrayBuffer(8)

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/octet-stream']]),
        arrayBuffer: jest.fn().mockResolvedValue(binaryData),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result).toEqual({
        error: 'Response is not text',
      })
    })
  })

  describe('format handling', () => {
    it('should format HTML to text with selectors', async () => {
      jest.doMock('@chatbotkit-dev/file-html/parse', () => ({
        html2text: jest.fn(),
      }))

      html2text.mockReturnValue('Converted text')

      const input = 'GET https://api.example.com/page'
      const params = { format: 'text', selectors: 'main' }

      const htmlContent = '<html><body><main>Content</main></body></html>'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(htmlContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // transform library includes 'html' in the default selectors list
      expect(html2text).toHaveBeenCalledWith(htmlContent, {
        url: 'https://api.example.com/page',
        selectors: 'main,article,main,body,html',
      })

      expect(result).toEqual({
        result: 'Converted text',
      })
    })

    it('should format HTML error responses to text when requested', async () => {
      html2text.mockReturnValue('Page not found')

      const input = 'GET https://api.example.com/page'
      const params = { format: 'text' }

      const htmlContent =
        '<!DOCTYPE html><html><body><main>Page not found</main></body></html>'

      const mockResponse = {
        ok: false,
        status: 404,
        headers: new Map([['content-type', 'text/html']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(htmlContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(html2text).toHaveBeenCalledWith(htmlContent, {
        url: 'https://api.example.com/page',
        selectors: 'article,main,body,html',
      })

      expect(result).toEqual({
        result: 'Page not found',
        error: 'Status code: 404',
      })
    })

    it('should handle JSON format', async () => {
      const input = 'GET https://api.example.com/data'
      const params = { format: 'json' }

      const jsonContent = '{"key": "value", "number": 42}'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result).toEqual({
        result: { key: 'value', number: 42 },
      })
    })

    it('should not transform JSON responses with html2text', async () => {
      const input = 'GET https://api.example.com/data'
      const params = { format: 'json' }

      const jsonContent = JSON.stringify({
        content: '<html><body><h1>Title</h1></body></html>',
      })

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(html2text).not.toHaveBeenCalled()
      expect(result).toEqual({
        result: {
          content: '<html><body><h1>Title</h1></body></html>',
        },
      })
    })

    it('should handle JSON parsing errors', async () => {
      const input = 'GET https://api.example.com/data'
      const params = { format: 'json' }

      const invalidJson = '{"invalid": json}'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(invalidJson)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // transform library returns more descriptive error messages
      expect(result.error).toContain('Parse failed')
      expect(result.result).toBe(invalidJson)
    })

    it('should parse JSON error responses when JSON format is requested', async () => {
      const input = 'GET https://api.example.com/data'
      const params = { format: 'json' }

      const jsonContent = '{"error": "Not found", "code": "missing_resource"}'

      const mockResponse = {
        ok: false,
        status: 404,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result).toEqual({
        result: {
          error: 'Not found',
        },
        error: 'Status code: 404',
      })
    })

    it('should preserve status error and raw body when JSON error response parsing fails', async () => {
      const input = 'GET https://api.example.com/data'
      const params = { format: 'json' }

      const invalidJson = '{"error": invalid json}'

      const mockResponse = {
        ok: false,
        status: 500,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(invalidJson)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result).toEqual({
        result: {
          status: 500,
          body: invalidJson,
        },
        error: 'Status code: 500',
      })
    })

    it('should handle toon format - converts JSON to token-optimized notation', async () => {
      const input = 'GET https://api.example.com/data'
      const params = { format: 'toon' }

      const jsonContent = '{"name": "Alice", "age": 30, "active": true}'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // toon format should return a string (the toon-encoded result)
      expect(typeof result.result).toBe('string')
      // Should contain the key names without JSON syntax
      expect(result.result).toContain('name')
      expect(result.result).toContain('Alice')
      expect(result.result).toContain('age')
      expect(result.result).toContain('30')
      expect(result.error).toBeUndefined()
    })

    it('should handle toon format with nested objects', async () => {
      const input = 'GET https://api.example.com/data'
      const params = { format: 'toon' }

      const jsonContent = JSON.stringify({
        user: {
          name: 'Bob',
          address: {
            city: 'NYC',
          },
        },
      })

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(typeof result.result).toBe('string')
      expect(result.result).toContain('user')
      expect(result.result).toContain('Bob')
      expect(result.result).toContain('NYC')
      expect(result.error).toBeUndefined()
    })

    it('should handle toon format with arrays', async () => {
      const input = 'GET https://api.example.com/data'
      const params = { format: 'toon' }

      const jsonContent = JSON.stringify({
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
        ],
      })

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(typeof result.result).toBe('string')
      expect(result.result).toContain('items')
      expect(result.result).toContain('Item 1')
      expect(result.result).toContain('Item 2')
      expect(result.error).toBeUndefined()
    })

    it('should apply jsonpath filter before toon transformation', async () => {
      const input = 'GET https://api.example.com/data'
      const params = { format: 'toon', jsonpath: '$.users[*].name' }

      const jsonContent = JSON.stringify({
        users: [{ name: 'Alice' }, { name: 'Bob' }],
        metadata: { count: 2 },
      })

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)
      matchJsonpath.mockReturnValue(['Alice', 'Bob'])

      const result = await executeFetchAction(input, params, mockOptions)

      // Should have called jsonpath first
      expect(matchJsonpath).toHaveBeenCalledWith('$.users[*].name', {
        users: [{ name: 'Alice' }, { name: 'Bob' }],
        metadata: { count: 2 },
      })

      // Result should be toon-encoded after jsonpath filtering
      expect(typeof result.result).toBe('string')
      expect(result.error).toBeUndefined()
    })

    it('should apply jmespath filter before toon transformation', async () => {
      const input = 'GET https://api.example.com/data'
      const params = { format: 'toon', jmespath: 'users[*].name' }

      const jsonContent = JSON.stringify({
        users: [{ name: 'Carol' }, { name: 'Dave' }],
      })

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)
      matchJmespath.mockReturnValue(['Carol', 'Dave'])

      const result = await executeFetchAction(input, params, mockOptions)

      // Should have called jmespath first
      expect(matchJmespath).toHaveBeenCalledWith('users[*].name', {
        users: [{ name: 'Carol' }, { name: 'Dave' }],
      })

      // Result should be toon-encoded after jmespath filtering
      expect(typeof result.result).toBe('string')
      expect(result.error).toBeUndefined()
    })

    it('should not apply toon transformation when there is an error', async () => {
      const input = 'GET https://api.example.com/data'
      const params = { format: 'toon' }

      const jsonContent = '{"error": "Something went wrong"}'

      const mockResponse = {
        ok: false,
        status: 500,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // Should have an error
      expect(result.error).toBeDefined()
      // Result should be an object (error handling), not toon-encoded string
      expect(typeof result.result).toBe('object')
    })

    it('should not apply toon transformation when result is not an object', async () => {
      const input = 'GET https://api.example.com/page'
      const params = { format: 'toon' }

      // Non-JSON content type that won't be parsed
      const htmlContent = '<html><body>Hello</body></html>'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(htmlContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // transform library converts HTML to text when format is toon
      // and toon encoding is not applied to non-objects (strings)
      expect(typeof result.result).toBe('string')
      expect(result.error).toBeUndefined()
    })

    it('should handle NDJSON (application/x-ndjson) content type', async () => {
      const input = 'GET https://api.example.com/logs'
      const params = {}

      const ndjsonContent = `{"id":1,"name":"Item 1"}
{"id":2,"name":"Item 2"}
{"id":3,"name":"Item 3"}`

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/x-ndjson']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(ndjsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // Should parse NDJSON into an array of objects
      expect(result.result).toEqual([
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' },
      ])
      expect(result.error).toBeUndefined()
    })

    it('should handle NDJSON (application/jsonl) content type', async () => {
      const input = 'GET https://api.example.com/logs'
      const params = {}

      const ndjsonContent = `{"event":"login","user":"alice"}
{"event":"logout","user":"bob"}`

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/jsonl']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(ndjsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result.result).toEqual([
        { event: 'login', user: 'alice' },
        { event: 'logout', user: 'bob' },
      ])
      expect(result.error).toBeUndefined()
    })

    it('should handle NDJSON with toon format', async () => {
      const input = 'GET https://api.example.com/logs'
      const params = { format: 'toon' }

      const ndjsonContent = `{"id":1,"name":"Item 1"}
{"id":2,"name":"Item 2"}`

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/x-ndjson']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(ndjsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // Should be toon-encoded string (since NDJSON was parsed to array, then toon applied)
      expect(typeof result.result).toBe('string')
      expect(result.result).toContain('Item 1')
      expect(result.result).toContain('Item 2')
      expect(result.error).toBeUndefined()
    })

    it('should handle NDJSON with empty lines', async () => {
      const input = 'GET https://api.example.com/logs'
      const params = {}

      const ndjsonContent = `{"id":1}

{"id":2}
`

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/x-ndjson']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(ndjsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // Should skip empty lines and parse the rest
      expect(result.result).toEqual([{ id: 1 }, { id: 2 }])
      expect(result.error).toBeUndefined()
    })

    it('should handle NDJSON with jsonpath filter', async () => {
      const input = 'GET https://api.example.com/logs'
      const params = { jsonpath: '$[*].name' }

      const ndjsonContent = `{"id":1,"name":"Alice"}
{"id":2,"name":"Bob"}`

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/x-ndjson']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(ndjsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)
      matchJsonpath.mockReturnValue(['Alice', 'Bob'])

      const result = await executeFetchAction(input, params, mockOptions)

      // jsonpath should be applied to the parsed NDJSON array
      expect(matchJsonpath).toHaveBeenCalledWith('$[*].name', [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ])
      expect(result.error).toBeUndefined()
    })

    it('should parse nested JSON strings with transformNestedStrings option', async () => {
      const input = 'GET https://api.example.com/logs'
      const params = { transformNestedStrings: { json: true } }

      const jsonContent = JSON.stringify({
        dt: '2026-01-11',
        raw: '{"message":"hello","level":"info"}',
      })

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // Should parse the nested JSON string into an object
      expect(result.result).toEqual({
        dt: '2026-01-11',
        raw: { message: 'hello', level: 'info' },
      })
      expect(result.error).toBeUndefined()
    })

    it('should parse deeply nested JSON strings with transformNestedStrings option', async () => {
      const input = 'GET https://api.example.com/logs'
      const params = { transformNestedStrings: { json: true } }

      const jsonContent = JSON.stringify({
        outer: '{"inner":"{\\"deep\\":\\"value\\"}"}',
      })

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // Should recursively parse nested JSON strings
      expect(result.result).toEqual({
        outer: { inner: { deep: 'value' } },
      })
      expect(result.error).toBeUndefined()
    })

    it('should parse nested JSON in arrays with transformNestedStrings option', async () => {
      const input = 'GET https://api.example.com/logs'
      const params = { transformNestedStrings: { json: true } }

      const jsonContent = JSON.stringify([
        { dt: '2026-01-11', raw: '{"id":1}' },
        { dt: '2026-01-12', raw: '{"id":2}' },
      ])

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result.result).toEqual([
        { dt: '2026-01-11', raw: { id: 1 } },
        { dt: '2026-01-12', raw: { id: 2 } },
      ])
      expect(result.error).toBeUndefined()
    })

    it('should work with transformNestedStrings and NDJSON content type', async () => {
      const input = 'GET https://api.example.com/logs'
      const params = { transformNestedStrings: { json: true } }

      const ndjsonContent = `{"dt":"2026-01-11","raw":"{\\"message\\":\\"hello\\"}"}
{"dt":"2026-01-12","raw":"{\\"message\\":\\"world\\"}"}`

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/x-ndjson']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(ndjsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result.result).toEqual([
        { dt: '2026-01-11', raw: { message: 'hello' } },
        { dt: '2026-01-12', raw: { message: 'world' } },
      ])
      expect(result.error).toBeUndefined()
    })

    it('should work with transformNestedStrings and toon format', async () => {
      const input = 'GET https://api.example.com/logs'
      const params = { transformNestedStrings: { json: true }, format: 'toon' }

      const jsonContent = JSON.stringify({
        dt: '2026-01-11',
        raw: '{"message":"hello"}',
      })

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // transformNestedStrings should run first, then toon should encode the result
      expect(typeof result.result).toBe('string')
      expect(result.result).toContain('2026-01-11')
      expect(result.result).toContain('hello')
      expect(result.error).toBeUndefined()
    })

    it('should not modify non-JSON strings with transformNestedStrings option', async () => {
      const input = 'GET https://api.example.com/data'
      const params = { transformNestedStrings: { json: true } }

      const jsonContent = JSON.stringify({
        name: 'John Doe',
        description: 'A regular string that is not JSON',
        number: 42,
      })

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // Non-JSON strings should remain as strings
      expect(result.result).toEqual({
        name: 'John Doe',
        description: 'A regular string that is not JSON',
        number: 42,
      })
      expect(result.error).toBeUndefined()
    })

    it('should handle large JSON files (>0.5MB) as plain text when truncated', async () => {
      const input = 'GET https://api.example.com/large-data'
      const params = {} // No explicit format

      // Create a truncated large JSON string (simulating what happens when size limit is exceeded)
      const largeJsonArray = Array.from({ length: 5000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: `Description for item ${i}`,
      }))

      const fullJson = JSON.stringify({ data: largeJsonArray })
      const truncatedJson = fullJson.slice(0, FETCH_RESPONSE_SIZE) // Truncate to 0.5 MB

      // When truncated, the fetch withLimit function changes content-type from application/json to text/plain
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([
          ['content-type', 'text/plain'], // Changed from application/json
          [HEADER_CONTENT_TRUNCATED, 'true'], // Indicates truncation
          [HEADER_CONTENT_ORIGINAL_TYPE, 'application/json'], // Original type before truncation
          [HEADER_CONTENT_ORIGINAL_SIZE, fullJson.length.toString()],
        ]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(truncatedJson)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // Should return as plain text, not attempt JSON parsing
      expect(result).toEqual({
        result: {
          status: 200,
          body: truncatedJson,
        },
      })

      // Should NOT have attempted to parse as JSON
      expect(result.error).toBeUndefined()
    })

    it('should handle truncated JSON with explicit json format as plain text', async () => {
      const input = 'GET https://api.example.com/large-data'
      const params = { format: 'json' } // Explicitly requesting JSON format

      const largeJsonArray = Array.from({ length: 5000 }, (_, i) => ({
        id: i,
        data: `Data ${i}`,
      }))

      const fullJson = JSON.stringify({ items: largeJsonArray })
      const truncatedJson = fullJson.slice(0, FETCH_RESPONSE_SIZE)

      // The withLimit function remaps application/json to text/plain when truncated
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([
          ['content-type', 'text/plain'], // Remapped from application/json
          [HEADER_CONTENT_TRUNCATED, 'true'],
          [HEADER_CONTENT_ORIGINAL_TYPE, 'application/json'],
          [HEADER_CONTENT_ORIGINAL_SIZE, fullJson.length.toString()],
        ]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(truncatedJson)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // Even with format: 'json', should return as plain text when truncated
      expect(result).toEqual({
        result: {
          status: 200,
          body: truncatedJson,
        },
      })

      expect(result.error).toBeUndefined()
    })

    it('should convert truncated HTML to text when text format is requested', async () => {
      html2text.mockReturnValue('Converted truncated page text')

      const input = 'GET https://www.bankofengland.co.uk/large-page'
      const params = { format: 'text' }

      const htmlContent = [
        '<!DOCTYPE html><html><body><main>',
        'Important report content',
        '</main></body></html>',
      ].join('')

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([
          ['content-type', 'text/html'],
          [HEADER_CONTENT_TRUNCATED, 'true'],
          [HEADER_CONTENT_ORIGINAL_TYPE, 'text/html; charset=utf-8'],
          [HEADER_CONTENT_ORIGINAL_SIZE, (FETCH_RESPONSE_SIZE + 1).toString()],
        ]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(htmlContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(html2text).toHaveBeenCalledWith(htmlContent, {
        url: 'https://www.bankofengland.co.uk/large-page',
        selectors: 'article,main,body,html',
      })

      expect(result).toEqual({
        result: 'Converted truncated page text',
      })
    })

    it('should convert truncated HTML to text when request options request text format', async () => {
      html2text.mockReturnValue('Converted truncated template page text')

      const input = `method: GET
url: https://www.bankofengland.co.uk/large-page
options:
  format: text`

      const params = {}

      const htmlContent = [
        '<!DOCTYPE html><html><body><main>',
        'Important report content',
        '</main></body></html>',
      ].join('')

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([
          ['content-type', 'text/html'],
          [HEADER_CONTENT_TRUNCATED, 'true'],
          [HEADER_CONTENT_ORIGINAL_TYPE, 'text/html; charset=utf-8'],
          [HEADER_CONTENT_ORIGINAL_SIZE, (FETCH_RESPONSE_SIZE + 1).toString()],
        ]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(htmlContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(html2text).toHaveBeenCalledWith(htmlContent, {
        url: 'https://www.bankofengland.co.uk/large-page',
        selectors: 'article,main,body,html',
      })

      expect(result).toEqual({
        result: 'Converted truncated template page text',
      })
    })

    it('should not parse truncated JSON with JSONPath selector', async () => {
      const input = 'GET https://api.example.com/large-data'
      const params = { jsonpath: '$.data[*]' }

      const largeJsonArray = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        value: `Value ${i}`,
      }))

      const fullJson = JSON.stringify({ data: largeJsonArray })
      const truncatedJson = fullJson.slice(0, FETCH_RESPONSE_SIZE)

      // Truncated response with content-type changed to text/plain
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([
          ['content-type', 'text/plain'],
          [HEADER_CONTENT_TRUNCATED, 'true'],
          [HEADER_CONTENT_ORIGINAL_TYPE, 'application/json'],
        ]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(truncatedJson)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // JSONPath should not be applied since content-type is text/plain
      expect(matchJsonpath).not.toHaveBeenCalled()

      // Should return raw text
      expect(result).toEqual({
        result: {
          status: 200,
          body: truncatedJson,
        },
      })
    })

    it('should not parse truncated JSON with JMESPath selector', async () => {
      const input = 'GET https://api.example.com/large-data'
      const params = { jmespath: 'data[?id > `100`]' }

      const largeData = {
        data: Array.from({ length: 8000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
        })),
      }

      const fullJson = JSON.stringify(largeData)
      const truncatedJson = fullJson.slice(0, FETCH_RESPONSE_SIZE)

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([
          ['content-type', 'text/plain'],
          [HEADER_CONTENT_TRUNCATED, 'true'],
          [HEADER_CONTENT_ORIGINAL_TYPE, 'application/json'],
        ]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(truncatedJson)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // JMESPath should not be applied
      expect(matchJmespath).not.toHaveBeenCalled()

      // Should return raw text
      expect(result).toEqual({
        result: {
          status: 200,
          body: truncatedJson,
        },
      })
    })

    it('should handle rerank parameter with truncated JSON gracefully', async () => {
      const input = 'GET https://api.example.com/search'
      const params = { rerank: 'search query' }

      const searchResults = Array.from({ length: 20000 }, (_, i) => ({
        id: i,
        title: `Result ${i}`,
        content: `Content for result ${i}`,
      }))

      const fullJson = JSON.stringify({ results: searchResults })
      const truncatedJson = fullJson.slice(0, FETCH_RESPONSE_SIZE)

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([
          ['content-type', 'text/plain'],
          [HEADER_CONTENT_TRUNCATED, 'true'],
          [HEADER_CONTENT_ORIGINAL_TYPE, 'application/json'],
        ]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(truncatedJson)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // Reranking should not be attempted on plain text
      expect(rerank).not.toHaveBeenCalled()

      // Should return raw truncated text
      expect(result).toEqual({
        result: {
          status: 200,
          body: truncatedJson,
        },
      })
    })
  })

  describe('JSONPath and JMESPath', () => {
    beforeEach(() => {
      jest.doMock('@/lib/jsonpath', () => jest.fn())
      jest.doMock('@/lib/jmespath', () => jest.fn())
    })

    it('should apply JSONPath transformation', async () => {
      matchJsonpath.mockReturnValue([{ id: 1 }, { id: 2 }])

      const input = 'GET https://api.example.com/data'
      const params = { jsonpath: '$.items[*]' }

      const jsonContent = '{"items": [{"id": 1}, {"id": 2}]}'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(matchJsonpath).toHaveBeenCalledWith('$.items[*]', {
        items: [{ id: 1 }, { id: 2 }],
      })

      expect(result).toEqual({
        result: [{ id: 1 }, { id: 2 }],
      })
    })

    it('should handle JSONPath transformation errors', async () => {
      matchJsonpath.mockImplementation(() => {
        throw new Error('Invalid JSONPath')
      })

      const input = 'GET https://api.example.com/data'
      const params = { jsonpath: '$.invalid[' }

      const jsonContent = '{"items": []}'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // transform library returns more descriptive error messages
      expect(result.error).toContain('JSONPath transformation failed')
    })

    it('should apply JMESPath transformation', async () => {
      matchJmespath.mockReturnValue([{ name: 'item1' }])

      const input = 'GET https://api.example.com/data'
      const params = { jmespath: 'items[?name==`item1`]' }

      const jsonContent = '{"items": [{"name": "item1"}, {"name": "item2"}]}'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(matchJmespath).toHaveBeenCalledWith('items[?name==`item1`]', {
        items: [{ name: 'item1' }, { name: 'item2' }],
      })

      expect(result).toEqual({
        result: [{ name: 'item1' }],
      })
    })

    it('should NOT apply JSONPath filter when there are HTTP errors', async () => {
      matchJsonpath.mockReturnValue([{ id: 1 }])

      const input = 'GET https://api.example.com/data'
      const params = { jsonpath: '$.items[*]' }

      const jsonContent = '{"error": "Not found"}'

      const mockResponse = {
        ok: false,
        status: 404,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // JSONPath should NOT be called because there's an error
      expect(matchJsonpath).not.toHaveBeenCalled()

      expect(result).toEqual({
        result: {
          error: 'Not found',
        },
        error: 'Status code: 404',
      })
    })

    it('should NOT apply JMESPath filter when there are HTTP errors', async () => {
      matchJmespath.mockReturnValue([{ name: 'item1' }])

      const input = 'GET https://api.example.com/data'
      const params = { jmespath: 'items[*]' }

      const jsonContent = '{"error": "Server error"}'

      const mockResponse = {
        ok: false,
        status: 500,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // JMESPath should NOT be called because there's an error
      expect(matchJmespath).not.toHaveBeenCalled()

      expect(result).toEqual({
        result: {
          error: 'Server error',
        },
        error: 'Status code: 500',
      })
    })

    it('should NOT apply JSONPath filter when there are network errors', async () => {
      matchJsonpath.mockReturnValue([{ id: 1 }])

      const input = 'GET https://api.example.com/data'
      const params = { jsonpath: '$.items[*]' }

      const networkError = new Error('Network timeout')

      fetch.mockRejectedValue(networkError)

      const result = await executeFetchAction(input, params, mockOptions)

      // JSONPath should NOT be called because there's an error
      expect(matchJsonpath).not.toHaveBeenCalled()

      expect(result).toEqual({
        error: 'Network timeout',
      })
    })

    it('should NOT apply JMESPath filter when there are network errors', async () => {
      matchJmespath.mockReturnValue([{ name: 'item1' }])

      const input = 'GET https://api.example.com/data'
      const params = { jmespath: 'items[*]' }

      const networkError = new Error('Connection refused')

      fetch.mockRejectedValue(networkError)

      const result = await executeFetchAction(input, params, mockOptions)

      // JMESPath should NOT be called because there's an error
      expect(matchJmespath).not.toHaveBeenCalled()

      expect(result).toEqual({
        error: 'Connection refused',
      })
    })

    it('should NOT apply JSONPath filter when there are binary content errors', async () => {
      matchJsonpath.mockReturnValue([{ id: 1 }])

      const input = 'GET https://api.example.com/data'
      const params = { jsonpath: '$.items[*]' }

      const binaryData = new ArrayBuffer(8)

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/octet-stream']]),
        arrayBuffer: jest.fn().mockResolvedValue(binaryData),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // JSONPath should NOT be called because there's an error
      expect(matchJsonpath).not.toHaveBeenCalled()

      expect(result).toEqual({
        error: 'Response is not text',
      })
    })
  })

  describe('rerank functionality', () => {
    it('should apply rerank transformation', async () => {
      const input = 'GET https://api.example.com/data'
      const params = { rerank: 'search query' }

      const jsonContent =
        '[{"id": 1, "name": "item1"}, {"id": 2, "name": "item2"}]'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      rerank.mockResolvedValue({
        documents: [{ id: '1' }, { id: '0' }],
        usage: { model: 'rerank-v4-fast', inputTokens: 0, outputTokens: 1 },
      })

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result.result).toEqual([
        { id: 2, name: 'item2' },
        { id: 1, name: 'item1' },
      ])
    })

    it('should handle rerank errors', async () => {
      const input = 'GET https://api.example.com/data'
      const params = { rerank: 'search query' }

      const jsonContent = '[{"id": 1}]'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      rerank.mockRejectedValue(new Error('Rerank failed'))

      const result = await executeFetchAction(input, params, mockOptions)

      // transform library returns more descriptive error messages
      expect(result.error).toContain('Rerank transformation failed')
    })
  })

  describe('debug mode', () => {
    it('should include debug information when debug flag is set', async () => {
      const input = 'GET https://api.example.com/data'
      const params = { debug: true }

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([
          ['content-type', 'application/json'],
          ['x-custom-header', 'custom-value'],
        ]),
        arrayBuffer: jest
          .fn()
          .mockResolvedValue(str2buf('{"result": "success"}')),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result.result).toHaveProperty('result')

      expect(result.result).toHaveProperty('debug')

      expect(result.result.debug).toHaveProperty('request')

      expect(result.result.debug).toHaveProperty('response')

      expect(result.result.debug.request).toMatchObject({
        method: 'GET',
        url: 'https://api.example.com/data',
      })

      expect(result.result.debug.response).toMatchObject({
        status: 200,
        body: '{"result": "success"}',
      })
    })
  })

  describe('logging and usage recording', () => {
    it('should log successful fetch events', async () => {
      const input = 'GET https://api.example.com'
      const params = {}

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('response')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      expect(logEvent).toHaveBeenCalledWith({
        user: { id: mockOptions.userId },
        type: 'action.fetch',
        relations: {
          abilityId: 'ability-123',
          blueprintId: 'blueprint-123',
          skillsetId: 'skillset-123',
        },
        meta: expect.objectContaining({
          params,
          request: expect.objectContaining({
            method: 'GET',
            url: 'https://api.example.com',
            status: 200,
            error: null,
          }),
        }),
      })

      expect(recordFetchUsage).toHaveBeenCalledWith({
        user: { id: mockOptions.userId },
        count: 1,
        meta: {
          reason: 'action/fetch',
        },
      })
    })

    it('should log HTTP error status codes as failed fetch events', async () => {
      const input = 'POST https://api.example.com'
      const params = {}

      const mockResponse = {
        ok: false,
        status: 400,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest
          .fn()
          .mockResolvedValue(str2buf('{"error":"Bad Request"}')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      expect(logEvent).toHaveBeenCalledWith({
        user: { id: mockOptions.userId },
        type: 'action.fetch',
        relations: {
          abilityId: 'ability-123',
          blueprintId: 'blueprint-123',
          skillsetId: 'skillset-123',
        },
        meta: expect.objectContaining({
          request: expect.objectContaining({
            method: 'POST',
            status: 400,
            error: 'Status code: 400',
          }),
        }),
      })
    })

    it('should log failed fetch events', async () => {
      const input = 'GET https://api.example.com'
      const params = {}

      const networkError = new Error('Connection timeout')

      fetch.mockRejectedValue(networkError)

      await executeFetchAction(input, params, mockOptions)

      expect(logEvent).toHaveBeenCalledWith({
        user: { id: mockOptions.userId },
        type: 'action.fetch',
        relations: {
          abilityId: 'ability-123',
          blueprintId: 'blueprint-123',
          skillsetId: 'skillset-123',
        },
        meta: expect.objectContaining({
          request: expect.objectContaining({
            status: 0,
            error: 'Connection timeout',
          }),
        }),
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty response body', async () => {
      const input = 'GET https://api.example.com'
      const params = {}

      const mockResponse = {
        ok: true,
        status: 204,
        headers: new Map(),
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result).toEqual({
        result: {
          status: 204,
          body: '',
        },
      })
    })

    it('should handle malformed request input', async () => {
      const input = 'INVALID REQUEST FORMAT'
      const params = {}

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('response')),
      }

      fetch.mockResolvedValue(mockResponse)

      // should not throw - parseRequest handles malformed input gracefully

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result.result).toBeDefined()
    })

    it('should handle missing optional context values', async () => {
      getContextContact.mockReturnValue(null)
      getContextTimezone.mockReturnValue(null)

      const input = 'GET https://api.example.com'
      const params = { context: 'contact,conversation' }

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('response')),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result.result).toBeDefined()
    })

    it('should handle partial contact information', async () => {
      const partialContact = {
        id: 'contact-123',
        name: 'John Doe',

        // missing email, phone, nick
      }

      getContextContact.mockReturnValue(partialContact)

      const input = 'GET https://api.example.com'
      const params = { context: 'contact' }

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('response')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-chatbotkit-contact-id': 'contact-123',
            'x-chatbotkit-contact-name': 'John Doe',
          }),
        })
      )

      const headers = swapSecrets.mock.calls[0][0]

      expect(headers).not.toHaveProperty('x-chatbotkit-contact-email')
      expect(headers).not.toHaveProperty('x-chatbotkit-contact-phone')
      expect(headers).not.toHaveProperty('x-chatbotkit-contact-nick')
    })

    // @note this test pollutes the debug log a lot - we either need to disable
    // debugging at this very moment or simply skip the test for now - we made
    // the decision to skip
    it.skip('should handle large response bodies', async () => {
      const input = 'GET https://api.example.com/large-data'
      const params = {}

      const largeContent = 'x'.repeat(1024 * 1024) // 1MB of data

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/plain']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(largeContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result.result.body).toBe(largeContent)
    })
  })

  describe('error detection functionality', () => {
    beforeEach(() => {
      jest.doMock('@/lib/jsonpath', () => jest.fn())
      jest.doMock('@/lib/jmespath', () => jest.fn())
    })

    it('should detect error using JSONPath when errorJsonpath is provided', async () => {
      matchJsonpath.mockReturnValue(false) // simulate error condition

      const input = 'GET https://api.slack.com/test'
      const params = { errorJsonpath: '$.ok' }

      const jsonContent = '{"ok": false, "error": "invalid_auth"}'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(matchJsonpath).toHaveBeenCalledWith('$.ok', {
        ok: false,
        error: 'invalid_auth',
      })

      // transform library parses the content, then detects the error
      expect(result.error).toBe('Error detected via JSONPath $.ok: false')
      expect(result.result).toEqual({ ok: false, error: 'invalid_auth' })
    })

    it('should detect error using JMESPath when errorJmespath is provided', async () => {
      matchJmespath.mockReturnValue('invalid_auth') // simulate error condition

      const input = 'GET https://api.example.com/test'
      const params = { errorJmespath: 'error' }

      const jsonContent = '{"success": false, "error": "invalid_auth"}'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(matchJmespath).toHaveBeenCalledWith('error', {
        success: false,
        error: 'invalid_auth',
      })

      // transform library parses the content, then detects the error
      expect(result.error).toBe(
        'Error detected via JMESPath error: "invalid_auth"'
      )
      expect(result.result).toEqual({ success: false, error: 'invalid_auth' })
    })

    it('should prefer JSONPath over JMESPath when both are provided and JSONPath detects error', async () => {
      matchJsonpath.mockReturnValue(false) // error detected via JSONPath
      matchJmespath.mockReturnValue('some_error') // would also detect error

      const input = 'GET https://api.example.com/test'

      const params = {
        errorJsonpath: '$.ok',
        errorJmespath: 'error',
      }

      const jsonContent = '{"ok": false, "error": "some_error"}'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(matchJsonpath).toHaveBeenCalledWith('$.ok', {
        ok: false,
        error: 'some_error',
      })
      expect(matchJmespath).not.toHaveBeenCalled() // should not be called since JSONPath detected error

      expect(result.error).toContain('JSONPath')
      expect(result.error).not.toContain('JMESPath')
    })

    it('should check JMESPath when JSONPath does not detect error', async () => {
      matchJsonpath.mockReturnValue(true) // no error detected via JSONPath
      matchJmespath.mockReturnValue('auth_failed') // error detected via JMESPath

      const input = 'GET https://api.example.com/test'

      const params = {
        errorJsonpath: '$.success',
        errorJmespath: 'errorMessage',
      }

      const jsonContent = '{"success": true, "errorMessage": "auth_failed"}'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(matchJsonpath).toHaveBeenCalledWith('$.success', {
        success: true,
        errorMessage: 'auth_failed',
      })
      expect(matchJmespath).toHaveBeenCalledWith('errorMessage', {
        success: true,
        errorMessage: 'auth_failed',
      })

      expect(result.error).toContain('JMESPath')
    })

    it('should not detect error when paths return falsy values', async () => {
      matchJsonpath.mockReturnValue(null) // no error
      matchJmespath.mockReturnValue(undefined) // no error

      const input = 'GET https://api.example.com/test'

      const params = {
        errorJsonpath: '$.error',
        errorJmespath: 'errorMessage',
      }

      const jsonContent = '{"success": true, "data": "some_data"}'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result).toEqual({
        result: {
          success: true,
          data: 'some_data',
        },
      })
      expect(result.error).toBeUndefined()
    })

    it('should not detect error when paths return empty arrays', async () => {
      matchJsonpath.mockReturnValue([]) // empty array
      matchJmespath.mockReturnValue([]) // empty array

      const input = 'GET https://api.example.com/test'

      const params = {
        errorJsonpath: '$.errors[*]',
        errorJmespath: 'warnings',
      }

      const jsonContent = '{"success": true, "errors": [], "warnings": []}'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result.error).toBeUndefined()
    })

    it('should detect error when paths return non-empty arrays', async () => {
      matchJsonpath.mockReturnValue(['error1', 'error2']) // non-empty array

      const input = 'GET https://api.example.com/test'
      const params = { errorJsonpath: '$.errors[*]' }

      const jsonContent = '{"errors": ["error1", "error2"]}'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result.error).toContain('Error detected via JSONPath')
      expect(result.error).toContain('["error1","error2"]')
    })

    it('should continue with normal processing when no error is detected', async () => {
      matchJsonpath.mockReturnValue(null) // no error from error detection

      const input = 'GET https://api.example.com/test'

      const params = {
        errorJsonpath: '$.error',
        format: 'json',
      }

      const jsonContent = '{"success": true, "data": "processed"}'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result).toEqual({
        result: {
          success: true,
          data: 'processed',
        },
      })
    })

    it('should not run error detection when action already has error', async () => {
      const input = 'GET https://api.example.com/test'
      const params = { errorJsonpath: '$.error' }

      const mockResponse = {
        ok: false, // this will set actionReturn.error
        status: 404,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest
          .fn()
          .mockResolvedValue(str2buf('{"error": "not_found"}')),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // should have HTTP error, not error detection

      expect(result.error).toBe('Status code: 404')
      expect(matchJsonpath).not.toHaveBeenCalled()
    })

    it('should handle JSONPath errors gracefully', async () => {
      matchJsonpath.mockImplementation(() => {
        throw new Error('Invalid JSONPath syntax')
      })

      const input = 'GET https://api.example.com/test'
      const params = { errorJsonpath: '$.invalid[syntax' }

      const jsonContent = '{"success": true}'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // should continue with normal processing despite error detection failure

      expect(result).toEqual({
        result: {
          success: true,
        },
      })
    })

    it('should handle JMESPath errors gracefully', async () => {
      matchJmespath.mockImplementation(() => {
        throw new Error('Invalid JMESPath syntax')
      })

      const input = 'GET https://api.example.com/test'
      const params = { errorJmespath: 'invalid.syntax[' }

      const jsonContent = '{"success": true}'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // should continue with normal processing despite error detection failure

      expect(result).toEqual({
        result: {
          success: true,
        },
      })
    })

    it('should work with params to provide error detection options', async () => {
      matchJsonpath.mockReturnValue(false) // Error detected

      const input = 'GET https://api.example.com/test'
      const params = { errorJsonpath: '$.ok' }

      const jsonContent = '{"ok": false, "error": "test_error"}'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result.error).toContain('Error detected via JSONPath')
    })

    it('should work with request.options.error.jsonpath', async () => {
      matchJsonpath.mockReturnValue(false) // error detected

      const input = `
method: GET
url: https://api.example.com/test
options:
  error:
    jsonpath: $.ok
`

      const params = {}

      const jsonContent = '{"ok": false, "error": "test_error"}'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result.error).toContain('Error detected via JSONPath')
      expect(matchJsonpath).toHaveBeenCalledWith('$.ok', expect.any(Object))
    })

    it('should work with request.options.error.jmespath', async () => {
      matchJmespath.mockReturnValue('Something went wrong') // error detected

      const input = `
method: GET
url: https://api.example.com/test
options:
  error:
    jmespath: error
`

      const params = {}

      const jsonContent = '{"success": true, "error": "Something went wrong"}'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result.error).toContain('Error detected via JMESPath')
      expect(matchJmespath).toHaveBeenCalledWith('error', expect.any(Object))
    })

    it('should prioritize params over request.options.error paths', async () => {
      matchJsonpath.mockReturnValue('param_error') // error detected

      const input = `
method: GET
url: https://api.example.com/test
options:
  error:
    jsonpath: $.nested.error
`

      const params = { errorJsonpath: '$.param_error' } // this should be used

      const jsonContent =
        '{"param_error": "param_error", "nested": {"error": "options_error"}}'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result.error).toContain('Error detected via JSONPath')
      expect(matchJsonpath).toHaveBeenCalledWith(
        '$.param_error',
        expect.any(Object)
      )
    })

    it('should handle non-JSON responses gracefully', async () => {
      const input = 'GET https://api.example.com/test'
      const params = { errorJsonpath: '$.error' }

      const htmlContent = '<html><body>Not Found</body></html>'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(htmlContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // should not attempt error detection on non-JSON content

      expect(matchJsonpath).not.toHaveBeenCalled()
      expect(result.error).toBeUndefined()
    })

    it('should attempt to parse as JSON even with incorrect content type', async () => {
      matchJsonpath.mockReturnValue(false) // error detected

      const input = 'GET https://api.example.com/test'
      const params = { errorJsonpath: '$.ok' }

      const jsonContent = '{"ok": false, "error": "test_error"}'

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/plain']]), // wrong content type
        arrayBuffer: jest.fn().mockResolvedValue(str2buf(jsonContent)),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      expect(matchJsonpath).toHaveBeenCalledWith('$.ok', {
        ok: false,
        error: 'test_error',
      })
      expect(result.error).toContain('Error detected via JSONPath')
    })

    describe('Slack API use case', () => {
      it('should detect Slack API errors with ok: false', async () => {
        matchJsonpath.mockReturnValue(false) // slack API error

        const input = 'GET https://slack.com/api/auth.test'
        const params = { errorJsonpath: '$.ok' }

        const slackErrorResponse = '{"ok": false, "error": "invalid_auth"}'

        const mockResponse = {
          ok: true, // HTTP 200
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          arrayBuffer: jest.fn().mockResolvedValue(str2buf(slackErrorResponse)),
        }

        fetch.mockResolvedValue(mockResponse)

        const result = await executeFetchAction(input, params, mockOptions)

        // transform library parses the content, then detects the error
        expect(result.error).toBe('Error detected via JSONPath $.ok: false')
        expect(result.result).toEqual({ ok: false, error: 'invalid_auth' })
      })

      it('should not detect error when Slack API returns ok: true', async () => {
        matchJsonpath.mockReturnValue(true) // slack API success

        const input = 'GET https://slack.com/api/auth.test'
        const params = { errorJsonpath: '$.ok', format: 'json' }

        const slackSuccessResponse =
          '{"ok": true, "user": "U123456", "team": "T123456"}'

        const mockResponse = {
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          arrayBuffer: jest
            .fn()
            .mockResolvedValue(str2buf(slackSuccessResponse)),
        }

        fetch.mockResolvedValue(mockResponse)

        const result = await executeFetchAction(input, params, mockOptions)

        expect(result).toEqual({
          result: {
            ok: true,
            user: 'U123456',
            team: 'T123456',
          },
        })
        expect(result.error).toBeUndefined()
      })
    })
  })

  describe('auxiliary URL transformation', () => {
    it('should record and transform auxiliary URL to shortened format', async () => {
      const input = 'GET /api/auxiliary/skillset/ability/notion/search'
      const params = {}

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest
          .fn()
          .mockResolvedValue(str2buf('{"result": "success"}')),
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await executeFetchAction(input, params, mockOptions)

      // verify the URL was transformed in the log call

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: {
            params: {},
            request: {
              error: null,
              method: 'GET',
              status: 200,
              timeout: 10000,
              url: 'auxiliary:notion/search',
            },
          },
        })
      )

      // when content-type is application/json, the response gets parsed

      expect(result).toEqual({
        result: {
          result: 'success',
        },
      })
    })

    it('should transform hubspot auxiliary URL', async () => {
      const input = 'POST /api/auxiliary/skillset/ability/hubspot/sql'
      const params = {}

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('{"data": []}')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: {
            params: {},
            request: {
              error: null,
              method: 'POST',
              status: 200,
              timeout: 10000,
              url: 'auxiliary:hubspot/sql',
            },
          },
        })
      )
    })

    it('should transform google calendar auxiliary URL', async () => {
      const input = 'GET /api/auxiliary/skillset/ability/google/calendar/list'
      const params = {}

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('{"calendars": []}')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: {
            params: {},
            request: {
              error: null,
              method: 'GET',
              status: 200,
              timeout: 10000,
              url: 'auxiliary:google/calendar/list',
            },
          },
        })
      )
    })

    it('should not transform non-auxiliary URLs', async () => {
      const input = 'GET https://api.example.com/some/endpoint'
      const params = {}

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/plain']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('success')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      // Verify the URL was NOT transformed
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: {
            params: {},
            request: {
              error: null,
              method: 'GET',
              status: 200,
              timeout: 10000,
              url: 'https://api.example.com/some/endpoint',
            },
          },
        })
      )
    })

    it('should handle auxiliary URLs with query parameters', async () => {
      const input =
        'GET /api/auxiliary/skillset/ability/notion/search?q=test&limit=10'

      const params = {}

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('{"results": []}')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: {
            params: {},
            request: {
              error: null,
              method: 'GET',
              status: 200,
              timeout: 10000,
              url: 'auxiliary:notion/search?q=test&limit=10',
            },
          },
        })
      )
    })

    it('should handle auxiliary URLs with fragments', async () => {
      const input =
        'GET /api/auxiliary/skillset/ability/google/docs/document/fetch#section1'

      const params = {}

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('{"document": {}}')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: {
            params: {},
            request: {
              error: null,
              method: 'GET',
              status: 200,
              timeout: 10000,
              url: 'auxiliary:google/docs/document/fetch#section1',
            },
          },
        })
      )
    })

    it('should handle malformed auxiliary URLs gracefully', async () => {
      const input = 'GET /api/auxiliary/skillset/ability/'
      const params = {}

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/plain']]),
        arrayBuffer: jest.fn().mockResolvedValue(str2buf('ok')),
      }

      fetch.mockResolvedValue(mockResponse)

      await executeFetchAction(input, params, mockOptions)

      // should not transform if there's no path after the auxiliary prefix

      expect(fetch).toHaveBeenCalledWith(
        '/api/auxiliary/skillset/ability/',
        expect.any(Object)
      )
    })
  })

  describe('constants validation', () => {
    it('should export correct timeout constants', () => {
      expect(FETCH_TIMEOUT_MIN).toBe(10000) // 10 seconds
      expect(FETCH_TIMEOUT_MAX).toBe(300000) // 5 minutes
      expect(DEFAULT_RERANK_TOP_N).toBe(10)
    })
  })
})

describe('parseRequest', () => {
  it('should parse the input as YAML and update the request URI if YAML parsing is successful', () => {
    const input = `
      uri: https://example.com/api
      query:
        param1: value1
        param2: value2
    `

    const result = parseRequest(input)
    const expectedUrl = new URL('https://example.com/api')

    expectedUrl.searchParams.set('param1', 'value1')
    expectedUrl.searchParams.set('param2', 'value2')

    expect(result.uri).toBe(expectedUrl.toString())
    expect(result.url).toBe(expectedUrl.toString())
  })

  it('should parse the input as HTTP request if YAML parsing fails', () => {
    const input = 'GET /api/users'
    const result = parseRequest(input)

    expect(result).toEqual(parseHttpRequest(input))
  })

  it('should parse http urls as requests', () => {
    const input = 'http://example.com/api'
    const result = parseRequest(input)

    expect(result.uri).toBe(input)
    expect(result.url).toBe(input)
  })

  it('should handle double-quoted JSON string containing a URL', () => {
    // edge-case: input is a JSON-encoded string like '"https://example.com/api"'
    const input = '"https://example.com/api"'
    const result = parseRequest(input)

    expect(result.method).toBe('GET')
    expect(result.uri).toBe('https://example.com/api')
    expect(result.url).toBe('https://example.com/api')
  })

  it('should handle double-quoted JSON string containing a URL with query params', () => {
    const input = '"https://example.com/api?foo=bar&baz=123"'
    const result = parseRequest(input)

    expect(result.method).toBe('GET')
    expect(result.uri).toBe('https://example.com/api?foo=bar&baz=123')
    expect(result.url).toBe('https://example.com/api?foo=bar&baz=123')
  })
})

describe('normalizeRequest', () => {
  it('should be able to fix malformed json', () => {
    const input = `
      method: POST
      uri: https://example.com/api
      headers:
        Content-Type: application/json
      body: |
        {
          "content": "Nome: Fulano de Tal
        Telefone: 27999999999
        Email: fulano@email.com
        Descrição: Café tá com gosto ruim",
          "name": "Café gosto ruim",
          "code": "398"
        }
    `

    const result = normalizeRequest(parseRequest(input))

    expect(() => JSON.parse(result.body)).not.toThrow()
  })

  it('should not omit non-optional values when expressed in yaml', () => {
    const input = `
      method: POST
      uri: https://example.com/api
      headers:
        Content-Type: application/json
      body:
        test123: true
        test456: false
        test789: null
    `

    const result = normalizeRequest(parseRequest(input))

    expect(result.body).toBe(
      JSON.stringify({
        test123: true,
        test456: false,
        test789: null,
      })
    )
  })

  it('should omit optional values when expressed in yaml', () => {
    const input = `
      method: POST
      uri: https://example.com/api
      headers:
        Content-Type: application/json
      body:
        test123?: true
        test456?: false
        test789?: null
    `

    const result = normalizeRequest(parseRequest(input))

    expect(result.body).toBe(
      JSON.stringify({
        test123: true,
        test456: false,
      })
    )
  })

  it('should omit empty objects when expressed in yaml', () => {
    const input = `
      method: POST
      uri: https://example.com/api
      headers:
        Content-Type: application/json
      body:
        object?:
          test123?: null
    `

    const result = normalizeRequest(parseRequest(input))

    expect(result.body).toBe(JSON.stringify({}))
  })

  it('should default object body to application/json when no content-type header present', () => {
    const input = `
      method: POST
      uri: https://example.com/api
      body:
        hello: world
        answer: 42
    `

    const result = normalizeRequest(parseRequest(input))

    expect(result.headers['content-type']).toBe('application/json')
    expect(result.body).toBe(
      JSON.stringify({
        hello: 'world',
        answer: 42,
      })
    )
  })

  it('should map top-level authorization to headers while content type comes from headers', () => {
    const input = `
      method: POST
      uri: https://example.com/api
      headers:
        Content-Type: application/json
      authorization: Bearer token123
      body:
        hello: world
    `

    const result = normalizeRequest(parseRequest(input))

    expect(result.headers['content-type']).toBe('application/json')
    expect(result.headers.authorization).toBe('Bearer token123')
    expect(result.body).toBe(JSON.stringify({ hello: 'world' }))
  })
})

describe('insertSearchParams', () => {
  let searchParams

  beforeEach(() => {
    searchParams = new URLSearchParams()
  })

  describe('with array input', () => {
    it('should handle array of strings', () => {
      insertSearchParams(['key1', 'key2', 'key3'], searchParams)

      expect(searchParams.get('key1')).toBe('')
      expect(searchParams.get('key2')).toBe('')
      expect(searchParams.get('key3')).toBe('')
    })

    it('should handle array with objects', () => {
      insertSearchParams(
        [{ param1: 'value1' }, { param2: 'value2' }, 'stringParam'],
        searchParams
      )

      expect(searchParams.get('param1')).toBe('value1')
      expect(searchParams.get('param2')).toBe('value2')
      expect(searchParams.get('stringParam')).toBe('')
    })

    it('should skip null and undefined items in array', () => {
      insertSearchParams(['valid', null, undefined, 'another'], searchParams)

      expect(searchParams.get('valid')).toBe('')
      expect(searchParams.get('another')).toBe('')
      expect(searchParams.toString()).toBe('valid=&another=')
    })

    it('should handle empty array', () => {
      insertSearchParams([], searchParams)

      expect(searchParams.toString()).toBe('')
    })

    it('should handle array with optional properties', () => {
      insertSearchParams(
        [{ 'param1?': 'value1', 'param2?': null, param3: 'value3' }],
        searchParams
      )

      expect(searchParams.get('param1')).toBe('value1')
      expect(searchParams.has('param2')).toBe(false)
      expect(searchParams.get('param3')).toBe('value3')
    })
  })

  describe('with object input', () => {
    it('should handle simple object', () => {
      insertSearchParams({ param1: 'value1', param2: 'value2' }, searchParams)

      expect(searchParams.get('param1')).toBe('value1')
      expect(searchParams.get('param2')).toBe('value2')
    })

    it('should handle object with optional properties', () => {
      insertSearchParams(
        {
          required: 'value',
          'optional?': null,
          'optionalEmpty?': '',
          'optionalArray?': [],
          'optionalObject?': {},
        },
        searchParams
      )

      expect(searchParams.get('required')).toBe('value')
      expect(searchParams.has('optional')).toBe(false)
      // Empty string is not considered null/undefined, so it gets included
      expect(searchParams.has('optionalEmpty')).toBe(true)
      expect(searchParams.get('optionalEmpty')).toBe('')
      expect(searchParams.has('optionalArray')).toBe(false)
      expect(searchParams.has('optionalObject')).toBe(false)
    })
  })

  describe('with primitive inputs', () => {
    it('should handle null input', () => {
      insertSearchParams(null, searchParams)

      expect(searchParams.toString()).toBe('')
    })

    it('should handle undefined input', () => {
      insertSearchParams(undefined, searchParams)

      expect(searchParams.toString()).toBe('')
    })

    it('should handle string input', () => {
      insertSearchParams('stringValue', searchParams)

      expect(searchParams.toString()).toBe('')
    })

    it('should handle number input', () => {
      insertSearchParams(123, searchParams)

      expect(searchParams.toString()).toBe('')
    })
  })
})

describe('parseRequest - comprehensive edge cases', () => {
  describe('YAML parsing with path property', () => {
    it('should handle path as array of strings', () => {
      const input = `
        uri: https://example.com/api
        path:
          - /users
          - /profile
          - /settings
      `

      const result = parseRequest(input)

      expect(result.uri).toBe('https://example.com/api/users/profile/settings')
      expect(result.url).toBe('https://example.com/api/users/profile/settings')
    })

    it('should handle path with leading/trailing slashes', () => {
      const input = `
        uri: https://example.com/api/
        path:
          - /users/
          - /profile/
      `

      const result = parseRequest(input)

      expect(result.uri).toBe('https://example.com/api/users/profile/')
    })

    it('should handle path as null', () => {
      const input = `
        uri: https://example.com/api
        path: null
      `

      const result = parseRequest(input)

      expect(result.uri).toBe('https://example.com/api')
    })
  })

  describe('URL edge cases', () => {
    it('should handle URLs with whitespace', () => {
      const input = '  https://example.com/api  '

      const result = parseRequest(input)

      expect(result.uri).toBe('https://example.com/api')
      expect(result.method).toBe('GET')
      expect(result.version).toBe('HTTP/1.1')
      expect(result.headers).toEqual({})
    })

    it('should handle HTTP URLs (not just HTTPS)', () => {
      const input = 'http://localhost:3000/api'

      const result = parseRequest(input)

      expect(result.uri).toBe('http://localhost:3000/api')
      expect(result.method).toBe('GET')
    })

    it('should handle URLs with case-insensitive protocol', () => {
      const input = 'HTTPS://EXAMPLE.COM/API'

      const result = parseRequest(input)

      expect(result.uri).toBe('HTTPS://EXAMPLE.COM/API')
    })
  })

  describe('complex query parameters', () => {
    it('should handle complex nested query structure', () => {
      const input = `
        uri: https://example.com/api
        query:
          - param1: value1
          - param2: value2
          - simpleParam
          - nested:
              subParam: subValue
      `

      const result = parseRequest(input)
      const url = new URL(result.uri)

      expect(url.searchParams.get('param1')).toBe('value1')
      expect(url.searchParams.get('param2')).toBe('value2')
      expect(url.searchParams.get('simpleParam')).toBe('')
      // The nested object becomes a string representation
      expect(url.searchParams.get('nested')).toBe('[object Object]')
    })
  })

  describe('malformed YAML handling', () => {
    it('should fall back to HTTP parsing for invalid YAML', () => {
      const input = 'POST /api/users\nContent-Type: application/json'

      const result = parseRequest(input)

      // Should match parseHttpRequest behavior
      expect(result).toEqual(parseHttpRequest(input))
    })

    it('should handle YAML that parses but is not an object', () => {
      const input = 'just a string'

      const result = parseRequest(input)

      // Should fall back to HTTP parsing
      expect(result).toEqual(parseHttpRequest(input))
    })
  })

  describe('custom delimiter', () => {
    it('should pass delimiter to HTTP parser', () => {
      const input = 'GET /api\nHost: example.com'
      const delim = '\n'

      const result = parseRequest(input, delim)

      expect(result).toEqual(parseHttpRequest(input, delim))
    })
  })
})

describe('normalizeRequest - comprehensive edge cases', () => {
  describe('different content types', () => {
    it('should handle application/yaml content type', () => {
      const input = `
        method: POST
        uri: https://example.com/api
        headers:
          Content-Type: application/yaml
        body:
          name: test
          value: 123
      `

      const result = normalizeRequest(parseRequest(input))

      expect(result.headers['content-type']).toBe('application/yaml')
      expect(result.body).toContain('name: test')
      expect(result.body).toContain('value: 123')
    })

    it('should handle application/x-www-form-urlencoded content type', () => {
      const input = `
        method: POST
        uri: https://example.com/api
        headers:
          Content-Type: application/x-www-form-urlencoded
        body:
          param1: value1
          param2: value2
      `

      const result = normalizeRequest(parseRequest(input))

      expect(result.headers['content-type']).toBe(
        'application/x-www-form-urlencoded'
      )
      expect(result.body).toBe('param1=value1&param2=value2')
    })

    it('should handle unknown content type with object body', () => {
      const input = `
        method: POST
        uri: https://example.com/api
        headers:
          Content-Type: application/custom
        body:
          test: value
      `

      const result = normalizeRequest(parseRequest(input))

      // Should remain as object since content type is not recognized
      expect(typeof result.body).toBe('object')
    })
  })

  describe('invalid header names', () => {
    it('should handle headers with invalid names (e.g., quoted names)', () => {
      const input = {
        method: 'POST',
        uri: 'https://example.com/api',
        headers: {
          'Content-Type': 'application/json',
          '"estado"': 'value', // Invalid header name with quotes
          'valid-header': 'value2',
        },
        body: { test: 'data' },
      }

      // Should not throw even with invalid header names
      expect(() => normalizeRequest(input)).not.toThrow()

      const result = normalizeRequest(input)

      // Valid headers should still be present
      expect(result.headers['content-type']).toBe('application/json')
      expect(result.headers['valid-header']).toBe('value2')
    })

    it('should handle headers with invalid characters', () => {
      const input = {
        method: 'GET',
        uri: 'https://example.com/api',
        headers: {
          'x-valid-header': 'ok',
          'invalid header': 'spaces', // Invalid: contains space
          'x-emoji-😀': 'emoji', // Invalid: contains emoji
        },
        body: null,
      }

      expect(() => normalizeRequest(input)).not.toThrow()

      const result = normalizeRequest(input)

      expect(result.headers['x-valid-header']).toBe('ok')
    })
  })

  describe('valid header handling', () => {
    it('should handle array-valued content-type header and detect content type correctly', () => {
      const input = {
        method: 'POST',
        uri: 'https://example.com/api',
        headers: {
          'Content-Type': ['application/json'],
          'x-custom-header': ['value1', 'value2'],
        },
        body: { test: 'data' },
      }

      const result = normalizeRequest(input)

      // Body should be serialized as JSON since content-type is application/json
      expect(result.body).toBe(JSON.stringify({ test: 'data' }))
      // Headers may remain as arrays in the result structure
      expect(
        Array.isArray(result.headers['content-type'])
          ? result.headers['content-type'][0]
          : result.headers['content-type']
      ).toBe('application/json')
    })

    it('should handle standard valid headers with object body and JSON serialization', () => {
      const input = {
        method: 'POST',
        uri: 'https://example.com/api',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token123',
          Accept: 'application/json',
          'X-Request-ID': 'req-abc-123',
        },
        body: { key: 'value', number: 42, nested: { inner: true } },
      }

      const result = normalizeRequest(input)

      expect(result.body).toBe(
        JSON.stringify({ key: 'value', number: 42, nested: { inner: true } })
      )
      expect(result.headers['content-type']).toBe('application/json')
      expect(result.headers['authorization']).toBe('Bearer token123')
      expect(result.headers['accept']).toBe('application/json')
      expect(result.headers['x-request-id']).toBe('req-abc-123')
    })

    it('should allow top-level authorization with custom headers', () => {
      const input = {
        method: 'POST',
        uri: 'https://example.com/api',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        authorization: 'Bearer token123',
        body: { key: 'value' },
      }

      const result = normalizeRequest(input)

      expect(result.body).toBe(JSON.stringify({ key: 'value' }))
      expect(result.headers['accept']).toBe('application/json')
      expect(result.headers['content-type']).toBe('application/json')
      expect(result.headers.authorization).toBe('Bearer token123')
    })

    it('should handle case-insensitive content-type detection for object body', () => {
      const input = {
        method: 'POST',
        uri: 'https://example.com/api',
        headers: {
          'CONTENT-TYPE': 'application/json',
        },
        body: { caseTest: true },
      }

      const result = normalizeRequest(input)

      expect(result.body).toBe(JSON.stringify({ caseTest: true }))
    })

    it('should handle mixed case content-type header with YAML serialization', () => {
      const input = {
        method: 'POST',
        uri: 'https://example.com/api',
        headers: {
          'Content-type': 'application/yaml',
        },
        body: { yamlKey: 'yamlValue' },
      }

      const result = normalizeRequest(input)

      expect(result.body).toContain('yamlKey')
      expect(result.body).toContain('yamlValue')
    })

    it('should handle empty headers object with object body', () => {
      const input = {
        method: 'POST',
        uri: 'https://example.com/api',
        headers: {},
        body: { empty: 'headers' },
      }

      const result = normalizeRequest(input)

      // Should default to application/json when no content-type
      expect(result.headers['content-type']).toBe('application/json')
      expect(result.body).toBe(JSON.stringify({ empty: 'headers' }))
    })

    it('should handle form-urlencoded with valid headers', () => {
      const input = {
        method: 'POST',
        uri: 'https://example.com/api',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: 'https://example.com',
        },
        body: { field1: 'value1', field2: 'value2' },
      }

      const result = normalizeRequest(input)

      expect(result.body).toBe('field1=value1&field2=value2')
      expect(result.headers['origin']).toBe('https://example.com')
    })

    it('should properly handle string body JSON repair with valid headers', () => {
      const input = {
        method: 'POST',
        uri: 'https://example.com/api',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': 'secret-key-123',
        },
        body: '{"valid": true, "incomplete": "data"',
      }

      const result = normalizeRequest(input)

      // Should repair the JSON
      expect(() => JSON.parse(result.body)).not.toThrow()
      expect(result.headers['x-api-key']).toBe('secret-key-123')
    })

    it('should skip JSON repair for string body when content-type is not JSON', () => {
      const input = {
        method: 'POST',
        uri: 'https://example.com/api',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: 'plain text with {invalid json',
      }

      const result = normalizeRequest(input)

      // Should not attempt to repair since content-type is not JSON
      expect(result.body).toBe('plain text with {invalid json')
    })

    it('should handle mixed valid and invalid headers, preserving valid ones for content-type detection', () => {
      const input = {
        method: 'POST',
        uri: 'https://example.com/api',
        headers: {
          '': 'empty-name', // Invalid: empty header name
          'Content-Type': 'application/yaml',
          'header\nwith\nnewlines': 'invalid', // Invalid: contains newlines
          'x-valid': 'valid',
        },
        body: { mixed: 'headers' },
      }

      const result = normalizeRequest(input)

      // Content-type should be detected correctly despite invalid headers
      expect(result.body).toContain('mixed')
      expect(result.headers['x-valid']).toBe('valid')
    })
  })

  describe('JSON repair functionality', () => {
    it('should handle JSON that repair function successfully fixes', () => {
      const input = {
        method: 'POST',
        uri: 'https://example.com/api',
        headers: { 'Content-Type': 'application/json' },
        body: '{"uncloseable": "malformed json that cannot be repaired"',
      }

      // Should not throw even if repair succeeds
      expect(() => normalizeRequest(input)).not.toThrow()

      const result = normalizeRequest(input)

      // Body should be fixed JSON after repair
      expect(() => JSON.parse(result.body)).not.toThrow()

      const parsed = JSON.parse(result.body)

      expect(parsed.uncloseable).toBe('malformed json that cannot be repaired')
    })

    it('should handle JSON that repair function cannot fix gracefully', () => {
      // Create a JSON string that is genuinely unrepairable
      const input = {
        method: 'POST',
        uri: 'https://example.com/api',
        headers: { 'Content-Type': 'application/json' },
        body: 'completely invalid json with no structure {',
      }

      // Should not throw even if repair fails
      expect(() => normalizeRequest(input)).not.toThrow()

      const result = normalizeRequest(input)

      // The repair function might actually fix this by wrapping it in quotes
      // So let's check if it's valid JSON after repair
      expect(() => JSON.parse(result.body)).not.toThrow()
    })

    it('should repair simple JSON successfully', () => {
      const input = {
        method: 'POST',
        uri: 'https://example.com/api',
        headers: { 'Content-Type': 'application/json' },
        body: '{"name": "test", "value": 123',
      }

      const result = normalizeRequest(input)

      // Should be valid JSON after repair
      expect(() => JSON.parse(result.body)).not.toThrow()
    })
  })

  describe('non-JSON string bodies', () => {
    it('should not attempt JSON repair for non-JSON content types', () => {
      const input = {
        method: 'POST',
        uri: 'https://example.com/api',
        headers: { 'Content-Type': 'text/plain' },
        body: 'plain text body',
      }

      const result = normalizeRequest(input)

      expect(result.body).toBe('plain text body')
    })
  })

  describe('complex nested optional structures', () => {
    it('should handle deeply nested optional objects', () => {
      const input = `
        method: POST
        uri: https://example.com/api
        headers:
          Content-Type: application/json
        body:
          level1?:
            level2?:
              level3?: null
            kept: value
          removed?: null
          kept: value
      `

      const result = normalizeRequest(parseRequest(input))

      const body = JSON.parse(result.body)

      expect(body).toEqual({
        level1: {
          kept: 'value',
        },
        kept: 'value',
      })
    })

    it('should handle optional arrays and objects with mixed content', () => {
      const input = `
        method: POST
        uri: https://example.com/api
        headers:
          Content-Type: application/json
        body:
          emptyArray?: []
          nonEmptyArray?: [1, 2, 3]
          emptyObject?: {}
          nonEmptyObject?: { key: value }
          nullValue?: null
      `

      const result = normalizeRequest(parseRequest(input))

      const body = JSON.parse(result.body)

      expect(body).toEqual({
        nonEmptyArray: [1, 2, 3],
        nonEmptyObject: { key: 'value' },
      })
    })
  })

  describe('epoch transformation in jmespath/jsonpath', () => {
    beforeEach(() => {
      fastGetUserById.mockResolvedValue({ id: 'user-123' })
      accountLimitsOk.mockResolvedValue(true)
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        body: JSON.stringify({
          data: [
            {
              id: 1,
              name: 'Test Item 1',
              createdAt: { $epochToDateTime: 1609459200 },
              timestamps: {
                created: { $epochToDateTime: '1609459200' },
                modified: { $epochToDateTime: 1640995200 },
              },
            },
            {
              id: 2,
              name: 'Test Item 2',
              createdAt: { $epochToDateTime: 'invalid' },
              timestamps: {
                created: { $epochToDateTime: null },
              },
            },
          ],
        }),
        arrayBuffer: async () =>
          str2buf(
            JSON.stringify({
              data: [
                {
                  id: 1,
                  name: 'Test Item 1',
                  createdAt: { $epochToDateTime: 1609459200 },
                  timestamps: {
                    created: { $epochToDateTime: '1609459200' },
                    modified: { $epochToDateTime: 1640995200 },
                  },
                },
                {
                  id: 2,
                  name: 'Test Item 2',
                  createdAt: { $epochToDateTime: 'invalid' },
                  timestamps: {
                    created: { $epochToDateTime: null },
                  },
                },
              ],
            })
          ),
      })
      swapSecrets.mockImplementation((obj) => obj)
      recordFetchUsage.mockResolvedValue()
      matchJmespath.mockImplementation((query, data) => {
        if (query === 'data') {
          return data.data
        }

        return data
      })
      matchJsonpath.mockImplementation((query, data) => {
        if (query === '$.data') {
          return data.data
        }

        return data
      })
    })

    it('should transform epoch timestamps in jmespath results', async () => {
      const input = 'GET https://api.example.com/data'
      const params = { jmespath: 'data' }
      const mockOptions = { userId: 'user-123' }

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result.error).toBeUndefined()
      expect(result.result).toEqual([
        {
          id: 1,
          name: 'Test Item 1',
          createdAt: 'Fri, Jan 1, 2021, 12:00 AM',
          timestamps: {
            created: 'Fri, Jan 1, 2021, 12:00 AM',
            modified: 'Sat, Jan 1, 2022, 12:00 AM',
          },
        },
        {
          id: 2,
          name: 'Test Item 2',
          createdAt: 'invalid',
          timestamps: {
            created: null,
          },
        },
      ])
    })

    it('should transform epoch timestamps in jsonpath results', async () => {
      const input = 'GET https://api.example.com/data'
      const params = { jsonpath: '$.data' }
      const mockOptions = { userId: 'user-123' }

      const result = await executeFetchAction(input, params, mockOptions)

      expect(result.error).toBeUndefined()
      expect(result.result).toEqual([
        {
          id: 1,
          name: 'Test Item 1',
          createdAt: 'Fri, Jan 1, 2021, 12:00 AM',
          timestamps: {
            created: 'Fri, Jan 1, 2021, 12:00 AM',
            modified: 'Sat, Jan 1, 2022, 12:00 AM',
          },
        },
        {
          id: 2,
          name: 'Test Item 2',
          createdAt: 'invalid',
          timestamps: {
            created: null,
          },
        },
      ])
    })
  })

  describe('placeholder substitution', () => {
    beforeEach(() => {
      fastGetUserById.mockResolvedValue({ id: 'user-123' })
      accountLimitsOk.mockResolvedValue(true)
      logEvent.mockResolvedValue(undefined)
      swapSecrets.mockImplementation((headers) => Promise.resolve(headers))
      recordFetchUsage.mockResolvedValue(undefined)
      getContextContact.mockReturnValue(null)
      getContextTimezone.mockReturnValue(null)
    })

    it('should replace BOT_DEFAULT placeholder in URL query parameters', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest
          .fn()
          .mockResolvedValue(
            str2buf(JSON.stringify({ result: 'success' })).buffer
          ),
      }

      fetch.mockResolvedValue(mockResponse)

      const input =
        'https://api.example.com/search?botId=${BOT_DEFAULT}&query=test'
      const params = {}
      const options = {
        userId: 'user-123',
        contextResources: {
          skillsetId: 'skillset-789',
          abilityId: 'ability-012',
        },
        linkedResources: {
          botId: 'bot-456',
        },
      }

      await executeFetchAction(input, params, options)

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/search?botId=bot-456&query=test',
        expect.any(Object)
      )
    })

    it('should replace BOT_DEFAULT placeholder in JSON request body', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest
          .fn()
          .mockResolvedValue(
            str2buf(JSON.stringify({ result: 'success' })).buffer
          ),
      }

      fetch.mockResolvedValue(mockResponse)

      const input = `POST https://api.example.com/create
Content-Type: application/json

{
  "botId": "\${BOT_DEFAULT}",
  "name": "Test Bot"
}`

      const params = {}
      const options = {
        userId: 'user-123',
        linkedResources: {
          botId: 'bot-456',
          skillsetId: 'skillset-789',
          abilityId: 'ability-012',
        },
      }

      await executeFetchAction(input, params, options)

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/create',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            botId: 'bot-456',
            name: 'Test Bot',
          }),
        })
      )
    })

    it('should replace FILE_DEFAULT placeholder in URL query parameters', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest
          .fn()
          .mockResolvedValue(
            str2buf(JSON.stringify({ result: 'success' })).buffer
          ),
      }

      fetch.mockResolvedValue(mockResponse)

      const input =
        'https://api.example.com/upload?fileId=${FILE_DEFAULT}&action=process'
      const params = {}
      const options = {
        userId: 'user-123',
        linkedResources: {
          botId: 'bot-456',
          skillsetId: 'skillset-789',
          abilityId: 'ability-012',
          fileId: 'file-789', // @note this would be available when fileId is added to linkedResources
        },
      }

      await executeFetchAction(input, params, options)

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/upload?fileId=file-789&action=process',
        expect.any(Object)
      )
    })

    it('should handle missing linkedResources gracefully', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest
          .fn()
          .mockResolvedValue(
            str2buf(JSON.stringify({ result: 'success' })).buffer
          ),
      }

      fetch.mockResolvedValue(mockResponse)

      const input =
        'https://api.example.com/search?botId=${BOT_DEFAULT}&query=test'
      const params = {}
      const options = {
        userId: 'user-123',
        // no linkedResources
      }

      await executeFetchAction(input, params, options)

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/search?botId=${BOT_DEFAULT}&query=test',
        expect.any(Object)
      )
    })

    it('should replace placeholders in form data', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest
          .fn()
          .mockResolvedValue(
            str2buf(JSON.stringify({ result: 'success' })).buffer
          ),
      }

      fetch.mockResolvedValue(mockResponse)

      const input = `POST https://api.example.com/submit
Content-Type: application/x-www-form-urlencoded

botId=\${BOT_DEFAULT}&name=TestBot&fileId=\${FILE_DEFAULT}`

      const params = {}
      const options = {
        userId: 'user-123',
        linkedResources: {
          botId: 'bot-456',
          fileId: 'file-789',
        },
      }

      await executeFetchAction(input, params, options)

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/submit',
        expect.objectContaining({
          method: 'POST',
          body: 'botId=bot-456&name=TestBot&fileId=file-789',
        })
      )
    })

    it('should replace placeholders in nested JSON objects', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest
          .fn()
          .mockResolvedValue(
            str2buf(JSON.stringify({ result: 'success' })).buffer
          ),
      }

      fetch.mockResolvedValue(mockResponse)

      const input = `POST https://api.example.com/complex
Content-Type: application/json

{
  "config": {
    "resources": {
      "botId": "\${BOT_DEFAULT}",
      "fileId": "\${FILE_DEFAULT}"
    },
    "settings": {
      "botReference": "\${BOT_DEFAULT}"
    }
  }
}`

      const params = {}
      const options = {
        userId: 'user-123',
        linkedResources: {
          botId: 'bot-456',
          fileId: 'file-789',
        },
      }

      await executeFetchAction(input, params, options)

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/complex',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            config: {
              resources: {
                botId: 'bot-456',
                fileId: 'file-789',
              },
              settings: {
                botReference: 'bot-456',
              },
            },
          }),
        })
      )
    })
  })
})
