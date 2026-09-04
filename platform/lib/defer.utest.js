import debug, { createSpan, warn } from '@/lib/debug'
import {
  awaitDeferred,
  defer,
  deferPastResponse,
  runInDeferred,
} from '@/lib/defer'
import { captureError, captureException } from '@/lib/error'

// @note the runtime hook `defer` uses to keep work alive past the response:
// a request context published under Vercel's well-known global symbol
const waitUntil = jest.fn()

beforeAll(() => {
  global[Symbol.for('@vercel/request-context')] = {
    get: () => ({ waitUntil }),
  }
})

afterAll(() => {
  delete global[Symbol.for('@vercel/request-context')]
})

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(),
  createSpan: jest.fn(() => ({
    finish: jest.fn(),
  })),
  warn: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
  captureException: jest.fn(),
}))

describe('defer module', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('awaitDeferred', () => {
    it('should create and finish a span', async () => {
      const mockSpan = { finish: jest.fn() }

      createSpan.mockReturnValue(mockSpan)

      await awaitDeferred()

      expect(createSpan).toHaveBeenCalledWith({ name: 'awaitDeferred' })
      expect(mockSpan.finish).toHaveBeenCalled()
    })

    it('should finish span even if error occurs', async () => {
      const mockSpan = { finish: jest.fn() }

      createSpan.mockReturnValue(mockSpan)

      await awaitDeferred()

      expect(mockSpan.finish).toHaveBeenCalled()
    })

    it('should handle missing store gracefully', async () => {
      const mockSpan = { finish: jest.fn() }

      createSpan.mockReturnValue(mockSpan)

      await awaitDeferred()

      expect(mockSpan.finish).toHaveBeenCalled()
      expect(debug).not.toHaveBeenCalled()
    })

    it('should await all deferred promises when store exists', async () => {
      const mockSpan = { finish: jest.fn() }

      createSpan.mockReturnValue(mockSpan)

      const promise1 = Promise.resolve('result1')
      const promise2 = Promise.resolve('result2')
      const promise3 = Promise.resolve('result3')

      await runInDeferred(async () => {
        await defer(promise1)
        await defer(promise2)
        await defer(promise3)

        await awaitDeferred()

        expect(debug).toHaveBeenCalledWith('awaiting 3 deferred promises')
        expect(debug).toHaveBeenCalledWith('all deferred promises resolved')
      })()
    })

    it('should await deferred promises added while awaiting deferred promises', async () => {
      const order = []

      await runInDeferred(async () => {
        await defer(
          Promise.resolve().then(async () => {
            order.push('first')

            await defer(
              Promise.resolve().then(() => {
                order.push('second')
              })
            )
          })
        )

        await awaitDeferred()

        expect(order).toEqual(['first', 'second'])
      })()
    })

    it('should handle empty deferred promises array', async () => {
      const mockSpan = { finish: jest.fn() }

      createSpan.mockReturnValue(mockSpan)

      await runInDeferred(async () => {
        await awaitDeferred()

        expect(debug).not.toHaveBeenCalledWith(
          expect.stringMatching(/awaiting .* deferred promises/)
        )
      })()
    })

    it('should not clear deferred promises array', async () => {
      const mockSpan = { finish: jest.fn() }

      createSpan.mockReturnValue(mockSpan)

      const promise1 = Promise.resolve('result1')

      await runInDeferred(async () => {
        await defer(promise1)

        await awaitDeferred()
        await awaitDeferred()

        expect(debug).toHaveBeenCalledWith('awaiting 1 deferred promises')
        expect(debug).toHaveBeenCalledTimes(4) // 2 calls for each awaitDeferred
      })()
    })
  })

  describe('runInDeferred', () => {
    it('should run function and return result for non-Response values', async () => {
      const testFunction = jest.fn().mockResolvedValue('test result')
      const wrappedFunction = runInDeferred(testFunction)

      const result = await wrappedFunction('arg1', 'arg2')

      expect(testFunction).toHaveBeenCalledWith('arg1', 'arg2')
      expect(result).toBe('test result')
      expect(waitUntil).toHaveBeenCalled()
    })

    it('should handle Response objects with beforeClose', async () => {
      const mockResponse = new Response('test body', {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'text/plain' },
      })

      const testFunction = jest.fn().mockResolvedValue(mockResponse)
      const wrappedFunction = runInDeferred(testFunction)

      const result = await wrappedFunction()

      expect(testFunction).toHaveBeenCalled()
      expect(result).toBeInstanceOf(Response)
      expect(result.status).toBe(200)
      expect(result.statusText).toBe('OK')
      expect(waitUntil).toHaveBeenCalled()
    })

    it('should pass arguments correctly to wrapped function', async () => {
      const testFunction = jest.fn().mockResolvedValue('result')
      const wrappedFunction = runInDeferred(testFunction)

      await wrappedFunction('a', 'b', 'c', { key: 'value' })

      expect(testFunction).toHaveBeenCalledWith('a', 'b', 'c', { key: 'value' })
    })

    it('should provide deferred context to wrapped function', async () => {
      let hasStore = false

      const testFunction = jest.fn(async () => {
        try {
          await defer(Promise.resolve('test'))
          hasStore = true
        } catch {
          hasStore = false
        }

        return 'result'
      })

      const wrappedFunction = runInDeferred(testFunction)

      await wrappedFunction()

      expect(testFunction).toHaveBeenCalled()
      expect(hasStore).toBe(true)
    })

    it('should handle function errors gracefully', async () => {
      const testError = new Error('Test function error')
      const testFunction = jest.fn().mockRejectedValue(testError)
      const wrappedFunction = runInDeferred(testFunction)

      await expect(wrappedFunction()).rejects.toThrow('Test function error')
    })
  })

  describe('defer', () => {
    it('should add promise to deferred array when in runInDeferred context', async () => {
      const testPromise = Promise.resolve('test result')

      await runInDeferred(async () => {
        await defer(testPromise)

        await awaitDeferred()

        expect(debug).toHaveBeenCalledWith('awaiting 1 deferred promises')
      })()
    })

    it('should add function result to deferred array when in runInDeferred context', async () => {
      const testFunction = jest.fn().mockResolvedValue('function result')

      await runInDeferred(async () => {
        await defer(testFunction)

        expect(testFunction).toHaveBeenCalled()

        await awaitDeferred()

        expect(debug).toHaveBeenCalledWith('awaiting 1 deferred promises')
      })()
    })

    it('should await promise immediately when not in runInDeferred context', async () => {
      const testPromise = Promise.resolve('immediate result')

      await defer(testPromise)

      expect(warn).toHaveBeenCalledWith(
        'getStore() must be called within a runWithDeferred() context'
      )
    })

    it('should await function result immediately when not in runInDeferred context', async () => {
      const testFunction = jest.fn().mockResolvedValue('immediate result')

      await defer(testFunction)

      expect(testFunction).toHaveBeenCalled()
      expect(warn).toHaveBeenCalledWith(
        'getStore() must be called within a runWithDeferred() context'
      )
    })

    it('should handle promise rejection in deferred context', async () => {
      await runInDeferred(async () => {
        const rejectedPromise = Promise.reject(new Error('Deferred error'))

        await defer(rejectedPromise)

        await awaitDeferred()
        expect(captureError).toHaveBeenCalledWith(expect.any(Error))
      })()
    })

    it('should handle promise rejection outside deferred context', async () => {
      const rejectedPromise = Promise.reject(new Error('Immediate error'))

      rejectedPromise.catch(() => {})

      await defer(rejectedPromise)

      expect(captureError).toHaveBeenCalledWith(expect.any(Error))
      expect(warn).toHaveBeenCalledWith(
        'getStore() must be called within a runWithDeferred() context'
      )
    })

    it('should handle function that throws in deferred context', async () => {
      const throwingFunction = jest
        .fn()
        .mockRejectedValue(new Error('Function error'))

      await runInDeferred(async () => {
        await defer(throwingFunction)

        expect(throwingFunction).toHaveBeenCalled()
        await awaitDeferred()
        expect(captureError).toHaveBeenCalledWith(expect.any(Error))
      })()
    })

    it('should handle function that throws outside deferred context', async () => {
      const throwingFunction = jest
        .fn()
        .mockRejectedValue(new Error('Function error'))

      await defer(throwingFunction)

      expect(throwingFunction).toHaveBeenCalled()
      expect(captureError).toHaveBeenCalledWith(expect.any(Error))
      expect(warn).toHaveBeenCalledWith(
        'getStore() must be called within a runWithDeferred() context'
      )
    })

    it('should maintain separate deferred arrays for nested contexts', async () => {
      await runInDeferred(async () => {
        await defer(Promise.resolve('outer1'))

        await runInDeferred(async () => {
          await defer(Promise.resolve('inner1'))
          await defer(Promise.resolve('inner2'))

          await awaitDeferred()

          expect(debug).toHaveBeenCalledWith('awaiting 2 deferred promises')
        })()

        await defer(Promise.resolve('outer2'))

        await awaitDeferred()
        expect(debug).toHaveBeenCalledWith('awaiting 2 deferred promises')
      })()
    })
  })

  describe('Response stream handling', () => {
    it('should handle Response with ReadableStream body', async () => {
      const chunks = ['chunk1', 'chunk2', 'chunk3']

      let chunkIndex = 0

      const stream = new ReadableStream({
        start(controller) {
          const pump = () => {
            if (chunkIndex < chunks.length) {
              controller.enqueue(new TextEncoder().encode(chunks[chunkIndex++]))
              pump()
            } else {
              controller.close()
            }
          }

          pump()
        },
      })

      const response = new Response(stream, {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'text/plain' },
      })

      const testFunction = jest.fn().mockResolvedValue(response)
      const wrappedFunction = runInDeferred(testFunction)

      const result = await wrappedFunction()

      expect(result).toBeInstanceOf(Response)
      expect(result.status).toBe(200)
      expect(result.statusText).toBe('OK')

      const responseText = await result.text()

      expect(responseText).toBe('chunk1chunk2chunk3')
    })

    it('should handle Response with non-stream body', async () => {
      const response = new Response('simple body', {
        status: 201,
        statusText: 'Created',
        headers: { 'Content-Type': 'text/plain' },
      })

      const testFunction = jest.fn().mockResolvedValue(response)
      const wrappedFunction = runInDeferred(testFunction)

      const result = await wrappedFunction()

      expect(result).toBeInstanceOf(Response)
      expect(result.status).toBe(201)
      expect(result.statusText).toBe('Created')

      const responseText = await result.text()

      expect(responseText).toBe('simple body')
    })

    it('should handle stream read errors gracefully', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.error(new Error('Stream error'))
        },
      })

      const response = new Response(stream)
      const testFunction = jest.fn().mockResolvedValue(response)
      const wrappedFunction = runInDeferred(testFunction)

      const result = await wrappedFunction()

      expect(result).toBeInstanceOf(Response)
      expect(captureException).toHaveBeenCalledWith(expect.any(Error))
    })
  })

  describe('error handling and edge cases', () => {
    it('should handle null input to defer', async () => {
      await runInDeferred(async () => {
        await expect(defer(null)).rejects.toThrow()
      })()
    })

    it('should handle undefined input to defer', async () => {
      await runInDeferred(async () => {
        await expect(defer(undefined)).rejects.toThrow()
      })()
    })

    it('should handle non-function, non-promise input to defer', async () => {
      await runInDeferred(async () => {
        await expect(defer('not a function or promise')).rejects.toThrow()
      })()
    })

    it('should handle multiple sequential defer calls', async () => {
      const promises = [
        Promise.resolve('result1'),
        Promise.resolve('result2'),
        Promise.resolve('result3'),
        Promise.resolve('result4'),
      ]

      await runInDeferred(async () => {
        for (const promise of promises) {
          await defer(promise)
        }

        await awaitDeferred()
        expect(debug).toHaveBeenCalledWith('awaiting 4 deferred promises')
      })()
    })

    it('should handle concurrent defer calls', async () => {
      const promises = [
        Promise.resolve('result1'),
        Promise.resolve('result2'),
        Promise.resolve('result3'),
      ]

      await runInDeferred(async () => {
        await Promise.all(promises.map((promise) => defer(promise)))

        await awaitDeferred()
        expect(debug).toHaveBeenCalledWith('awaiting 3 deferred promises')
      })()
    })

    it('should preserve promise resolution order', async () => {
      const results = []

      const slowPromise = new Promise((resolve) =>
        setTimeout(() => {
          results.push('slow')
          resolve('slow')
        }, 10)
      )

      const fastPromise = Promise.resolve().then(() => {
        results.push('fast')

        return 'fast'
      })

      await runInDeferred(async () => {
        await defer(slowPromise)
        await defer(fastPromise)

        await awaitDeferred()

        expect(results).toEqual(['fast', 'slow'])
      })()
    })

    it('should handle large number of deferred promises', async () => {
      const promiseCount = 100

      const promises = Array.from({ length: promiseCount }, (_, i) =>
        Promise.resolve(`result${i}`)
      )

      await runInDeferred(async () => {
        for (const promise of promises) {
          await defer(promise)
        }

        await awaitDeferred()
        expect(debug).toHaveBeenCalledWith(
          `awaiting ${promiseCount} deferred promises`
        )
      })()
    })

    it('should handle mixed sync and async deferred operations', async () => {
      const syncFunction = jest.fn(() => Promise.resolve('sync result'))

      const asyncFunction = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))

        return 'async result'
      })

      await runInDeferred(async () => {
        await defer(syncFunction)
        await defer(asyncFunction)
        await defer(Promise.resolve('direct promise'))

        await awaitDeferred()

        expect(syncFunction).toHaveBeenCalled()
        expect(asyncFunction).toHaveBeenCalled()
        expect(debug).toHaveBeenCalledWith('awaiting 3 deferred promises')
      })()
    })

    it('should isolate deferred contexts between different runInDeferred calls', async () => {
      const context1Promises = []
      const context2Promises = []

      const context1 = runInDeferred(async () => {
        await defer(Promise.resolve('context1-1'))
        await defer(Promise.resolve('context1-2'))

        await awaitDeferred()

        context1Promises.push('completed')
      })

      const context2 = runInDeferred(async () => {
        await defer(Promise.resolve('context2-1'))

        await awaitDeferred()

        context2Promises.push('completed')
      })

      await Promise.all([context1(), context2()])

      expect(context1Promises).toEqual(['completed'])
      expect(context2Promises).toEqual(['completed'])

      expect(debug).toHaveBeenCalledWith('awaiting 2 deferred promises')
      expect(debug).toHaveBeenCalledWith('awaiting 1 deferred promises')
    })

    it('should handle errors in deferred promises without affecting others', async () => {
      const successPromise = Promise.resolve('success')
      const errorPromise = Promise.reject(new Error('test error'))

      errorPromise.catch(() => {})

      await runInDeferred(async () => {
        await defer(successPromise)
        await defer(errorPromise)
        await defer(Promise.resolve('another success'))

        await awaitDeferred()

        expect(debug).toHaveBeenCalledWith('awaiting 3 deferred promises')
        expect(captureError).toHaveBeenCalledWith(expect.any(Error))
      })()
    })

    it('should handle calling awaitDeferred multiple times in same context', async () => {
      await runInDeferred(async () => {
        await defer(Promise.resolve('test1'))
        await defer(Promise.resolve('test2'))

        await awaitDeferred()

        expect(debug).toHaveBeenCalledWith('awaiting 2 deferred promises')

        await awaitDeferred()

        expect(debug).toHaveBeenCalledTimes(4)
      })()
    })
  })

  describe('advanced stream handling', () => {
    it('should handle stream that closes immediately', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.close()
        },
      })

      const response = new Response(stream)
      const testFunction = jest.fn().mockResolvedValue(response)
      const wrappedFunction = runInDeferred(testFunction)

      const result = await wrappedFunction()

      expect(result).toBeInstanceOf(Response)

      const text = await result.text()

      expect(text).toBe('')
    })

    it('should handle stream with multiple chunks and proper cleanup', async () => {
      let readerReleased = false

      const chunks = ['chunk1', 'chunk2', 'chunk3']

      let chunkIndex = 0

      const stream = new ReadableStream({
        start(controller) {
          const interval = setInterval(() => {
            if (chunkIndex < chunks.length) {
              controller.enqueue(new TextEncoder().encode(chunks[chunkIndex++]))
            } else {
              clearInterval(interval)
              controller.close()
            }
          }, 1)
        },
      })

      const originalGetReader = stream.getReader.bind(stream)

      stream.getReader = () => {
        const reader = originalGetReader()
        const originalReleaseLock = reader.releaseLock.bind(reader)

        reader.releaseLock = () => {
          readerReleased = true
          originalReleaseLock()
        }

        return reader
      }

      const response = new Response(stream)
      const testFunction = jest.fn().mockResolvedValue(response)
      const wrappedFunction = runInDeferred(testFunction)

      const result = await wrappedFunction()
      const text = await result.text()

      expect(text).toBe('chunk1chunk2chunk3')
      expect(readerReleased).toBe(true)
    })

    it('should handle Response with null body', async () => {
      const response = new Response(null, { status: 204 })
      const testFunction = jest.fn().mockResolvedValue(response)
      const wrappedFunction = runInDeferred(testFunction)

      const result = await wrappedFunction()

      expect(result).toBeInstanceOf(Response)
      expect(result.status).toBe(204)

      const text = await result.text()

      expect(text).toBe('')
    })

    it('should properly handle ReadableStream controller errors', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.error(new Error('Controller error'))
        },
      })

      const response = new Response(stream)
      const testFunction = jest.fn().mockResolvedValue(response)
      const wrappedFunction = runInDeferred(testFunction)

      const result = await wrappedFunction()

      expect(result).toBeInstanceOf(Response)

      try {
        await result.text()
      } catch (error) {
        expect(error.message).toBe('Controller error')
      }

      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(captureException).toHaveBeenCalled()
    })
  })

  describe('context isolation and nesting', () => {
    it('should handle deeply nested runInDeferred calls', async () => {
      let level1Called = false
      let level2Called = false
      let level3Called = false

      const level3Fn = runInDeferred(async () => {
        await defer(Promise.resolve('level3'))
        level3Called = true

        return 'level3'
      })

      const level2Fn = runInDeferred(async () => {
        await defer(Promise.resolve('level2'))

        const result = await level3Fn()

        level2Called = true

        return result
      })

      const level1Fn = runInDeferred(async () => {
        await defer(Promise.resolve('level1'))

        const result = await level2Fn()

        level1Called = true

        return result
      })

      const result = await level1Fn()

      expect(result).toBe('level3')
      expect(level1Called).toBe(true)
      expect(level2Called).toBe(true)
      expect(level3Called).toBe(true)
    })

    it('should handle parallel runInDeferred execution', async () => {
      const results = []

      const task1 = runInDeferred(async () => {
        await defer(
          Promise.resolve().then(() => results.push('task1-deferred'))
        )
        results.push('task1-main')

        return 'task1'
      })

      const task2 = runInDeferred(async () => {
        await defer(
          Promise.resolve().then(() => results.push('task2-deferred'))
        )
        results.push('task2-main')

        return 'task2'
      })

      const [result1, result2] = await Promise.all([task1(), task2()])

      expect(result1).toBe('task1')
      expect(result2).toBe('task2')
      expect(results).toContain('task1-main')
      expect(results).toContain('task2-main')
      expect(results).toContain('task1-deferred')
      expect(results).toContain('task2-deferred')
    })
  })
})

describe('deferPastResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('hands the work to waitUntil and resolves before the work settles', async () => {
    let finish
    const work = jest.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )

    await deferPastResponse(work)

    expect(work).toHaveBeenCalledTimes(1)
    expect(waitUntil).toHaveBeenCalledTimes(1)

    finish()

    await waitUntil.mock.calls[0][0]
  })

  it('does not hold a runInDeferred response for work the handed function defers', async () => {
    let finish
    const inner = new Promise((resolve) => {
      finish = resolve
    })

    const wrapped = runInDeferred(async () => {
      await deferPastResponse(async () => {
        await defer(inner)
      })

      return new Response('ok', { status: 200 })
    })

    // @note would hang if `inner` had landed on the request store
    const result = await wrapped()

    expect(result.status).toBe(200)

    finish()

    await Promise.all(waitUntil.mock.calls.map(([promise]) => promise))
  })

  it('captures a failure of the handed work', async () => {
    const error = new Error('publish failed')

    await deferPastResponse(() => Promise.reject(error))

    await waitUntil.mock.calls[0][0]

    expect(captureError).toHaveBeenCalledWith(error)
  })

  it('awaits the work in place when the runtime has no waitUntil', async () => {
    const context = global[Symbol.for('@vercel/request-context')]

    delete global[Symbol.for('@vercel/request-context')]

    try {
      const order = []

      await deferPastResponse(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))

        order.push('work')
      })

      order.push('returned')

      expect(order).toEqual(['work', 'returned'])
      expect(waitUntil).not.toHaveBeenCalled()
    } finally {
      global[Symbol.for('@vercel/request-context')] = context
    }
  })
})
