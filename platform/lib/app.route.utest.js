import { ensureContact } from '@/lib/app.contact'
import { getContextAppConfig, getContextAppSession } from '@/lib/app.context'
import { APP_AUDIENCE } from '@/lib/audience.consts'
import {
  getContextFrontendHost,
  getContextRequestHost,
} from '@/lib/context.store'
import { captureException } from '@/lib/error'
import { parseRequestSchema } from '@/lib/request'
import { throwNotAuthenticated, throwNotAuthorized } from '@/lib/response'

import { appContactRouteHandler, appRouteHandler } from './app.route'

import { z } from 'zod'

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

jest.mock('@/lib/stream', () => ({
  withStream: jest.fn((fn) => fn),
}))

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
}))

jest.mock('@/lib/method', () => ({
  withAny: jest.fn((fn) => fn),
}))

jest.mock('@/lib/request', () => ({
  parseRequestSchema: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  throwNotAuthenticated: jest.fn(() => {
    throw new Error('Not authenticated')
  }),
  throwNotAuthorized: jest.fn(() => {
    throw new Error('Not authorized')
  }),
}))

describe('appRouteHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getContextFrontendHost.mockReturnValue(undefined)
    getContextRequestHost.mockReturnValue(undefined)
  })

  it('should create a handler function', () => {
    const schema = z.object({ test: z.string() })
    const fn = jest.fn()

    const handler = appRouteHandler('test-app', schema, fn)

    expect(typeof handler).toBe('function')
  })

  it('should throw not authenticated if session is null', async () => {
    const schema = z.object({})
    const fn = jest.fn()

    getContextAppConfig.mockResolvedValue({})
    getContextAppSession.mockResolvedValue(null)
    parseRequestSchema.mockResolvedValue({})

    const handler = appRouteHandler('test-app', schema, fn)
    const mockReq = new Request('http://localhost/test')
    const mockStream = { push: jest.fn(), result: jest.fn(), error: jest.fn() }

    await expect(handler(mockReq, mockStream)).rejects.toThrow(
      'Not authenticated'
    )

    expect(throwNotAuthenticated).toHaveBeenCalled()
  })

  it('should throw not authorized if app audience and no config', async () => {
    const schema = z.object({})
    const fn = jest.fn()

    getContextAppConfig.mockResolvedValue(null)
    getContextAppSession.mockResolvedValue({
      payload: { aud: APP_AUDIENCE },
    })
    parseRequestSchema.mockResolvedValue({})

    const handler = appRouteHandler('test-app', schema, fn)
    const mockReq = new Request('http://localhost/test')
    const mockStream = { push: jest.fn(), result: jest.fn(), error: jest.fn() }

    await expect(handler(mockReq, mockStream)).rejects.toThrow('Not authorized')

    expect(throwNotAuthorized).toHaveBeenCalled()
  })

  it('should call handler with config, session, body, and context', async () => {
    const schema = z.object({ name: z.string() })
    const fn = jest.fn().mockResolvedValue({ success: true })

    const mockConfig = { setting: 'value' }
    const mockSession = { payload: { aud: 'other' } }
    const mockBody = { name: 'test' }

    getContextAppConfig.mockResolvedValue(mockConfig)
    getContextAppSession.mockResolvedValue(mockSession)
    parseRequestSchema.mockResolvedValue(mockBody)

    const handler = appRouteHandler('test-app', schema, fn)
    const mockReq = new Request('http://localhost/test')
    const mockStream = { push: jest.fn(), result: jest.fn(), error: jest.fn() }

    await handler(mockReq, mockStream)

    expect(fn).toHaveBeenCalledWith(
      mockConfig,
      mockSession,
      mockBody,
      expect.objectContaining({})
    )
  })

  it('should handle async generator response', async () => {
    const schema = z.object({})
    const fn = jest.fn().mockImplementation(async function* () {
      yield { type: 'chunk', data: '1' }
      yield { type: 'chunk', data: '2' }
    })

    const mockConfig = { setting: 'value' }
    const mockSession = { payload: { aud: 'other' } }

    getContextAppConfig.mockResolvedValue(mockConfig)
    getContextAppSession.mockResolvedValue(mockSession)
    parseRequestSchema.mockResolvedValue({})

    const handler = appRouteHandler('test-app', schema, fn)
    const mockReq = new Request('http://localhost/test')
    const mockStream = { push: jest.fn(), result: jest.fn(), error: jest.fn() }

    await handler(mockReq, mockStream)

    expect(mockStream.push).toHaveBeenCalledTimes(2)
    expect(mockStream.push).toHaveBeenCalledWith({ type: 'chunk', data: '1' })
    expect(mockStream.push).toHaveBeenCalledWith({ type: 'chunk', data: '2' })
  })

  it('should handle promise response', async () => {
    const schema = z.object({})
    const fn = jest.fn().mockResolvedValue({ success: true })

    const mockConfig = { setting: 'value' }
    const mockSession = { payload: { aud: 'other' } }

    getContextAppConfig.mockResolvedValue(mockConfig)
    getContextAppSession.mockResolvedValue(mockSession)
    parseRequestSchema.mockResolvedValue({})

    const handler = appRouteHandler('test-app', schema, fn)
    const mockReq = new Request('http://localhost/test')
    const mockStream = { push: jest.fn(), result: jest.fn(), error: jest.fn() }

    await handler(mockReq, mockStream)

    expect(mockStream.result).toHaveBeenCalledWith({ success: true })
  })

  it('should handle errors with captureException', async () => {
    const schema = z.object({})
    const testError = new Error('Test error')
    const fn = jest.fn().mockRejectedValue(testError)

    const mockConfig = { setting: 'value' }
    const mockSession = { payload: { aud: 'other' } }

    getContextAppConfig.mockResolvedValue(mockConfig)
    getContextAppSession.mockResolvedValue(mockSession)
    parseRequestSchema.mockResolvedValue({})

    const handler = appRouteHandler('test-app', schema, fn)
    const mockReq = new Request('http://localhost/test')
    const mockStream = { push: jest.fn(), result: jest.fn(), error: jest.fn() }

    await handler(mockReq, mockStream)

    expect(captureException).toHaveBeenCalledWith(testError)
    expect(mockStream.error).toHaveBeenCalledWith(testError)
  })

  it('should handle non-Error exceptions', async () => {
    const schema = z.object({})
    const fn = jest.fn().mockRejectedValue('string error')

    const mockConfig = { setting: 'value' }
    const mockSession = { payload: { aud: 'other' } }

    getContextAppConfig.mockResolvedValue(mockConfig)
    getContextAppSession.mockResolvedValue(mockSession)
    parseRequestSchema.mockResolvedValue({})

    const handler = appRouteHandler('test-app', schema, fn)
    const mockReq = new Request('http://localhost/test')
    const mockStream = { push: jest.fn(), result: jest.fn(), error: jest.fn() }

    await handler(mockReq, mockStream)

    expect(mockStream.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'string error',
      })
    )
  })

  it('should use empty config if config is null', async () => {
    const schema = z.object({})
    const fn = jest.fn().mockResolvedValue({ success: true })

    getContextAppConfig.mockResolvedValue(null)
    getContextAppSession.mockResolvedValue({ payload: { aud: 'other' } })
    parseRequestSchema.mockResolvedValue({})

    const handler = appRouteHandler('test-app', schema, fn)
    const mockReq = new Request('http://localhost/test')
    const mockStream = { push: jest.fn(), result: jest.fn(), error: jest.fn() }

    await handler(mockReq, mockStream)

    expect(fn).toHaveBeenCalledWith(
      {},
      expect.any(Object),
      expect.any(Object),
      expect.any(Object)
    )
  })

  it('should not call result if function returns no value', async () => {
    const schema = z.object({})
    const fn = jest.fn().mockResolvedValue(undefined)

    const mockConfig = { setting: 'value' }
    const mockSession = { payload: { aud: 'other' } }

    getContextAppConfig.mockResolvedValue(mockConfig)
    getContextAppSession.mockResolvedValue(mockSession)
    parseRequestSchema.mockResolvedValue({})

    const handler = appRouteHandler('test-app', schema, fn)
    const mockReq = new Request('http://localhost/test')
    const mockStream = { push: jest.fn(), result: jest.fn(), error: jest.fn() }

    await handler(mockReq, mockStream)

    expect(mockStream.result).not.toHaveBeenCalled()
  })
})

describe('appContactRouteHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getContextFrontendHost.mockReturnValue(undefined)
    getContextRequestHost.mockReturnValue(undefined)
  })

  it('should ensure the contact and pass parsed config, contact and input', async () => {
    const configSchema = z.object({ flag: z.boolean().default(false) })
    const inputSchema = z.object({ name: z.string() })
    const fn = jest.fn().mockResolvedValue({ ok: true })

    const mockSession = { payload: { aud: 'other' } }
    const mockContact = { id: 'contact-1' }

    getContextAppConfig.mockResolvedValue({})
    getContextAppSession.mockResolvedValue(mockSession)
    parseRequestSchema.mockResolvedValue({ name: 'test' })
    ensureContact.mockResolvedValue(mockContact)

    const handler = appContactRouteHandler(
      'test-app',
      'test-namespace',
      configSchema,
      inputSchema,
      fn
    )
    const mockReq = new Request('http://localhost/test')
    const mockStream = { push: jest.fn(), result: jest.fn(), error: jest.fn() }

    await handler(mockReq, mockStream)

    expect(ensureContact).toHaveBeenCalledWith({
      namespace: 'test-namespace',
      session: mockSession,
      app: 'test-app',
    })
    expect(fn).toHaveBeenCalledWith(
      { flag: false },
      mockSession,
      mockContact,
      { name: 'test' },
      expect.any(Object)
    )
    expect(mockStream.result).toHaveBeenCalledWith({ ok: true })
  })

  it('should stream generator events from the contact handler', async () => {
    const fn = jest.fn().mockImplementation(async function* () {
      yield { type: 'item', data: { n: 1 } }
    })

    getContextAppConfig.mockResolvedValue({})
    getContextAppSession.mockResolvedValue({ payload: { aud: 'other' } })
    parseRequestSchema.mockResolvedValue({})
    ensureContact.mockResolvedValue({ id: 'contact-1' })

    const handler = appContactRouteHandler(
      'test-app',
      'test-namespace',
      z.object({}),
      z.object({}),
      fn
    )
    const mockReq = new Request('http://localhost/test')
    const mockStream = { push: jest.fn(), result: jest.fn(), error: jest.fn() }

    await handler(mockReq, mockStream)

    expect(mockStream.push).toHaveBeenCalledWith({
      type: 'item',
      data: { n: 1 },
    })
    expect(mockStream.result).not.toHaveBeenCalled()
  })

  it('should report a contact failure through the stream error', async () => {
    const fn = jest.fn()
    const contactError = new Error('Contact not found')

    getContextAppConfig.mockResolvedValue({})
    getContextAppSession.mockResolvedValue({ payload: { aud: 'other' } })
    parseRequestSchema.mockResolvedValue({})
    ensureContact.mockRejectedValue(contactError)

    const handler = appContactRouteHandler(
      'test-app',
      'test-namespace',
      z.object({}),
      z.object({}),
      fn
    )
    const mockReq = new Request('http://localhost/test')
    const mockStream = { push: jest.fn(), result: jest.fn(), error: jest.fn() }

    await handler(mockReq, mockStream)

    expect(fn).not.toHaveBeenCalled()
    expect(captureException).toHaveBeenCalledWith(contactError)
    expect(mockStream.error).toHaveBeenCalledWith(contactError)
  })
})
