import { fetchPlusPlus } from '@/lib/fetch'
import { either } from '@/lib/helpers'
import toast from '@/lib/toast'
import { isURL, joinPathsAndGetPathname } from '@/lib/url'

import useRouter from '@/hooks/useRouter'

import useFetch from './useFetch'

import { act, renderHook } from '@testing-library/react'

jest.mock('@/lib/fetch', () => ({
  fetchPlusPlus: jest.fn(),
  TIMEOUT_ERROR_NAME: 'TimeoutError',
}))

jest.mock('@/lib/toast', () => ({
  loading: jest.fn(() => 'toast-id-123'),
  success: jest.fn(),
  error: jest.fn(),
  dismiss: jest.fn(),
}))

jest.mock('@/hooks/useRouter', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    basePath: '',
    resolveHref: jest.fn((url) => url),
  })),
}))

jest.mock('@/lib/helpers', () => ({
  either: jest.fn((a, b) => (a !== undefined ? a : b)),
}))

jest.mock('@/lib/response', () => ({
  statusToCodeMap: {
    304: 'NOT_MODIFIED',
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    500: 'INTERNAL_SERVER_ERROR',
  },
  statusToMessageMap: {
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
  },
  TIMEOUT_CODE: 'TIMEOUT',
  SERVICE_UNAVAILABLE_CODE: 'SERVICE_UNAVAILABLE',
}))

const mockCaptureException = jest.fn()

jest.mock('@/lib/error', () => ({
  captureException: (...args) => mockCaptureException(...args),
}))

jest.mock('@/lib/url', () => ({
  isURL: jest.fn((url) => url.startsWith('http')),
  joinPathsAndGetPathname: jest.fn((base, path) => `${base}${path}`),
}))

describe('useFetch', () => {
  const mockRouter = {
    basePath: '',
    resolveHref: jest.fn((url) => url),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    useRouter.mockReturnValue(mockRouter)
    either.mockImplementation((a, b) => (a !== undefined ? a : b))
    isURL.mockImplementation((url) => url.startsWith('http'))
    joinPathsAndGetPathname.mockImplementation((base, path) => `${base}${path}`)
  })

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useFetch())

      expect(result.current.loading).toBe(false)
      expect(result.current.streaming).toBe(false)
      expect(result.current.error).toBe(null)
      expect(result.current.code).toBe(null)
      expect(result.current.data).toEqual({})
      expect(typeof result.current.fetch).toBe('function')
      expect(typeof result.current.reportError).toBe('function')
    })

    it('should initialize with custom options', () => {
      const options = {
        trackLoading: false,
        trackStreaming: false,
        loadingMessage: 'Custom loading...',
        failureMessage: 'Custom error',
        successMessage: 'Custom success',
        timeout: 5000,
        retries: 3,
        dataType: 'text',
      }

      const { result } = renderHook(() => useFetch(options))

      expect(result.current.loading).toBe(false)
      expect(result.current.streaming).toBe(false)
      expect(result.current.error).toBe(null)
      expect(result.current.code).toBe(null)
      expect(result.current.data).toEqual({})
    })
  })

  describe('successful fetch operations', () => {
    it('should handle successful JSON response', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ message: 'Success' }),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useFetch())

      await act(async () => {
        const response = await result.current.fetch('/api/test')

        expect(response).toEqual({
          data: { message: 'Success' },
          error: undefined,
          code: undefined,
        })
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe(null)
      expect(result.current.data).toEqual({ message: 'Success' })
    })

    it('should handle different dataType values', async () => {
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue('Plain text response'),
        json: jest.fn().mockResolvedValue({ data: 'json' }),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      // Test text dataType
      const { result } = renderHook(() => useFetch({ dataType: 'text' }))

      await act(async () => {
        await result.current.fetch('/api/test')
      })

      expect(mockResponse.text).toHaveBeenCalled()
      expect(result.current.data).toBe('Plain text response')
    })

    it('should handle body dataType with streaming', async () => {
      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new Uint8Array([1, 2, 3]),
          })
          .mockResolvedValueOnce({ done: true }),
      }

      const mockResponse = {
        ok: true,
        body: {
          getReader: jest.fn(() => mockReader),
        },
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      const { result } = renderHook(() =>
        useFetch({
          dataType: 'body',
          trackStreaming: true,
          streamingMessage: 'Processing...',
        })
      )

      await act(async () => {
        await result.current.fetch('/api/stream')
      })

      expect(mockResponse.body.getReader).toHaveBeenCalled()
      expect(result.current.data).toBeInstanceOf(ReadableStream)
      expect(toast.loading).toHaveBeenCalledWith(
        'Processing...',
        expect.any(Object)
      )
    })
  })

  describe('error handling', () => {
    it('should handle HTTP error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: jest
          .fn()
          .mockResolvedValue(
            '{"message": "Bad Request", "code": "BAD_REQUEST"}'
          ),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useFetch({ failureMessage: true }))

      await act(async () => {
        const response = await result.current.fetch('/api/error')

        expect(response).toEqual({
          data: '{"message": "Bad Request", "code": "BAD_REQUEST"}', // Raw text data is returned
          error: 'Bad Request',
          code: 'BAD_REQUEST',
        })
      })

      expect(result.current.error).toBe('Bad Request')
      expect(result.current.code).toBe('BAD_REQUEST')
      // Error toasts use undefined ID when no loading message is shown
      expect(toast.error).toHaveBeenCalledWith(
        'Bad Request',
        expect.objectContaining({
          duration: 6000,
        })
      )
    })

    it('should handle transport-level network errors without rejecting', async () => {
      // @note a driver rejection (e.g. mobile Safari/WKWebView `TypeError: Load
      // failed`) must be folded into the hook's `{ data, error, code }` contract
      // rather than propagating to the global `unhandledrejection` handler
      //.
      const networkError = new TypeError('Load failed')

      fetchPlusPlus.mockRejectedValue(networkError)

      const { result } = renderHook(() => useFetch())

      let response

      await act(async () => {
        response = await result.current.fetch('/api/test')
      })

      expect(response).toEqual({
        data: {},
        error:
          'There was a problem reaching the server. Please check your connection and try again.',
        code: 'SERVICE_UNAVAILABLE',
      })

      expect(result.current.error).toBe(
        'There was a problem reaching the server. Please check your connection and try again.'
      )
      expect(result.current.code).toBe('SERVICE_UNAVAILABLE')

      // @note the transport error is surfaced through state/return, not thrown
      // to Sentry as an exception - callers decide how to react.
      expect(mockCaptureException).not.toHaveBeenCalled()
    })

    it('should show a failure toast for a transport error when enabled', async () => {
      fetchPlusPlus.mockRejectedValue(new TypeError('Load failed'))

      const { result } = renderHook(() => useFetch({ failureMessage: true }))

      await act(async () => {
        await result.current.fetch('/api/test')
      })

      expect(toast.error).toHaveBeenCalledWith(
        'There was a problem reaching the server. Please check your connection and try again.',
        expect.objectContaining({ duration: 6000 })
      )
      expect(result.current.loading).toBe(false)
    })

    it('should map a driver timeout to a TIMEOUT error result', async () => {
      const timeoutError = new Error('TimeoutError')

      timeoutError.name = 'TimeoutError'

      fetchPlusPlus.mockRejectedValue(timeoutError)

      const { result } = renderHook(() => useFetch())

      let response

      await act(async () => {
        response = await result.current.fetch('/api/test')
      })

      expect(response).toEqual({
        data: {},
        error: 'The request timed out. Please try again.',
        code: 'TIMEOUT',
      })
      expect(result.current.code).toBe('TIMEOUT')
    })

    it('should handle JSON parsing errors in error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Invalid JSON response'),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useFetch())

      await act(async () => {
        await result.current.fetch('/api/error')
      })

      expect(result.current.error).toBe(
        'There was an unexpected error. Please contact our support team for more information!'
      )
      expect(result.current.code).toBe('INTERNAL_SERVER_ERROR')
    })

    it('should handle HTTP 304 Not Modified with empty body', async () => {
      // @note HTTP 304 responses have no body per the spec, which causes
      // JSON.parse('') to throw "Unexpected end of JSON input"
      const mockResponse = {
        ok: false,
        status: 304,
        statusText: 'Not Modified',
        text: jest.fn().mockResolvedValue(''),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)
      mockCaptureException.mockClear()

      const { result } = renderHook(() => useFetch())

      await act(async () => {
        const response = await result.current.fetch('/api/test')

        expect(response).toEqual({
          data: '',
          error: 'Not Modified',
          code: 'NOT_MODIFIED',
        })
      })

      expect(result.current.error).toBe('Not Modified')
      expect(result.current.code).toBe('NOT_MODIFIED')
      // Should NOT call captureException for expected empty-body responses
      expect(mockCaptureException).not.toHaveBeenCalled()
    })

    it('should capture exception with request context when JSON parsing fails', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue('Invalid JSON response'),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)
      mockCaptureException.mockClear()

      const { result } = renderHook(() => useFetch())

      await act(async () => {
        await result.current.fetch('/api/test-endpoint')
      })

      expect(mockCaptureException).toHaveBeenCalledTimes(1)

      const capturedError = mockCaptureException.mock.calls[0][0]

      // The error should have a data property with request context
      expect(capturedError.data).toBeDefined()
      expect(capturedError.data.url).toBe('/api/test-endpoint')
      expect(capturedError.data.status).toBe(500)
      expect(capturedError.data.statusText).toBe('Internal Server Error')
      expect(capturedError.data.responseBody).toBe('Invalid JSON response')
    })

    it('should handle HTML error responses without calling captureException', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest
          .fn()
          .mockResolvedValue(
            '<!DOCTYPE html><html><body>Internal Server Error</body></html>'
          ),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)
      mockCaptureException.mockClear()

      const { result } = renderHook(() => useFetch())

      await act(async () => {
        const response = await result.current.fetch('/api/error')

        expect(response.error).toBeDefined()
      })

      // Should NOT call captureException for HTML error pages (e.g. from server returning error HTML)
      expect(mockCaptureException).not.toHaveBeenCalled()
      expect(result.current.code).toBe('INTERNAL_SERVER_ERROR')
    })

    it('should capture exception with request context when response parsing fails on success', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockRejectedValue(new Error('Unexpected token')),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)
      mockCaptureException.mockClear()

      const { result } = renderHook(() => useFetch())

      await act(async () => {
        await result.current.fetch('/api/broken-json')
      })

      expect(mockCaptureException).toHaveBeenCalledTimes(1)

      const capturedError = mockCaptureException.mock.calls[0][0]

      expect(capturedError.data).toBeDefined()
      expect(capturedError.data.url).toBe('/api/broken-json')
      expect(capturedError.data.status).toBe(200)
    })
  })

  describe('toast notifications', () => {
    it('should show loading toast when loadingMessage is enabled', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      const { result } = renderHook(() =>
        useFetch({
          loadingMessage: 'Fetching data...',
          loadingMessageDuration: 5000,
        })
      )

      await act(async () => {
        await result.current.fetch('/api/test')
      })

      expect(toast.loading).toHaveBeenCalledWith('Fetching data...', {
        id: undefined,
        duration: 5000,
      })
    })

    it('should show success toast when successMessage is enabled', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ message: 'Operation complete' }),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      // Mock toast.loading to return a toast ID
      toast.loading.mockReturnValue('loading-toast-id')

      const { result } = renderHook(() =>
        useFetch({
          successMessage: true,
          successMessageDuration: 2000,
          loadingMessage: true, // Need a loading message to get the toast ID
        })
      )

      await act(async () => {
        await result.current.fetch('/api/test')
      })

      // When successMessage is true, it uses data.message or 'Success' as fallback
      expect(toast.success).toHaveBeenCalledWith('Operation complete', {
        id: 'loading-toast-id', // Should use the toast ID from loading toast
        duration: 2000,
      })
    })

    it('should show default success message when data has no message', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      // Mock toast.loading to return a toast ID
      toast.loading.mockReturnValue('loading-toast-id')

      const { result } = renderHook(() =>
        useFetch({
          successMessage: true,
          loadingMessage: true, // Enable loading message so toast ID is set
        })
      )

      await act(async () => {
        await result.current.fetch('/api/test')
      })

      expect(toast.success).toHaveBeenCalledWith('Success', {
        id: 'loading-toast-id',
        duration: 3000,
      })
    })

    it('should show custom success message when provided', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      const { result } = renderHook(() =>
        useFetch({
          successMessage: 'Custom success message',
        })
      )

      await act(async () => {
        await result.current.fetch('/api/test')
      })

      expect(toast.success).toHaveBeenCalledWith(
        'Custom success message',
        expect.any(Object)
      )
    })

    it('should dismiss toast when no message options are set', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useFetch())

      await act(async () => {
        await result.current.fetch('/api/test')
      })

      expect(toast.dismiss).toHaveBeenCalled()
    })
  })

  describe('URL resolution', () => {
    it('should handle absolute URLs', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useFetch())

      await act(async () => {
        await result.current.fetch('https://api.example.com/test')
      })

      expect(fetchPlusPlus).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.any(Object)
      )
    })

    it('should resolve relative URLs with basePrefix', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      // Mock router.resolveHref to return the processed URL
      mockRouter.resolveHref.mockReturnValue('/api/v1/users')

      const { result } = renderHook(() => useFetch({ basePrefix: '/api/v1' }))

      await act(async () => {
        await result.current.fetch('/users')
      })

      expect(joinPathsAndGetPathname).toHaveBeenCalledWith('/api/v1', '/users')
      expect(mockRouter.resolveHref).toHaveBeenCalled()
      expect(fetchPlusPlus).toHaveBeenCalledWith(
        '/api/v1/users',
        expect.any(Object)
      )
    })

    it('should resolve relative URLs with basePath', async () => {
      mockRouter.basePath = '/app'
      mockRouter.resolveHref.mockReturnValue('/app/api/test')

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useFetch())

      await act(async () => {
        await result.current.fetch('/api/test')
      })

      expect(joinPathsAndGetPathname).toHaveBeenCalledWith('/app', '/api/test')
      expect(fetchPlusPlus).toHaveBeenCalledWith(
        '/app/api/test',
        expect.any(Object)
      )
    })

    it('should handle URLs starting with "!" to skip basePrefix/basePath', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useFetch({ basePrefix: '/api/v1' }))

      await act(async () => {
        await result.current.fetch('!/direct/api/call')
      })

      // resolveHref should NOT be called for "!" URLs - they skip all processing
      expect(mockRouter.resolveHref).not.toHaveBeenCalled()
      // basePrefix should not be used when URL starts with "!"
      expect(joinPathsAndGetPathname).not.toHaveBeenCalledWith(
        '/api/v1',
        expect.anything()
      )
      expect(fetchPlusPlus).toHaveBeenCalledWith(
        '/direct/api/call',
        expect.any(Object)
      )
    })
  })

  describe('headers and request options', () => {
    beforeEach(() => {
      // Reset router mocks for each test - just use resolveHref as identity
      mockRouter.basePath = ''
      mockRouter.resolveHref.mockImplementation((url) => url)
    })

    it('should merge custom headers with default headers', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      const { result } = renderHook(() =>
        useFetch({
          headers: { Authorization: 'Bearer token' },
        })
      )

      await act(async () => {
        await result.current.fetch('/api/test', {
          headers: { 'Content-Type': 'application/json' },
        })
      })

      expect(fetchPlusPlus).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
            'Content-Type': 'application/json',
          }),
        })
      )
    })

    it('should remove undefined header values', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useFetch())

      await act(async () => {
        await result.current.fetch('/api/test', {
          headers: {
            'Valid-Header': 'value',
            'Undefined-Header': undefined,
          },
        })
      })

      const callArgs = fetchPlusPlus.mock.calls[0][1]

      expect(callArgs.headers).toHaveProperty('Valid-Header', 'value')
      expect(callArgs.headers).not.toHaveProperty('Undefined-Header')
    })

    it('should set X-Requested-With header when xRequestedWith is provided', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      const { result } = renderHook(() =>
        useFetch({ xRequestedWith: 'CustomApp' })
      )

      await act(async () => {
        await result.current.fetch('/api/test')
      })

      expect(fetchPlusPlus).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Requested-With': 'CustomApp',
          }),
        })
      )
    })

    it('should handle data option by converting to JSON and setting method to POST', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useFetch())

      const requestData = { name: 'John', age: 30 }

      await act(async () => {
        await result.current.fetch('/api/create', {
          data: requestData,
        })
      })

      expect(fetchPlusPlus).toHaveBeenCalledWith(
        '/api/create',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestData),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
    })

    it('should preserve existing method when data is provided', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useFetch())

      await act(async () => {
        await result.current.fetch('/api/update', {
          method: 'PUT',
          data: { id: 1, name: 'Updated' },
        })
      })

      expect(fetchPlusPlus).toHaveBeenCalledWith(
        '/api/update',
        expect.objectContaining({
          method: 'PUT',
        })
      )
    })
  })

  describe('timeout and retry settings', () => {
    beforeEach(() => {
      mockRouter.resolveHref.mockImplementation((url) => url)
    })

    it('should pass timeout and retry settings to fetch driver', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      const { result } = renderHook(() =>
        useFetch({
          timeout: 10000,
          retries: 3,
          retryDelay: 1000,
        })
      )

      await act(async () => {
        await result.current.fetch('/api/test')
      })

      expect(fetchPlusPlus).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          timeout: 10000,
          retries: 3,
          retryDelay: 1000,
        })
      )
    })

    it('should allow per-request override of timeout and retry settings', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      const { result } = renderHook(() =>
        useFetch({
          timeout: 5000,
          retries: 2,
        })
      )

      await act(async () => {
        await result.current.fetch('/api/test', {
          timeout: 15000,
          retries: 5,
        })
      })

      const callArgs = fetchPlusPlus.mock.calls[0][1]

      expect(callArgs.timeout).toBe(15000)
      expect(callArgs.retries).toBe(5)
    })
  })

  describe('state management', () => {
    it('should update loading state when trackLoading is true', async () => {
      let resolvePromise
      const mockPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      fetchPlusPlus.mockReturnValue(mockPromise)

      const { result } = renderHook(() => useFetch({ trackLoading: true }))

      expect(result.current.loading).toBe(false)

      act(() => {
        result.current.fetch('/api/test')
      })

      expect(result.current.loading).toBe(true)

      await act(async () => {
        resolvePromise({
          ok: true,
          json: jest.fn().mockResolvedValue({}),
        })
        await mockPromise
      })

      expect(result.current.loading).toBe(false)
    })

    it('should not update loading state when trackLoading is false', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useFetch({ trackLoading: false }))

      expect(result.current.loading).toBe(false)

      await act(async () => {
        await result.current.fetch('/api/test')
      })

      expect(result.current.loading).toBe(false)
    })

    it('should allow manual state updates', () => {
      const { result } = renderHook(() => useFetch())

      act(() => {
        result.current.setLoading(true)
      })

      expect(result.current.loading).toBe(true)

      act(() => {
        result.current.setError('Custom error')
      })

      expect(result.current.error).toBe('Custom error')

      act(() => {
        result.current.setCode('CUSTOM_CODE')
      })

      expect(result.current.code).toBe('CUSTOM_CODE')

      act(() => {
        result.current.setData({ custom: 'data' })
      })

      expect(result.current.data).toEqual({ custom: 'data' })
    })
  })

  describe('reportError function', () => {
    it('should report error with default failure message', async () => {
      const { result } = renderHook(() => useFetch({ failureMessage: true }))

      const error = { message: 'Test error', code: 'TEST_ERROR' }

      await act(async () => {
        await result.current.reportError(error)
      })

      expect(toast.error).toHaveBeenCalledWith('Test error', {
        id: undefined,
        duration: 6000,
      })
    })

    it('should use error code when message is not available', async () => {
      const { result } = renderHook(() => useFetch({ failureMessage: true }))

      const error = { code: 'TEST_ERROR' }

      await act(async () => {
        await result.current.reportError(error)
      })

      expect(toast.error).toHaveBeenCalledWith('TEST_ERROR', expect.any(Object))
    })

    it('should use fallback emoji when neither message nor code is available', async () => {
      const { result } = renderHook(() => useFetch({ failureMessage: true }))

      const error = {}

      await act(async () => {
        await result.current.reportError(error)
      })

      expect(toast.error).toHaveBeenCalledWith('🙁', expect.any(Object))
    })

    it('should not show toast when failureMessage is disabled', async () => {
      const { result } = renderHook(() => useFetch({ failureMessage: false }))

      const error = { message: 'Test error' }

      await act(async () => {
        await result.current.reportError(error)
      })

      expect(toast.error).not.toHaveBeenCalled()
    })

    it('should allow per-call override of failure message option', async () => {
      const { result } = renderHook(() => useFetch({ failureMessage: false }))

      const error = { message: 'Test error' }

      await act(async () => {
        await result.current.reportError(error, { failureMessage: true })
      })

      // The reportError uses the either(options?.failureMessage, failureMessage) to determine
      // if it should show the toast, but always shows the actual error message
      expect(toast.error).toHaveBeenCalledWith('Test error', expect.any(Object))
    })
  })

  describe('custom driver', () => {
    it('should use custom fetch driver when provided', async () => {
      const customDriver = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ custom: true }),
      })

      const { result } = renderHook(() => useFetch({ driver: customDriver }))

      await act(async () => {
        await result.current.fetch('/api/test')
      })

      expect(customDriver).toHaveBeenCalled()
      expect(fetchPlusPlus).not.toHaveBeenCalled()
      expect(result.current.data).toEqual({ custom: true })
    })
  })

  describe('edge cases', () => {
    it('should handle empty response data', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(null),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useFetch())

      await act(async () => {
        const response = await result.current.fetch('/api/test')

        expect(response.data).toBe(null)
      })

      expect(result.current.data).toBe(null)
      expect(toast.dismiss).toHaveBeenCalled()
    })

    it('should handle streaming with trackStreaming disabled', async () => {
      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({ done: false, value: new Uint8Array([1]) })
          .mockResolvedValueOnce({ done: true }),
      }

      const mockResponse = {
        ok: true,
        body: {
          getReader: jest.fn(() => mockReader),
        },
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      const { result } = renderHook(() =>
        useFetch({
          dataType: 'body',
          trackStreaming: false,
        })
      )

      await act(async () => {
        await result.current.fetch('/api/stream')
      })

      expect(result.current.streaming).toBe(false)
    })

    it('should handle toast ID override', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      }

      fetchPlusPlus.mockResolvedValue(mockResponse)

      const { result } = renderHook(() =>
        useFetch({
          loadingMessage: true,
          toastId: 'custom-toast-id',
        })
      )

      await act(async () => {
        await result.current.fetch('/api/test', {
          toastId: 'override-toast-id',
        })
      })

      expect(toast.loading).toHaveBeenCalledWith('Loading...', {
        id: 'override-toast-id',
        duration: Infinity,
      })
    })
  })
})
