import { PortalConfig, SecretConfig } from './types'

import { ZodError } from 'zod'

describe('PortalConfig', () => {
  describe('valid configurations', () => {
    it('should accept empty object', () => {
      const validConfig = {}

      const result = PortalConfig.parse(validConfig)

      expect(result).toEqual({})
    })

    it('should accept valid apps configuration', () => {
      const validConfig = {
        apps: {
          app1: {},
          app2: {},
        },
      }

      const result = PortalConfig.parse(validConfig)

      expect(result).toEqual(validConfig)
    })

    it('should accept valid apps with random configuration properties', () => {
      const validConfig = {
        apps: {
          app1: { customProp: 'value', anotherProp: 123 },
          app2: { enabled: true, version: '1.0.0' },
        },
      }

      const result = PortalConfig.parse(validConfig)

      expect(result).toEqual(validConfig)
    })

    it('should accept valid users configuration', () => {
      const validConfig = {
        users: {
          user1: {},
          user2: {},
        },
      }

      const result = PortalConfig.parse(validConfig)

      expect(result).toEqual(validConfig)
    })

    it('should accept valid auth configuration', () => {
      const validConfig = {
        auth: {},
      }

      const result = PortalConfig.parse(validConfig)

      expect(result).toEqual(validConfig)
    })

    it('should accept valid signin configuration', () => {
      const validConfig = {
        signin: {
          title: 'Welcome',
          headline: 'Sign in to your account',
        },
      }

      const result = PortalConfig.parse(validConfig)

      expect(result).toEqual(validConfig)
    })

    it('should accept valid layout configuration', () => {
      const validConfig = {
        layout: {
          madeWith: true,
        },
      }

      const result = PortalConfig.parse(validConfig)

      expect(result).toEqual(validConfig)
    })

    it('should accept complete valid configuration', () => {
      const validConfig = {
        apps: { app1: {} },
        users: { user1: {} },
        auth: {},
        signin: {
          title: 'Portal',
          headline: 'Welcome back',
        },
        layout: {
          madeWith: false,
        },
      }

      const result = PortalConfig.parse(validConfig)

      expect(result).toEqual(validConfig)
    })
  })

  describe('non-standard properties handling', () => {
    // @note for now we allow this to happen
    it.skip('should strip non-standard properties at root level (strict behavior)', () => {
      const configWithExtra = {
        apps: { app1: {} },
        extraProperty: 'this will be stripped',
      }

      const result = PortalConfig.parse(configWithExtra)

      expect(result).toEqual({
        apps: { app1: {} },
      })
      expect(result.extraProperty).toBeUndefined()
    })

    // @note for now we allow this to happen
    it.skip('should strip non-standard properties in nested objects', () => {
      const configWithExtra = {
        signin: {
          title: 'Welcome',
          headline: 'Sign in',
          customProperty: 'will be stripped',
        },
        layout: {
          madeWith: true,
          customLayoutProp: 'will be stripped',
        },
      }

      const result = PortalConfig.parse(configWithExtra)

      expect(result).toEqual({
        signin: {
          title: 'Welcome',
          headline: 'Sign in',
        },
        layout: {
          madeWith: true,
        },
      })
      expect(result.signin.customProperty).toBeUndefined()
      expect(result.layout.customLayoutProp).toBeUndefined()
    })

    // @note for now we allow this to happen
    it.skip('should strip all extra properties while preserving valid ones', () => {
      const configWithMultipleExtras = {
        apps: { app1: {} },
        users: { user1: {} },
        customProp1: 'stripped',
        customProp2: 42,
        customProp3: { nested: 'object' },
        signin: {
          title: 'Valid title',
          invalidProp: 'stripped',
        },
      }

      const result = PortalConfig.parse(configWithMultipleExtras)

      expect(result).toEqual({
        apps: { app1: {} },
        users: { user1: {} },
        signin: {
          title: 'Valid title',
        },
      })

      expect(result.customProp1).toBeUndefined()
      expect(result.customProp2).toBeUndefined()
      expect(result.customProp3).toBeUndefined()
      expect(result.signin.invalidProp).toBeUndefined()
    })

    // @note for now we allow this to happen
    it.skip('should demonstrate that PortalConfig does not accept non-standard properties', () => {
      const input = {
        invalidProperty: 'will be removed',
      }

      const result = PortalConfig.parse(input)

      expect(Object.keys(result)).toEqual([])
      expect(result.invalidProperty).toBeUndefined()
    })
  })

  describe('type validation', () => {
    it('should reject invalid types for signin properties', () => {
      const invalidConfig = {
        signin: {
          title: 123, // should be string
          headline: true, // should be string
        },
      }

      expect(() => PortalConfig.parse(invalidConfig)).toThrow(ZodError)
    })

    it('should reject invalid type for layout.footer.madeWith', () => {
      const invalidConfig = {
        layout: {
          footer: {
            madeWith: 'yes', // should be boolean
          },
        },
      }

      expect(() => PortalConfig.parse(invalidConfig)).toThrow(ZodError)
    })

    it('should reject invalid type for apps', () => {
      const invalidConfig = {
        apps: 'not an object', // should be record/object
      }

      expect(() => PortalConfig.parse(invalidConfig)).toThrow(ZodError)
    })

    it('should reject invalid type for users', () => {
      const invalidConfig = {
        users: [], // should be record/object
      }

      expect(() => PortalConfig.parse(invalidConfig)).toThrow(ZodError)
    })
  })
})

describe('SecretConfig', () => {
  describe('valid configurations', () => {
    it('should accept empty object', () => {
      const validConfig = {}

      const result = SecretConfig.parse(validConfig)

      expect(result).toEqual({})
    })
  })

  describe('non-standard properties handling', () => {
    // @note for now we allow this to happen
    it.skip('should strip any additional properties (strict empty object schema)', () => {
      const configWithExtra = {
        someProperty: 'will be stripped',
      }

      const result = SecretConfig.parse(configWithExtra)

      expect(result).toEqual({})
      expect(result.someProperty).toBeUndefined()
    })

    // @note for now we allow this to happen
    it.skip('should strip all additional properties regardless of type', () => {
      const configWithMultipleProps = {
        prop1: 'string value',
        prop2: 123,
        prop3: true,
        prop4: { nested: 'object' },
      }

      const result = SecretConfig.parse(configWithMultipleProps)

      expect(result).toEqual({})
      expect(Object.keys(result)).toHaveLength(0)
      expect(result.prop1).toBeUndefined()
      expect(result.prop2).toBeUndefined()
      expect(result.prop3).toBeUndefined()
      expect(result.prop4).toBeUndefined()
    })

    // @note for now we allow this to happen
    it.skip('should demonstrate that SecretConfig does not accept any non-standard properties', () => {
      const input = {
        secret: 'password',
        apiKey: 'key123',
        token: 'abc123',
      }

      const result = SecretConfig.parse(input)

      expect(result).toEqual({})
      expect(Object.keys(result)).toHaveLength(0)
    })
  })
})
