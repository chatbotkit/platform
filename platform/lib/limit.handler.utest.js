/* eslint-disable @typescript-eslint/no-require-imports */
import { withLimits, withSessionLimits } from './limit.handler'

jest.mock('@/lib/debug', () => ({
  ...jest.requireActual('@/lib/debug'),
  createSpan: jest.fn(() => ({ finish: jest.fn() })),
}))

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
}))

jest.mock('@/lib/limit.core', () => ({
  splitLimits: jest.fn(),
  rateLimitsOk: jest.fn(),
  databaseLimitsOk: jest.fn(),
  accountLimitsOk: jest.fn(),
  specialRateLimitsOk: jest.fn(),
  constructExceededRateLimitsMessage: jest.fn(
    (limits) => 'Rate limit exceeded'
  ),
  constructExceededDatabaseLimitsMessage: jest.fn(
    (limits) => 'Database limit exceeded'
  ),
  constructExceededAccountLimitsMessage: jest.fn(
    (limits) => 'Account limit exceeded'
  ),
  constructExceededSpecialRateLimitsMessage: jest.fn(
    (limits) => 'Special rate limit exceeded'
  ),
}))

jest.mock('@/lib/response', () => ({
  limitsReached: jest.fn((message) => new Response(message, { status: 429 })),
  genericError: jest.fn((error) => new Response('Error', { status: 500 })),
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: jest.fn((fn) => fn),
}))

const { createSpan } = require('@/lib/debug')
const { captureException } = require('@/lib/error')
const {
  splitLimits,
  rateLimitsOk,
  databaseLimitsOk,
  accountLimitsOk,
  specialRateLimitsOk,
  constructExceededRateLimitsMessage,
  constructExceededDatabaseLimitsMessage,
  constructExceededAccountLimitsMessage,
  constructExceededSpecialRateLimitsMessage,
} = require('@/lib/limit.core')
const { limitsReached, genericError } = require('@/lib/response')
const { withSession } = require('@/lib/session.handler')

describe('withLimits', () => {
  let mockReq
  let mockSession
  let mockHandlerFn
  let mockSpan

  beforeEach(() => {
    jest.clearAllMocks()

    mockReq = new Request('http://localhost/test')
    mockSession = { user: { id: 'user-123' } }
    mockHandlerFn = jest.fn().mockResolvedValue(new Response('Success'))
    mockSpan = { finish: jest.fn() }

    createSpan.mockReturnValue(mockSpan)

    splitLimits.mockReturnValue({
      rateLimits: [],
      databaseLimits: [],
      accountLimits: [],
      specialRateLimits: [],
    })
  })

  describe('basic functionality', () => {
    it('should call handler when no limits are provided', async () => {
      const handler = withLimits([], mockHandlerFn)
      const response = await handler(mockReq, mockSession)

      expect(mockHandlerFn).toHaveBeenCalledWith(mockReq, mockSession)
      expect(response).toBeInstanceOf(Response)
      expect(await response.text()).toBe('Success')
    })

    it('should create and finish span', async () => {
      const handler = withLimits([], mockHandlerFn)

      await handler(mockReq, mockSession)

      expect(createSpan).toHaveBeenCalledWith({ name: 'withLimits' })
      expect(mockSpan.finish).toHaveBeenCalled()
    })

    it('should pass through additional arguments', async () => {
      const handler = withLimits([], mockHandlerFn)

      await handler(mockReq, mockSession, 'arg1', 'arg2')

      expect(mockHandlerFn).toHaveBeenCalledWith(
        mockReq,
        mockSession,
        'arg1',
        'arg2'
      )
    })
  })

  describe('rate limits', () => {
    beforeEach(() => {
      splitLimits.mockReturnValue({
        rateLimits: ['rate-limit-1'],
        databaseLimits: [],
        accountLimits: [],
        specialRateLimits: [],
      })
    })

    it('should call handler when rate limits pass', async () => {
      rateLimitsOk.mockResolvedValue(true)

      const handler = withLimits(['rate-limit-1'], mockHandlerFn)

      await handler(mockReq, mockSession)

      expect(rateLimitsOk).toHaveBeenCalledWith(
        mockSession.user,
        ['rate-limit-1'],
        expect.any(Object)
      )
      expect(mockHandlerFn).toHaveBeenCalled()
    })

    it('should return error when rate limits fail', async () => {
      rateLimitsOk.mockResolvedValue(false)
      limitsReached.mockReturnValue(new Response('Rate limit', { status: 429 }))

      const handler = withLimits(['rate-limit-1'], mockHandlerFn)
      const response = await handler(mockReq, mockSession)

      expect(rateLimitsOk).toHaveBeenCalled()
      expect(constructExceededRateLimitsMessage).toHaveBeenCalled()
      expect(limitsReached).toHaveBeenCalledWith('Rate limit exceeded')
      expect(mockHandlerFn).not.toHaveBeenCalled()
      expect(response.status).toBe(429)
    })
  })

  describe('database limits', () => {
    beforeEach(() => {
      splitLimits.mockReturnValue({
        rateLimits: [],
        databaseLimits: ['db-limit-1'],
        accountLimits: [],
        specialRateLimits: [],
      })
    })

    it('should call handler when database limits pass', async () => {
      databaseLimitsOk.mockResolvedValue(true)

      const handler = withLimits(['db-limit-1'], mockHandlerFn)

      await handler(mockReq, mockSession)

      expect(databaseLimitsOk).toHaveBeenCalledWith(
        mockSession.user,
        ['db-limit-1'],
        expect.any(Object)
      )
      expect(mockHandlerFn).toHaveBeenCalled()
    })

    it('should return error when database limits fail', async () => {
      databaseLimitsOk.mockResolvedValue(false)
      limitsReached.mockReturnValue(new Response('DB limit', { status: 429 }))

      const handler = withLimits(['db-limit-1'], mockHandlerFn)
      const response = await handler(mockReq, mockSession)

      expect(databaseLimitsOk).toHaveBeenCalled()
      expect(constructExceededDatabaseLimitsMessage).toHaveBeenCalled()
      expect(mockHandlerFn).not.toHaveBeenCalled()
      expect(response.status).toBe(429)
    })
  })

  describe('account limits', () => {
    beforeEach(() => {
      splitLimits.mockReturnValue({
        rateLimits: [],
        databaseLimits: [],
        accountLimits: ['account-limit-1'],
        specialRateLimits: [],
      })
    })

    it('should call handler when account limits pass', async () => {
      accountLimitsOk.mockResolvedValue(true)

      const handler = withLimits(['account-limit-1'], mockHandlerFn)

      await handler(mockReq, mockSession)

      expect(accountLimitsOk).toHaveBeenCalledWith(
        mockSession.user,
        ['account-limit-1'],
        expect.any(Object)
      )
      expect(mockHandlerFn).toHaveBeenCalled()
    })

    it('should return error when account limits fail', async () => {
      accountLimitsOk.mockResolvedValue(false)
      limitsReached.mockReturnValue(
        new Response('Account limit', { status: 429 })
      )

      const handler = withLimits(['account-limit-1'], mockHandlerFn)
      const response = await handler(mockReq, mockSession)

      expect(accountLimitsOk).toHaveBeenCalled()
      expect(constructExceededAccountLimitsMessage).toHaveBeenCalled()
      expect(mockHandlerFn).not.toHaveBeenCalled()
      expect(response.status).toBe(429)
    })
  })

  describe('special rate limits', () => {
    beforeEach(() => {
      splitLimits.mockReturnValue({
        rateLimits: [],
        databaseLimits: [],
        accountLimits: [],
        specialRateLimits: ['special-limit-1'],
      })
    })

    it('should call handler when special rate limits pass', async () => {
      specialRateLimitsOk.mockResolvedValue(true)

      const handler = withLimits(['special-limit-1'], mockHandlerFn)

      await handler(mockReq, mockSession)

      expect(specialRateLimitsOk).toHaveBeenCalledWith(
        mockSession.user,
        ['special-limit-1'],
        expect.any(Object)
      )
      expect(mockHandlerFn).toHaveBeenCalled()
    })

    it('should return error when special rate limits fail', async () => {
      specialRateLimitsOk.mockResolvedValue(false)
      limitsReached.mockReturnValue(
        new Response('Special limit', { status: 429 })
      )

      const handler = withLimits(['special-limit-1'], mockHandlerFn)
      const response = await handler(mockReq, mockSession)

      expect(specialRateLimitsOk).toHaveBeenCalled()
      expect(constructExceededSpecialRateLimitsMessage).toHaveBeenCalled()
      expect(mockHandlerFn).not.toHaveBeenCalled()
      expect(response.status).toBe(429)
    })
  })

  describe('multiple limit types', () => {
    beforeEach(() => {
      splitLimits.mockReturnValue({
        rateLimits: ['rate-limit-1'],
        databaseLimits: ['db-limit-1'],
        accountLimits: ['account-limit-1'],
        specialRateLimits: ['special-limit-1'],
      })
    })

    it('should check all limit types when all pass', async () => {
      rateLimitsOk.mockResolvedValue(true)
      databaseLimitsOk.mockResolvedValue(true)
      accountLimitsOk.mockResolvedValue(true)
      specialRateLimitsOk.mockResolvedValue(true)

      const handler = withLimits(
        ['rate-limit-1', 'db-limit-1', 'account-limit-1', 'special-limit-1'],
        mockHandlerFn
      )

      await handler(mockReq, mockSession)

      expect(rateLimitsOk).toHaveBeenCalled()
      expect(databaseLimitsOk).toHaveBeenCalled()
      expect(accountLimitsOk).toHaveBeenCalled()
      expect(specialRateLimitsOk).toHaveBeenCalled()
      expect(mockHandlerFn).toHaveBeenCalled()
    })

    it('should short-circuit on first failing limit', async () => {
      rateLimitsOk.mockResolvedValue(false)
      limitsReached.mockReturnValue(new Response('Limit', { status: 429 }))

      const handler = withLimits(
        ['rate-limit-1', 'db-limit-1', 'account-limit-1'],
        mockHandlerFn
      )

      await handler(mockReq, mockSession)

      expect(mockHandlerFn).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should capture exception and return generic error', async () => {
      const error = new Error('Limit check failed')

      rateLimitsOk.mockRejectedValue(error)
      genericError.mockReturnValue(new Response('Error', { status: 500 }))

      splitLimits.mockReturnValue({
        rateLimits: ['rate-limit-1'],
        databaseLimits: [],
        accountLimits: [],
        specialRateLimits: [],
      })

      const handler = withLimits(['rate-limit-1'], mockHandlerFn)
      const response = await handler(mockReq, mockSession)

      expect(captureException).toHaveBeenCalledWith(error)
      expect(genericError).toHaveBeenCalledWith(error)
      expect(response.status).toBe(500)
    })

    it('should finish span even when error occurs', async () => {
      rateLimitsOk.mockRejectedValue(new Error('Limit check failed'))
      genericError.mockReturnValue(new Response('Error', { status: 500 }))

      splitLimits.mockReturnValue({
        rateLimits: ['rate-limit-1'],
        databaseLimits: [],
        accountLimits: [],
        specialRateLimits: [],
      })

      const handler = withLimits(['rate-limit-1'], mockHandlerFn)

      await handler(mockReq, mockSession)

      expect(mockSpan.finish).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle missing session gracefully', async () => {
      const handler = withLimits([], mockHandlerFn)

      await expect(handler(mockReq, null)).rejects.toThrow()
    })

    it('should handle empty limits array', async () => {
      const handler = withLimits([], mockHandlerFn)

      await handler(mockReq, mockSession)

      expect(mockHandlerFn).toHaveBeenCalled()
    })
  })
})

describe('withSessionLimits', () => {
  it('should wrap handler with session and limits', () => {
    const mockHandlerFn = jest.fn()
    const limits = ['rate-limit-1']

    withSessionLimits(limits, mockHandlerFn)

    expect(withSession).toHaveBeenCalledWith(expect.any(Function))
  })

  it('should return function that applies limits', async () => {
    const mockHandlerFn = jest.fn().mockResolvedValue(new Response('Success'))
    const limits = ['rate-limit-1']

    splitLimits.mockReturnValue({
      rateLimits: ['rate-limit-1'],
      databaseLimits: [],
      accountLimits: [],
      specialRateLimits: [],
    })
    rateLimitsOk.mockResolvedValue(true)

    const handler = withSessionLimits(limits, mockHandlerFn)
    const mockReq = new Request('http://localhost/test')
    const mockSession = { user: { id: 'user-123' } }

    await handler(mockReq, mockSession)

    expect(mockHandlerFn).toHaveBeenCalled()
  })
})
