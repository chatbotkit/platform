/* eslint-disable @typescript-eslint/no-require-imports */
import { FetchError } from '@/lib/fetch'

import {
  HANDLER_NAME_HEADER,
  authenticatedHandler,
  authenticatedMultiHandler,
  handler,
  multiHandler,
} from './auxiliary.handler'

import { FetchError as SdkFetchError } from '@chatbotkit/fetch'

import z from 'zod'

jest.mock('@/lib/stream', () => ({
  withStream: jest.fn((fn) => {
    return async (request, ...args) => {
      const stream = {
        result: jest.fn(async (data) => {
          stream._result = data
        }),
        error: jest.fn(async (error) => {
          stream._error = error
        }),
        _result: undefined,
        _error: undefined,
      }

      await fn(request, stream, ...args)

      return stream
    }
  }),
}))

jest.mock('@/lib/method', () => ({
  withAny: jest.fn((fn) => fn),
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: jest.fn((fn) => {
    return async (request, ...args) => {
      const mockSession = { userId: 'test-user-id' }

      return await fn(request, ...args, mockSession)
    }
  }),
}))

jest.mock('@/lib/response', () => ({
  captureUnknownException: jest.fn(),
}))

describe('auxiliary.handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('handler', () => {
    describe('GET requests', () => {
      it('should return schema when accept header is application/schema+json', async () => {
        const schema = z.object({
          name: z.string(),
          age: z.number(),
        })

        const testHandler = handler(schema, async () => {
          return { success: true }
        })

        const request = {
          method: 'GET',
          headers: {
            get: jest.fn((name) =>
              name === 'accept' ? 'application/schema+json' : null
            ),
          },
        }

        const result = await testHandler(request)

        // stream.result is called twice - first with schema, then with {}
        expect(result._result).toEqual({})
      })

      it('should return empty object for GET without schema accept header', async () => {
        const schema = z.object({})

        const testHandler = handler(schema, async () => {
          return { success: true }
        })

        const request = {
          method: 'GET',
          headers: {
            get: jest.fn(() => null),
          },
        }

        const result = await testHandler(request)

        expect(result._result).toEqual({})
      })
    })

    describe('POST requests', () => {
      it('should process valid input and return result', async () => {
        const schema = z.object({
          name: z.string(),
          age: z.number(),
        })

        const mockFn = jest.fn(async (params) => {
          return { processed: true, ...params }
        })

        const testHandler = handler(schema, mockFn)

        const request = {
          method: 'POST',
          headers: {
            get: jest.fn(() => null),
          },
          json: jest.fn(async () => ({
            name: 'Alice',
            age: 30,
          })),
        }

        const result = await testHandler(request)

        expect(mockFn).toHaveBeenCalledWith(
          { name: 'Alice', age: 30 },
          expect.any(Object)
        )
        expect(result._result).toEqual({
          processed: true,
          name: 'Alice',
          age: 30,
        })
      })

      it('should handle validation errors', async () => {
        const schema = z.object({
          name: z.string(),
          age: z.number(),
        })

        const testHandler = handler(schema, async () => {
          return { success: true }
        })

        const request = {
          method: 'POST',
          headers: {
            get: jest.fn(() => null),
          },
          json: jest.fn(async () => ({
            name: 'Alice',
            age: 'invalid',
          })),
        }

        const result = await testHandler(request)

        expect(result._error).toBeDefined()
      })

      it('should handle FetchError without capturing exception', async () => {
        const { captureUnknownException } = require('@/lib/response')
        const schema = z.object({ name: z.string() })

        const testHandler = handler(schema, async () => {
          throw new FetchError('API error', { status: 500 })
        })

        const request = {
          method: 'POST',
          headers: { get: jest.fn(() => null) },
          json: jest.fn(async () => ({ name: 'Test' })),
        }

        const result = await testHandler(request)

        expect(result._error).toBeInstanceOf(FetchError)
        expect(captureUnknownException).not.toHaveBeenCalled()
      })

      it('should handle SDK FetchError without capturing exception', async () => {
        const { captureUnknownException } = require('@/lib/response')
        const schema = z.object({ name: z.string() })

        const sdkError = new SdkFetchError('Not found', 'GENERIC_ERROR')

        const testHandler = handler(schema, async () => {
          throw sdkError
        })

        const request = {
          method: 'POST',
          headers: { get: jest.fn(() => null) },
          json: jest.fn(async () => ({ name: 'Test' })),
        }

        const result = await testHandler(request)

        expect(result._error).toBe(sdkError)
        expect(captureUnknownException).not.toHaveBeenCalled()
      })

      it('should capture non-FetchError exceptions', async () => {
        const { captureUnknownException } = require('@/lib/response')
        const schema = z.object({ name: z.string() })
        const testError = new Error('Unexpected error')

        const testHandler = handler(schema, async () => {
          throw testError
        })

        const request = {
          method: 'POST',
          headers: { get: jest.fn(() => null) },
          json: jest.fn(async () => ({ name: 'Test' })),
        }

        const result = await testHandler(request)

        expect(result._error).toBe(testError)
        expect(captureUnknownException).toHaveBeenCalledWith(testError)
      })
    })
  })

  describe('authenticatedHandler', () => {
    it('should pass session to handler function', async () => {
      const schema = z.object({ name: z.string() })
      const mockFn = jest.fn(async (session, params) => {
        return { userId: session.userId, ...params }
      })

      const testHandler = authenticatedHandler(schema, mockFn)

      const request = {
        method: 'POST',
        headers: { get: jest.fn(() => null) },
        json: jest.fn(async () => ({ name: 'Alice' })),
      }

      const result = await testHandler(request)

      expect(mockFn).toHaveBeenCalledWith(
        { userId: 'test-user-id' },
        { name: 'Alice' },
        expect.any(Object)
      )
      expect(result._result).toEqual({
        userId: 'test-user-id',
        name: 'Alice',
      })
    })

    it('should return schema for GET with accept header', async () => {
      const schema = z.object({ value: z.number() })

      const testHandler = authenticatedHandler(schema, async () => {
        return { success: true }
      })

      const request = {
        method: 'GET',
        headers: {
          get: jest.fn((name) =>
            name === 'accept' ? 'application/schema+json' : null
          ),
        },
      }

      const result = await testHandler(request)

      // stream.result is called twice - first with schema, then with {}
      expect(result._result).toEqual({})
    })
  })

  describe('multiHandler', () => {
    it('should route to correct handler based on header', async () => {
      const handlers = {
        createUser: {
          schema: z.object({ name: z.string() }),
          fn: jest.fn(async (params) => ({ created: true, ...params })),
        },
        deleteUser: {
          schema: z.object({ id: z.string() }),
          fn: jest.fn(async (params) => ({ deleted: true, ...params })),
        },
      }

      const testHandler = multiHandler(handlers)

      const request = {
        method: 'POST',
        headers: {
          get: jest.fn((name) =>
            name === HANDLER_NAME_HEADER ? 'createUser' : null
          ),
        },
        json: jest.fn(async () => ({ name: 'Bob' })),
      }

      const result = await testHandler(request)

      expect(handlers.createUser.fn).toHaveBeenCalledWith(
        { name: 'Bob' },
        expect.any(Object)
      )
      expect(handlers.deleteUser.fn).not.toHaveBeenCalled()
      expect(result._result).toEqual({ created: true, name: 'Bob' })
    })

    it('should return error when handler name header is missing', async () => {
      const handlers = {
        test: {
          schema: z.object({}),
          fn: jest.fn(),
        },
      }

      const testHandler = multiHandler(handlers)

      const request = {
        method: 'POST',
        headers: { get: jest.fn(() => null) },
        json: jest.fn(async () => ({})),
      }

      const result = await testHandler(request)

      expect(result._error).toBeInstanceOf(Error)
      expect(result._error.message).toContain(HANDLER_NAME_HEADER)
    })

    it('should return error when handler name is unknown', async () => {
      const handlers = {
        validHandler: {
          schema: z.object({}),
          fn: jest.fn(),
        },
      }

      const testHandler = multiHandler(handlers)

      const request = {
        method: 'POST',
        headers: {
          get: jest.fn((name) =>
            name === HANDLER_NAME_HEADER ? 'unknownHandler' : null
          ),
        },
        json: jest.fn(async () => ({})),
      }

      const result = await testHandler(request)

      expect(result._error).toBeInstanceOf(Error)
      expect(result._error.message).toContain('Unknown handler')
    })

    it('should return schema map for GET with schema accept header', async () => {
      const handlers = {
        handler1: {
          schema: z.object({ a: z.string() }),
          fn: jest.fn(),
        },
        handler2: {
          schema: z.object({ b: z.number() }),
          fn: jest.fn(),
        },
      }

      const testHandler = multiHandler(handlers)

      const request = {
        method: 'GET',
        headers: {
          get: jest.fn((name) =>
            name === 'accept' ? 'application/schema+json' : null
          ),
        },
      }

      const result = await testHandler(request)

      // stream.result is called twice - first with schemaMap, then with {}
      expect(result._result).toEqual({})
    })
  })

  describe('authenticatedMultiHandler', () => {
    it('should pass session to routed handler', async () => {
      const handlers = {
        testHandler: {
          schema: z.object({ value: z.string() }),
          fn: jest.fn(async (session, params) => {
            return { userId: session.userId, ...params }
          }),
        },
      }

      const testHandler = authenticatedMultiHandler(handlers)

      const request = {
        method: 'POST',
        headers: {
          get: jest.fn((name) =>
            name === HANDLER_NAME_HEADER ? 'testHandler' : null
          ),
        },
        json: jest.fn(async () => ({ value: 'test' })),
      }

      const result = await testHandler(request)

      expect(handlers.testHandler.fn).toHaveBeenCalledWith(
        { userId: 'test-user-id' },
        { value: 'test' },
        expect.any(Object)
      )
      expect(result._result).toEqual({
        userId: 'test-user-id',
        value: 'test',
      })
    })

    it('should handle missing handler name header', async () => {
      const handlers = {
        test: {
          schema: z.object({}),
          fn: jest.fn(),
        },
      }

      const testHandler = authenticatedMultiHandler(handlers)

      const request = {
        method: 'POST',
        headers: { get: jest.fn(() => null) },
        json: jest.fn(async () => ({})),
      }

      const result = await testHandler(request)

      expect(result._error).toBeInstanceOf(Error)
      expect(result._error.message).toContain(HANDLER_NAME_HEADER)
    })
  })
})
