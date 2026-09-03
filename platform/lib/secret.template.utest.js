/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import platformSecretTemplatesData from '@chatbotkit-dev/secrets-platform'

import standardSecretTemplatesData from '@/data/secrets/catalogue/standard.yaml'

import prisma from '@/prisma/client'

import { decryptRecord } from '@/lib/cloak'
import * as env from '@/lib/env'
import { merge, pick } from '@/lib/object'
import {
  getTemplateInstance,
  resolveTemplateSecret,
  revealSecretInstanceFromTemplateSecret,
  revealTemplateInstance,
} from '@/lib/secret.template'
import { getTemplate, isPlatformTemplate } from '@/lib/template'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/prisma/types', () => ({
  SecretType: {
    template: 'template',
  },
}))

jest.mock('@/lib/template', () => ({
  getTemplate: jest.fn(),
  isPlatformTemplate: jest.fn(),
}))
jest.mock('@/lib/object')
jest.mock('@/lib/cloak', () => ({
  decryptRecord: jest.fn(),
}))

jest.mock('@/lib/env', () => ({
  __esModule: true,

  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',
  isStaging: false,
  isProduction: false,
}))

describe('getTemplateInstance', () => {
  beforeEach(() => {
    jest.resetAllMocks()

    mockReset(prisma)
  })

  it('returns merged config when template is in platformSecretTemplatesData and in development', async () => {
    env.isDevelopment = true
    env.isTest = false

    const template = 'testTemplate'

    const platformInstance = {
      config: { key1: 'value1' },
      developmentConfig: { key2: 'value2' },
      otherProp: 'other',
    }

    getTemplate.mockImplementation((_template, data) => {
      if (data === platformSecretTemplatesData && _template === template) {
        return platformInstance
      }

      return null
    })

    merge.mockReturnValue({ key1: 'value1', key2: 'value2' })

    const result = await getTemplateInstance(template)

    expect(getTemplate).toHaveBeenCalledWith(
      template,
      platformSecretTemplatesData
    )

    expect(result).toEqual({
      otherProp: 'other',
      config: { key1: 'value1', key2: 'value2' },
    })
  })

  it('returns config without merging when not in development or test', async () => {
    env.isDevelopment = false
    env.isTest = false

    const template = 'testTemplate'

    const platformInstance = {
      config: { key1: 'value1' },
      developmentConfig: { key2: 'value2' },
      otherProp: 'other',
    }

    getTemplate.mockImplementation((tmpl, data) => {
      if (data === platformSecretTemplatesData && tmpl === template) {
        return platformInstance
      }

      return null
    })

    const result = await getTemplateInstance(template)

    expect(getTemplate).toHaveBeenCalledWith(
      template,
      platformSecretTemplatesData
    )

    expect(result).toEqual({
      otherProp: 'other',
      config: { key1: 'value1' },
    })
  })

  it('returns instance from secretTemplatesData when not in platformSecretTemplatesData', async () => {
    const template = 'secretTemplate'
    const secretInstance = { config: { keyA: 'valueA' }, otherProp: 'otherA' }

    getTemplate.mockImplementation((_template, data) => {
      if (data === standardSecretTemplatesData && _template === template) {
        return secretInstance
      }

      return null
    })

    const result = await getTemplateInstance(template)

    expect(getTemplate).toHaveBeenCalledWith(
      template,
      platformSecretTemplatesData
    )

    expect(getTemplate).toHaveBeenCalledWith(
      template,
      standardSecretTemplatesData
    )

    expect(result).toEqual(secretInstance)
  })

  it('returns null when template is not found', async () => {
    const template = 'nonExistentTemplate'

    getTemplate.mockReturnValue(null)

    const result = await getTemplateInstance(template)

    expect(getTemplate).toHaveBeenCalledWith(
      template,
      platformSecretTemplatesData
    )

    expect(getTemplate).toHaveBeenCalledWith(
      template,
      standardSecretTemplatesData
    )

    expect(result).toBeNull()
  })
})

describe('getTemplateInstance - staging environment', () => {
  beforeEach(() => {
    jest.resetAllMocks()

    mockReset(prisma)

    env.isDevelopment = false
    env.isTest = false
    env.isStaging = true
    env.isProduction = false
  })

  it('returns merged config with staging config when in staging environment', async () => {
    const template = 'testTemplate'

    const platformInstance = {
      config: { key1: 'value1' },
      stagingConfig: { key2: 'staging-value' },
      otherProp: 'other',
    }

    getTemplate.mockImplementation((_template, data) => {
      if (data === platformSecretTemplatesData && _template === template) {
        return platformInstance
      }

      return null
    })

    merge.mockReturnValue({ key1: 'value1', key2: 'staging-value' })

    const result = await getTemplateInstance(template)

    expect(merge).toHaveBeenCalledWith(
      { key1: 'value1' },
      { key2: 'staging-value' }
    )
    expect(result).toEqual({
      otherProp: 'other',
      config: { key1: 'value1', key2: 'staging-value' },
    })
  })
})

describe('getTemplateInstance - production environment', () => {
  beforeEach(() => {
    jest.resetAllMocks()

    mockReset(prisma)

    env.isDevelopment = false
    env.isTest = false
    env.isStaging = false
    env.isProduction = true
  })

  it('returns merged config with production config when in production environment', async () => {
    const template = 'testTemplate'

    const platformInstance = {
      config: { key1: 'value1' },
      productionConfig: { key2: 'production-value' },
      otherProp: 'other',
    }

    getTemplate.mockImplementation((_template, data) => {
      if (data === platformSecretTemplatesData && _template === template) {
        return platformInstance
      }

      return null
    })

    merge.mockReturnValue({ key1: 'value1', key2: 'production-value' })

    const result = await getTemplateInstance(template)

    expect(merge).toHaveBeenCalledWith(
      { key1: 'value1' },
      { key2: 'production-value' }
    )
    expect(result).toEqual({
      otherProp: 'other',
      config: { key1: 'value1', key2: 'production-value' },
    })
  })
})

describe('resolveTemplateSecret', () => {
  beforeEach(() => {
    jest.resetAllMocks()

    mockReset(prisma)

    env.isDevelopment = true
    env.isTest = false
    env.isStaging = false
    env.isProduction = false
  })

  it('returns template instance merged with secret when secret is template type', async () => {
    const secret = {
      id: 'secret-123',
      type: 'template',
      config: {
        template: 'testTemplate',
        parameters: { param1: 'value1' },
      },
      otherSecretProp: 'secretValue',
    }

    const templateInstance = {
      name: 'Test Template',
      config: { key1: 'templateValue' },
      otherProp: 'templateProp',
    }

    getTemplate.mockImplementation((_template, data) => {
      if (
        data === platformSecretTemplatesData &&
        _template === 'testTemplate'
      ) {
        return templateInstance
      }

      return null
    })

    merge.mockReturnValue({ key1: 'templateValue' })
    pick.mockReturnValue({ template: 'testTemplate' })

    const result = await resolveTemplateSecret(secret)

    expect(pick).toHaveBeenCalledWith(secret.config, [
      'template',
      'clientId',
      'clientSecret',
      'scope',
      'user',
      'username',
      'pass',
      'password',
    ])
    expect(result).toEqual({
      id: 'secret-123',
      type: 'template',
      otherSecretProp: 'secretValue',
      name: 'Test Template',
      otherProp: 'templateProp',
      config: {
        template: 'testTemplate',
        key1: 'templateValue',
        param1: 'value1',
      },
    })
  })

  it('returns null when secret is not template type', async () => {
    const secret = {
      id: 'secret-123',
      type: 'basic',
      config: { apiKey: 'secret-key' },
    }

    const result = await resolveTemplateSecret(secret)

    expect(result).toBeNull()
    expect(getTemplate).not.toHaveBeenCalled()
  })

  it('returns null when secret config is null', async () => {
    const secret = {
      id: 'secret-123',
      type: 'template',
      config: null,
    }

    const result = await resolveTemplateSecret(secret)

    expect(result).toBeNull()
    expect(getTemplate).not.toHaveBeenCalled()
  })

  it('returns null when template is not specified in config', async () => {
    const secret = {
      id: 'secret-123',
      type: 'template',
      config: {
        parameters: { param1: 'value1' },
      },
    }

    const result = await resolveTemplateSecret(secret)

    expect(result).toBeNull()
    expect(getTemplate).not.toHaveBeenCalled()
  })

  it('returns null when template instance is not found', async () => {
    const secret = {
      id: 'secret-123',
      type: 'template',
      config: {
        template: 'nonExistentTemplate',
        parameters: { param1: 'value1' },
      },
    }

    getTemplate.mockReturnValue(null)

    const result = await resolveTemplateSecret(secret)

    expect(result).toBeNull()
    expect(getTemplate).toHaveBeenCalledWith(
      'nonExistentTemplate',
      platformSecretTemplatesData
    )
  })

  describe('user config override priority', () => {
    it('should preserve user clientId when template definition also has clientId', async () => {
      const secret = {
        id: 'user-secret-123',
        type: 'template',
        config: {
          template: 'testTemplate',
          clientId: 'user-registered-client-id',
        },
      }

      const templateInstance = {
        name: 'Test Template',
        config: {
          clientId: 'template-default-client-id',
          authorizationUrl: 'https://auth.example.com/authorize',
        },
      }

      getTemplate.mockImplementation((_template, data) => {
        if (
          data === platformSecretTemplatesData &&
          _template === 'testTemplate'
        ) {
          return templateInstance
        }

        return null
      })

      merge.mockReturnValue(templateInstance.config)
      // Use real pick behavior for this test
      pick.mockImplementation((obj, keys) => {
        const result = {}

        for (const key of keys) {
          if (obj && key in obj) {
            result[key] = obj[key]
          }
        }

        return result
      })

      const result = await resolveTemplateSecret(secret)

      // User's clientId should NOT be overwritten by template's clientId
      expect(result.config.clientId).toBe('user-registered-client-id')
      expect(result.config.authorizationUrl).toBe(
        'https://auth.example.com/authorize'
      )
    })

    it('should not allow template definition to override the template property', async () => {
      const secret = {
        id: 'user-secret-123',
        type: 'template',
        config: {
          template: 'user-selected-template',
        },
      }

      const templateInstance = {
        name: 'Test Template',
        config: {
          template: 'malicious-template-override',
          authorizationUrl: 'https://auth.example.com/authorize',
        },
      }

      getTemplate.mockImplementation((_template, data) => {
        if (
          data === platformSecretTemplatesData &&
          _template === 'user-selected-template'
        ) {
          return templateInstance
        }

        return null
      })

      merge.mockReturnValue(templateInstance.config)
      pick.mockImplementation((obj, keys) => {
        const result = {}

        for (const key of keys) {
          if (obj && key in obj) {
            result[key] = obj[key]
          }
        }

        return result
      })

      const result = await resolveTemplateSecret(secret)

      // Template definition should NOT be able to override the template property
      expect(result.config.template).toBe('user-selected-template')
    })

    it('should only allow specific config fields to be overridden by user', async () => {
      // Security: resolveTemplateSecret should use pick() like
      // revealSecretInstanceFromTemplateSecret to prevent arbitrary
      // user config fields from overriding template config
      const secret = {
        id: 'user-secret-123',
        type: 'template',
        config: {
          template: 'testTemplate',
          clientId: 'allowed-user-client-id',
          // Disallowed field that should NOT override template config
          arbitraryField: 'user-arbitrary-value',
          dangerousConfig: 'user-dangerous-value',
        },
      }

      const templateInstance = {
        name: 'Test Template',
        config: {
          clientId: 'template-client-id',
          arbitraryField: 'template-arbitrary-value',
          dangerousConfig: 'template-dangerous-value',
          authorizationUrl: 'https://auth.example.com/authorize',
        },
      }

      getTemplate.mockImplementation((_template, data) => {
        if (
          data === platformSecretTemplatesData &&
          _template === 'testTemplate'
        ) {
          return templateInstance
        }

        return null
      })

      merge.mockReturnValue(templateInstance.config)
      pick.mockImplementation((obj, keys) => {
        const result = {}

        for (const key of keys) {
          if (obj && key in obj) {
            result[key] = obj[key]
          }
        }

        return result
      })

      const result = await resolveTemplateSecret(secret)

      // Allowed field should be overridden by user
      expect(result.config.clientId).toBe('allowed-user-client-id')
      // Disallowed fields should NOT be overridden by user - template values preserved
      expect(result.config.arbitraryField).toBe('template-arbitrary-value')
      expect(result.config.dangerousConfig).toBe('template-dangerous-value')
    })
  })
})

describe('revealTemplateInstance', () => {
  beforeEach(() => {
    jest.resetAllMocks()

    mockReset(prisma)

    env.isDevelopment = true
    env.isTest = false
    env.isStaging = false
    env.isProduction = false
  })

  it('returns decrypted template instance for platform template', async () => {
    const template = 'platformTemplate'

    const templateInstance = {
      name: 'Test Template',
      config: { encryptedKey: 'encrypted-value' },
      otherProp: 'templateProp',
    }

    const decryptedConfig = { encryptedKey: 'decrypted-value' }

    isPlatformTemplate.mockReturnValue(true)
    getTemplate.mockImplementation((_template, data) => {
      if (data === platformSecretTemplatesData && _template === template) {
        return templateInstance
      }

      return null
    })
    merge.mockReturnValue(templateInstance.config)
    decryptRecord.mockResolvedValue(decryptedConfig)

    const result = await revealTemplateInstance(template)

    expect(isPlatformTemplate).toHaveBeenCalledWith(template)
    expect(decryptRecord).toHaveBeenCalledWith(templateInstance.config)
    expect(result).toEqual({
      name: 'Test Template',
      otherProp: 'templateProp',
      config: { encryptedKey: 'decrypted-value' },
    })
  })

  it('returns null for non-platform template', async () => {
    const template = 'regularTemplate'

    isPlatformTemplate.mockReturnValue(false)

    const result = await revealTemplateInstance(template)

    expect(isPlatformTemplate).toHaveBeenCalledWith(template)
    expect(getTemplate).not.toHaveBeenCalled()
    expect(decryptRecord).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('returns null when platform template instance is not found', async () => {
    const template = 'nonExistentPlatformTemplate'

    isPlatformTemplate.mockReturnValue(true)
    getTemplate.mockReturnValue(null)

    const result = await revealTemplateInstance(template)

    expect(isPlatformTemplate).toHaveBeenCalledWith(template)
    expect(getTemplate).toHaveBeenCalledWith(
      template,
      platformSecretTemplatesData
    )
    expect(decryptRecord).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })
})

describe('revealSecretInstanceFromTemplateSecret', () => {
  beforeEach(() => {
    jest.resetAllMocks()

    mockReset(prisma)

    env.isDevelopment = true
    env.isTest = false
    env.isStaging = false
    env.isProduction = false
  })

  it('returns decrypted template instance merged with secret when secret is template type', async () => {
    const secret = {
      id: 'secret-123',
      type: 'template',
      config: {
        template: 'platformTemplate',
        parameters: { param1: 'value1' },
        clientId: 'secret-client-id',
        clientSecret: 'secret-client-secret',
      },
      otherSecretProp: 'secretValue',
    }

    const templateInstance = {
      name: 'Test Template',
      config: { encryptedKey: 'encrypted-value' },
      otherProp: 'templateProp',
    }

    const decryptedConfig = { encryptedKey: 'decrypted-value' }

    isPlatformTemplate.mockReturnValue(true)
    getTemplate.mockImplementation((_template, data) => {
      if (
        data === platformSecretTemplatesData &&
        _template === 'platformTemplate'
      ) {
        return templateInstance
      }

      return null
    })
    merge.mockReturnValue(templateInstance.config)
    pick.mockReturnValue({
      clientId: 'secret-client-id',
      clientSecret: 'secret-client-secret',
    })
    decryptRecord.mockResolvedValue(decryptedConfig)

    const result = await revealSecretInstanceFromTemplateSecret(secret)

    expect(isPlatformTemplate).toHaveBeenCalledWith('platformTemplate')
    expect(decryptRecord).toHaveBeenCalledWith(templateInstance.config)
    expect(pick).toHaveBeenCalledWith(secret.config, [
      'template',
      'clientId',
      'clientSecret',
      'scope',
      'user',
      'username',
      'pass',
      'password',
    ])
    expect(result).toEqual({
      id: 'secret-123',
      type: 'template',
      otherSecretProp: 'secretValue',
      name: 'Test Template',
      otherProp: 'templateProp',
      config: {
        clientId: 'secret-client-id',
        clientSecret: 'secret-client-secret',
        encryptedKey: 'decrypted-value',
        param1: 'value1',
      },
    })
  })

  it('only allows specific config fields from secret to be merged', async () => {
    const secret = {
      id: 'secret-123',
      type: 'template',
      config: {
        template: 'platformTemplate',
        parameters: { param1: 'value1' },
        // allowed fields
        clientId: 'allowed-client-id',
        clientSecret: 'allowed-secret',
        scope: 'allowed-scope',
        user: 'allowed-user',
        username: 'allowed-username',
        pass: 'allowed-pass',
        password: 'allowed-password',
        // disallowed fields
        arbitraryField: 'should-not-appear',
        dangerousConfig: 'should-not-appear',
      },
      otherSecretProp: 'secretValue',
    }

    const templateInstance = {
      name: 'Test Template',
      config: { encryptedKey: 'encrypted-value' },
      otherProp: 'templateProp',
    }

    const decryptedConfig = { encryptedKey: 'decrypted-value' }

    isPlatformTemplate.mockReturnValue(true)
    getTemplate.mockImplementation((_template, data) => {
      if (
        data === platformSecretTemplatesData &&
        _template === 'platformTemplate'
      ) {
        return templateInstance
      }

      return null
    })
    merge.mockReturnValue(templateInstance.config)
    pick.mockReturnValue({
      clientId: 'allowed-client-id',
      clientSecret: 'allowed-secret',
      scope: 'allowed-scope',
      user: 'allowed-user',
      username: 'allowed-username',
      pass: 'allowed-pass',
      password: 'allowed-password',
    })
    decryptRecord.mockResolvedValue(decryptedConfig)

    const result = await revealSecretInstanceFromTemplateSecret(secret)

    expect(pick).toHaveBeenCalledWith(secret.config, [
      'template',
      'clientId',
      'clientSecret',
      'scope',
      'user',
      'username',
      'pass',
      'password',
    ])
    expect(result.config).toEqual({
      clientId: 'allowed-client-id',
      clientSecret: 'allowed-secret',
      scope: 'allowed-scope',
      user: 'allowed-user',
      username: 'allowed-username',
      pass: 'allowed-pass',
      password: 'allowed-password',
      encryptedKey: 'decrypted-value',
      param1: 'value1',
    })
    // @note ensure disallowed fields are not present
    expect(result.config.arbitraryField).toBeUndefined()
    expect(result.config.dangerousConfig).toBeUndefined()
  })

  it('does not include disallowed config fields from secret', async () => {
    const secret = {
      id: 'secret-123',
      type: 'template',
      config: {
        template: 'platformTemplate',
        parameters: { param1: 'value1' },
        // only disallowed fields
        notAllowedField: 'should-not-merge',
        anotherField: 'also-should-not-merge',
      },
    }

    const templateInstance = {
      name: 'Test Template',
      config: { encryptedKey: 'encrypted-value' },
    }

    const decryptedConfig = { encryptedKey: 'decrypted-value' }

    isPlatformTemplate.mockReturnValue(true)
    getTemplate.mockImplementation((_template, data) => {
      if (
        data === platformSecretTemplatesData &&
        _template === 'platformTemplate'
      ) {
        return templateInstance
      }

      return null
    })
    merge.mockReturnValue(templateInstance.config)
    pick.mockReturnValue({}) // @note pick returns empty object when no allowed fields are present
    decryptRecord.mockResolvedValue(decryptedConfig)

    const result = await revealSecretInstanceFromTemplateSecret(secret)

    expect(pick).toHaveBeenCalledWith(secret.config, [
      'template',
      'clientId',
      'clientSecret',
      'scope',
      'user',
      'username',
      'pass',
      'password',
    ])
    expect(result.config).toEqual({
      encryptedKey: 'decrypted-value',
      param1: 'value1',
    })
    expect(result.config.notAllowedField).toBeUndefined()
    expect(result.config.anotherField).toBeUndefined()
  })

  it('template instance properties override secret properties', async () => {
    const secret = {
      id: 'secret-123',
      type: 'template',
      name: 'Secret Name',
      description: 'Secret Description',
      config: {
        template: 'platformTemplate',
        parameters: { param1: 'value1' },
      },
    }

    const templateInstance = {
      name: 'Template Name',
      description: 'Template Description',
      config: { encryptedKey: 'encrypted-value' },
    }

    const decryptedConfig = { encryptedKey: 'decrypted-value' }

    isPlatformTemplate.mockReturnValue(true)
    getTemplate.mockImplementation((_template, data) => {
      if (
        data === platformSecretTemplatesData &&
        _template === 'platformTemplate'
      ) {
        return templateInstance
      }

      return null
    })
    merge.mockReturnValue(templateInstance.config)
    pick.mockReturnValue({})
    decryptRecord.mockResolvedValue(decryptedConfig)

    const result = await revealSecretInstanceFromTemplateSecret(secret)

    // @note template instance properties should override secret properties
    expect(result.name).toBe('Template Name')
    expect(result.description).toBe('Template Description')
    expect(result.id).toBe('secret-123')
    expect(result.type).toBe('template')
  })

  it('returns null when secret is not template type', async () => {
    const secret = {
      id: 'secret-123',
      type: 'basic',
      config: { apiKey: 'secret-key' },
    }

    const result = await revealSecretInstanceFromTemplateSecret(secret)

    expect(result).toBeNull()
    expect(isPlatformTemplate).not.toHaveBeenCalled()
    expect(getTemplate).not.toHaveBeenCalled()
    expect(decryptRecord).not.toHaveBeenCalled()
  })

  it('returns null when template is not specified in secret config', async () => {
    const secret = {
      id: 'secret-123',
      type: 'template',
      config: {
        parameters: { param1: 'value1' },
      },
    }

    const result = await revealSecretInstanceFromTemplateSecret(secret)

    expect(result).toBeNull()
    expect(isPlatformTemplate).not.toHaveBeenCalled()
    expect(getTemplate).not.toHaveBeenCalled()
    expect(decryptRecord).not.toHaveBeenCalled()
  })

  it('returns null when revealed template instance is not found', async () => {
    const secret = {
      id: 'secret-123',
      type: 'template',
      config: {
        template: 'nonPlatformTemplate',
        parameters: { param1: 'value1' },
      },
    }

    isPlatformTemplate.mockReturnValue(false)

    const result = await revealSecretInstanceFromTemplateSecret(secret)

    expect(result).toBeNull()
    expect(isPlatformTemplate).toHaveBeenCalledWith('nonPlatformTemplate')
    expect(getTemplate).not.toHaveBeenCalled()
    expect(decryptRecord).not.toHaveBeenCalled()
  })

  describe('user config override priority', () => {
    it('should preserve user clientId when template definition also has clientId', async () => {
      // Bug scenario: After dynamic client registration (RFC 7591), the user's
      // template secret has a user-specific clientId. The template definition
      // may have a different clientId (or none). The user's clientId should
      // take precedence in the merged config.
      const secret = {
        id: 'user-secret-123',
        type: 'template',
        config: {
          template: 'platformTemplate',
          clientId: 'user-registered-client-id', // User's clientId from registration
        },
      }

      const templateInstance = {
        name: 'MCP Server Template',
        config: {
          clientId: 'template-default-client-id', // Template has a default clientId
          authorizationUrl: 'https://auth.example.com/authorize',
          tokenUrl: 'https://auth.example.com/token',
        },
      }

      isPlatformTemplate.mockReturnValue(true)
      getTemplate.mockImplementation((_template, data) => {
        if (
          data === platformSecretTemplatesData &&
          _template === 'platformTemplate'
        ) {
          return templateInstance
        }

        return null
      })
      merge.mockReturnValue(templateInstance.config)
      // Use real pick behavior for this test
      pick.mockImplementation((obj, keys) => {
        const result = {}

        for (const key of keys) {
          if (obj && key in obj) {
            result[key] = obj[key]
          }
        }

        return result
      })
      decryptRecord.mockResolvedValue(templateInstance.config)

      const result = await revealSecretInstanceFromTemplateSecret(secret)

      // User's clientId should NOT be overwritten by template's clientId
      expect(result.config.clientId).toBe('user-registered-client-id')
      // Template's other config values should be inherited
      expect(result.config.authorizationUrl).toBe(
        'https://auth.example.com/authorize'
      )
      expect(result.config.tokenUrl).toBe('https://auth.example.com/token')
    })

    it('should use template clientId when user has no clientId', async () => {
      const secret = {
        id: 'user-secret-123',
        type: 'template',
        config: {
          template: 'platformTemplate',
          // No clientId - user hasn't done dynamic registration
        },
      }

      const templateInstance = {
        name: 'OAuth Template',
        config: {
          clientId: 'template-client-id',
          clientSecret: 'template-client-secret',
          authorizationUrl: 'https://auth.example.com/authorize',
        },
      }

      isPlatformTemplate.mockReturnValue(true)
      getTemplate.mockImplementation((_template, data) => {
        if (
          data === platformSecretTemplatesData &&
          _template === 'platformTemplate'
        ) {
          return templateInstance
        }

        return null
      })
      merge.mockReturnValue(templateInstance.config)
      pick.mockImplementation((obj, keys) => {
        const result = {}

        for (const key of keys) {
          if (obj && key in obj) {
            result[key] = obj[key]
          }
        }

        return result
      })
      decryptRecord.mockResolvedValue(templateInstance.config)

      const result = await revealSecretInstanceFromTemplateSecret(secret)

      // Template's clientId should be used when user has none
      expect(result.config.clientId).toBe('template-client-id')
      expect(result.config.clientSecret).toBe('template-client-secret')
    })

    it('should not allow template definition to override the template property', async () => {
      // Security: The template definition config should NOT be able to inject
      // or override the `template` property, which identifies which template
      // the user's secret is using.
      const secret = {
        id: 'user-secret-123',
        type: 'template',
        config: {
          template: 'user-selected-template',
          clientId: 'user-client-id',
        },
      }

      const templateInstance = {
        name: 'OAuth Template',
        config: {
          template: 'malicious-template-override', // Should NOT appear in result
          clientId: 'template-client-id',
          authorizationUrl: 'https://auth.example.com/authorize',
        },
      }

      isPlatformTemplate.mockReturnValue(true)
      getTemplate.mockImplementation((_template, data) => {
        if (
          data === platformSecretTemplatesData &&
          _template === 'user-selected-template'
        ) {
          return templateInstance
        }

        return null
      })
      merge.mockReturnValue(templateInstance.config)
      pick.mockImplementation((obj, keys) => {
        const result = {}

        for (const key of keys) {
          if (obj && key in obj) {
            result[key] = obj[key]
          }
        }

        return result
      })
      decryptRecord.mockResolvedValue(templateInstance.config)

      const result = await revealSecretInstanceFromTemplateSecret(secret)

      // Template definition should NOT be able to override the template property
      expect(result.config.template).toBe('user-selected-template')
      // User's clientId should still take precedence
      expect(result.config.clientId).toBe('user-client-id')
    })
  })
})

describe('getTemplateInstance - edge cases', () => {
  beforeEach(() => {
    jest.resetAllMocks()

    mockReset(prisma)

    env.isDevelopment = true
    env.isTest = false
    env.isStaging = false
    env.isProduction = false
  })

  it('handles template with missing config property', async () => {
    const template = 'templateWithoutConfig'

    const platformInstance = {
      // Missing config property
      developmentConfig: { key2: 'value2' },
      otherProp: 'other',
    }

    getTemplate.mockImplementation((_template, data) => {
      if (data === platformSecretTemplatesData && _template === template) {
        return platformInstance
      }

      return null
    })

    merge.mockReturnValue({ key2: 'value2' })

    const result = await getTemplateInstance(template)

    expect(merge).toHaveBeenCalledWith(undefined, { key2: 'value2' })
    expect(result).toEqual({
      otherProp: 'other',
      config: { key2: 'value2' },
    })
  })

  it('handles template with null config property', async () => {
    const template = 'templateWithNullConfig'

    const platformInstance = {
      config: null,
      developmentConfig: { key2: 'value2' },
      otherProp: 'other',
    }

    getTemplate.mockImplementation((_template, data) => {
      if (data === platformSecretTemplatesData && _template === template) {
        return platformInstance
      }

      return null
    })

    merge.mockReturnValue({ key2: 'value2' })

    const result = await getTemplateInstance(template)

    expect(merge).toHaveBeenCalledWith(null, { key2: 'value2' })
    expect(result).toEqual({
      otherProp: 'other',
      config: { key2: 'value2' },
    })
  })

  it('handles template with missing environment-specific configs', async () => {
    const template = 'templateMissingEnvConfigs'

    const platformInstance = {
      config: { key1: 'value1' },
      // Missing developmentConfig
      otherProp: 'other',
    }

    getTemplate.mockImplementation((_template, data) => {
      if (data === platformSecretTemplatesData && _template === template) {
        return platformInstance
      }

      return null
    })

    merge.mockReturnValue({ key1: 'value1' })

    const result = await getTemplateInstance(template)

    expect(merge).toHaveBeenCalledWith({ key1: 'value1' }, {})
    expect(result).toEqual({
      otherProp: 'other',
      config: { key1: 'value1' },
    })
  })
})

describe('resolveTemplateSecret - edge cases', () => {
  beforeEach(() => {
    jest.resetAllMocks()

    mockReset(prisma)

    env.isDevelopment = true
    env.isTest = false
    env.isStaging = false
    env.isProduction = false
  })

  it('handles secret with empty parameters object', async () => {
    const secret = {
      id: 'secret-123',
      type: 'template',
      config: {
        template: 'testTemplate',
        parameters: {},
      },
    }

    const templateInstance = {
      name: 'Test Template',
      config: { key1: 'templateValue' },
    }

    getTemplate.mockImplementation((_template, data) => {
      if (
        data === platformSecretTemplatesData &&
        _template === 'testTemplate'
      ) {
        return templateInstance
      }

      return null
    })

    merge.mockReturnValue({ key1: 'templateValue' })
    pick.mockReturnValue({ template: 'testTemplate' })

    const result = await resolveTemplateSecret(secret)

    expect(result.config).toEqual({
      template: 'testTemplate',
      key1: 'templateValue',
    })
  })

  it('handles secret with missing parameters property', async () => {
    const secret = {
      id: 'secret-123',
      type: 'template',
      config: {
        template: 'testTemplate',
        // Missing parameters property
      },
    }

    const templateInstance = {
      name: 'Test Template',
      config: { key1: 'templateValue' },
    }

    getTemplate.mockImplementation((_template, data) => {
      if (
        data === platformSecretTemplatesData &&
        _template === 'testTemplate'
      ) {
        return templateInstance
      }

      return null
    })

    merge.mockReturnValue({ key1: 'templateValue' })
    pick.mockReturnValue({ template: 'testTemplate' })

    const result = await resolveTemplateSecret(secret)

    expect(result.config).toEqual({
      template: 'testTemplate',
      key1: 'templateValue',
    })
  })

  it('handles secret with complex parameter values', async () => {
    const secret = {
      id: 'secret-123',
      type: 'template',
      config: {
        template: 'testTemplate',
        parameters: {
          stringParam: 'string-value',
          numberParam: 42,
          booleanParam: true,
          objectParam: { nested: 'value' },
          arrayParam: [1, 2, 3],
        },
      },
    }

    const templateInstance = {
      config: { key1: 'templateValue' },
    }

    getTemplate.mockImplementation((_template, data) => {
      if (
        data === platformSecretTemplatesData &&
        _template === 'testTemplate'
      ) {
        return templateInstance
      }

      return null
    })

    merge.mockReturnValue({ key1: 'templateValue' })
    pick.mockReturnValue({ template: 'testTemplate' })

    const result = await resolveTemplateSecret(secret)

    expect(result.config).toEqual({
      template: 'testTemplate',
      key1: 'templateValue',
      stringParam: 'string-value',
      numberParam: 42,
      booleanParam: true,
      objectParam: { nested: 'value' },
      arrayParam: [1, 2, 3],
    })
  })
})

describe('revealTemplateInstance - edge cases', () => {
  beforeEach(() => {
    jest.resetAllMocks()

    mockReset(prisma)

    env.isDevelopment = true
    env.isTest = false
    env.isStaging = false
    env.isProduction = false
  })

  it('handles decryption error gracefully', async () => {
    const template = 'platformTemplate'

    const templateInstance = {
      name: 'Test Template',
      config: { encryptedKey: 'encrypted-value' },
    }

    isPlatformTemplate.mockReturnValue(true)
    getTemplate.mockImplementation((_template, data) => {
      if (data === platformSecretTemplatesData && _template === template) {
        return templateInstance
      }

      return null
    })
    merge.mockReturnValue(templateInstance.config)
    decryptRecord.mockRejectedValue(new Error('Decryption failed'))

    await expect(revealTemplateInstance(template)).rejects.toThrow(
      'Decryption failed'
    )
  })

  it('handles template instance with null config for decryption', async () => {
    const template = 'platformTemplate'

    const templateInstance = {
      name: 'Test Template',
      config: null,
    }

    isPlatformTemplate.mockReturnValue(true)
    getTemplate.mockImplementation((_template, data) => {
      if (data === platformSecretTemplatesData && _template === template) {
        return templateInstance
      }

      return null
    })
    merge.mockReturnValue(null)
    decryptRecord.mockResolvedValue({})

    const result = await revealTemplateInstance(template)

    expect(decryptRecord).toHaveBeenCalledWith(null)
    expect(result).toEqual({
      name: 'Test Template',
      config: {},
    })
  })
})
