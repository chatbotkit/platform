/* eslint-disable @typescript-eslint/no-require-imports */
import { authOptions } from '@/lib/auth.options'

jest.mock('@/lib/auth.adapter', () => ({
  __esModule: true,
  default: { name: 'mock-adapter' },
}))

jest.mock('@/lib/auth.callbacks', () => ({
  __esModule: true,
  default: { jwt: jest.fn(), session: jest.fn() },
}))

describe('auth.options', () => {
  describe('configuration structure', () => {
    it('should export authOptions object', () => {
      expect(authOptions).toBeDefined()
      expect(typeof authOptions).toBe('object')
    })

    it('should have adapter property', () => {
      expect(authOptions.adapter).toBeDefined()
      expect(authOptions.adapter).toEqual({ name: 'mock-adapter' })
    })

    it('should have providers array', () => {
      expect(authOptions.providers).toBeDefined()
      expect(Array.isArray(authOptions.providers)).toBe(true)
    })

    it('should have session configuration', () => {
      expect(authOptions.session).toBeDefined()
      expect(typeof authOptions.session).toBe('object')
    })

    it('should have pages configuration', () => {
      expect(authOptions.pages).toBeDefined()
      expect(typeof authOptions.pages).toBe('object')
    })

    it('should have callbacks property', () => {
      expect(authOptions.callbacks).toBeDefined()
      expect(authOptions.callbacks).toEqual({
        jwt: expect.any(Function),
        session: expect.any(Function),
      })
    })

    it('should have debug property', () => {
      expect(authOptions).toHaveProperty('debug')
      expect(typeof authOptions.debug).toBe('boolean')
    })
  })

  describe('session configuration', () => {
    it('should use database strategy', () => {
      expect(authOptions.session.strategy).toBe('database')
    })

    it('should have maxAge configuration', () => {
      expect(authOptions.session.maxAge).toBeDefined()
      expect(typeof authOptions.session.maxAge).toBe('number')
    })

    it('should have updateAge configuration', () => {
      expect(authOptions.session.updateAge).toBeDefined()
      expect(typeof authOptions.session.updateAge).toBe('number')
    })

    it('should have reasonable session duration', () => {
      // maxAge should be approximately one month in seconds
      const oneMonthInSeconds = 30 * 24 * 60 * 60 // 2592000 seconds

      expect(authOptions.session.maxAge).toBeGreaterThanOrEqual(
        oneMonthInSeconds * 0.9
      )
      expect(authOptions.session.maxAge).toBeLessThanOrEqual(
        oneMonthInSeconds * 1.1
      )
    })

    it('should have reasonable update age', () => {
      // updateAge should be high enough to avoid constant writes and low
      // enough to keep active database sessions fresh.
      const fiveMinutesInSeconds = 5 * 60

      expect(authOptions.session.updateAge).toBeGreaterThan(1)
      expect(authOptions.session.updateAge).toBeLessThanOrEqual(
        fiveMinutesInSeconds
      )
    })
  })

  describe('page configuration', () => {
    it('should have signIn page configured', () => {
      expect(authOptions.pages.signIn).toBe('/signin')
    })

    it('should have error page configured', () => {
      expect(authOptions.pages.error).toBe('/signin')
    })

    it('should have verifyRequest page configured', () => {
      expect(authOptions.pages.verifyRequest).toBe('/signin/verify')
    })

    it('should use signin page for errors', () => {
      // Error page should redirect to signin
      expect(authOptions.pages.error).toBe(authOptions.pages.signIn)
    })
  })

  describe('providers configuration', () => {
    it('should have empty providers array', () => {
      expect(authOptions.providers).toEqual([])
    })

    it('should be an array', () => {
      expect(Array.isArray(authOptions.providers)).toBe(true)
    })
  })

  describe('debug configuration', () => {
    it('should be boolean', () => {
      expect(typeof authOptions.debug).toBe('boolean')
    })

    it('should be false when DEBUG env var is not set', () => {
      const originalDebug = process.env.DEBUG

      delete process.env.DEBUG

      // Re-import to get fresh value
      jest.resetModules()

      const { authOptions: freshOptions } = require('./auth.options')

      expect(freshOptions.debug).toBe(false)

      // Restore
      if (originalDebug !== undefined) {
        process.env.DEBUG = originalDebug
      }
    })

    it('should be true when DEBUG env var is set', () => {
      const originalDebug = process.env.DEBUG

      process.env.DEBUG = 'true'

      // Re-import to get fresh value
      jest.resetModules()

      const { authOptions: freshOptions } = require('./auth.options')

      expect(freshOptions.debug).toBe(true)

      // Restore
      if (originalDebug !== undefined) {
        process.env.DEBUG = originalDebug
      } else {
        delete process.env.DEBUG
      }
    })
  })

  describe('default export', () => {
    it('should export authOptions as default', () => {
      const defaultExport = require('./auth.options').default

      // Check structure rather than identity since debug flag may vary
      expect(defaultExport).toHaveProperty('adapter')
      expect(defaultExport).toHaveProperty('providers')
      expect(defaultExport).toHaveProperty('session')
      expect(defaultExport).toHaveProperty('pages')
      expect(defaultExport).toHaveProperty('callbacks')
      expect(defaultExport).toHaveProperty('debug')
    })
  })

  describe('configuration completeness', () => {
    it('should have all required NextAuth options', () => {
      // Check for required NextAuth configuration keys
      const requiredKeys = ['adapter', 'providers', 'session', 'pages']

      requiredKeys.forEach((key) => {
        expect(authOptions).toHaveProperty(key)
      })
    })

    it('should have consistent page routing', () => {
      // All auth pages should be under /signin path
      expect(authOptions.pages.signIn).toMatch(/^\/signin/)
      expect(authOptions.pages.error).toMatch(/^\/signin/)
      expect(authOptions.pages.verifyRequest).toMatch(/^\/signin/)
    })
  })

  describe('session strategy reasoning', () => {
    it('should not use JWT strategy', () => {
      // Per the detailed comments in the source, JWT should not be used
      expect(authOptions.session.strategy).not.toBe('jwt')
    })

    it('should use database for security reasons', () => {
      // Database strategy allows proper token revocation
      expect(authOptions.session.strategy).toBe('database')
    })
  })

  describe('edge cases', () => {
    it('should handle missing DEBUG env var gracefully', () => {
      const originalDebug = process.env.DEBUG

      delete process.env.DEBUG

      jest.resetModules()

      const { authOptions: options } = require('./auth.options')

      expect(options.debug).toBe(false)
      expect(() => options.debug).not.toThrow()

      // Restore
      if (originalDebug !== undefined) {
        process.env.DEBUG = originalDebug
      }
    })

    it('should have immutable configuration structure', () => {
      // Configuration should be a plain object
      expect(Object.getPrototypeOf(authOptions)).toBe(Object.prototype)
    })

    it('should maintain session configuration consistency', () => {
      // maxAge should be greater than updateAge
      expect(authOptions.session.maxAge).toBeGreaterThan(
        authOptions.session.updateAge
      )
    })
  })

  describe('adapter integration', () => {
    it('should have valid adapter configured', () => {
      expect(authOptions.adapter).toBeTruthy()
      expect(typeof authOptions.adapter).toBe('object')
    })
  })

  describe('callbacks integration', () => {
    it('should have valid callbacks configured', () => {
      expect(authOptions.callbacks).toBeTruthy()
      expect(typeof authOptions.callbacks).toBe('object')
    })
  })
})
