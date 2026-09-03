import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { ensureContact } from '@/lib/app.contact'
import { getContextAppConfig, getContextAppSession } from '@/lib/app.context'
import { APP_AUDIENCE } from '@/lib/audience.consts'
import {
  getContextFrontendHost,
  getContextRequestHost,
} from '@/lib/context.store'
import { captureException } from '@/lib/error'
import schema from '@/lib/zod.schema'

import {
  ANY_SCHEMA,
  appActionHandler,
  appContactActionHandler,
} from './app.action'

jest.mock('next/headers', () => ({
  headers: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn((path) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

jest.mock('@/lib/app.contact', () => ({
  ensureContact: jest.fn(),
}))

jest.mock('@/lib/app.context', () => ({
  getContextAppConfig: jest.fn(),
  getContextAppSession: jest.fn(),
  runInAppContext: jest.fn((fn) => fn),
}))

jest.mock('@/lib/context.store', () => ({
  getContextFrontendHost: jest.fn(),
  getContextRequestHost: jest.fn(),
  runInContext: jest.fn((fn) => fn),
}))

jest.mock('@/lib/context.setup', () => ({
  setupHeadersContext: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
}))

describe('app.action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getContextFrontendHost.mockReturnValue('example.com')
    getContextRequestHost.mockReturnValue(null)

    const mockHeaders = new Map()

    mockHeaders.get = jest.fn((key) => {
      const lowerKey = key.toLowerCase()

      if (lowerKey === 'x-chatbotkit-internal-frontend-host') {
        return 'example.com'
      }

      if (lowerKey === 'x-timezone') {
        return 'America/New_York'
      }

      if (lowerKey === 'x-forwarded-host') {
        return null
      }

      if (lowerKey === 'host') {
        return null
      }

      return null
    })

    headers.mockResolvedValue(mockHeaders)
  })

  describe('ANY_SCHEMA', () => {
    it('should accept any record', () => {
      const result = ANY_SCHEMA.parse({ key1: 'value1', key2: 123 })

      expect(result).toEqual({ key1: 'value1', key2: 123 })
    })

    it('should accept empty object', () => {
      const result = ANY_SCHEMA.parse({})

      expect(result).toEqual({})
    })
  })

  describe('appActionHandler', () => {
    describe('basic functionality', () => {
      it('should execute handler function with valid config and session', async () => {
        const mockConfig = { feature: 'enabled' }
        const mockSession = {
          payload: { aud: 'user' },
          options: { portalId: 'portal1' },
        }
        const mockFn = jest.fn().mockResolvedValue({ success: true })

        getContextAppConfig.mockResolvedValue(mockConfig)
        getContextAppSession.mockResolvedValue(mockSession)

        const configSchema = schema.object({ feature: schema.string() })
        const inputSchema = schema.object({ name: schema.string() })

        const handler = appActionHandler(
          'test-app',
          configSchema,
          inputSchema,
          mockFn
        )

        const result = await handler({ name: 'test' })

        expect(result).toEqual({ success: true })
        expect(mockFn).toHaveBeenCalledWith(
          mockConfig,
          mockSession,
          { name: 'test' },
          expect.objectContaining({
            host: 'example.com',
            portalId: 'portal1',
          })
        )
      })

      it('should redirect to signin when session is missing', async () => {
        getContextAppConfig.mockResolvedValue({})
        getContextAppSession.mockResolvedValue(null)

        const handler = appActionHandler(
          'test-app',
          ANY_SCHEMA,
          ANY_SCHEMA,
          jest.fn()
        )

        await expect(handler({})).rejects.toThrow('REDIRECT:/signin')
        expect(redirect).toHaveBeenCalledWith('/signin')
      })

      it('should redirect to signin when config is missing for APP_AUDIENCE', async () => {
        getContextAppConfig.mockResolvedValue(null)
        getContextAppSession.mockResolvedValue({
          payload: { aud: APP_AUDIENCE },
        })

        const handler = appActionHandler(
          'test-app',
          ANY_SCHEMA,
          ANY_SCHEMA,
          jest.fn()
        )

        await expect(handler({})).rejects.toThrow('REDIRECT:/signin')
        expect(redirect).toHaveBeenCalledWith('/signin')
      })
    })

    describe('error handling', () => {
      it('should handle errors and return error response', async () => {
        const mockSession = { payload: { aud: 'user' }, options: {} }
        const mockError = new Error('Test error')

        mockError.code = 'TEST_ERROR'

        getContextAppConfig.mockResolvedValue({})
        getContextAppSession.mockResolvedValue(mockSession)

        const mockFn = jest.fn().mockRejectedValue(mockError)

        const handler = appActionHandler(
          'test-app',
          ANY_SCHEMA,
          ANY_SCHEMA,
          mockFn
        )

        const result = await handler({})

        expect(result).toEqual({
          error: {
            code: 'TEST_ERROR',
            message: 'Test error',
          },
        })
        expect(captureException).toHaveBeenCalledWith(mockError)
      })

      it('should handle validation errors in input schema', async () => {
        const mockSession = { payload: { aud: 'user' }, options: {} }

        getContextAppConfig.mockResolvedValue({})
        getContextAppSession.mockResolvedValue(mockSession)

        const inputSchema = schema.object({ name: schema.string() })

        const handler = appActionHandler(
          'test-app',
          ANY_SCHEMA,
          inputSchema,
          jest.fn()
        )

        const result = await handler({ name: 123 })

        expect(result).toHaveProperty('error')
        expect(captureException).toHaveBeenCalled()
      })

      it('should handle validation errors in config schema', async () => {
        const mockSession = { payload: { aud: 'user' }, options: {} }

        getContextAppConfig.mockResolvedValue({ feature: 123 })
        getContextAppSession.mockResolvedValue(mockSession)

        const configSchema = schema.object({ feature: schema.string() })

        const handler = appActionHandler(
          'test-app',
          configSchema,
          ANY_SCHEMA,
          jest.fn()
        )

        const result = await handler({})

        expect(result).toHaveProperty('error')
        expect(captureException).toHaveBeenCalled()
      })
    })

    describe('context extraction', () => {
      it('should prefer the verified frontend host from context', async () => {
        const mockSession = { payload: { aud: 'user' }, options: {} }
        const mockFn = jest.fn().mockResolvedValue({ success: true })

        getContextAppConfig.mockResolvedValue({})
        getContextAppSession.mockResolvedValue(mockSession)

        getContextFrontendHost.mockReturnValue('custom.example.com')
        headers.mockResolvedValue(
          new Headers({
            'x-forwarded-host': 'forwarded.example.com',
            host: 'host.example.com',
          })
        )

        const handler = appActionHandler(
          'test-app',
          ANY_SCHEMA,
          ANY_SCHEMA,
          mockFn
        )

        await handler({})

        expect(mockFn).toHaveBeenCalledWith(
          {},
          mockSession,
          {},
          expect.objectContaining({
            host: 'custom.example.com',
          })
        )
      })

      it('should extract portalId from session options', async () => {
        const mockSession = {
          payload: { aud: 'user' },
          options: { portalId: 'portal123' },
        }
        const mockFn = jest.fn().mockResolvedValue({ success: true })

        getContextAppConfig.mockResolvedValue({})
        getContextAppSession.mockResolvedValue(mockSession)

        const handler = appActionHandler(
          'test-app',
          ANY_SCHEMA,
          ANY_SCHEMA,
          mockFn
        )

        await handler({})

        expect(mockFn).toHaveBeenCalledWith(
          {},
          mockSession,
          {},
          expect.objectContaining({
            portalId: 'portal123',
          })
        )
      })
    })
  })

  describe('appContactActionHandler', () => {
    describe('basic functionality', () => {
      it('should ensure contact and call handler with contact', async () => {
        const mockConfig = { feature: 'enabled' }
        const mockSession = { payload: { aud: 'user' }, options: {} }
        const mockContact = { id: 'contact1', name: 'Test Contact' }
        const mockFn = jest.fn().mockResolvedValue({ success: true })

        getContextAppConfig.mockResolvedValue(mockConfig)
        getContextAppSession.mockResolvedValue(mockSession)
        ensureContact.mockResolvedValue(mockContact)

        const handler = appContactActionHandler(
          'test-app',
          'test-namespace',
          ANY_SCHEMA,
          ANY_SCHEMA,
          mockFn
        )

        const result = await handler({})

        expect(result).toEqual({ success: true })
        expect(ensureContact).toHaveBeenCalledWith({
          namespace: 'test-namespace',
          session: mockSession,
          app: 'test-app',
        })
        expect(mockFn).toHaveBeenCalledWith(
          mockConfig,
          mockSession,
          mockContact,
          {}
        )
      })

      it('should pass input to handler function', async () => {
        const mockSession = { payload: { aud: 'user' }, options: {} }
        const mockContact = { id: 'contact1' }
        const mockFn = jest.fn().mockResolvedValue({ success: true })

        getContextAppConfig.mockResolvedValue({})
        getContextAppSession.mockResolvedValue(mockSession)
        ensureContact.mockResolvedValue(mockContact)

        const inputSchema = schema.object({ data: schema.string() })

        const handler = appContactActionHandler(
          'test-app',
          'test-namespace',
          ANY_SCHEMA,
          inputSchema,
          mockFn
        )

        await handler({ data: 'test-data' })

        expect(mockFn).toHaveBeenCalledWith({}, mockSession, mockContact, {
          data: 'test-data',
        })
      })
    })

    describe('error handling', () => {
      it('should handle errors from ensureContact', async () => {
        const mockSession = { payload: { aud: 'user' }, options: {} }
        const mockError = new Error('Contact error')

        mockError.code = 'CONTACT_ERROR'

        getContextAppConfig.mockResolvedValue({})
        getContextAppSession.mockResolvedValue(mockSession)
        ensureContact.mockRejectedValue(mockError)

        const handler = appContactActionHandler(
          'test-app',
          'test-namespace',
          ANY_SCHEMA,
          ANY_SCHEMA,
          jest.fn()
        )

        const result = await handler({})

        expect(result).toEqual({
          error: {
            code: 'CONTACT_ERROR',
            message: 'Contact error',
          },
        })
      })
    })
  })
})
