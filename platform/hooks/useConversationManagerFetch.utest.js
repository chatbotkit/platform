import { jsonl } from '@/lib/fetch'
import { rateLimitWithCondition } from '@/lib/it'

import useFetch from '@/hooks/useFetch'

import useConversationManagerFetch, {
  humanizeJsonl,
} from './useConversationManagerFetch'

import { renderHook } from '@testing-library/react'

jest.mock('@/lib/fetch', () => ({
  jsonl: jest.fn(),
}))

jest.mock('@/lib/it', () => {
  const actualIt = jest.requireActual('@/lib/it')

  return {
    __esModule: true,

    default: actualIt.default,

    rateLimitWithCondition: jest.fn((iter, condition, options) => iter),
  }
})

jest.mock('@/hooks/useFetch', () => ({
  __esModule: true,
  default: jest.fn(),
}))

describe('useConversationManagerFetch', () => {
  let mockFetch
  let mockUseFetchReturn

  beforeEach(() => {
    jest.clearAllMocks()

    mockFetch = jest.fn()
    mockUseFetchReturn = {
      fetch: mockFetch,
      loading: false,
      error: null,
    }

    useFetch.mockReturnValue(mockUseFetchReturn)
  })

  describe('hook initialization', () => {
    it('should initialize with basic props', () => {
      const { result } = renderHook(() =>
        useConversationManagerFetch({
          stream: true,
          headers: { 'X-Custom': 'header' },
          token: 'test-token',
        })
      )

      expect(result.current.fetch).toBeDefined()
      expect(result.current.fetchStream).toBeDefined()
      expect(result.current.loading).toBe(false)
    })

    it('should pass headers to useFetch with authorization', () => {
      renderHook(() =>
        useConversationManagerFetch({
          stream: true,
          headers: { 'X-Custom': 'value' },
          token: 'auth-token',
        })
      )

      expect(useFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'X-Custom': 'value',
            Authorization: 'Bearer auth-token',
          },
        })
      )
    })

    it('should handle missing token', () => {
      renderHook(() =>
        useConversationManagerFetch({
          stream: false,
          headers: {},
        })
      )

      expect(useFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {},
        })
      )
    })

    it('should spread additional props to useFetch', () => {
      renderHook(() =>
        useConversationManagerFetch({
          stream: true,
          baseUrl: 'https://api.example.com',
          timeout: 5000,
        })
      )

      expect(useFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'https://api.example.com',
          timeout: 5000,
        })
      )
    })
  })

  describe('fetch function', () => {
    it('should call underlying fetch with authorization header', async () => {
      mockFetch.mockResolvedValue({ data: { result: 'ok' } })

      const { result } = renderHook(() =>
        useConversationManagerFetch({
          stream: false,
          token: 'my-token',
        })
      )

      await result.current.fetch('/api/test', {})

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer my-token',
          },
        })
      )
    })

    it('should allow token override in options', async () => {
      mockFetch.mockResolvedValue({ data: { result: 'ok' } })

      const { result } = renderHook(() =>
        useConversationManagerFetch({
          stream: false,
          token: 'default-token',
        })
      )

      await result.current.fetch('/api/test', { token: 'override-token' })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer override-token',
          },
        })
      )
    })

    it('should use custom endpoint when provided', async () => {
      const customEndpoint = jest.fn().mockResolvedValue({ data: 'custom' })

      const { result } = renderHook(() =>
        useConversationManagerFetch({
          stream: false,
        })
      )

      await result.current.fetch('/api/test', { endpoint: customEndpoint })

      expect(customEndpoint).toHaveBeenCalled()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should merge headers from options', async () => {
      mockFetch.mockResolvedValue({ data: 'ok' })

      const { result } = renderHook(() =>
        useConversationManagerFetch({
          stream: false,
          token: 'token',
        })
      )

      await result.current.fetch('/api/test', {
        headers: { 'X-Custom': 'value' },
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
            'X-Custom': 'value',
          }),
        })
      )
    })

    it('should remove endpoint from options before passing to fetch', async () => {
      const customEndpoint = jest.fn().mockResolvedValue({ data: 'ok' })

      const { result } = renderHook(() =>
        useConversationManagerFetch({
          stream: false,
        })
      )

      await result.current.fetch('/api/test', {
        endpoint: customEndpoint,
        otherOption: 'value',
      })

      expect(customEndpoint).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          endpoint: undefined,
          otherOption: 'value',
        })
      )
    })
  })

  describe('fetchStream function', () => {
    it('should throw error when errorType is missing', async () => {
      const { result } = renderHook(() =>
        useConversationManagerFetch({
          stream: true,
        })
      )

      await expect(
        result.current.fetchStream('/api/stream', { returnType: 'data' })
      ).rejects.toThrow('errorType is required')
    })

    it('should throw error when returnType is missing', async () => {
      const { result } = renderHook(() =>
        useConversationManagerFetch({
          stream: true,
        })
      )

      await expect(
        result.current.fetchStream('/api/stream', { errorType: 'error' })
      ).rejects.toThrow('returnType is required')
    })

    it('should handle error response', async () => {
      mockFetch.mockResolvedValue({
        error: 'Request failed',
        code: 400,
      })

      const { result } = renderHook(() =>
        useConversationManagerFetch({
          stream: true,
        })
      )

      const stream = await result.current.fetchStream('/api/stream', {
        errorType: 'error',
        returnType: 'data',
      })

      const messages = []

      for await (const message of stream) {
        messages.push(message)
      }

      expect(messages).toEqual([
        {
          type: 'error',
          data: { error: 'Request failed', code: 400 },
        },
      ])
    })

    it('should stream jsonl response when streaming is enabled', async () => {
      const mockBody = { readable: true }

      mockFetch.mockResolvedValue({ data: mockBody })

      const mockMessages = [
        { type: 'token', data: 'hello' },
        { type: 'token', data: 'world' },
      ]

      jsonl.mockReturnValue(
        (async function* () {
          yield* mockMessages
        })()
      )

      const { result } = renderHook(() =>
        useConversationManagerFetch({
          stream: true,
        })
      )

      const stream = await result.current.fetchStream('/api/stream', {
        errorType: 'error',
        returnType: 'data',
      })

      const messages = []

      for await (const message of stream) {
        messages.push(message)
      }

      expect(jsonl).toHaveBeenCalledWith(mockBody)
      expect(messages).toEqual(mockMessages)
    })

    it('should return single json response when streaming is disabled', async () => {
      mockFetch.mockResolvedValue({ data: { result: 'complete' } })

      const { result } = renderHook(() =>
        useConversationManagerFetch({
          stream: false,
        })
      )

      const stream = await result.current.fetchStream('/api/data', {
        errorType: 'error',
        returnType: 'success',
      })

      const messages = []

      for await (const message of stream) {
        messages.push(message)
      }

      expect(messages).toEqual([
        {
          type: 'success',
          data: { result: 'complete' },
        },
      ])
    })

    it('should use custom endpoint for streaming', async () => {
      const customEndpoint = jest
        .fn()
        .mockResolvedValue({ data: { result: 'ok' } })

      const { result } = renderHook(() =>
        useConversationManagerFetch({
          stream: false,
        })
      )

      const stream = await result.current.fetchStream('/api/stream', {
        errorType: 'error',
        returnType: 'data',
        endpoint: customEndpoint,
      })

      const messages = []

      for await (const message of stream) {
        messages.push(message)
      }

      expect(customEndpoint).toHaveBeenCalled()
      expect(messages).toEqual([{ type: 'data', data: { result: 'ok' } }])
    })

    it('should set correct Accept header for streaming', async () => {
      mockFetch.mockResolvedValue({ data: {} })

      const { result } = renderHook(() =>
        useConversationManagerFetch({
          stream: true,
        })
      )

      await result.current.fetchStream('/api/stream', {
        errorType: 'error',
        returnType: 'data',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/stream',
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/jsonl',
          }),
        })
      )
    })

    it('should set correct dataType for streaming', async () => {
      mockFetch.mockResolvedValue({ data: {} })

      const { result } = renderHook(() =>
        useConversationManagerFetch({
          stream: true,
        })
      )

      await result.current.fetchStream('/api/stream', {
        errorType: 'error',
        returnType: 'data',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/stream',
        expect.objectContaining({
          dataType: 'body',
        })
      )
    })

    it('should handle custom endpoint with streaming enabled', async () => {
      const mockMessages = [
        { type: 'token', data: 'test' },
        { type: 'complete', data: {} },
      ]
      const customEndpoint = jest.fn().mockResolvedValue({ data: mockMessages })

      const { result } = renderHook(() =>
        useConversationManagerFetch({
          stream: true,
        })
      )

      const stream = await result.current.fetchStream('/api/stream', {
        errorType: 'error',
        returnType: 'data',
        endpoint: customEndpoint,
      })

      const messages = []

      for await (const message of stream) {
        messages.push(message)
      }

      expect(messages).toEqual(mockMessages)
    })
  })

  describe('humanizeJsonl', () => {
    it('should rate limit token messages', async () => {
      const mockBody = { stream: true }
      const mockMessages = [
        { type: 'token', data: 'a' },
        { type: 'token', data: 'b' },
        { type: 'complete', data: {} },
      ]

      jsonl.mockReturnValue(
        (async function* () {
          yield* mockMessages
        })()
      )

      const tps = 10

      rateLimitWithCondition.mockReturnValue(
        (async function* () {
          yield* mockMessages
        })()
      )

      const stream = humanizeJsonl(mockBody, tps)
      const messages = []

      for await (const message of stream) {
        messages.push(message)
      }

      expect(rateLimitWithCondition).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Function),
        { messagesPerSecond: tps }
      )
    })

    it('should only rate limit messages of type token', async () => {
      const mockBody = {}
      const mockMessages = [{ type: 'token' }, { type: 'other' }]

      jsonl.mockReturnValue(
        (async function* () {
          yield* mockMessages
        })()
      )

      rateLimitWithCondition.mockReturnValue(
        (async function* () {
          yield* mockMessages
        })()
      )

      const stream = humanizeJsonl(mockBody, 5)

      for await (const _ of stream) {
        // consume stream
      }

      const conditionFn = rateLimitWithCondition.mock.calls[0][1]

      expect(conditionFn({ type: 'token' })).toBe(true)
      expect(conditionFn({ type: 'other' })).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle undefined token gracefully', async () => {
      mockFetch.mockResolvedValue({ data: 'ok' })

      const { result } = renderHook(() =>
        useConversationManagerFetch({
          stream: false,
        })
      )

      await result.current.fetch('/api/test', {})

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: {},
        })
      )
    })

    it('should handle null headers', async () => {
      mockFetch.mockResolvedValue({ data: 'ok' })

      const { result } = renderHook(() =>
        useConversationManagerFetch({
          stream: false,
          headers: null,
        })
      )

      await result.current.fetch('/api/test', {})

      expect(mockFetch).toHaveBeenCalled()
    })

    it('should handle fetchStream with tps parameter', async () => {
      const mockBody = {}

      mockFetch.mockResolvedValue({ data: mockBody })

      jsonl.mockReturnValue(
        (async function* () {
          yield { type: 'token', data: 'test' }
        })()
      )

      rateLimitWithCondition.mockReturnValue(
        (async function* () {
          yield { type: 'token', data: 'test' }
        })()
      )

      const { result } = renderHook(() =>
        useConversationManagerFetch({
          stream: true,
          tps: 20,
        })
      )

      const stream = await result.current.fetchStream('/api/stream', {
        errorType: 'error',
        returnType: 'data',
      })

      for await (const _ of stream) {
        // consume stream
      }

      expect(rateLimitWithCondition).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Function),
        { messagesPerSecond: 20 }
      )
    })

    it('should remove endpoint property from options', async () => {
      mockFetch.mockResolvedValue({ data: 'ok' })

      const { result } = renderHook(() =>
        useConversationManagerFetch({
          stream: false,
        })
      )

      await result.current.fetch('/api/test', {
        endpoint: mockFetch,
        param: 'value',
      })

      const callArgs = mockFetch.mock.calls[0][1]

      expect(callArgs.endpoint).toBeUndefined()
      expect(callArgs.param).toBe('value')
    })
  })
})
