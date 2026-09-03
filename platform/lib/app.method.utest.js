import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { getContextAppConfig, getContextAppSession } from '@/lib/app.context'
import { APP_AUDIENCE } from '@/lib/audience.consts'
import {
  getContextFrontendHost,
  getContextRequestHost,
} from '@/lib/context.store'
import { captureException } from '@/lib/error'

import { ANY_SCHEMA, appMethodHandler } from './app.method'

import { z } from 'zod'

jest.mock('next/headers', () => ({
  headers: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
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

describe('appMethodHandler', () => {
  const mockApp = 'test-app'
  const mockConfig = { setting: 'value' }
  const mockSession = {
    payload: { aud: 'user', sub: 'user-123' },
  }
  const mockInput = { data: 'test' }

  beforeEach(() => {
    jest.clearAllMocks()
    getContextFrontendHost.mockReturnValue('app.example.com')
    getContextRequestHost.mockReturnValue('request.example.com')

    const mockHeaders = new Map()

    mockHeaders.get = jest.fn((key) => {
      const values = {
        'x-chatbotkit-internal-frontend-host': 'app.example.com',
        'x-chatbotkit-internal-timezone': 'America/New_York',
      }

      return values[key] || null
    })
    mockHeaders.has = jest.fn(() => false)

    headers.mockResolvedValue(mockHeaders)
    getContextAppConfig.mockResolvedValue(mockConfig)
    getContextAppSession.mockResolvedValue(mockSession)
  })

  describe('ANY_SCHEMA', () => {
    it('should accept any object', () => {
      const result = ANY_SCHEMA.parse({ foo: 'bar', nested: { value: 123 } })

      expect(result).toEqual({ foo: 'bar', nested: { value: 123 } })
    })
  })

  describe('basic functionality', () => {
    it('should call handler with config, session, input, and context', async () => {
      const mockFn = jest.fn().mockResolvedValue({ result: 'success' })
      const handler = appMethodHandler(mockApp, ANY_SCHEMA, ANY_SCHEMA, mockFn)

      const result = await handler(mockInput)

      expect(result).toEqual({ result: 'success' })
      expect(mockFn).toHaveBeenCalledWith(
        mockConfig,
        mockSession,
        mockInput,
        expect.objectContaining({
          host: 'app.example.com',
        })
      )
    })

    it('should fetch config and session in parallel', async () => {
      const mockFn = jest.fn().mockResolvedValue({ result: 'success' })
      const handler = appMethodHandler(mockApp, ANY_SCHEMA, ANY_SCHEMA, mockFn)

      await handler(mockInput)

      expect(getContextAppConfig).toHaveBeenCalledWith(mockApp)
      expect(getContextAppSession).toHaveBeenCalledWith(mockApp)
    })
  })

  describe('session validation', () => {
    it('should redirect to signin when session is null', async () => {
      getContextAppSession.mockResolvedValue(null)

      const mockFn = jest.fn()
      const handler = appMethodHandler(mockApp, ANY_SCHEMA, ANY_SCHEMA, mockFn)

      await handler(mockInput)

      expect(redirect).toHaveBeenCalledWith('/signin')
      expect(mockFn).not.toHaveBeenCalled()
    })

    it('should redirect to signin when session is undefined', async () => {
      getContextAppSession.mockResolvedValue(undefined)

      const mockFn = jest.fn()
      const handler = appMethodHandler(mockApp, ANY_SCHEMA, ANY_SCHEMA, mockFn)

      await handler(mockInput)

      expect(redirect).toHaveBeenCalledWith('/signin')
      expect(mockFn).not.toHaveBeenCalled()
    })
  })

  describe('app audience validation', () => {
    it('should redirect when config is missing for app audience', async () => {
      getContextAppConfig.mockResolvedValue(null)
      getContextAppSession.mockResolvedValue({
        payload: { aud: APP_AUDIENCE, sub: 'app-123' },
      })

      const mockFn = jest.fn()
      const handler = appMethodHandler(mockApp, ANY_SCHEMA, ANY_SCHEMA, mockFn)

      await handler(mockInput)

      expect(redirect).toHaveBeenCalledWith('/signin')
      expect(mockFn).not.toHaveBeenCalled()
    })

    it('should proceed when config exists for app audience', async () => {
      getContextAppSession.mockResolvedValue({
        payload: { aud: APP_AUDIENCE, sub: 'app-123' },
      })

      const mockFn = jest.fn().mockResolvedValue({ result: 'success' })
      const handler = appMethodHandler(mockApp, ANY_SCHEMA, ANY_SCHEMA, mockFn)

      const result = await handler(mockInput)

      expect(result).toEqual({ result: 'success' })
      expect(mockFn).toHaveBeenCalled()
    })

    it('should allow missing config for non-app audience', async () => {
      getContextAppConfig.mockResolvedValue(null)
      getContextAppSession.mockResolvedValue({
        payload: { aud: 'user', sub: 'user-123' },
      })

      const mockFn = jest.fn().mockResolvedValue({ result: 'success' })
      const handler = appMethodHandler(mockApp, ANY_SCHEMA, ANY_SCHEMA, mockFn)

      const result = await handler(mockInput)

      expect(result).toEqual({ result: 'success' })
      expect(mockFn).toHaveBeenCalledWith(
        {},
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      )
    })
  })

  describe('next-action header handling', () => {
    it('should return error when next-action header is present', async () => {
      const mockHeaders = new Map()

      mockHeaders.has = jest.fn((key) => key === 'next-action')
      mockHeaders.get = jest.fn(() => null)

      headers.mockResolvedValue(mockHeaders)

      const mockFn = jest.fn()
      const handler = appMethodHandler(mockApp, ANY_SCHEMA, ANY_SCHEMA, mockFn)

      const result = await handler(mockInput)

      expect(result).toEqual({
        error: {
          code: 'method_not_allowed',
          message: 'This method is not allowed in this context.',
        },
      })
      expect(mockFn).not.toHaveBeenCalled()
    })

    it('should allow next-action header when notExported is true', async () => {
      const mockHeaders = new Map()

      mockHeaders.has = jest.fn((key) => key === 'next-action')
      mockHeaders.get = jest.fn(() => null)

      headers.mockResolvedValue(mockHeaders)

      const mockFn = jest.fn().mockResolvedValue({ result: 'success' })
      const handler = appMethodHandler(
        mockApp,
        ANY_SCHEMA,
        ANY_SCHEMA,
        mockFn,
        true // notExported = true
      )

      const result = await handler(mockInput)

      expect(result).toEqual({ result: 'success' })
      expect(mockFn).toHaveBeenCalled()
    })
  })

  describe('schema validation', () => {
    it('should validate config schema', async () => {
      const configSchema = z.object({ required: z.string() })
      const invalidConfig = {}

      getContextAppConfig.mockResolvedValue(invalidConfig)

      const mockFn = jest.fn()
      const handler = appMethodHandler(
        mockApp,
        configSchema,
        ANY_SCHEMA,
        mockFn
      )

      const result = await handler(mockInput)

      expect(result).toEqual({
        error: expect.objectContaining({
          code: undefined,
          message: expect.stringContaining('required'),
        }),
      })
      expect(mockFn).not.toHaveBeenCalled()
    })

    it('should validate input schema', async () => {
      const inputSchema = z.object({ required: z.string() })
      const invalidInput = {}

      const mockFn = jest.fn()
      const handler = appMethodHandler(mockApp, ANY_SCHEMA, inputSchema, mockFn)

      const result = await handler(invalidInput)

      expect(result).toEqual({
        error: expect.objectContaining({
          message: expect.stringContaining('required'),
        }),
      })
      expect(mockFn).not.toHaveBeenCalled()
    })

    it('should pass validated schemas to handler', async () => {
      const configSchema = z.object({ setting: z.string() })
      const inputSchema = z.object({ data: z.string() })

      const mockFn = jest.fn().mockResolvedValue({ result: 'success' })
      const handler = appMethodHandler(
        mockApp,
        configSchema,
        inputSchema,
        mockFn
      )

      await handler(mockInput)

      expect(mockFn).toHaveBeenCalledWith(
        mockConfig,
        mockSession,
        mockInput,
        expect.any(Object)
      )
    })
  })

  describe('error handling', () => {
    it('should catch and return errors from handler', async () => {
      const mockError = new Error('Handler error')

      mockError.code = 'handler_error'

      const mockFn = jest.fn().mockRejectedValue(mockError)
      const handler = appMethodHandler(mockApp, ANY_SCHEMA, ANY_SCHEMA, mockFn)

      const result = await handler(mockInput)

      expect(result).toEqual({
        error: {
          code: 'handler_error',
          message: 'Handler error',
        },
      })
    })

    it('should handle errors without code property', async () => {
      const mockError = new Error('Generic error')

      const mockFn = jest.fn().mockRejectedValue(mockError)
      const handler = appMethodHandler(mockApp, ANY_SCHEMA, ANY_SCHEMA, mockFn)

      const result = await handler(mockInput)

      expect(result).toEqual({
        error: {
          code: undefined,
          message: 'Generic error',
        },
      })
    })

    it('should capture exceptions', async () => {
      const mockError = new Error('Handler error')

      const mockFn = jest.fn().mockRejectedValue(mockError)
      const handler = appMethodHandler(mockApp, ANY_SCHEMA, ANY_SCHEMA, mockFn)

      await handler(mockInput)

      expect(captureException).toHaveBeenCalledWith(mockError)
    })
  })

  describe('host resolution', () => {
    it('should prioritize the verified frontend host in context', async () => {
      getContextFrontendHost.mockReturnValue('frontend.example.com')
      headers.mockResolvedValue(
        new Headers({
          'x-forwarded-host': 'forwarded.example.com',
          host: 'default.example.com',
        })
      )

      const mockFn = jest.fn().mockResolvedValue({ result: 'success' })
      const handler = appMethodHandler(mockApp, ANY_SCHEMA, ANY_SCHEMA, mockFn)

      await handler(mockInput)

      expect(mockFn).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
        { host: 'frontend.example.com' }
      )
    })

    it('should fall back to the request host in context', async () => {
      getContextFrontendHost.mockReturnValue(null)
      getContextRequestHost.mockReturnValue('context.example.com')
      headers.mockResolvedValue(
        new Headers({
          'x-forwarded-host': 'untrusted.example.com',
          host: 'untrusted-fallback.example.com',
        })
      )

      const mockFn = jest.fn().mockResolvedValue({ result: 'success' })
      const handler = appMethodHandler(mockApp, ANY_SCHEMA, ANY_SCHEMA, mockFn)

      await handler(mockInput)

      expect(mockFn).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
        { host: 'context.example.com' }
      )
    })

    it('should use undefined when no host exists in context', async () => {
      getContextFrontendHost.mockReturnValue(null)
      getContextRequestHost.mockReturnValue(null)

      const mockHeaders = new Map()

      mockHeaders.has = jest.fn(() => false)
      mockHeaders.get = jest.fn(() => null)

      headers.mockResolvedValue(mockHeaders)

      const mockFn = jest.fn().mockResolvedValue({ result: 'success' })
      const handler = appMethodHandler(mockApp, ANY_SCHEMA, ANY_SCHEMA, mockFn)

      await handler(mockInput)

      expect(mockFn).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
        { host: undefined }
      )
    })
  })
})
