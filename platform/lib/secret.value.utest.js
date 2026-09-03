/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { encode as encodeB64 } from '@/lib/b64'
import {
  runInContext,
  setContextContact,
  setContextNamespace,
  setContextUser,
} from '@/lib/context.store'
import { toHeadersHashMap } from '@/lib/header'
import {
  getInlineSecretValue,
  getSecretValue,
  getSecretValueAndType,
  getUnsafeSecretInstance,
  hasSecrets,
  swapSecrets,
} from '@/lib/secret.value'

jest.mock('@/lib/secret.template')

jest.mock('@/lib/secret.reference')

jest.mock('@/lib/secret.access', () => ({
  canUseSecret: jest.fn().mockResolvedValue(true),
  canManipulateSecret: jest.fn().mockResolvedValue(true),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

beforeEach(() => {
  mockReset(prisma)
})

describe('swapSecrets', () => {
  const getUnsafeSecretInstance = jest.fn(({ secretName }) => {
    if (secretName === 'KEY') {
      return {
        kind: 'shared',
        value: 'my-secret-key',
        type: 'plain',
      }
    }

    return null
  })

  it('should replace secret placeholders with actual values', async () => {
    const headers = {
      Authorization: 'Bearer ${SECRET_TOKEN}',
      'X-Api-Key': '${SECRET_KEY}',
    }

    const userId = 'user123'

    const updatedHeaders = await swapSecrets(headers, {
      headers: headers,
      userId: userId,
      abilityId: null,
      secretId: null,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      authorization: 'Bearer ${SECRET_TOKEN}',
      'x-api-key': 'my-secret-key',
    })
  })

  it('should not replace secret placeholders if secret is not found', async () => {
    const headers = {
      Authorization: 'Bearer ${SECRET_TOKEN}',
      'X-Api-Key': '${NON_EXISTING_SECRET}',
    }

    const userId = 'user123'

    const updatedHeaders = await swapSecrets(headers, {
      headers: headers,
      userId: userId,
      abilityId: null,
      secretId: null,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      authorization: 'Bearer ${SECRET_TOKEN}',
      'x-api-key': '${NON_EXISTING_SECRET}',
    })
  })

  it('should not replace secret placeholders when user cannot use secret', async () => {
    const headers = {
      Authorization: 'Bearer ${SECRET_TOKEN}',
      'X-Api-Key': '${SECRET_KEY}',
    }

    const userId = 'user123'

    const { canUseSecret } = jest.requireMock('@/lib/secret.access')

    canUseSecret.mockResolvedValueOnce(false)

    const updatedHeaders = await swapSecrets(headers, {
      headers: headers,
      userId: userId,
      abilityId: null,
      secretId: null,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      authorization: 'Bearer ${SECRET_TOKEN}',
      'x-api-key': '${SECRET_KEY}', // Should remain unreplaced
    })
  })
})

describe('swapSecrets - enhanced tests', () => {
  const getUnsafeSecretInstance = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should handle array header values', async () => {
    getUnsafeSecretInstance.mockImplementation(({ secretName }) => {
      if (secretName === 'KEY') {
        return {
          kind: 'shared',
          value: 'my-secret-key',
          type: 'plain',
        }
      }

      return null
    })

    const headers = {
      'X-Custom': ['${SECRET_KEY}', 'static-value', '${SECRET_KEY}'],
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-custom': 'my-secret-key, static-value, my-secret-key',
    })
  })

  it('should clean up duplicate Basic auth prefixes', async () => {
    getUnsafeSecretInstance.mockImplementation(({ secretName }) => {
      if (secretName === 'AUTH') {
        return {
          kind: 'shared',
          value: 'Basic dGVzdDp0ZXN0',
          type: 'plain',
        }
      }

      return null
    })

    const headers = {
      Authorization: 'Basic ${SECRET_AUTH}',
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    // @note should clean up duplicate Basic prefix

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      authorization: 'Basic dGVzdDp0ZXN0',
    })
  })

  it('should clean up duplicate Bearer auth prefixes', async () => {
    getUnsafeSecretInstance.mockImplementation(({ secretName }) => {
      if (secretName === 'TOKEN') {
        return {
          kind: 'shared',
          value: 'Bearer token123',
          type: 'plain',
        }
      }

      return null
    })

    const headers = {
      Authorization: 'Bearer ${SECRET_TOKEN}',
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    // @note should clean up duplicate Bearer prefix

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      authorization: 'Bearer token123',
    })
  })

  it('should handle multiple secret replacements in single header value', async () => {
    // @note this test now passes after fixing the regex bug in swapSecrets

    getUnsafeSecretInstance.mockImplementation(({ secretName }) => {
      if (secretName === 'USER') {
        return { kind: 'shared', value: 'admin', type: 'plain' }
      }

      if (secretName === 'PASS') {
        return { kind: 'shared', value: 'secret', type: 'plain' }
      }

      return null
    })

    const headers = {
      'X-Credentials': '${SECRET_USER}:${SECRET_PASS}',
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-credentials': 'admin:secret',
    })
  })

  it('should handle multiple secret replacements - comprehensive bug test', async () => {
    getUnsafeSecretInstance.mockImplementation(({ secretName }) => {
      const secrets = {
        API_KEY: 'key123',
        TOKEN: 'token456',
        USER: 'admin',
        PASS: 'secret',
        HOST: 'example.com',
        PORT: '8080',
      }

      if (secrets[secretName]) {
        return { kind: 'shared', value: secrets[secretName], type: 'plain' }
      }

      return null
    })

    const headers = {
      // test various patterns that expose the regex bug
      'X-Single': '${SECRET_API_KEY}',
      'X-Double': '${SECRET_USER}:${SECRET_PASS}',
      'X-Triple': '${SECRET_HOST}:${SECRET_PORT}:${SECRET_TOKEN}',
      'X-Complex':
        'https://${SECRET_USER}:${SECRET_PASS}@${SECRET_HOST}:${SECRET_PORT}/api',
      'X-Mixed': 'Bearer ${SECRET_TOKEN} for ${SECRET_USER}',
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-single': 'key123',
      'x-double': 'admin:secret',
      'x-triple': 'example.com:8080:token456',
      'x-complex': 'https://admin:secret@example.com:8080/api',
      'x-mixed': 'Bearer token456 for admin',
    })
  })

  it('should handle edge cases and overlapping secret replacements', async () => {
    getUnsafeSecretInstance.mockImplementation(({ secretName }) => {
      const secrets = {
        SECRET: 'inner', // @note this could be confusing if not handled right
        NESTED: 'outer${SECRET_INSIDE}outer',
        SAME: 'repeated',
        PREFIX: 'start',
        SUFFIX: 'end',
      }

      if (secrets[secretName]) {
        return { kind: 'shared', value: secrets[secretName], type: 'plain' }
      }

      return null
    })

    const headers = {
      'X-SameSecret': '${SECRET_SAME}-${SECRET_SAME}', // same secret multiple times
      'X-Adjacent': '${SECRET_PREFIX}${SECRET_SUFFIX}', // adjacent secrets
      'X-Separated': '${SECRET_PREFIX} and ${SECRET_SUFFIX}', // separated secrets
      'X-Nested': '${SECRET_NESTED}', // secret that contains a reference (but won't resolve)
      'X-Mix': 'start-${SECRET_SECRET}-${SECRET_SAME}-end', // mixed content
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-samesecret': 'repeated-repeated',
      'x-adjacent': 'startend',
      'x-separated': 'start and end',
      'x-nested': 'outer${SECRET_INSIDE}outer', // not resolved recursively
      'x-mix': 'start-inner-repeated-end',
    })
  })

  it('should convert single-value array back to string', async () => {
    getUnsafeSecretInstance.mockImplementation(() => null)

    const headers = {
      'Content-Type': 'application/json',
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    // @note should return string, not array for single values

    expect(updatedHeaders.get('content-type')).toBe('application/json')
    expect(Array.isArray(updatedHeaders.get('content-type'))).toBe(false)
  })
})

describe('swapSecrets - inline secrets tests', () => {
  const getUnsafeSecretInstance = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should replace secret placeholders with inline secret values', async () => {
    const headers = {
      Authorization: 'Bearer ${SECRET_TOKEN}',
      'X-Api-Key': '${SECRET_KEY}',
    }

    const inlineSecrets = {
      TOKEN: { value: 'inline-token-123' },
      KEY: { value: 'inline-key-456' },
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      inlineSecrets,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      authorization: 'Bearer inline-token-123',
      'x-api-key': 'inline-key-456',
    })

    // @note should not call getUnsafeSecretInstance when inline secrets are available

    expect(getUnsafeSecretInstance).not.toHaveBeenCalled()
  })

  it('should prioritize inline secrets over secret store', async () => {
    getUnsafeSecretInstance.mockImplementation(({ secretName }) => {
      if (secretName === 'KEY') {
        return {
          kind: 'shared',
          value: 'store-secret-value',
          type: 'plain',
        }
      }

      return null
    })

    const headers = {
      'X-Api-Key': '${SECRET_KEY}',
      'X-Other': '${SECRET_OTHER}',
    }

    const inlineSecrets = {
      KEY: { value: 'inline-secret-value' },
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      inlineSecrets,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-api-key': 'inline-secret-value',
      'x-other': '${SECRET_OTHER}', // @note not found in inline or store
    })

    // @note should only call getUnsafeSecretInstance for secrets not in inline
    // secrets

    expect(getUnsafeSecretInstance).toHaveBeenCalledWith({
      userId: 'user123',
      abilityId: null,
      secretId: null,
      secretName: 'OTHER',
    })
  })

  it('should handle SECRET_DEFAULT with default inline secret', async () => {
    const headers = {
      'X-Default': '${SECRET_DEFAULT}',
      'X-Other': '${SECRET_TEST}',
    }

    const inlineSecrets = {
      DEFAULT: { value: 'default-value-123' },
      TEST: { value: 'test-value-456' },
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      inlineSecrets,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-default': 'default-value-123',
      'x-other': 'test-value-456',
    })

    expect(getUnsafeSecretInstance).not.toHaveBeenCalled()
  })

  it('should handle multiple inline secret replacements in single header value', async () => {
    const headers = {
      'X-Credentials': '${SECRET_USER}:${SECRET_PASS}',
      'X-Url': 'https://${SECRET_HOST}:${SECRET_PORT}/api',
    }

    const inlineSecrets = {
      USER: { value: 'inline-user' },
      PASS: { value: 'inline-pass' },
      HOST: { value: 'example.com' },
      PORT: { value: '8080' },
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      inlineSecrets,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-credentials': 'inline-user:inline-pass',
      'x-url': 'https://example.com:8080/api',
    })
  })

  it('should handle array header values with inline secrets', async () => {
    const headers = {
      'X-Custom': ['${SECRET_KEY}', 'static-value', '${SECRET_TOKEN}'],
    }

    const inlineSecrets = {
      KEY: { value: 'inline-key' },
      TOKEN: { value: 'inline-token' },
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      inlineSecrets,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-custom': 'inline-key, static-value, inline-token',
    })
  })

  it('should handle mixed inline secrets and secret store lookups', async () => {
    getUnsafeSecretInstance.mockImplementation(({ secretName }) => {
      if (secretName === 'STORE_SECRET') {
        return {
          kind: 'shared',
          value: 'from-store',
          type: 'plain',
        }
      }

      return null
    })

    const headers = {
      'X-Mixed': '${SECRET_INLINE}:${SECRET_STORE_SECRET}:${SECRET_MISSING}',
    }

    const inlineSecrets = {
      INLINE: { value: 'from-inline' },
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      inlineSecrets,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-mixed': 'from-inline:from-store:${SECRET_MISSING}',
    })

    // @note should call getUnsafeSecretInstance for secrets not in inline secrets

    expect(getUnsafeSecretInstance).toHaveBeenCalledWith({
      userId: 'user123',
      abilityId: null,
      secretId: null,
      secretName: 'STORE_SECRET',
    })

    expect(getUnsafeSecretInstance).toHaveBeenCalledWith({
      userId: 'user123',
      abilityId: null,
      secretId: null,
      secretName: 'MISSING',
    })
  })

  it('should handle empty inline secrets object', async () => {
    getUnsafeSecretInstance.mockImplementation(({ secretName }) => {
      if (secretName === 'KEY') {
        return {
          kind: 'shared',
          value: 'from-store',
          type: 'plain',
        }
      }

      return null
    })

    const headers = {
      'X-Api-Key': '${SECRET_KEY}',
    }

    const inlineSecrets = {}

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      inlineSecrets,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-api-key': 'from-store',
    })

    expect(getUnsafeSecretInstance).toHaveBeenCalled()
  })

  it('should handle inline secrets with empty values', async () => {
    const headers = {
      'X-Empty': '${SECRET_EMPTY}',
      'X-Undefined': '${SECRET_UNDEFINED}',
    }

    const inlineSecrets = {
      EMPTY: { value: '' },
      UNDEFINED: { value: undefined },
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      inlineSecrets,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    // @note empty string is a valid value and should be used for replacement
    // @note undefined values should fall back to secret store

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-empty': '', // replaced with empty
      'x-undefined': '${SECRET_UNDEFINED}', // falls back to secret store
    })

    // @note should only call getUnsafeSecretInstance for undefined values, not empty strings

    expect(getUnsafeSecretInstance).toHaveBeenCalledWith({
      userId: 'user123',
      abilityId: null,
      secretId: null,
      secretName: 'UNDEFINED',
    })

    // @note should NOT call getUnsafeSecretInstance for EMPTY since empty string is valid

    expect(getUnsafeSecretInstance).not.toHaveBeenCalledWith({
      userId: 'user123',
      abilityId: null,
      secretId: null,
      secretName: 'EMPTY',
    })
  })

  it('should handle inline secrets that contain whitespace values', async () => {
    const headers = {
      'X-Space': '${SECRET_SPACE}',
      'X-Tabs': '${SECRET_TABS}',
    }

    const inlineSecrets = {
      SPACE: { value: ' ' },
      TABS: { value: '\t' },
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      inlineSecrets,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-space': '',
      'x-tabs': '',
    })

    expect(getUnsafeSecretInstance).not.toHaveBeenCalled()
  })

  it('should handle case-insensitive inline secret matching', async () => {
    const headers = {
      'X-Upper': '${SECRET_TEST}',
      'X-Lower': '${SECRET_test}',
      'X-Mixed': '${SECRET_Test}',
    }

    const inlineSecrets = {
      test: { value: 'lowercase-key-value' },
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      inlineSecrets,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    // @note case-insensitive matching means all variations should match the lowercase key

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-upper': 'lowercase-key-value',
      'x-lower': 'lowercase-key-value',
      'x-mixed': 'lowercase-key-value',
    })

    expect(getUnsafeSecretInstance).not.toHaveBeenCalled()
  })

  it('should handle same inline secret used multiple times', async () => {
    const headers = {
      'X-First': '${SECRET_REPEATED}',
      'X-Second': 'prefix-${SECRET_REPEATED}-suffix',
      'X-Third': '${SECRET_REPEATED}:${SECRET_REPEATED}',
    }

    const inlineSecrets = {
      REPEATED: { value: 'same-value' },
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      inlineSecrets,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-first': 'same-value',
      'x-second': 'prefix-same-value-suffix',
      'x-third': 'same-value:same-value',
    })
  })

  it('should handle inline secrets with special characters and formatting', async () => {
    const headers = {
      'X-Json': '${SECRET_JSON}',
      'X-Special': '${SECRET_SPECIAL}',
      'X-Whitespace': '${SECRET_WHITESPACE}',
    }

    const inlineSecrets = {
      JSON: { value: '{"key":"value","nested":{"data":true}}' },
      SPECIAL: { value: 'special!@#$%^&*()_+-=[]{}|;:,.<>?' },
      WHITESPACE: { value: 'padded  value' },
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      inlineSecrets,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-json': '{"key":"value","nested":{"data":true}}',
      'x-special': 'special!@#$%^&*()_+-=[]{}|;:,.<>?',
      'x-whitespace': 'padded  value',
    })
  })

  it('should match SECRET_DEFAULT and SECRET_TEST with lowercase inline secrets', async () => {
    const headers = {
      'X-Default': '${SECRET_DEFAULT}',
      'X-Test': '${SECRET_TEST}',
      'X-Custom': '${SECRET_API_KEY}',
    }

    const inlineSecrets = {
      default: { value: 'default-secret-value' },
      test: { value: 'test-secret-value' },
      api_key: { value: 'api-key-value' },
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      inlineSecrets,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    // @note case-insensitive matching allows uppercase secret placeholders to match lowercase inline secret keys

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-default': 'default-secret-value',
      'x-test': 'test-secret-value',
      'x-custom': 'api-key-value',
    })

    expect(getUnsafeSecretInstance).not.toHaveBeenCalled()
  })

  it('should handle case-insensitive matching with mixed-case inline secret keys', async () => {
    const headers = {
      'X-Upper': '${SECRET_API_KEY}',
      'X-Lower': '${SECRET_database_url}',
      'X-Mixed': '${SECRET_RefreshToken}',
    }

    const inlineSecrets = {
      Api_Key: { value: 'mixed-case-api-key' },
      DATABASE_URL: { value: 'uppercase-database-url' },
      refreshtoken: { value: 'lowercase-refresh-token' },
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      inlineSecrets,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
    })

    // @note case-insensitive matching works regardless of case used in either the placeholder or the inline secret key

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-upper': 'mixed-case-api-key',
      'x-lower': 'uppercase-database-url',
      'x-mixed': 'lowercase-refresh-token',
    })

    expect(getUnsafeSecretInstance).not.toHaveBeenCalled()
  })

  describe('error propagation from inline secrets', () => {
    it('should propagate errors from inline secret value getters', async () => {
      const testError = new Error('Inline secret getter failed')

      const headers = {
        'x-test': '${SECRET_FAILING}',
      }

      const inlineSecrets = {
        FAILING: {
          value: async () => {
            throw testError
          },
        },
      }

      await expect(
        swapSecrets(headers, {
          userId: 'user123',
          abilityId: null,
          secretId: null,
          inlineSecrets,
          fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
        })
      ).rejects.toThrow('Inline secret getter failed')

      expect(getUnsafeSecretInstance).not.toHaveBeenCalled()
    })

    it('should propagate custom error types from inline secret getters', async () => {
      class CustomSecretError extends Error {
        constructor(message) {
          super(message)
          this.name = 'CustomSecretError'
          this.code = 'SECRET_ERROR'
        }
      }

      const customError = new CustomSecretError('Custom secret error')

      const headers = {
        'X-Custom': '${SECRET_CUSTOM_ERROR}',
      }

      const inlineSecrets = {
        CUSTOM_ERROR: {
          value: async () => {
            throw customError
          },
        },
      }

      await expect(
        swapSecrets(headers, {
          userId: 'user123',
          abilityId: null,
          secretId: null,
          inlineSecrets,
          fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
        })
      ).rejects.toThrow(CustomSecretError)

      await expect(
        swapSecrets(headers, {
          userId: 'user123',
          abilityId: null,
          secretId: null,
          inlineSecrets,
          fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
        })
      ).rejects.toMatchObject({
        name: 'CustomSecretError',
        code: 'SECRET_ERROR',
        message: 'Custom secret error',
      })
    })

    it('should propagate errors from direct async function inline secrets', async () => {
      const asyncError = new Error('Direct async function failed')

      const headers = {
        'X-Direct': '${SECRET_DIRECT_ASYNC}',
      }

      const inlineSecrets = {
        DIRECT_ASYNC: async () => {
          throw asyncError
        },
      }

      await expect(
        swapSecrets(headers, {
          userId: 'user123',
          abilityId: null,
          secretId: null,
          inlineSecrets,
          fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
        })
      ).rejects.toThrow('Direct async function failed')
    })

    it('should propagate errors from lazy-loaded secret map getters', async () => {
      const lazyError = new Error('Lazy secret map getter failed')

      const headers = {
        'X-Lazy': '${SECRET_LAZY}',
      }

      const lazyInlineSecrets = async () => {
        throw lazyError
      }

      await expect(
        swapSecrets(headers, {
          userId: 'user123',
          abilityId: null,
          secretId: null,
          inlineSecrets: lazyInlineSecrets,
          fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
        })
      ).rejects.toThrow('Lazy secret map getter failed')

      expect(getUnsafeSecretInstance).not.toHaveBeenCalled()
    })

    it('should propagate UserAuthError and preserve error properties', async () => {
      // @note simulate a UserAuthError that should bubble up unchanged

      class UserAuthError extends Error {
        constructor(message, code) {
          super(message)
          this.name = 'UserAuthError'
          this.code = code
          this.statusCode = 401
        }
      }

      const authError = new UserAuthError(
        'Authentication failed',
        'AUTH_EXPIRED'
      )

      const headers = {
        'X-Auth': '${SECRET_AUTH}',
      }

      const inlineSecrets = {
        AUTH: {
          value: async () => {
            throw authError
          },
        },
      }

      await expect(
        swapSecrets(headers, {
          userId: 'user123',
          abilityId: null,
          secretId: null,
          inlineSecrets,
          fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
        })
      ).rejects.toThrow(UserAuthError)

      await expect(
        swapSecrets(headers, {
          userId: 'user123',
          abilityId: null,
          secretId: null,
          inlineSecrets,
          fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
        })
      ).rejects.toMatchObject({
        name: 'UserAuthError',
        code: 'AUTH_EXPIRED',
        statusCode: 401,
        message: 'Authentication failed',
      })
    })

    it('should handle errors when processing multiple secrets', async () => {
      const firstError = new Error('First secret failed')

      const headers = {
        'X-Success': '${SECRET_SUCCESS}',
        'X-Fail': '${SECRET_FAIL}',
        'X-Another': '${SECRET_ANOTHER}',
      }

      const inlineSecrets = {
        SUCCESS: { value: 'success-value' },
        FAIL: {
          value: async () => {
            throw firstError
          },
        },
        ANOTHER: { value: 'another-value' },
      }

      // @note should fail on the first error encountered during processing

      await expect(
        swapSecrets(headers, {
          userId: 'user123',
          abilityId: null,
          secretId: null,
          inlineSecrets,
          fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
        })
      ).rejects.toThrow('First secret failed')
    })

    it('should handle errors in case-insensitive secret matching', async () => {
      const caseError = new Error('Case-insensitive secret failed')

      const headers = {
        'X-Lower': '${SECRET_test}', // lowercase request
      }

      const inlineSecrets = {
        TEST: {
          // uppercase key
          value: async () => {
            throw caseError
          },
        },
      }

      await expect(
        swapSecrets(headers, {
          userId: 'user123',
          abilityId: null,
          secretId: null,
          inlineSecrets,
          fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
        })
      ).rejects.toThrow('Case-insensitive secret failed')
    })

    it('should propagate errors with proper stack traces', async () => {
      const stackError = new Error('Stack trace test')

      const headers = {
        'X-Stack': '${SECRET_STACK}',
      }

      const inlineSecrets = {
        STACK: {
          value: async () => {
            throw stackError
          },
        },
      }

      let caughtError

      try {
        await swapSecrets(headers, {
          userId: 'user123',
          abilityId: null,
          secretId: null,
          inlineSecrets,
          fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
        })
      } catch (error) {
        caughtError = error
      }

      expect(caughtError).toBe(stackError)
      expect(caughtError.stack).toContain('Stack trace test')
      expect(caughtError.stack).toContain('secret.value.utest.js')
    })
  })
})

describe('getSecretValue', () => {
  it.each([
    { kind: 'shared', value: '', expected: null, throws: false },
    { kind: 'personal', value: '', expected: null, throws: true },
    {
      kind: 'personal',
      value: '',
      expected: null,
      throws: /ask the user to visit/,
      namespace: 'test123',
    },
    {
      kind: 'personal',
      value: '',
      expected: null,
      throws: /ask the user to visit/,
      contact: {
        verifiedAt: new Date(),
      },
    },
    {
      kind: 'personal',
      value: '',
      expected: 'xyz123',
      throws: false,
      contact: {
        verifiedAt: new Date(),
        secret: {
          value: 'xyz123',
        },
      },
    },
    {
      kind: 'personal',
      value: 'test123',
      expected: 'xyz123',
      throws: false,
      contact: {
        verifiedAt: new Date(),
        secret: {
          value: 'xyz123',
        },
      },
    },
    {
      kind: 'personal',
      value: 'test123',
      expected: 'xyz123',
      throws: true,
      contact: {
        // @note should throw because the contact is not verified
        secret: {
          value: 'xyz123',
        },
      },
    },
    { kind: 'shared', value: ' ', expected: ' ', throws: false },
    { kind: 'shared', value: 'test', expected: 'test', throws: false },
  ])(
    'should return plain secret value',
    async ({ kind, value, expected, throws, namespace, contact }) => {
      await runInContext(async () => {
        if (namespace) {
          setContextNamespace(namespace)
        }

        if (contact) {
          setContextContact(contact)

          if (contact.secret) {
            prisma.secretValue.findUnique.mockResolvedValue({
              value: contact.secret.value,
            })
          }
        }

        const secret = {
          kind: kind,
          type: 'plain',
          value: value,
        }

        if (throws) {
          await expect(getSecretValue(secret)).rejects.toThrow(
            throws === true ? undefined : throws
          )
        } else {
          const secretValue = await getSecretValue(secret)

          expect(secretValue).toBe(expected)
        }
      })()
    }
  )

  it.each([
    // @note a secret with no value holds no credentials - it must not encode
    // into a `Basic ` header, which reads as authenticated everywhere a value
    // is looked for
    {
      kind: 'shared',
      value: '',
      expected: null,
      throws: false,
    },
    {
      kind: 'personal',
      value: '',
      expected: null,
      throws: true,
    },
    {
      kind: 'shared',
      value: ' ',
      expected: null,
      throws: false,
    },
    {
      kind: 'shared',
      value: 'my-username:my-password',
      expected: `Basic ${encodeB64('my-username:my-password')}`,
      throws: false,
    },
    {
      kind: 'shared',
      value: JSON.stringify({ user: 'admin', pass: 'admin' }),
      expected: `Basic ${encodeB64('admin:admin')}`,
      throws: false,
    },
    {
      kind: 'shared',
      value: JSON.stringify({ username: 'admin', password: 'admin' }),
      expected: `Basic ${encodeB64('admin:admin')}`,
      throws: false,
    },
  ])(
    'should return basic auth secret value',
    async ({ kind, value, expected, throws, namespace, contact }) => {
      await runInContext(async () => {
        if (namespace) {
          setContextNamespace(namespace)
        }

        if (contact) {
          setContextContact(contact)

          if (contact.secret) {
            prisma.secretValue.findUnique.mockResolvedValue({
              value: contact.secret.value,
            })
          }
        }

        const secret = {
          kind: kind,
          type: 'basic',
          value: value,
        }

        if (throws) {
          await expect(getSecretValue(secret)).rejects.toThrow(
            throws === true ? undefined : throws
          )
        } else {
          const secretValue = await getSecretValue(secret)

          expect(secretValue).toBe(expected)
        }
      })()
    }
  )

  it.each([
    // @note a blank value is no token - it must not encode into a `Bearer `
    // header, which reads as authenticated everywhere a value is looked for
    { kind: 'shared', value: '', expected: null, throws: false },
    { kind: 'personal', value: '', expected: null, throws: true },
    { kind: 'shared', value: ' ', expected: null, throws: false },
    { kind: 'shared', value: ' test ', expected: 'Bearer test', throws: false },
    { kind: 'shared', value: 'test', expected: 'Bearer test', throws: false },
  ])(
    'should return bearer secret value',
    async ({ kind, value, expected, throws, namespace, contact }) => {
      await runInContext(async () => {
        if (namespace) {
          setContextNamespace(namespace)
        }

        if (contact) {
          setContextContact(contact)

          if (contact.secret) {
            prisma.secretValue.findUnique.mockResolvedValue({
              value: contact.secret.value,
            })
          }
        }

        const secret = {
          kind: kind,
          type: 'bearer',
          value: value,
        }

        if (throws) {
          await expect(getSecretValue(secret)).rejects.toThrow(
            throws === true ? undefined : throws
          )
        } else {
          const secretValue = await getSecretValue(secret)

          expect(secretValue).toBe(expected)
        }
      })()
    }
  )

  describe('bearer secret with custom schema config', () => {
    it('should use default Bearer schema when config is not provided', async () => {
      await runInContext(async () => {
        setContextNamespace('test')

        const secret = {
          kind: 'shared',
          type: 'bearer',
          value: 'token123',
          config: null,
        }

        const result = await getSecretValue(secret)

        expect(result).toBe('Bearer token123')
      })()
    })

    it('should use default Bearer schema when config is empty object', async () => {
      await runInContext(async () => {
        setContextNamespace('test')

        const secret = {
          kind: 'shared',
          type: 'bearer',
          value: 'token456',
          config: {},
        }

        const result = await getSecretValue(secret)

        expect(result).toBe('Bearer token456')
      })()
    })

    it('should use custom schema from config.schema', async () => {
      await runInContext(async () => {
        setContextNamespace('test')

        const secret = {
          kind: 'shared',
          type: 'bearer',
          value: 'custom-token',
          config: {
            schema: 'Token',
          },
        }

        const result = await getSecretValue(secret)

        expect(result).toBe('Token custom-token')
      })()
    })

    it('should trim whitespace from custom schema', async () => {
      await runInContext(async () => {
        setContextNamespace('test')

        const secret = {
          kind: 'shared',
          type: 'bearer',
          value: 'trimmed-token',
          config: {
            schema: '  ApiKey  ',
          },
        }

        const result = await getSecretValue(secret)

        expect(result).toBe('ApiKey trimmed-token')
      })()
    })

    it('should handle schema with leading/trailing spaces', async () => {
      await runInContext(async () => {
        setContextNamespace('test')

        const secret = {
          kind: 'shared',
          type: 'bearer',
          value: 'space-token',
          config: {
            schema: 'Basic ',
          },
        }

        const result = await getSecretValue(secret)

        expect(result).toBe('Basic space-token')
      })()
    })

    it('should use default Bearer when schema is empty string', async () => {
      await runInContext(async () => {
        setContextNamespace('test')

        const secret = {
          kind: 'shared',
          type: 'bearer',
          value: 'empty-schema-token',
          config: {
            schema: '',
          },
        }

        const result = await getSecretValue(secret)

        expect(result).toBe('Bearer empty-schema-token')
      })()
    })

    it('should use default Bearer when schema is whitespace only', async () => {
      await runInContext(async () => {
        setContextNamespace('test')

        const secret = {
          kind: 'shared',
          type: 'bearer',
          value: 'whitespace-schema-token',
          config: {
            schema: '   ',
          },
        }

        const result = await getSecretValue(secret)

        // @note whitespace-only schema trims to empty string, so defaults to Bearer
        expect(result).toBe('Bearer whitespace-schema-token')
      })()
    })

    it('should use default Bearer when schema is not a string', async () => {
      await runInContext(async () => {
        setContextNamespace('test')

        const secret = {
          kind: 'shared',
          type: 'bearer',
          value: 'number-schema-token',
          config: {
            schema: 123,
          },
        }

        const result = await getSecretValue(secret)

        expect(result).toBe('Bearer number-schema-token')
      })()
    })

    it('should use default Bearer when schema is null', async () => {
      await runInContext(async () => {
        setContextNamespace('test')

        const secret = {
          kind: 'shared',
          type: 'bearer',
          value: 'null-schema-token',
          config: {
            schema: null,
          },
        }

        const result = await getSecretValue(secret)

        expect(result).toBe('Bearer null-schema-token')
      })()
    })

    it('should handle config as non-object gracefully', async () => {
      await runInContext(async () => {
        setContextNamespace('test')

        const secret = {
          kind: 'shared',
          type: 'bearer',
          value: 'string-config-token',
          config: 'not-an-object',
        }

        const result = await getSecretValue(secret)

        expect(result).toBe('Bearer string-config-token')
      })()
    })

    it('should support various custom schema values', async () => {
      const testCases = [
        { schema: 'ApiKey', value: 'token1', expected: 'ApiKey token1' },
        { schema: 'Token', value: 'token2', expected: 'Token token2' },
        { schema: 'JWT', value: 'token3', expected: 'JWT token3' },
        { schema: 'X-API-Key', value: 'token4', expected: 'X-API-Key token4' },
        { schema: 'Custom', value: 'token5', expected: 'Custom token5' },
      ]

      for (const testCase of testCases) {
        await runInContext(async () => {
          setContextNamespace('test')

          const secret = {
            kind: 'shared',
            type: 'bearer',
            value: testCase.value,
            config: {
              schema: testCase.schema,
            },
          }

          const result = await getSecretValue(secret)

          expect(result).toBe(testCase.expected)
        })()
      }
    })

    it('should handle empty token value with custom schema', async () => {
      await runInContext(async () => {
        setContextNamespace('test')

        const secret = {
          kind: 'shared',
          type: 'bearer',
          value: '',
          config: {
            schema: 'CustomSchema',
          },
        }

        const result = await getSecretValue(secret)

        // @note empty value should return null regardless of schema
        expect(result).toBeNull()
      })()
    })

    it('should handle config with other properties alongside schema', async () => {
      await runInContext(async () => {
        setContextNamespace('test')

        const secret = {
          kind: 'shared',
          type: 'bearer',
          value: 'multi-prop-token',
          config: {
            schema: 'Custom',
            otherProperty: 'ignored',
            anotherProperty: 123,
          },
        }

        const result = await getSecretValue(secret)

        expect(result).toBe('Custom multi-prop-token')
      })()
    })

    it('should handle schema with special characters', async () => {
      await runInContext(async () => {
        setContextNamespace('test')

        const secret = {
          kind: 'shared',
          type: 'bearer',
          value: 'special-token',
          config: {
            schema: 'X-Custom-Auth-Token',
          },
        }

        const result = await getSecretValue(secret)

        expect(result).toBe('X-Custom-Auth-Token special-token')
      })()
    })
  })

  it.each([
    { kind: 'shared', value: '', expected: null, throws: false },
    { kind: 'personal', value: '', expected: null, throws: true },
    {
      kind: 'shared',
      value: 'accessToken: test123',
      expected: 'Bearer test123',
      throws: false,
    },
    {
      kind: 'personal',
      value: 'accessToken: test123',
      expected: 'Bearer xyz123',
      throws: false,
      contact: {
        verifiedAt: new Date(),
        secret: {
          value: 'accessToken: xyz123',
        },
      },
    },
    {
      kind: 'personal',
      value: 'accessToken: test123',
      expected: 'Bearer xyz123',
      throws: true,
      contact: {
        // @note should throw because the contact is not verified
        secret: {
          value: 'accessToken: xyz123',
        },
      },
    },
  ])(
    'should return oauth secret value',
    async ({ kind, value, expected, throws, namespace, contact }) => {
      await runInContext(async () => {
        if (namespace) {
          setContextNamespace(namespace)
        }

        if (contact) {
          setContextContact(contact)

          if (contact.secret) {
            prisma.secretValue.findUnique.mockResolvedValue({
              value: contact.secret.value,
            })
          }
        }

        const secret = {
          kind: kind,
          type: 'oauth',
          value: value,
        }

        if (throws) {
          await expect(getSecretValue(secret)).rejects.toThrow(
            throws === true ? undefined : throws
          )
        } else {
          const secretValue = await getSecretValue(secret)

          expect(secretValue).toBe(expected)
        }
      })()
    }
  )
})

describe('getUnsafeSecretInstance', () => {
  const mockUser = { id: 'user123', email: 'test@example.com' }

  const mockSecret = {
    id: 'secret123',
    name: 'TEST_SECRET',
    userId: 'user123',
    kind: 'personal',
    type: 'plain',
    value: 'secret-value',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return null when no user is in context', async () => {
    await runInContext(async () => {
      // @note no user set in context, should return null

      const result = await getUnsafeSecretInstance({
        userId: 'user123',
        secretName: 'TEST_SECRET',
        secretId: null,
        abilityId: null,
      })

      expect(result).toBeNull()
    })()
  })

  it('should return null when user is not the secret owner', async () => {
    await runInContext(async () => {
      setContextUser(mockUser)

      const result = await getUnsafeSecretInstance({
        userId: 'different-user', // different from context user
        secretName: 'TEST_SECRET',
        secretId: null,
        abilityId: null,
      })

      expect(result).toBeNull()
    })()
  })

  it('should find secret by secretId when secretName is DEFAULT', async () => {
    await runInContext(async () => {
      setContextUser(mockUser)

      prisma.secret.findUnique.mockResolvedValue(mockSecret)

      const result = await getUnsafeSecretInstance({
        userId: 'user123',
        secretName: 'DEFAULT',
        secretId: 'secret123',
        abilityId: null,
      })

      expect(result).toEqual(mockSecret)
      expect(prisma.secret.findUnique).toHaveBeenCalledWith({
        where: { id: 'secret123' },
        // @note disabled because it was a bad idea
        // cacheStrategy: { swr: 60, ttl: 60 },
      })
    })()
  })

  it('should find secret by abilityId when secretName is DEFAULT', async () => {
    await runInContext(async () => {
      setContextUser(mockUser)

      const mockAbility = { linkedSecret: mockSecret }

      prisma.ability.findUnique.mockResolvedValue(mockAbility)

      const result = await getUnsafeSecretInstance({
        userId: 'user123',
        secretName: 'DEFAULT',
        secretId: null,
        abilityId: 'ability123',
      })

      expect(result).toEqual(mockSecret)
      expect(prisma.ability.findUnique).toHaveBeenCalledWith({
        where: { id: 'ability123' },
        select: { linkedSecret: true },
      })
    })()
  })

  it('should find secret by custom name using normalizeSecretName', async () => {
    await runInContext(async () => {
      setContextUser(mockUser)

      const secrets = [
        { ...mockSecret, name: 'test_secret' },
        { ...mockSecret, id: 'secret456', name: 'other_secret' },
      ]

      prisma.secret.findMany.mockResolvedValue(secrets)

      const result = await getUnsafeSecretInstance({
        userId: 'user123',
        secretName: 'TEST SECRET', // will be normalized to match test_secret
        secretId: null,
        abilityId: null,
      })

      expect(result).toEqual(secrets[0])
      expect(prisma.secret.findMany).toHaveBeenCalledWith({
        where: { userId: 'user123' },
        // @note disabled because it was a bad idea
        // cacheStrategy: { swr: 60, ttl: 60 },
      })
    })()
  })

  it('should return null when secret is not found', async () => {
    await runInContext(async () => {
      setContextUser(mockUser)

      prisma.secret.findMany.mockResolvedValue([])

      const result = await getUnsafeSecretInstance({
        userId: 'user123',
        secretName: 'NON_EXISTENT',
        secretId: null,
        abilityId: null,
      })

      expect(result).toBeNull()
    })()
  })

  it('should prioritize secretId over abilityId when both are provided', async () => {
    await runInContext(async () => {
      setContextUser(mockUser)

      prisma.secret.findUnique.mockResolvedValue(mockSecret)

      const result = await getUnsafeSecretInstance({
        userId: 'user123',
        secretName: 'DEFAULT',
        secretId: 'secret123',
        abilityId: 'ability123',
      })

      expect(result).toEqual(mockSecret)
      expect(prisma.secret.findUnique).toHaveBeenCalled()
      expect(prisma.ability.findUnique).not.toHaveBeenCalled()
    })()
  })

  it('should fall back to custom name search when secretId and abilityId fail', async () => {
    await runInContext(async () => {
      setContextUser(mockUser)

      prisma.secret.findUnique.mockResolvedValue(null)

      prisma.ability.findUnique.mockResolvedValue(null)

      prisma.secret.findMany.mockResolvedValue([mockSecret])

      const result = await getUnsafeSecretInstance({
        userId: 'user123',
        secretName: 'TEST_SECRET',
        secretId: 'non-existent',
        abilityId: 'non-existent',
      })

      expect(result).toEqual(mockSecret)
      expect(prisma.secret.findMany).toHaveBeenCalled()
    })()
  })
})

describe('getSecretValue - enhanced tests', () => {
  it('should handle template secret type', async () => {
    const secretTemplate = await import('@/lib/secret.template') // @todo move this as an import on the top

    const mockRevealSecretTemplateInstanceFromSecret = jest.mocked(
      secretTemplate.revealSecretInstanceFromTemplateSecret
    )

    mockRevealSecretTemplateInstanceFromSecret.mockResolvedValue({
      kind: 'shared',
      type: 'plain',
      value: 'abc',
      config: {},
    })

    await runInContext(async () => {
      setContextNamespace('test')

      const templateSecret = {
        kind: 'shared',
        type: 'template',
        value: 'xyz',
        config: {
          template: 'some-template',
          parameters: {},
        },
      }

      const result = await getSecretValue(templateSecret)

      expect(result).toBe('xyz')
      expect(mockRevealSecretTemplateInstanceFromSecret).toHaveBeenCalledWith(
        templateSecret
      )
    })()
  })

  it('should handle bearer token with empty value', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'bearer',
        value: '',
      }

      const result = await getSecretValue(secret)

      expect(result).toBeNull()
    })()
  })

  it('should handle basic auth with JSON credentials containing user/pass', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'basic',
        value: JSON.stringify({ user: 'testuser', pass: 'testpass' }),
      }

      const result = await getSecretValue(secret)

      expect(result).toBe(`Basic ${encodeB64('testuser:testpass')}`)
    })()
  })

  it('should handle basic auth with malformed JSON', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'basic',
        value: 'not-json-data',
      }

      const result = await getSecretValue(secret)

      expect(result).toBe(`Basic ${encodeB64('not-json-data')}`)
    })()
  })

  it('should return null for plain secret with empty value', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'plain',
        value: '',
      }

      const result = await getSecretValue(secret)

      expect(result).toBeNull()
    })()
  })

  it('should handle oauth token refresh with simple simulation', async () => {
    // @note instead of complex mocking, create a test that simulates the OAuth
    // flow by testing the expected behavior when OAuth dependencies return
    // expected values

    await runInContext(async () => {
      setContextNamespace('test')
      setContextContact({
        verifiedAt: new Date(),
        secret: {
          value: 'accessToken: test-oauth-token',
        },
      })

      prisma.secretValue.findUnique.mockResolvedValue({
        value: 'accessToken: test-oauth-token',
      })

      const oauthSecret = {
        kind: 'personal',
        type: 'oauth',
        value: 'accessToken: test-oauth-token',
      }

      const result = await getSecretValue(oauthSecret)

      // @note the OAuth functionality should parse the accessToken from the
      // value and return it as a Bearer token

      expect(result).toBe('Bearer test-oauth-token')

      expect(prisma.secretValue.findUnique).toHaveBeenCalled()
    })()
  })

  it('should use provided options namespace instead of context', async () => {
    await runInContext(async () => {
      setContextNamespace('context-namespace')

      const secret = {
        kind: 'shared',
        type: 'plain',
        value: 'test-value',
      }

      const options = {
        namespace: 'options-namespace',
      }

      // @note should use options.namespace instead of context namespace

      const result = await getSecretValue(secret, options)

      expect(result).toBe('test-value')
    })()
  })
})

describe('getSecretValueAndType', () => {
  it('should return value, type, and baseType for plain secret', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'plain',
        value: 'test-value',
      }

      const result = await getSecretValueAndType(secret)

      expect(result).toEqual({
        value: 'test-value',
        type: 'plain',
        baseType: 'plain',
      })
    })()
  })

  it('should return value, type, and baseType for bearer secret', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'bearer',
        value: 'token123',
      }

      const result = await getSecretValueAndType(secret)

      expect(result).toEqual({
        value: 'Bearer token123',
        type: 'bearer',
        baseType: 'bearer',
      })
    })()
  })

  it('should return value, type, and baseType for basic secret', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'basic',
        value: JSON.stringify({ username: 'user', password: 'pass' }),
      }

      const result = await getSecretValueAndType(secret)

      expect(result).toEqual({
        value: `Basic ${encodeB64('user:pass')}`,
        type: 'basic',
        baseType: 'basic',
      })
    })()
  })

  it('should track baseType through template secret', async () => {
    const secretTemplate = await import('@/lib/secret.template')

    const mockRevealSecretTemplateInstanceFromSecret = jest.mocked(
      secretTemplate.revealSecretInstanceFromTemplateSecret
    )

    mockRevealSecretTemplateInstanceFromSecret.mockResolvedValue({
      kind: 'shared',
      type: 'bearer',
      value: 'template-token',
      config: {},
    })

    await runInContext(async () => {
      setContextNamespace('test')

      const templateSecret = {
        kind: 'shared',
        type: 'template',
        value: 'template-token',
        config: {
          template: 'some-template',
          parameters: {},
        },
      }

      const result = await getSecretValueAndType(templateSecret)

      // @note baseType should be 'bearer' (from resolved template) not 'template'
      expect(result).toEqual({
        value: 'Bearer template-token',
        type: 'bearer',
        baseType: 'bearer',
      })
    })()
  })

  it('should preserve custom baseType parameter', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'bearer',
        value: 'token123',
      }

      const result = await getSecretValueAndType(secret, {}, 'oauth')

      // @note baseType should be preserved as 'oauth' even though type is 'bearer'
      expect(result).toEqual({
        value: 'Bearer token123',
        type: 'bearer',
        baseType: 'oauth',
      })
    })()
  })

  it('should return null for empty plain secret', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'plain',
        value: '',
      }

      const result = await getSecretValueAndType(secret)

      expect(result).toBeNull()
    })()
  })

  it('should throw error when secret manager cannot be obtained without context', async () => {
    await runInContext(async () => {
      // @note no context set, should throw specific error

      const secret = {
        kind: 'personal',
        type: 'plain',
        value: 'test',
      }

      await expect(getSecretValueAndType(secret)).rejects.toThrow(
        /Cannot obtain valid authentication context/
      )
    })()
  })

  it('should handle bearer secret with custom schema through getSecretValueAndType', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'bearer',
        value: 'custom-token',
        config: {
          schema: 'ApiKey',
        },
      }

      const result = await getSecretValueAndType(secret)

      expect(result).toEqual({
        value: 'ApiKey custom-token',
        type: 'bearer',
        baseType: 'bearer',
      })
    })()
  })
})

describe('getSecretValue - reference secret type', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should resolve reference secret to plain secret', async () => {
    const secretReference = await import('@/lib/secret.reference')

    const mockRevealSecretInstanceFromReferenceSecret = jest.spyOn(
      secretReference,
      'revealSecretInstanceFromReferenceSecret'
    )

    mockRevealSecretInstanceFromReferenceSecret.mockResolvedValue({
      kind: 'shared',
      type: 'plain',
      value: 'referenced-value',
      config: null,
    })

    await runInContext(async () => {
      setContextNamespace('test')

      const referenceSecret = {
        kind: 'shared',
        type: 'reference',
        value: null,
        config: {
          secretId: 'some-secret-id',
        },
      }

      const result = await getSecretValue(referenceSecret)

      expect(result).toBe('referenced-value')
      expect(mockRevealSecretInstanceFromReferenceSecret).toHaveBeenCalledWith(
        referenceSecret
      )
    })()
  })

  it('should resolve reference secret to bearer secret', async () => {
    const secretReference = await import('@/lib/secret.reference')

    const mockRevealSecretInstanceFromReferenceSecret = jest.spyOn(
      secretReference,
      'revealSecretInstanceFromReferenceSecret'
    )

    mockRevealSecretInstanceFromReferenceSecret.mockResolvedValue({
      kind: 'shared',
      type: 'bearer',
      value: 'ref-bearer-token',
      config: null,
    })

    await runInContext(async () => {
      setContextNamespace('test')

      const referenceSecret = {
        kind: 'shared',
        type: 'reference',
        value: null,
        config: {
          secretId: 'bearer-secret-id',
        },
      }

      const result = await getSecretValue(referenceSecret)

      expect(result).toBe('Bearer ref-bearer-token')
    })()
  })

  it('should throw error when reference secret cannot be resolved', async () => {
    const secretReference = await import('@/lib/secret.reference')

    const mockRevealSecretInstanceFromReferenceSecret = jest.spyOn(
      secretReference,
      'revealSecretInstanceFromReferenceSecret'
    )

    mockRevealSecretInstanceFromReferenceSecret.mockResolvedValue(null)

    await runInContext(async () => {
      setContextNamespace('test')

      const referenceSecret = {
        kind: 'shared',
        type: 'reference',
        value: null,
        config: {
          secretId: 'non-existent-secret-id',
        },
      }

      await expect(getSecretValue(referenceSecret)).rejects.toThrow(
        /Cannot find secret reference/
      )
    })()
  })

  it('should use reference secret value when provided', async () => {
    const secretReference = await import('@/lib/secret.reference')

    const mockRevealSecretInstanceFromReferenceSecret = jest.spyOn(
      secretReference,
      'revealSecretInstanceFromReferenceSecret'
    )

    mockRevealSecretInstanceFromReferenceSecret.mockResolvedValue({
      kind: 'shared',
      type: 'plain',
      value: 'default-value',
      config: null,
    })

    await runInContext(async () => {
      setContextNamespace('test')

      const referenceSecret = {
        kind: 'shared',
        type: 'reference',
        value: 'override-value',
        config: {
          secretId: 'some-secret-id',
        },
      }

      const result = await getSecretValue(referenceSecret)

      // @note should use the reference secret's value, not the default value
      expect(result).toBe('override-value')
    })()
  })
})

describe('getSecretValue - template secret edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should throw error when template secret cannot be resolved', async () => {
    const secretTemplate = await import('@/lib/secret.template')

    const mockRevealSecretTemplateInstanceFromSecret = jest.spyOn(
      secretTemplate,
      'revealSecretInstanceFromTemplateSecret'
    )

    mockRevealSecretTemplateInstanceFromSecret.mockResolvedValue(null)

    await runInContext(async () => {
      setContextNamespace('test')

      const templateSecret = {
        kind: 'shared',
        type: 'template',
        value: null,
        config: {
          template: 'non-existent-template',
        },
      }

      await expect(getSecretValue(templateSecret)).rejects.toThrow(
        /Cannot find secret template/
      )
    })()
  })

  it('should prevent nested template secrets', async () => {
    const secretTemplate = await import('@/lib/secret.template')

    const mockRevealSecretTemplateInstanceFromSecret = jest.spyOn(
      secretTemplate,
      'revealSecretInstanceFromTemplateSecret'
    )

    // @note mock returns another template type, which is not allowed
    mockRevealSecretTemplateInstanceFromSecret.mockResolvedValue({
      kind: 'shared',
      type: 'template',
      value: 'nested-template',
      config: {
        template: 'nested-template',
      },
    })

    await runInContext(async () => {
      setContextNamespace('test')

      const templateSecret = {
        kind: 'shared',
        type: 'template',
        value: null,
        config: {
          template: 'outer-template',
        },
      }

      await expect(getSecretValue(templateSecret)).rejects.toThrow(
        /Nested templates are not allowed/
      )
    })()
  })

  it('should resolve template to basic auth secret', async () => {
    const secretTemplate = await import('@/lib/secret.template')

    const mockRevealSecretTemplateInstanceFromSecret = jest.spyOn(
      secretTemplate,
      'revealSecretInstanceFromTemplateSecret'
    )

    mockRevealSecretTemplateInstanceFromSecret.mockResolvedValue({
      kind: 'shared',
      type: 'basic',
      value: JSON.stringify({
        username: 'template-user',
        password: 'template-pass',
      }),
      config: null,
    })

    await runInContext(async () => {
      setContextNamespace('test')

      const templateSecret = {
        kind: 'shared',
        type: 'template',
        value: null,
        config: {
          template: 'basic-auth-template',
        },
      }

      const result = await getSecretValue(templateSecret)

      expect(result).toBe(`Basic ${encodeB64('template-user:template-pass')}`)
    })()
  })

  it('should use template secret value when provided', async () => {
    const secretTemplate = await import('@/lib/secret.template')

    const mockRevealSecretTemplateInstanceFromSecret = jest.spyOn(
      secretTemplate,
      'revealSecretInstanceFromTemplateSecret'
    )

    mockRevealSecretTemplateInstanceFromSecret.mockResolvedValue({
      kind: 'shared',
      type: 'plain',
      value: 'default-template-value',
      config: null,
    })

    await runInContext(async () => {
      setContextNamespace('test')

      const templateSecret = {
        kind: 'shared',
        type: 'template',
        value: 'override-template-value',
        config: {
          template: 'some-template',
        },
      }

      const result = await getSecretValue(templateSecret)

      // @note should use the template secret's value
      expect(result).toBe('override-template-value')
    })()
  })
})

describe('swapSecrets - secret exists but has no value', () => {
  const getUnsafeSecretInstance = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should throw UserAuthError when secret exists but has no value', async () => {
    // @note this tests the scenario where a secret record exists in the
    // database but has no value configured (e.g., OAuth not completed)

    getUnsafeSecretInstance.mockImplementation(({ secretName }) => {
      if (secretName === 'EMPTY') {
        return {
          id: 'sec_123',
          name: 'betterstack-auth',
          kind: 'shared',
          value: null, // @note no value configured
          type: 'plain',
        }
      }

      return null
    })

    const headers = {
      Authorization: '${SECRET_EMPTY}',
    }

    await expect(
      runInContext(async () => {
        setContextNamespace('test')

        return swapSecrets(headers, {
          userId: 'user123',
          abilityId: null,
          secretId: null,
          fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
        })
      })()
    ).rejects.toThrow('A linked secret exists but has no value configured')
  })

  it('should throw UserAuthError when secret has no name', async () => {
    getUnsafeSecretInstance.mockImplementation(({ secretName }) => {
      if (secretName === 'DEFAULT') {
        return {
          id: 'sec_123',
          name: null, // @note secret has no name
          kind: 'shared',
          value: '', // @note empty value
          type: 'plain',
        }
      }

      return null
    })

    const headers = {
      Authorization: '${SECRET_DEFAULT}',
    }

    await expect(
      runInContext(async () => {
        setContextNamespace('test')

        return swapSecrets(headers, {
          userId: 'user123',
          abilityId: null,
          secretId: null,
          fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
        })
      })()
    ).rejects.toThrow('A linked secret exists but has no value configured')
  })

  it('should not throw when secret has a valid value', async () => {
    getUnsafeSecretInstance.mockImplementation(({ secretName }) => {
      if (secretName === 'VALID') {
        return {
          id: 'sec_123',
          name: 'valid-secret',
          kind: 'shared',
          value: 'Bearer my-token',
          type: 'plain',
        }
      }

      return null
    })

    const headers = {
      Authorization: '${SECRET_VALID}',
    }

    const result = await runInContext(async () => {
      setContextNamespace('test')

      return swapSecrets(headers, {
        userId: 'user123',
        abilityId: null,
        secretId: null,
        fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
      })
    })()

    expect(toHeadersHashMap(result)).toEqual({
      authorization: 'Bearer my-token',
    })
  })
})

describe('swapSecrets - discardSecretPlaceholders option', () => {
  const getUnsafeSecretInstance = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should keep secret placeholders when discardSecretPlaceholders is false', async () => {
    getUnsafeSecretInstance.mockImplementation(() => null)

    const headers = {
      'X-Api-Key': '${SECRET_MISSING}',
      'X-Token': '${SECRET_NOT_FOUND}',
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
      discardSecretPlaceholders: false,
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-api-key': '${SECRET_MISSING}',
      'x-token': '${SECRET_NOT_FOUND}',
    })
  })

  it('should keep secret placeholders when discardSecretPlaceholders is undefined', async () => {
    getUnsafeSecretInstance.mockImplementation(() => null)

    const headers = {
      'X-Api-Key': '${SECRET_MISSING}',
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
      // @note discardSecretPlaceholders not specified, defaults to undefined
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-api-key': '${SECRET_MISSING}',
    })
  })

  it('should discard secret placeholders when discardSecretPlaceholders is true', async () => {
    getUnsafeSecretInstance.mockImplementation(() => null)

    const headers = {
      'X-Api-Key': '${SECRET_MISSING}',
      'X-Token': '${SECRET_NOT_FOUND}',
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
      discardSecretPlaceholders: true,
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-api-key': '',
      'x-token': '',
    })
  })

  it('should discard only missing secrets, keep found ones', async () => {
    getUnsafeSecretInstance.mockImplementation(({ secretName }) => {
      if (secretName === 'FOUND') {
        return {
          kind: 'shared',
          value: 'found-value',
          type: 'plain',
        }
      }

      return null
    })

    const headers = {
      'X-Mixed': '${SECRET_FOUND}:${SECRET_MISSING}',
      'X-Found': '${SECRET_FOUND}',
      'X-Missing': '${SECRET_MISSING}',
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
      discardSecretPlaceholders: true,
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-mixed': 'found-value:',
      'x-found': 'found-value',
      'x-missing': '',
    })
  })

  it('should discard multiple missing secrets in single header', async () => {
    getUnsafeSecretInstance.mockImplementation(() => null)

    const headers = {
      'X-Multiple': '${SECRET_ONE}:${SECRET_TWO}:${SECRET_THREE}',
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
      discardSecretPlaceholders: true,
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-multiple': '::',
    })
  })

  it('should work with inline secrets when discarding placeholders', async () => {
    const headers = {
      'X-Mixed': '${SECRET_INLINE}:${SECRET_MISSING}',
    }

    const inlineSecrets = {
      INLINE: { value: 'inline-value' },
    }

    const updatedHeaders = await swapSecrets(headers, {
      userId: 'user123',
      abilityId: null,
      secretId: null,
      inlineSecrets,
      fnGetUnsafeSecretInstance: getUnsafeSecretInstance,
      discardSecretPlaceholders: true,
    })

    expect(toHeadersHashMap(updatedHeaders)).toEqual({
      'x-mixed': 'inline-value:',
    })
  })
})

describe('getSecretValue - basic auth edge cases', () => {
  it('should encode username with empty password when only username provided', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'basic',
        value: JSON.stringify({ username: 'admin' }),
      }

      const result = await getSecretValue(secret)

      // @note password is undefined, should encode as empty string
      expect(result).toBe(`Basic ${encodeB64('admin:')}`)
    })()
  })

  it('should encode empty username with password when only password provided', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'basic',
        value: JSON.stringify({ password: 'secret' }),
      }

      const result = await getSecretValue(secret)

      // @note username is undefined, should encode as empty string
      expect(result).toBe(`Basic ${encodeB64(':secret')}`)
    })()
  })

  it('should handle credentials with username:password containing colons', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'basic',
        value: 'user:name:pass:word',
      }

      const result = await getSecretValue(secret)

      // @note raw string with colons should be base64 encoded as-is
      expect(result).toBe(`Basic ${encodeB64('user:name:pass:word')}`)
    })()
  })

  it('should encode empty username with valid password', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'basic',
        value: JSON.stringify({ username: '', password: 'secret' }),
      }

      const result = await getSecretValue(secret)

      // @note empty username is falsy but still encodes as empty:password
      expect(result).toBe(`Basic ${encodeB64(':secret')}`)
    })()
  })

  it('should encode valid username with empty password', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'basic',
        value: JSON.stringify({ username: 'admin', password: '' }),
      }

      const result = await getSecretValue(secret)

      // @note empty password is falsy but still encodes as username:empty
      expect(result).toBe(`Basic ${encodeB64('admin:')}`)
    })()
  })

  it('should handle credentials with both user/username fields', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'basic',
        value: JSON.stringify({
          user: 'user-field',
          username: 'username-field',
          password: 'pass',
        }),
      }

      const result = await getSecretValue(secret)

      // @note username takes precedence over user
      expect(result).toBe(`Basic ${encodeB64('username-field:pass')}`)
    })()
  })

  it('should handle credentials with both pass/password fields', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'basic',
        value: JSON.stringify({
          username: 'admin',
          pass: 'pass-field',
          password: 'password-field',
        }),
      }

      const result = await getSecretValue(secret)

      // @note password takes precedence over pass
      expect(result).toBe(`Basic ${encodeB64('admin:password-field')}`)
    })()
  })

  it('should return null when both username and password are missing', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'basic',
        value: JSON.stringify({ otherField: 'value' }),
      }

      const result = await getSecretValue(secret)

      // @note both username and password are undefined, should return null
      expect(result).toBeNull()
    })()
  })

  it('should return null when credentials object is empty', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'basic',
        value: JSON.stringify({}),
      }

      const result = await getSecretValue(secret)

      // @note empty object means no username/password, should return null
      expect(result).toBeNull()
    })()
  })

  it('should handle null username with valid password', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'basic',
        value: JSON.stringify({ username: null, password: 'secret' }),
      }

      const result = await getSecretValue(secret)

      // @note null is falsy like undefined, should encode as empty string
      expect(result).toBe(`Basic ${encodeB64(':secret')}`)
    })()
  })

  it('should handle valid username with null password', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'basic',
        value: JSON.stringify({ username: 'admin', password: null }),
      }

      const result = await getSecretValue(secret)

      // @note null is falsy like undefined, should encode as empty string
      expect(result).toBe(`Basic ${encodeB64('admin:')}`)
    })()
  })

  it('should handle both username and password as null', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'basic',
        value: JSON.stringify({ username: null, password: null }),
      }

      const result = await getSecretValue(secret)

      // @note both are null (falsy), should return null
      expect(result).toBeNull()
    })()
  })

  it('should return null when the secret has no value', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'basic',
        value: null,
      }

      const result = await getSecretValue(secret)

      // @note a secret nobody has authenticated yet holds no credentials -
      // encoding it into a bare `Basic ` header reports it as authenticated
      expect(result).toBeNull()
    })()
  })

  it('should return null when the value is empty', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'basic',
        value: '',
      }

      const result = await getSecretValue(secret)

      expect(result).toBeNull()
    })()
  })

  it('should return null when the value is only whitespace', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'basic',
        value: '   \n  ',
      }

      const result = await getSecretValue(secret)

      expect(result).toBeNull()
    })()
  })
})

describe('getInlineSecretValue', () => {
  describe('basic functionality', () => {
    it('should return string value from direct value entry', async () => {
      const secrets = {
        API_KEY: { value: 'test-api-key' },
      }

      const result = await getInlineSecretValue(secrets, 'API_KEY')

      expect(result).toBe('test-api-key')
    })

    it('should return null for non-existent secret', async () => {
      const secrets = {
        API_KEY: { value: 'test-api-key' },
      }

      const result = await getInlineSecretValue(secrets, 'NON_EXISTENT')

      expect(result).toBe(null)
    })

    it('should return null when secret map is empty', async () => {
      const secrets = {}

      const result = await getInlineSecretValue(secrets, 'API_KEY')

      expect(result).toBe(null)
    })
  })

  describe('async value getters', () => {
    it('should resolve value from async getter in object', async () => {
      const secrets = {
        ASYNC_SECRET: {
          value: async () => 'async-value',
        },
      }

      const result = await getInlineSecretValue(secrets, 'ASYNC_SECRET')

      expect(result).toBe('async-value')
    })

    it('should resolve value from direct async getter function', async () => {
      const secrets = {
        DIRECT_ASYNC: async () => 'direct-async-value',
      }

      const result = await getInlineSecretValue(secrets, 'DIRECT_ASYNC')

      expect(result).toBe('direct-async-value')
    })

    it('should handle async getter returning null', async () => {
      const secrets = {
        NULL_SECRET: {
          value: async () => null,
        },
      }

      const result = await getInlineSecretValue(secrets, 'NULL_SECRET')

      expect(result).toBe(null)
    })

    it('should handle direct async getter returning null', async () => {
      const secrets = {
        NULL_DIRECT: async () => null,
      }

      const result = await getInlineSecretValue(secrets, 'NULL_DIRECT')

      expect(result).toBe(null)
    })
  })

  describe('lazy-loaded secret maps', () => {
    it('should resolve secrets from getter function', async () => {
      const secretMapGetter = async () => ({
        LAZY_SECRET: { value: 'lazy-value' },
      })

      const result = await getInlineSecretValue(secretMapGetter, 'LAZY_SECRET')

      expect(result).toBe('lazy-value')
    })

    it('should handle getter returning null map', async () => {
      const secretMapGetter = async () => null

      const result = await getInlineSecretValue(secretMapGetter, 'ANY_SECRET')

      expect(result).toBe(null)
    })

    it('should handle getter returning empty map', async () => {
      const secretMapGetter = async () => ({})

      const result = await getInlineSecretValue(secretMapGetter, 'ANY_SECRET')

      expect(result).toBe(null)
    })

    it('should resolve nested async values from lazy map', async () => {
      const secretMapGetter = async () => ({
        NESTED_ASYNC: {
          value: async () => 'nested-async-value',
        },
      })

      const result = await getInlineSecretValue(secretMapGetter, 'NESTED_ASYNC')

      expect(result).toBe('nested-async-value')
    })
  })

  describe('case-insensitive matching', () => {
    it('should find secret with exact case match first', async () => {
      const secrets = {
        api_key: { value: 'lowercase' },
        API_KEY: { value: 'uppercase' },
      }

      const result = await getInlineSecretValue(secrets, 'API_KEY')

      expect(result).toBe('uppercase')
    })

    it('should fallback to case-insensitive match when exact match fails', async () => {
      const secrets = {
        api_key: { value: 'found-value' },
      }

      const result = await getInlineSecretValue(secrets, 'API_KEY')

      expect(result).toBe('found-value')
    })

    it('should handle mixed case in both secret name and request', async () => {
      const secrets = {
        'My-Api-Key': { value: 'mixed-case-value' },
      }

      const result = await getInlineSecretValue(secrets, 'my-api-key')

      expect(result).toBe('mixed-case-value')
    })

    it('should work with case-insensitive async getters', async () => {
      const secrets = {
        async_secret: async () => 'case-insensitive-async',
      }

      const result = await getInlineSecretValue(secrets, 'ASYNC_SECRET')

      expect(result).toBe('case-insensitive-async')
    })
  })

  describe('error handling', () => {
    it('should propagate errors from async value getters', async () => {
      const secrets = {
        ERROR_SECRET: {
          value: async () => {
            throw new Error('Value getter error')
          },
        },
      }

      await expect(
        getInlineSecretValue(secrets, 'ERROR_SECRET')
      ).rejects.toThrow('Value getter error')
    })

    it('should propagate errors from direct async getters', async () => {
      const secrets = {
        ERROR_DIRECT: async () => {
          throw new Error('Direct getter error')
        },
      }

      await expect(
        getInlineSecretValue(secrets, 'ERROR_DIRECT')
      ).rejects.toThrow('Direct getter error')
    })

    it('should propagate errors from secret map getter', async () => {
      const secretMapGetter = async () => {
        throw new Error('Map getter error')
      }

      await expect(
        getInlineSecretValue(secretMapGetter, 'ANY_SECRET')
      ).rejects.toThrow('Map getter error')
    })

    it('should handle invalid secret entry format gracefully', async () => {
      const secrets = {
        // @note this simulates an invalid entry that somehow bypassed type checking
        INVALID_SECRET: { invalidProperty: 'invalid' },
      }

      const result = await getInlineSecretValue(secrets, 'INVALID_SECRET')

      expect(result).toBe(null)
    })
  })

  describe('complex scenarios', () => {
    it('should handle mix of sync and async secrets', async () => {
      const secrets = {
        SYNC_SECRET: { value: 'sync-value' },
        ASYNC_SECRET: { value: async () => 'async-value' },
        DIRECT_ASYNC: async () => 'direct-async-value',
      }

      const syncResult = await getInlineSecretValue(secrets, 'SYNC_SECRET')
      const asyncResult = await getInlineSecretValue(secrets, 'ASYNC_SECRET')

      const directAsyncResult = await getInlineSecretValue(
        secrets,
        'DIRECT_ASYNC'
      )

      expect(syncResult).toBe('sync-value')
      expect(asyncResult).toBe('async-value')
      expect(directAsyncResult).toBe('direct-async-value')
    })

    it('should handle async map with async values', async () => {
      const secretMapGetter = async () => {
        // @note simulate loading secrets from external source
        await new Promise((resolve) => setTimeout(resolve, 1))

        return {
          EXTERNAL_SECRET: {
            value: async () => {
              // @note simulate async value resolution
              await new Promise((resolve) => setTimeout(resolve, 1))

              return 'external-async-value'
            },
          },
        }
      }

      const result = await getInlineSecretValue(
        secretMapGetter,
        'EXTERNAL_SECRET'
      )

      expect(result).toBe('external-async-value')
    })

    it('should preserve secret precedence with case matching', async () => {
      // @note test that exact case matches take precedence over case-insensitive
      const secrets = {
        database_url: { value: 'lowercase-db' },
        DATABASE_URL: { value: 'uppercase-db' },
        Database_Url: { value: 'mixed-case-db' },
      }

      const exactMatch = await getInlineSecretValue(secrets, 'DATABASE_URL')

      const caseInsensitiveMatch = await getInlineSecretValue(
        secrets,
        'database_URL'
      )

      expect(exactMatch).toBe('uppercase-db')
      // @note should find first case-insensitive match (iteration order dependent)
      expect(caseInsensitiveMatch).toBe('lowercase-db')
    })

    it('should handle empty string values correctly', async () => {
      const secrets = {
        EMPTY_SECRET: { value: '' },
        EMPTY_ASYNC: { value: async () => '' },
      }

      const emptySync = await getInlineSecretValue(secrets, 'EMPTY_SECRET')
      const emptyAsync = await getInlineSecretValue(secrets, 'EMPTY_ASYNC')

      expect(emptySync).toBe('')
      expect(emptyAsync).toBe('')
    })

    it('should handle special characters in secret names', async () => {
      const secrets = {
        'API-KEY_V1.2': { value: 'special-chars-value' },
        '@internal/secret': { value: 'scoped-value' },
      }

      const specialResult = await getInlineSecretValue(secrets, 'API-KEY_V1.2')

      const scopedResult = await getInlineSecretValue(
        secrets,
        '@internal/secret'
      )

      expect(specialResult).toBe('special-chars-value')
      expect(scopedResult).toBe('scoped-value')
    })
  })

  describe('performance considerations', () => {
    it('should prioritize exact matches for performance', async () => {
      const valueGetter = jest.fn(async () => 'getter-value')

      const secrets = {
        // @note add many case variations to test exact match performance
        ...Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [
            `secret_${i}`,
            { value: `value_${i}` },
          ])
        ),
        TARGET_SECRET: { value: valueGetter },
      }

      // @note exact match should not require iteration through all keys
      const result = await getInlineSecretValue(secrets, 'TARGET_SECRET')

      expect(result).toBe('getter-value')
      expect(valueGetter).toHaveBeenCalledTimes(1)
    })

    it('should only perform case-insensitive search when needed', async () => {
      const secrets = {
        exact_match: { value: 'exact-value' },
        case_insensitive: { value: 'case-value' },
      }

      // @note exact match should not trigger case-insensitive search
      const exactResult = await getInlineSecretValue(secrets, 'exact_match')

      expect(exactResult).toBe('exact-value')

      // @note case-insensitive match should work when exact fails
      const caseResult = await getInlineSecretValue(secrets, 'CASE_INSENSITIVE')

      expect(caseResult).toBe('case-value')
    })
  })

  describe('backward compatibility - empty string handling', () => {
    it('should return empty string values as-is for direct usage', async () => {
      const secrets = {
        EMPTY_SECRET: { value: '' },
        NULL_SECRET: { value: async () => null },
      }

      const emptyResult = await getInlineSecretValue(secrets, 'EMPTY_SECRET')
      const nullResult = await getInlineSecretValue(secrets, 'NULL_SECRET')

      expect(emptyResult).toBe('')
      expect(nullResult).toBe(null)
    })
  })
})

describe('hasSecrets', () => {
  describe('with Record<string, string> headers', () => {
    it('should return true when headers contain ${SECRET_*} placeholder', () => {
      const headers = {
        Authorization: 'Bearer ${SECRET_TOKEN}',
      }

      expect(hasSecrets(headers)).toBe(true)
    })

    it('should return true when headers contain {{SECRET_*}} placeholder', () => {
      const headers = {
        Authorization: 'Bearer {{SECRET_TOKEN}}',
      }

      expect(hasSecrets(headers)).toBe(true)
    })

    it('should return false when headers contain no secret placeholders', () => {
      const headers = {
        Authorization: 'Bearer some-static-token',
        'Content-Type': 'application/json',
      }

      expect(hasSecrets(headers)).toBe(false)
    })

    it('should return false for empty headers object', () => {
      const headers = {}

      expect(hasSecrets(headers)).toBe(false)
    })

    it('should detect secrets in any header, not just Authorization', () => {
      const headers = {
        'X-Custom-Header': '${SECRET_API_KEY}',
        'Content-Type': 'application/json',
      }

      expect(hasSecrets(headers)).toBe(true)
    })

    it('should handle multiple headers with secrets', () => {
      const headers = {
        Authorization: 'Bearer ${SECRET_TOKEN}',
        'X-API-Key': '{{SECRET_API_KEY}}',
      }

      expect(hasSecrets(headers)).toBe(true)
    })
  })

  describe('with Record<string, string[]> headers', () => {
    it('should return true when array header values contain secrets', () => {
      const headers = {
        Authorization: ['Bearer ${SECRET_TOKEN}', 'Basic ${SECRET_BASIC}'],
      }

      expect(hasSecrets(headers)).toBe(true)
    })

    it('should return true when only one array value contains a secret', () => {
      const headers = {
        'X-Custom': ['static-value', '${SECRET_KEY}'],
      }

      expect(hasSecrets(headers)).toBe(true)
    })

    it('should return false when no array values contain secrets', () => {
      const headers = {
        Authorization: ['Bearer token1', 'Bearer token2'],
      }

      expect(hasSecrets(headers)).toBe(false)
    })
  })

  describe('with Headers object', () => {
    it('should return true when Headers contain secret placeholders', () => {
      const headers = new Headers()

      headers.set('Authorization', 'Bearer ${SECRET_TOKEN}')

      expect(hasSecrets(headers)).toBe(true)
    })

    it('should return false when Headers contain no secret placeholders', () => {
      const headers = new Headers()

      headers.set('Authorization', 'Bearer static-token')
      headers.set('Content-Type', 'application/json')

      expect(hasSecrets(headers)).toBe(false)
    })

    it('should return false for empty Headers object', () => {
      const headers = new Headers()

      expect(hasSecrets(headers)).toBe(false)
    })

    it('should detect {{SECRET_*}} format in Headers', () => {
      const headers = new Headers()

      headers.set('X-API-Key', '{{SECRET_API_KEY}}')

      expect(hasSecrets(headers)).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should not match partial secret patterns', () => {
      const headers = {
        'X-Info': 'SECRET_TOKEN is the key name',
      }

      expect(hasSecrets(headers)).toBe(false)
    })

    it('should not match ${SECRET} without underscore', () => {
      const headers = {
        Authorization: '${SECRET}',
      }

      expect(hasSecrets(headers)).toBe(false)
    })

    it('should match DEFAULT secret name', () => {
      const headers = {
        Authorization: '${SECRET_DEFAULT}',
      }

      expect(hasSecrets(headers)).toBe(true)
    })

    it('should handle mixed static and secret content in same value', () => {
      const headers = {
        'X-Combined': 'prefix-${SECRET_KEY}-suffix',
      }

      expect(hasSecrets(headers)).toBe(true)
    })

    it('should handle multiple secrets in same header value', () => {
      const headers = {
        'X-Combined': '${SECRET_USER}:${SECRET_PASS}',
      }

      expect(hasSecrets(headers)).toBe(true)
    })
  })
})

describe('getSecretValueAndType - jwt secret type', () => {
  function readDerLength(bytes, offset) {
    const first = bytes[offset++]

    if (first < 0x80) {
      return { length: first, offset }
    }

    const byteLength = first & 0x7f
    let length = 0

    for (let i = 0; i < byteLength; i++) {
      length = (length << 8) | bytes[offset++]
    }

    return { length, offset }
  }

  function readDerElement(bytes, offset, tag) {
    if (bytes[offset++] !== tag) {
      throw new Error(`unexpected DER tag`)
    }

    const lengthResult = readDerLength(bytes, offset)
    const start = lengthResult.offset
    const end = start + lengthResult.length

    return {
      value: bytes.slice(start, end),
      offset: end,
    }
  }

  function pemToBytes(pem, label) {
    const base64 = pem
      .replace(new RegExp(`-----BEGIN ${label}-----`, 'g'), '')
      .replace(new RegExp(`-----END ${label}-----`, 'g'), '')
      .replace(/\s/g, '')

    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  }

  function bytesToPem(bytes, label) {
    const base64 = btoa(String.fromCharCode(...bytes))
    const lines = base64.match(/.{1,64}/g) || []

    return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`
  }

  function extractPkcs1FromPkcs8Pem(pem) {
    const privateKeyInfo = readDerElement(pemToBytes(pem, 'PRIVATE KEY'), 0, 0x30)
    let offset = 0

    offset = readDerElement(privateKeyInfo.value, offset, 0x02).offset
    offset = readDerElement(privateKeyInfo.value, offset, 0x30).offset

    return bytesToPem(
      readDerElement(privateKeyInfo.value, offset, 0x04).value,
      'RSA PRIVATE KEY'
    )
  }

  let rsaPrivateKeyPem
  let rsaPrivateKeyPkcs1Pem
  let rsaPublicKey
  let ecPrivateKeyPem
  let ecPublicKey

  beforeAll(async () => {
    const { generateKeyPair, exportPKCS8, exportSPKI } = await import('jose')

    const rsa = await generateKeyPair('RS256')

    rsaPrivateKeyPem = await exportPKCS8(rsa.privateKey)
    rsaPrivateKeyPkcs1Pem = extractPkcs1FromPkcs8Pem(rsaPrivateKeyPem)
    rsaPublicKey = rsa.publicKey

    const ec = await generateKeyPair('ES256')

    ecPrivateKeyPem = await exportPKCS8(ec.privateKey)
    ecPublicKey = ec.publicKey
  })

  it('should sign a JWT with RS256 by default and return Bearer token', async () => {
    const { jwtVerify } = await import('jose')

    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'jwt',
        value: rsaPrivateKeyPem,
        config: {
          claims: { iss: 'app-123' },
        },
      }

      const result = await getSecretValueAndType(secret)

      expect(result).not.toBeNull()
      expect(result.type).toBe('bearer')
      expect(result.baseType).toBe('jwt')
      expect(result.value).toMatch(/^Bearer /)

      const token = result.value.replace('Bearer ', '')
      const { payload } = await jwtVerify(token, rsaPublicKey)

      expect(payload.iss).toBe('app-123')
      expect(payload.iat).toBeDefined()
      expect(payload.exp).toBeDefined()
      expect(payload.exp - payload.iat).toBe(600)
    })()
  })

  it('should sign a JWT from a PKCS#1 RSA private key', async () => {
    const { jwtVerify } = await import('jose')

    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'jwt',
        value: rsaPrivateKeyPkcs1Pem,
        config: {
          claims: { iss: 'github-app-123' },
        },
      }

      const result = await getSecretValueAndType(secret)

      expect(result).not.toBeNull()
      expect(result.type).toBe('bearer')
      expect(result.baseType).toBe('jwt')

      const token = result.value.replace('Bearer ', '')
      const { payload } = await jwtVerify(token, rsaPublicKey)

      expect(payload.iss).toBe('github-app-123')
    })()
  })

  it('should respect custom expiresInSeconds', async () => {
    const { jwtVerify } = await import('jose')

    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'jwt',
        value: rsaPrivateKeyPem,
        config: {
          claims: { iss: 'app-456' },
          expiresInSeconds: 120,
        },
      }

      const result = await getSecretValueAndType(secret)
      const token = result.value.replace('Bearer ', '')
      const { payload } = await jwtVerify(token, rsaPublicKey)

      expect(payload.exp - payload.iat).toBe(120)
    })()
  })

  it('should sign with ES256 when algorithm is specified', async () => {
    const { jwtVerify } = await import('jose')

    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'jwt',
        value: ecPrivateKeyPem,
        config: {
          algorithm: 'ES256',
          claims: { iss: 'ec-app' },
        },
      }

      const result = await getSecretValueAndType(secret)

      expect(result.type).toBe('bearer')
      expect(result.baseType).toBe('jwt')

      const token = result.value.replace('Bearer ', '')
      const { payload } = await jwtVerify(token, ecPublicKey)

      expect(payload.iss).toBe('ec-app')
    })()
  })

  it('should use custom schema from config', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'jwt',
        value: rsaPrivateKeyPem,
        config: {
          schema: 'Token',
          claims: { iss: 'app-789' },
        },
      }

      const result = await getSecretValueAndType(secret)

      expect(result.value).toMatch(/^Token /)
    })()
  })

  it('should include multiple custom claims in the token', async () => {
    const { jwtVerify } = await import('jose')

    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'jwt',
        value: rsaPrivateKeyPem,
        config: {
          claims: {
            iss: 'app-multi',
            sub: 'installation-42',
            aud: 'https://api.example.com',
          },
        },
      }

      const result = await getSecretValueAndType(secret)
      const token = result.value.replace('Bearer ', '')
      const { payload } = await jwtVerify(token, rsaPublicKey, {
        audience: 'https://api.example.com',
      })

      expect(payload.iss).toBe('app-multi')
      expect(payload.sub).toBe('installation-42')
    })()
  })

  it('should return null when value is missing', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'jwt',
        value: null,
        config: {
          claims: { iss: 'app-123' },
        },
      }

      const result = await getSecretValueAndType(secret)

      expect(result).toBeNull()
    })()
  })

  it('should default to empty claims when config.claims is absent', async () => {
    const { jwtVerify } = await import('jose')

    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'jwt',
        value: rsaPrivateKeyPem,
        config: {},
      }

      const result = await getSecretValueAndType(secret)

      expect(result).not.toBeNull()

      const token = result.value.replace('Bearer ', '')
      const { payload } = await jwtVerify(token, rsaPublicKey)

      expect(payload.iat).toBeDefined()
      expect(payload.exp).toBeDefined()
    })()
  })

  it('should default to Bearer schema when config.schema is empty string', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'jwt',
        value: rsaPrivateKeyPem,
        config: {
          schema: '',
          claims: { iss: 'app-123' },
        },
      }

      const result = await getSecretValueAndType(secret)

      expect(result.value).toMatch(/^Bearer /)
    })()
  })

  it('should preserve jwt as baseType when used via template', async () => {
    await runInContext(async () => {
      setContextNamespace('test')

      const secret = {
        kind: 'shared',
        type: 'jwt',
        value: rsaPrivateKeyPem,
        config: { claims: { iss: 'app-123' } },
      }

      const result = await getSecretValueAndType(secret, undefined, 'jwt')

      expect(result.baseType).toBe('jwt')
    })()
  })
})
