/* eslint-disable @typescript-eslint/no-require-imports */
import * as ratelimitModule from '@/lib/ratelimit'
import * as responseModule from '@/lib/response'
import * as sessionHandlerModule from '@/lib/session.handler'

import {
  withRate,
  withSessionRate,
  withSessionSystemRate,
  withSystemRate,
} from './rate'

jest.mock('@/lib/env', () => ({
  isDevelopment: false,
}))

jest.mock('@/lib/ratelimit', () => ({
  slidingWindow: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  ok: jest.fn(() => ({ status: 200 })),
  tooManyRequests: jest.fn((msg) => ({ status: 429, message: msg })),
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: jest.fn((fn) => fn),
}))

describe('rate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('withRate', () => {
    const mockReq = { url: '/test-endpoint' }
    const mockSession = { user: { id: 'user-123' } }
    const mockFn = jest.fn(async () => ({ status: 200, data: 'success' }))

    it('should call the function when rate limit check passes', async () => {
      ratelimitModule.slidingWindow.mockResolvedValue({ success: true })

      const rateLimitedFn = withRate(10, '1 m', mockFn)
      const result = await rateLimitedFn(mockReq, mockSession)

      expect(ratelimitModule.slidingWindow).toHaveBeenCalledWith(
        'with-rate-user-user-123-url-/test-endpoint',
        10,
        '1 m'
      )
      expect(mockFn).toHaveBeenCalledWith(mockReq, mockSession)
      expect(result).toEqual({ status: 200, data: 'success' })
    })

    it('should return tooManyRequests when rate limit exceeded', async () => {
      ratelimitModule.slidingWindow.mockResolvedValue({ success: false })
      responseModule.tooManyRequests.mockReturnValue({
        status: 429,
        message: 'You have exceeded your allocated request limits',
      })

      const rateLimitedFn = withRate(10, '1 m', mockFn)
      const result = await rateLimitedFn(mockReq, mockSession)

      expect(ratelimitModule.slidingWindow).toHaveBeenCalled()
      expect(mockFn).not.toHaveBeenCalled()
      expect(result).toEqual({
        status: 429,
        message: 'You have exceeded your allocated request limits',
      })
    })

    it('should return ok when rate limit exceeded but pass is true', async () => {
      ratelimitModule.slidingWindow.mockResolvedValue({ success: false })
      responseModule.ok.mockReturnValue({ status: 200 })

      const rateLimitedFn = withRate(10, '1 m', mockFn, true)
      const result = await rateLimitedFn(mockReq, mockSession)

      expect(ratelimitModule.slidingWindow).toHaveBeenCalled()
      expect(mockFn).not.toHaveBeenCalled()
      expect(result).toEqual({ status: 200 })
    })

    it('should skip rate limiting in development mode', async () => {
      const envModule = require('@/lib/env')

      envModule.isDevelopment = true

      const rateLimitedFn = withRate(10, '1 m', mockFn)
      const result = await rateLimitedFn(mockReq, mockSession)

      expect(ratelimitModule.slidingWindow).not.toHaveBeenCalled()
      expect(mockFn).toHaveBeenCalledWith(mockReq, mockSession)
      expect(result).toEqual({ status: 200, data: 'success' })

      envModule.isDevelopment = false
    })

    it('should pass additional arguments to the wrapped function', async () => {
      ratelimitModule.slidingWindow.mockResolvedValue({ success: true })

      const rateLimitedFn = withRate(10, '1 m', mockFn)

      await rateLimitedFn(mockReq, mockSession, 'arg1', 'arg2')

      expect(mockFn).toHaveBeenCalledWith(mockReq, mockSession, 'arg1', 'arg2')
    })

    it('should handle different rate formats', async () => {
      ratelimitModule.slidingWindow.mockResolvedValue({ success: true })

      const rates = ['100 ms', '5 s', '10 m', '2 h', '1 d']

      for (const rate of rates) {
        const rateLimitedFn = withRate(10, rate, mockFn)

        await rateLimitedFn(mockReq, mockSession)

        expect(ratelimitModule.slidingWindow).toHaveBeenCalledWith(
          expect.any(String),
          10,
          rate
        )
      }
    })

    it('should throw when session is missing', async () => {
      const rateLimitedFn = withRate(10, '1 m', mockFn)

      await expect(rateLimitedFn(mockReq, null)).rejects.toThrow(
        'no session provided'
      )
    })

    it('should throw when session.user.id is missing', async () => {
      const rateLimitedFn = withRate(10, '1 m', mockFn)

      await expect(
        rateLimitedFn(mockReq, { user: { id: null } })
      ).rejects.toThrow('no session provided')
    })

    it('should throw when req.url is missing', async () => {
      const rateLimitedFn = withRate(10, '1 m', mockFn)

      await expect(rateLimitedFn({}, mockSession)).rejects.toThrow(
        'no url provided'
      )
    })
  })

  describe('withSystemRate', () => {
    const mockReq = { url: '/api/system' }
    const mockSession = { user: { id: 'user-123' } }
    const mockFn = jest.fn(async () => ({ status: 200, data: 'success' }))

    it('should use system rate key without user id', async () => {
      ratelimitModule.slidingWindow.mockResolvedValue({ success: true })

      const rateLimitedFn = withSystemRate(100, '1 m', mockFn)

      await rateLimitedFn(mockReq, mockSession)

      expect(ratelimitModule.slidingWindow).toHaveBeenCalledWith(
        'with-rate-user-system-url-/api/system',
        100,
        '1 m'
      )
    })

    it('should return tooManyRequests with system message when rate limit exceeded', async () => {
      ratelimitModule.slidingWindow.mockResolvedValue({ success: false })
      responseModule.tooManyRequests.mockReturnValue({
        status: 429,
        message: 'You have exceeded the system allocated request limits',
      })

      const rateLimitedFn = withSystemRate(100, '1 m', mockFn)
      const result = await rateLimitedFn(mockReq, mockSession)

      expect(result).toEqual({
        status: 429,
        message: 'You have exceeded the system allocated request limits',
      })
    })

    it('should return ok when system rate limit exceeded but pass is true', async () => {
      ratelimitModule.slidingWindow.mockResolvedValue({ success: false })
      responseModule.ok.mockReturnValue({ status: 200 })

      const rateLimitedFn = withSystemRate(100, '1 m', mockFn, true)
      const result = await rateLimitedFn(mockReq, mockSession)

      expect(result).toEqual({ status: 200 })
    })

    it('should skip system rate limiting in development mode', async () => {
      const envModule = require('@/lib/env')

      envModule.isDevelopment = true

      const rateLimitedFn = withSystemRate(100, '1 m', mockFn)

      await rateLimitedFn(mockReq, mockSession)

      expect(ratelimitModule.slidingWindow).not.toHaveBeenCalled()
      expect(mockFn).toHaveBeenCalled()

      envModule.isDevelopment = false
    })

    it('should throw when session is missing', async () => {
      const rateLimitedFn = withSystemRate(100, '1 m', mockFn)

      await expect(rateLimitedFn(mockReq, null)).rejects.toThrow(
        'no session provided'
      )
    })

    it('should throw when req.url is missing', async () => {
      const rateLimitedFn = withSystemRate(100, '1 m', mockFn)

      await expect(rateLimitedFn({}, mockSession)).rejects.toThrow(
        'no url provided'
      )
    })
  })

  describe('withSessionRate', () => {
    it('should compose withSession and withRate', () => {
      const mockFn = jest.fn()

      withSessionRate(10, '1 m', mockFn)

      expect(sessionHandlerModule.withSession).toHaveBeenCalled()
    })

    it('should pass pass parameter through', () => {
      const mockFn = jest.fn()

      withSessionRate(10, '1 m', mockFn, true)

      expect(sessionHandlerModule.withSession).toHaveBeenCalled()
    })
  })

  describe('withSessionSystemRate', () => {
    it('should compose withSession and withSystemRate', () => {
      const mockFn = jest.fn()

      withSessionSystemRate(100, '1 m', mockFn)

      expect(sessionHandlerModule.withSession).toHaveBeenCalled()
    })

    it('should pass pass parameter through', () => {
      const mockFn = jest.fn()

      withSessionSystemRate(100, '1 m', mockFn, true)

      expect(sessionHandlerModule.withSession).toHaveBeenCalled()
    })
  })
})
