import { getContextRequestStartTime } from '@/lib/context.store'

import {
  MAX_RESPONSE_WAIT_TIME_IN_MILLISECONDS,
  MAX_WAIT_TIME_TO_NOP_IN_MILLISECONDS,
  MAX_WAIT_TIME_TO_STREAM_IN_MILLISECONDS,
  getRemainingWaitTime,
  withStreamContinuity,
  withStreamCursor,
  withStream,
} from './stream'

jest.mock('@/lib/context.store', () => ({
  getContextRequestStartTime: jest.fn(),
}))

jest.mock('@/lib/debug', () => ({
  debug: jest.fn(() => ({
    log: jest.fn(),
  })),
  createSpan: jest.fn(() => ({ finish: jest.fn() })),
}))

jest.mock('@/lib/header', () => ({
  getAcceptHeader: jest.fn(() => 'application/jsonl'),
}))

jest.mock('@/lib/query.get', () => ({
  getQuery: jest.fn(() => new URLSearchParams()),
}))

describe('stream', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('constants', () => {
    it('should define MAX_RESPONSE_WAIT_TIME_IN_MILLISECONDS', () => {
      expect(MAX_RESPONSE_WAIT_TIME_IN_MILLISECONDS).toBe(25000)
    })

    it('should define MAX_WAIT_TIME_TO_NOP_IN_MILLISECONDS as 2/3 of response wait time', () => {
      expect(MAX_WAIT_TIME_TO_NOP_IN_MILLISECONDS).toBeCloseTo(16666.67, 0)
    })

    it('should define MAX_WAIT_TIME_TO_STREAM_IN_MILLISECONDS as 3/4 of response wait time', () => {
      expect(MAX_WAIT_TIME_TO_STREAM_IN_MILLISECONDS).toBeCloseTo(18750, 0)
    })
  })

  describe('getRemainingWaitTime', () => {
    let originalDateNow

    beforeEach(() => {
      originalDateNow = Date.now
      Date.now = jest.fn()
    })

    afterEach(() => {
      Date.now = originalDateNow
    })

    it('should calculate remaining time based on context start time', () => {
      const startTime = 1000
      const currentTime = 5000
      const elapsedTime = currentTime - startTime

      getContextRequestStartTime.mockReturnValue(startTime)
      Date.now.mockReturnValue(currentTime)

      const remaining = getRemainingWaitTime()

      expect(remaining).toBe(
        MAX_RESPONSE_WAIT_TIME_IN_MILLISECONDS - elapsedTime
      )
      expect(remaining).toBe(25000 - 4000)
      expect(remaining).toBe(21000)
    })

    it('should use Date.now() as fallback when context start time is not available', () => {
      const currentTime = 10000

      getContextRequestStartTime.mockReturnValue(null)
      Date.now.mockReturnValue(currentTime)

      const remaining = getRemainingWaitTime()

      // @note when no start time, elapsed time is 0
      expect(remaining).toBe(MAX_RESPONSE_WAIT_TIME_IN_MILLISECONDS)
      expect(remaining).toBe(25000)
    })

    it('should return decreasing values as time elapses', () => {
      const startTime = 1000

      getContextRequestStartTime.mockReturnValue(startTime)

      // First call: 1 second elapsed
      Date.now.mockReturnValue(2000)

      const remaining1 = getRemainingWaitTime()

      expect(remaining1).toBe(24000)

      // Second call: 5 seconds elapsed
      Date.now.mockReturnValue(6000)

      const remaining2 = getRemainingWaitTime()

      expect(remaining2).toBe(20000)

      // Third call: 20 seconds elapsed
      Date.now.mockReturnValue(21000)

      const remaining3 = getRemainingWaitTime()

      expect(remaining3).toBe(5000)

      expect(remaining1).toBeGreaterThan(remaining2)
      expect(remaining2).toBeGreaterThan(remaining3)
    })

    it('should return negative value when response wait time exceeded', () => {
      const startTime = 1000
      const currentTime =
        startTime + MAX_RESPONSE_WAIT_TIME_IN_MILLISECONDS + 5000

      getContextRequestStartTime.mockReturnValue(startTime)
      Date.now.mockReturnValue(currentTime)

      const remaining = getRemainingWaitTime()

      expect(remaining).toBe(-5000)
      expect(remaining).toBeLessThan(0)
    })

    it('should handle edge case when elapsed time equals max response wait time', () => {
      const startTime = 1000
      const currentTime =
        startTime + MAX_RESPONSE_WAIT_TIME_IN_MILLISECONDS

      getContextRequestStartTime.mockReturnValue(startTime)
      Date.now.mockReturnValue(currentTime)

      const remaining = getRemainingWaitTime()

      expect(remaining).toBe(0)
    })

    it('should handle undefined context start time', () => {
      const currentTime = 50000

      getContextRequestStartTime.mockReturnValue(undefined)
      Date.now.mockReturnValue(currentTime)

      const remaining = getRemainingWaitTime()

      expect(remaining).toBe(MAX_RESPONSE_WAIT_TIME_IN_MILLISECONDS)
    })
  })

  describe('withStreamCursor', () => {
    it('should support cursor in StreamCursorHandlerResult type', () => {
      const result = {
        items: [{ id: 'test' }],
        cursor: 'uuid-cursor-value',
      }

      expect(result.items).toHaveLength(1)
      expect(result.cursor).toBe('uuid-cursor-value')
    })

    it('should stop streaming when handler returns null cursor (vector store end of pages)', async () => {
      const handlerCalls = []

      const handler = jest.fn(async (cursor) => {
        handlerCalls.push(cursor)

        if (!cursor) {
          // First call: return items with a UUID cursor
          return {
            items: [{ id: 'cuid-abc123', text: 'first page' }],
            cursor: 'uuid-550e8400-e29b-41d4-a716-446655440000',
          }
        } else if (cursor === 'uuid-550e8400-e29b-41d4-a716-446655440000') {
          // Second call: return items with null cursor (last page)
          return {
            items: [{ id: 'cuid-def456', text: 'last page' }],
            cursor: null,
          }
        }

        // Should never reach here
        return { items: [], cursor: null }
      })

      const wrapped = withStreamCursor(handler)

      const response = await wrapped(
        new Request('https://example.com', {
          headers: { accept: 'application/jsonl' },
        })
      )

      const text = await response.text()

      // Handler should only be called twice (not a third time with the CUID)
      expect(handler).toHaveBeenCalledTimes(2)

      // First call with no cursor
      expect(handlerCalls[0]).toBeUndefined()

      // Second call with UUID cursor from vector store
      expect(handlerCalls[1]).toBe('uuid-550e8400-e29b-41d4-a716-446655440000')

      // Both items should be in the response
      expect(text).toContain('first page')
      expect(text).toContain('last page')
    })

    it('should continue using last item id as cursor when handler returns undefined cursor (database-backed stores)', async () => {
      const handlerCalls = []

      const handler = jest.fn(async (cursor) => {
        handlerCalls.push(cursor)

        if (!cursor) {
          return { items: [{ id: 'cuid-first' }] } // no cursor field = database-backed
        } else if (cursor === 'cuid-first') {
          return { items: [] } // empty = end of pages
        }

        return { items: [] }
      })

      const wrapped = withStreamCursor(handler)

      const response = await wrapped(
        new Request('https://example.com', {
          headers: { accept: 'application/jsonl' },
        })
      )

      await response.text()

      // Handler called twice: once for first page, once with last item id, once for empty
      expect(handler).toHaveBeenCalledTimes(2)
      expect(handlerCalls[1]).toBe('cuid-first')
    })
  })

  describe('withStream', () => {
    it('should expose stream signal and abort when request signal aborts', async () => {
      const requestAbortController = new AbortController()

      const wrapped = withStream(async (_req, stream) => {
        await new Promise((resolve) => {
          stream.abortSignal.addEventListener('abort', resolve, { once: true })
        })

        await stream.result({ aborted: stream.abortSignal.aborted })
      })

      const responsePromise = wrapped(
        new Request('https://example.com', {
          headers: {
            accept: 'application/jsonl',
          },
          signal: requestAbortController.signal,
        })
      )

      requestAbortController.abort()

      const response = await responsePromise
      const text = await response.text()

      expect(text).toContain('"type":"result"')
      expect(text).toContain('"aborted":true')
    })
  })

  describe('withStreamContinuity', () => {
    it('should not append the ping result after a streamed result event', async () => {
      const wrapped = withStreamContinuity(async (_req, stream) => {
        await stream.push({
          type: 'result',
          data: {
            text: 'complete',
          },
        })
      })

      const response = await wrapped(
        new Request('https://example.com', {
          headers: {
            accept: 'application/jsonl',
          },
        })
      )

      const text = await response.text()
      const events = text
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))

      expect(events).toEqual([
        {
          type: 'result',
          data: {
            text: 'complete',
          },
        },
      ])
    })
  })
})
