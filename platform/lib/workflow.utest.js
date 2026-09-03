/* eslint-disable @typescript-eslint/no-require-imports */
import {
  MaxRunsExceededError,
  MaxTimeExceededError,
  WorkflowAbortError,
  isAbortError,
  sendWorkflowEvent,
  withWorkflowHandler,
} from './workflow'

import { z } from 'zod'

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn(() => ({ log: jest.fn() })) })),
}))

jest.mock('@/lib/error', () => ({
  captureUnexpectedState: jest.fn(),
  captureObservation: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  captureUnknownException: jest.fn(),
  throwBadRequest: jest.fn((msg) => {
    throw new Error(msg)
  }),
}))

jest.mock('@/lib/stream', () => ({
  withStreamContinuity: jest.fn((fn) => fn),
}))

jest.mock('@/lib/queue', () => ({
  __esModule: true,
  default: jest.fn(),
  withQueue: jest.fn((fn) => fn),
}))

jest.mock('@/lib/request', () => ({
  parseRequestJson: jest.fn(),
}))

describe('MaxRunsExceededError', () => {
  it('should create error with correct properties', () => {
    const error = new MaxRunsExceededError(10, 11)

    expect(error.name).toBe('MaxRunsExceededError')
    expect(error.message).toBe('Max runs exceeded: 11 >= 10')
    expect(error.maxRuns).toBe(10)
    expect(error.currentRun).toBe(11)
    expect(error instanceof Error).toBe(true)
  })
})

describe('MaxTimeExceededError', () => {
  it('should create error with correct properties', () => {
    const error = new MaxTimeExceededError(60000, 65000)

    expect(error.name).toBe('MaxTimeExceededError')
    expect(error.message).toContain('Max time exceeded')
    expect(error.message).toContain('65000ms')
    expect(error.message).toContain('60000ms')
    expect(error.maxTimeMs).toBe(60000)
    expect(error.elapsedTimeMs).toBe(65000)
    expect(error instanceof Error).toBe(true)
  })

  it('should include minutes in error message', () => {
    const error = new MaxTimeExceededError(600000, 660000) // 10 min, 11 min

    expect(error.message).toContain('11 minutes')
  })
})

describe('WorkflowAbortError', () => {
  it('should create error with default message', () => {
    const error = new WorkflowAbortError()

    expect(error.name).toBe('WorkflowAbortError')
    expect(error.message).toBe('Workflow processing aborted')
    expect(error instanceof Error).toBe(true)
  })

  it('should create error with custom message', () => {
    const error = new WorkflowAbortError('Custom abort reason')

    expect(error.message).toBe('Custom abort reason')
  })
})

describe('isAbortError', () => {
  it('should return true for WorkflowAbortError', () => {
    const error = new WorkflowAbortError()

    expect(isAbortError(error)).toBe(true)
  })

  it('should return true for error with AbortError name', () => {
    const error = new Error('aborted')

    error.name = 'AbortError'

    expect(isAbortError(error)).toBe(true)
  })

  it('should return false for regular errors', () => {
    expect(isAbortError(new Error('regular error'))).toBe(false)
  })

  it('should return false for null', () => {
    expect(isAbortError(null)).toBe(false)
  })

  it('should return false for undefined', () => {
    expect(isAbortError(undefined)).toBe(false)
  })

  it('should return false for non-error objects', () => {
    expect(isAbortError({ message: 'not an error' })).toBe(false)
  })
})

describe('withWorkflowHandler', () => {
  const debug = require('@/lib/debug').default
  const { parseRequestJson } = require('@/lib/request')
  const { captureUnknownException } = require('@/lib/response')
  const { captureUnexpectedState, captureObservation } = require('@/lib/error')
  const queue = require('@/lib/queue').default

  const testStateSchema = z.object({
    cursor: z.string().optional(),
    processed: z.number(),
  })

  const createValidPayload = (state, meta) => ({
    type: 'step',
    payload: {
      state,
      meta: {
        runCount: 0,
        startedAt: Date.now() - 1000,
        lastRunAt: Date.now() - 1000,
        workflowId: 'wf-test',
        ...meta,
      },
    },
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('handler execution', () => {
    it('should throw when neither maxRuns nor maxTimeMs is provided', () => {
      const handler = jest.fn()

      expect(() =>
        withWorkflowHandler({
          route: '/api/v1/test/queue',
          stateSchema: testStateSchema,
          handler,
        })
      ).toThrow('Either maxRuns or maxTimeMs must be provided')
    })

    it('should throw when maxRuns is not a positive integer', () => {
      const handler = jest.fn()

      expect(() =>
        withWorkflowHandler({
          route: '/api/v1/test/queue',
          stateSchema: testStateSchema,
          maxRuns: 0,
          onMaxRunsExceeded: 'error',
          handler,
        })
      ).toThrow('maxRuns must be a positive integer')
    })

    it('should throw when maxTimeMs is not a positive integer', () => {
      const handler = jest.fn()

      expect(() =>
        withWorkflowHandler({
          route: '/api/v1/test/queue',
          stateSchema: testStateSchema,
          maxTimeMs: 0,
          onMaxTimeExceeded: 'error',
          handler,
        })
      ).toThrow('maxTimeMs must be a positive integer')
    })

    it('should execute handler with valid payload', async () => {
      const handler = jest.fn().mockResolvedValue(null)
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        handler,
      }

      const state = { processed: 0 }

      parseRequestJson.mockResolvedValue(createValidPayload(state))

      const wrappedHandler = withWorkflowHandler(config)
      const req = {}
      const stream = { error: jest.fn() }

      await wrappedHandler(req, stream)

      expect(handler).toHaveBeenCalledWith(
        state,
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          runCount: 1,
          remainingRuns: 9,
          elapsedTimeMs: expect.any(Number),
          remainingTimeMs: Infinity,
        })
      )
    })

    it('should pass correct context with maxTimeMs', async () => {
      const handler = jest.fn().mockResolvedValue(null)
      const maxTimeMs = 60000
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxTimeMs,
        onMaxTimeExceeded: 'error',
        handler,
      }

      const now = Date.now()
      const startedAt = now - 10000 // 10 seconds ago
      const state = { processed: 0 }

      parseRequestJson.mockResolvedValue(
        createValidPayload(state, { startedAt, lastRunAt: startedAt })
      )

      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, { error: jest.fn() })

      expect(handler).toHaveBeenCalledWith(
        state,
        expect.objectContaining({
          elapsedTimeMs: expect.any(Number),
          remainingTimeMs: expect.any(Number),
        })
      )

      const context = handler.mock.calls[0][1]

      expect(context.remainingTimeMs).toBeLessThanOrEqual(maxTimeMs)
      expect(context.remainingTimeMs).toBeGreaterThan(0)
    })

    it('should clamp negative elapsed time when startedAt is in the future', async () => {
      const handler = jest.fn().mockResolvedValue(null)
      const maxTimeMs = 60000
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxTimeMs,
        onMaxTimeExceeded: 'error',
        handler,
      }

      const now = Date.now()
      const startedAt = now + 10000

      parseRequestJson.mockResolvedValue(
        createValidPayload(
          { processed: 0 },
          { startedAt, lastRunAt: startedAt, runCount: 0 }
        )
      )

      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, { error: jest.fn() })

      const context = handler.mock.calls[0][1]

      expect(context.elapsedTimeMs).toBe(0)
      expect(context.remainingTimeMs).toBe(maxTimeMs)
    })

    it('should complete without re-queuing when handler returns null', async () => {
      const handler = jest.fn().mockResolvedValue(null)
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        handler,
      }

      parseRequestJson.mockResolvedValue(createValidPayload({ processed: 5 }))

      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, { error: jest.fn() })

      expect(queue).not.toHaveBeenCalled()
    })

    it('should complete without re-queuing when handler returns undefined', async () => {
      const handler = jest.fn().mockResolvedValue(undefined)
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        handler,
      }

      parseRequestJson.mockResolvedValue(createValidPayload({ processed: 5 }))

      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, { error: jest.fn() })

      expect(queue).not.toHaveBeenCalled()
    })

    it('should re-queue when handler returns new state', async () => {
      const newState = { processed: 10, cursor: 'next' }
      const handler = jest.fn().mockResolvedValue({ state: newState })
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        handler,
      }

      const now = Date.now()

      parseRequestJson.mockResolvedValue(
        createValidPayload({ processed: 5 }, { startedAt: now - 5000 })
      )

      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, { error: jest.fn() })

      expect(queue).toHaveBeenCalledWith(
        '/api/v1/test/queue',
        expect.objectContaining({
          type: 'step',
          payload: expect.objectContaining({
            state: newState,
            meta: expect.objectContaining({
              runCount: 1,
              startedAt: now - 5000,
            }),
          }),
        }),
        expect.any(Object)
      )
    })

    it('should emit workflow step metric logs when a step starts and continues', async () => {
      const handler = jest.fn().mockResolvedValue({ state: { processed: 10 } })
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        handler,
      }

      parseRequestJson.mockResolvedValue(
        createValidPayload(
          { processed: 5 },
          { startedAt: Date.now() - 5000, workflowId: 'workflow-test' }
        )
      )

      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, { error: jest.fn() })

      const metricCalls = debug.mock.calls
        .filter(([message]) => message === 'recording workflow step')
        .map(([, metric]) => metric)

      expect(metricCalls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            route: '/api/v1/test/queue',
            status: 'started',
            count: 1,
            runCount: 1,
            workflowId: 'workflow-test',
          }),
          expect.objectContaining({
            route: '/api/v1/test/queue',
            status: 'continued',
            count: 1,
            runCount: 1,
            nextRun: 2,
            workflowId: 'workflow-test',
          }),
        ])
      )
    })

    it('should set lastRunAt to completion time when re-queuing', async () => {
      jest.useFakeTimers()

      try {
        const baseTime = Date.now()

        const handler = jest.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 200))

          return { state: { processed: 10 } }
        })

        const config = {
          route: '/api/v1/test/queue',
          stateSchema: testStateSchema,
          maxRuns: 10,
          onMaxRunsExceeded: 'error',
          handler,
        }

        parseRequestJson.mockResolvedValue(
          createValidPayload(
            { processed: 5 },
            { startedAt: baseTime - 1000, lastRunAt: baseTime - 1000 }
          )
        )

        const wrappedHandler = withWorkflowHandler(config)
        const promise = wrappedHandler({}, { error: jest.fn() })

        await jest.advanceTimersByTimeAsync(210)
        await promise

        const queuedMeta = queue.mock.calls[0][1].payload.meta

        expect(queuedMeta.lastRunAt).toBe(baseTime + 200)
      } finally {
        jest.useRealTimers()
      }
    })

    it('should pass delayInSeconds when configured', async () => {
      const handler = jest.fn().mockResolvedValue({ state: { processed: 10 } })
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        delaySeconds: 5,
        handler,
      }

      parseRequestJson.mockResolvedValue(createValidPayload({ processed: 5 }))

      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, { error: jest.fn() })

      expect(queue).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          delayInSeconds: 5,
        })
      )
    })

    it('should use per-step delay from result delaySeconds', async () => {
      const handler = jest
        .fn()
        .mockResolvedValue({ state: { processed: 10 }, delaySeconds: 30 })
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        delaySeconds: 5,
        handler,
      }

      parseRequestJson.mockResolvedValue(createValidPayload({ processed: 5 }))

      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, { error: jest.fn() })

      expect(queue).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          payload: expect.objectContaining({
            state: { processed: 10 },
          }),
        }),
        expect.objectContaining({
          delayInSeconds: 30,
        })
      )
    })

    it('should override config delaySeconds with per-step delay of 0', async () => {
      const handler = jest
        .fn()
        .mockResolvedValue({ state: { processed: 10 }, delaySeconds: 0 })
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        delaySeconds: 5,
        handler,
      }

      parseRequestJson.mockResolvedValue(createValidPayload({ processed: 5 }))

      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, { error: jest.fn() })

      expect(queue).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          delayInSeconds: undefined,
        })
      )
    })

    it('should fall back to config delaySeconds when handler returns plain state', async () => {
      const handler = jest.fn().mockResolvedValue({ state: { processed: 10 } })
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        delaySeconds: 5,
        handler,
      }

      parseRequestJson.mockResolvedValue(createValidPayload({ processed: 5 }))

      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, { error: jest.fn() })

      expect(queue).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          delayInSeconds: 5,
        })
      )
    })

    it('should clamp timeout delay to max setTimeout range', async () => {
      const handler = jest.fn().mockResolvedValue(null)
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxTimeMs: Number.MAX_SAFE_INTEGER,
        onMaxTimeExceeded: 'error',
        handler,
      }

      parseRequestJson.mockResolvedValue(createValidPayload({ processed: 0 }))

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout')

      try {
        const wrappedHandler = withWorkflowHandler(config)

        await wrappedHandler({}, { error: jest.fn() })

        const delay = setTimeoutSpy.mock.calls[0][1]

        expect(delay).toBe(2147483647)
      } finally {
        setTimeoutSpy.mockRestore()
      }
    })
  })

  describe('max runs limit', () => {
    it('should signal MaxRunsExceededError via stream when limit exceeded with error mode', async () => {
      const handler = jest.fn()
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 5,
        onMaxRunsExceeded: 'error',
        handler,
      }

      parseRequestJson.mockResolvedValue(
        createValidPayload({ processed: 0 }, { runCount: 5 })
      )

      const stream = { error: jest.fn() }
      const wrappedHandler = withWorkflowHandler(config)

      await expect(wrappedHandler({}, stream)).resolves.toBeUndefined()
      expect(stream.error).toHaveBeenCalledWith(
        expect.any(MaxRunsExceededError)
      )
      expect(captureUnknownException).toHaveBeenCalledWith(
        expect.any(MaxRunsExceededError)
      )
      expect(handler).not.toHaveBeenCalled()
    })

    it('should stop silently when limit exceeded with stop mode', async () => {
      const handler = jest.fn()
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 5,
        onMaxRunsExceeded: 'stop',
        handler,
      }

      parseRequestJson.mockResolvedValue(
        createValidPayload({ processed: 0 }, { runCount: 5 })
      )

      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, { error: jest.fn() })

      expect(handler).not.toHaveBeenCalled()
      expect(queue).not.toHaveBeenCalled()
    })

    it('should call callback when limit exceeded with callback mode', async () => {
      const onMaxRunsExceeded = jest.fn()
      const handler = jest.fn()
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 5,
        onMaxRunsExceeded,
        handler,
      }

      const state = { processed: 0 }

      parseRequestJson.mockResolvedValue(
        createValidPayload(state, { runCount: 5 })
      )

      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, { error: jest.fn() })

      expect(onMaxRunsExceeded).toHaveBeenCalledWith(
        state,
        expect.objectContaining({ runCount: 6 })
      )
      expect(handler).not.toHaveBeenCalled()
    })

    it('should prefer maxRuns handling when both maxRuns and maxTimeMs are exceeded', async () => {
      const onMaxRunsExceeded = jest.fn()
      const onMaxTimeExceeded = jest.fn()
      const handler = jest.fn()

      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 3,
        onMaxRunsExceeded,
        maxTimeMs: 1000,
        onMaxTimeExceeded,
        handler,
      }

      parseRequestJson.mockResolvedValue(
        createValidPayload(
          { processed: 0 },
          { runCount: 3, startedAt: Date.now() - 5000 }
        )
      )

      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, { error: jest.fn() })

      expect(onMaxRunsExceeded).toHaveBeenCalled()
      expect(onMaxTimeExceeded).not.toHaveBeenCalled()
      expect(handler).not.toHaveBeenCalled()
      expect(queue).not.toHaveBeenCalled()
    })
  })

  describe('max time limit', () => {
    it('should signal MaxTimeExceededError via stream when limit exceeded with error mode', async () => {
      const handler = jest.fn()
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxTimeMs: 60000, // 1 minute
        onMaxTimeExceeded: 'error',
        handler,
      }

      const now = Date.now()

      parseRequestJson.mockResolvedValue(
        createValidPayload({ processed: 0 }, { startedAt: now - 120000 }) // 2 minutes ago
      )

      const stream = { error: jest.fn() }
      const wrappedHandler = withWorkflowHandler(config)

      await expect(wrappedHandler({}, stream)).resolves.toBeUndefined()
      expect(stream.error).toHaveBeenCalledWith(
        expect.any(MaxTimeExceededError)
      )
      expect(captureUnknownException).toHaveBeenCalledWith(
        expect.any(MaxTimeExceededError)
      )
      expect(handler).not.toHaveBeenCalled()
    })

    it('should stop silently when limit exceeded with stop mode', async () => {
      const handler = jest.fn()
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxTimeMs: 60000,
        onMaxTimeExceeded: 'stop',
        handler,
      }

      const now = Date.now()

      parseRequestJson.mockResolvedValue(
        createValidPayload({ processed: 0 }, { startedAt: now - 120000 })
      )

      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, { error: jest.fn() })

      expect(handler).not.toHaveBeenCalled()
      expect(queue).not.toHaveBeenCalled()
    })

    it('should call callback when limit exceeded with callback mode', async () => {
      const onMaxTimeExceeded = jest.fn()
      const handler = jest.fn()
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxTimeMs: 60000,
        onMaxTimeExceeded,
        handler,
      }

      const now = Date.now()
      const state = { processed: 0 }

      parseRequestJson.mockResolvedValue(
        createValidPayload(state, { startedAt: now - 120000 })
      )

      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, { error: jest.fn() })

      expect(onMaxTimeExceeded).toHaveBeenCalledWith(
        state,
        expect.objectContaining({ startedAt: now - 120000, runCount: 1 })
      )
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('abort handling', () => {
    it('should capture elapsedTimeMs at abort time', async () => {
      jest.useFakeTimers()

      try {
        const handler = jest.fn(() => new Promise(() => {}))

        const now = Date.now()
        const config = {
          route: '/api/v1/test/queue',
          stateSchema: testStateSchema,
          maxTimeMs: 20,
          onMaxTimeExceeded: 'error',
          handler,
        }

        parseRequestJson.mockResolvedValue(
          createValidPayload(
            { processed: 5 },
            { startedAt: now, lastRunAt: now, runCount: 0 }
          )
        )

        const wrappedHandler = withWorkflowHandler(config)
        const promise = wrappedHandler({}, { error: jest.fn() })

        await jest.advanceTimersByTimeAsync(100)
        await promise

        expect(captureObservation).toHaveBeenCalledWith(
          expect.stringMatching(/^Workflow handler aborted:/),
          expect.objectContaining({
            elapsedTimeMs: expect.any(Number),
          })
        )

        const observationPayload = captureObservation.mock.calls.at(-1)[1]

        expect(observationPayload.elapsedTimeMs).toBeGreaterThanOrEqual(20)
      } finally {
        jest.useRealTimers()
      }
    })

    it('should stop when handler ignores signal and exceeds maxTimeMs', async () => {
      jest.useFakeTimers()

      try {
        const handler = jest.fn(
          () => new Promise(() => {}) // never resolves, ignores signal
        )

        const now = Date.now()
        const config = {
          route: '/api/v1/test/queue',
          stateSchema: testStateSchema,
          maxTimeMs: 20,
          onMaxTimeExceeded: 'error',
          handler,
        }

        parseRequestJson.mockResolvedValue(
          createValidPayload(
            { processed: 5 },
            { startedAt: now, lastRunAt: now, runCount: 0 }
          )
        )

        const stream = { error: jest.fn() }
        const wrappedHandler = withWorkflowHandler(config)
        const promise = wrappedHandler({}, stream)

        const timeoutMarker = Symbol('timeout')
        const raceResult = await Promise.race([
          promise.then(() => 'completed'),
          (async () => {
            await jest.advanceTimersByTimeAsync(100)

            return timeoutMarker
          })(),
        ])

        expect(raceResult).toBe('completed')
        expect(captureObservation).toHaveBeenCalled()
        expect(queue).not.toHaveBeenCalled()
        expect(stream.error).not.toHaveBeenCalled()
      } finally {
        jest.useRealTimers()
      }
    })

    it('should abort signal when maxTimeMs is exceeded during handler execution', async () => {
      jest.useFakeTimers()

      try {
        let signalWasAborted = false

        const handler = jest.fn(async (_state, context) => {
          await new Promise((resolve) => setTimeout(resolve, 50))
          signalWasAborted = context.signal.aborted

          return null
        })

        const now = Date.now()
        const config = {
          route: '/api/v1/test/queue',
          stateSchema: testStateSchema,
          maxTimeMs: 20,
          onMaxTimeExceeded: 'error',
          handler,
        }

        parseRequestJson.mockResolvedValue(
          createValidPayload(
            { processed: 5 },
            { startedAt: now, lastRunAt: now, runCount: 0 }
          )
        )

        const wrappedHandler = withWorkflowHandler(config)
        const promise = wrappedHandler({}, { error: jest.fn() })

        await jest.advanceTimersByTimeAsync(60)
        await promise

        expect(signalWasAborted).toBe(true)
      } finally {
        jest.useRealTimers()
      }
    })

    it('should not re-queue when handler throws WorkflowAbortError', async () => {
      const handler = jest.fn().mockRejectedValue(new WorkflowAbortError())
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        handler,
      }

      parseRequestJson.mockResolvedValue(createValidPayload({ processed: 5 }))

      const stream = { error: jest.fn() }
      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, stream)

      expect(queue).not.toHaveBeenCalled()
      expect(captureObservation).toHaveBeenCalled()
      expect(captureUnexpectedState).not.toHaveBeenCalled()
      expect(stream.error).not.toHaveBeenCalled()
    })

    it('should not re-queue when handler throws AbortError', async () => {
      const abortError = new Error('Operation aborted')

      abortError.name = 'AbortError'

      const handler = jest.fn().mockRejectedValue(abortError)
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        handler,
      }

      parseRequestJson.mockResolvedValue(createValidPayload({ processed: 5 }))

      const stream = { error: jest.fn() }
      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, stream)

      expect(queue).not.toHaveBeenCalled()
      expect(captureObservation).toHaveBeenCalled()
      expect(captureUnexpectedState).not.toHaveBeenCalled()
    })
  })

  describe('onAbort callback', () => {
    it('should invoke onAbort when handler throws WorkflowAbortError', async () => {
      const onAbort = jest.fn().mockResolvedValue(undefined)
      const abortError = new WorkflowAbortError('Task execution canceled')
      const handler = jest.fn().mockRejectedValue(abortError)

      const state = { processed: 5 }
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        handler,
        onAbort,
      }

      parseRequestJson.mockResolvedValue(createValidPayload(state))

      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, { error: jest.fn() })

      expect(onAbort).toHaveBeenCalledTimes(1)

      const [calledState, calledMeta, calledError] = onAbort.mock.calls[0]

      expect(calledState).toEqual(state)
      expect(calledError).toBe(abortError)
      expect(calledError.message).toBe('Task execution canceled')
      expect(calledMeta).toEqual(
        expect.objectContaining({
          runCount: 1,
          startedAt: expect.any(Number),
          lastRunAt: expect.any(Number),
        })
      )
      expect(queue).not.toHaveBeenCalled()
    })

    it('should NOT invoke onAbort when the step-timeout AbortController fires', async () => {
      jest.useFakeTimers()

      try {
        const onAbort = jest.fn().mockResolvedValue(undefined)
        const handler = jest.fn(() => new Promise(() => {}))

        const now = Date.now()
        const config = {
          route: '/api/v1/test/queue',
          stateSchema: testStateSchema,
          maxTimeMs: 20,
          onMaxTimeExceeded: 'error',
          handler,
          onAbort,
        }

        parseRequestJson.mockResolvedValue(
          createValidPayload(
            { processed: 5 },
            { startedAt: now, lastRunAt: now, runCount: 0 }
          )
        )

        const wrappedHandler = withWorkflowHandler(config)
        const promise = wrappedHandler({}, { error: jest.fn() })

        await jest.advanceTimersByTimeAsync(100)
        await promise

        expect(captureObservation).toHaveBeenCalled()
        expect(onAbort).not.toHaveBeenCalled()
      } finally {
        jest.useRealTimers()
      }
    })

    it('should not invoke onAbort when onMaxRunsExceeded callback throws abort', async () => {
      const onAbort = jest.fn().mockResolvedValue(undefined)
      const onMaxRunsExceeded = jest
        .fn()
        .mockRejectedValue(new WorkflowAbortError())

      const handler = jest.fn().mockResolvedValue(null)
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 5,
        onMaxRunsExceeded,
        handler,
        onAbort,
      }

      parseRequestJson.mockResolvedValue(
        createValidPayload({ processed: 0 }, { runCount: 5 })
      )

      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, { error: jest.fn() })

      expect(onMaxRunsExceeded).toHaveBeenCalled()
      expect(handler).not.toHaveBeenCalled()
      expect(onAbort).not.toHaveBeenCalled()
    })

    it('should not invoke onAbort when onMaxTimeExceeded callback throws abort', async () => {
      const onAbort = jest.fn().mockResolvedValue(undefined)
      const onMaxTimeExceeded = jest
        .fn()
        .mockRejectedValue(new WorkflowAbortError())

      const handler = jest.fn().mockResolvedValue(null)
      const now = Date.now()
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxTimeMs: 100,
        onMaxTimeExceeded,
        handler,
        onAbort,
      }

      parseRequestJson.mockResolvedValue(
        createValidPayload(
          { processed: 0 },
          { startedAt: now - 10000, lastRunAt: now - 10000 }
        )
      )

      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, { error: jest.fn() })

      expect(onMaxTimeExceeded).toHaveBeenCalled()
      expect(handler).not.toHaveBeenCalled()
      expect(onAbort).not.toHaveBeenCalled()
    })

    it('should swallow abort errors thrown from the onAbort callback itself', async () => {
      const onAbort = jest.fn().mockRejectedValue(new WorkflowAbortError())
      const handler = jest
        .fn()
        .mockRejectedValue(new WorkflowAbortError('original'))

      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        handler,
        onAbort,
      }

      parseRequestJson.mockResolvedValue(createValidPayload({ processed: 0 }))

      const stream = { error: jest.fn() }
      const wrappedHandler = withWorkflowHandler(config)

      await expect(wrappedHandler({}, stream)).resolves.toBeUndefined()

      expect(onAbort).toHaveBeenCalled()
      expect(stream.error).not.toHaveBeenCalled()
      expect(captureUnknownException).not.toHaveBeenCalled()
    })

    it('should capture but not propagate non-abort errors thrown from onAbort', async () => {
      const callbackError = new Error('callback boom')
      const onAbort = jest.fn().mockRejectedValue(callbackError)
      const handler = jest
        .fn()
        .mockRejectedValue(new WorkflowAbortError('original'))

      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        handler,
        onAbort,
      }

      parseRequestJson.mockResolvedValue(createValidPayload({ processed: 0 }))

      const stream = { error: jest.fn() }
      const wrappedHandler = withWorkflowHandler(config)

      await expect(wrappedHandler({}, stream)).resolves.toBeUndefined()

      expect(onAbort).toHaveBeenCalled()
      expect(captureUnknownException).toHaveBeenCalledWith(callbackError)
      expect(stream.error).not.toHaveBeenCalled()
    })

    it('should still abort cleanly when onAbort is not provided', async () => {
      const handler = jest
        .fn()
        .mockRejectedValue(new WorkflowAbortError('Task execution canceled'))

      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        handler,
      }

      parseRequestJson.mockResolvedValue(createValidPayload({ processed: 0 }))

      const stream = { error: jest.fn() }
      const wrappedHandler = withWorkflowHandler(config)

      await expect(wrappedHandler({}, stream)).resolves.toBeUndefined()

      expect(queue).not.toHaveBeenCalled()
      expect(captureObservation).toHaveBeenCalled()
      expect(stream.error).not.toHaveBeenCalled()
    })

    it('should pass advanced runCount in meta to onAbort', async () => {
      const onAbort = jest.fn().mockResolvedValue(undefined)
      const handler = jest.fn().mockRejectedValue(new WorkflowAbortError('x'))

      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        handler,
        onAbort,
      }

      parseRequestJson.mockResolvedValue(
        createValidPayload({ processed: 0 }, { runCount: 3 })
      )

      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, { error: jest.fn() })

      const calledMeta = onAbort.mock.calls[0][1]

      expect(calledMeta.runCount).toBe(4)
    })
  })

  describe('error handling', () => {
    it('should call stream.error for non-abort errors', async () => {
      const error = new Error('Processing failed')
      const handler = jest.fn().mockRejectedValue(error)
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        handler,
      }

      parseRequestJson.mockResolvedValue(createValidPayload({ processed: 5 }))

      const stream = { error: jest.fn() }
      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, stream)

      expect(captureUnknownException).toHaveBeenCalledWith(error)
      expect(stream.error).toHaveBeenCalledWith(error)
    })

    it('should capture and report invalid returned state without re-queuing', async () => {
      const handler = jest.fn().mockResolvedValue({
        state: {
          processed: 'not-a-number',
        },
      })

      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        handler,
      }

      parseRequestJson.mockResolvedValue(createValidPayload({ processed: 5 }))

      const stream = { error: jest.fn() }
      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, stream)

      expect(queue).not.toHaveBeenCalled()
      expect(captureUnknownException).toHaveBeenCalledWith(expect.any(Error))
      expect(stream.error).toHaveBeenCalledWith(expect.any(Error))
    })

    it('should capture and report continuation queue failures', async () => {
      const queueError = new Error('QStash publish failed')
      const handler = jest.fn().mockResolvedValue({
        state: {
          processed: 10,
        },
      })

      queue.mockRejectedValueOnce(queueError)

      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        handler,
      }

      parseRequestJson.mockResolvedValue(createValidPayload({ processed: 5 }))

      const stream = { error: jest.fn() }
      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, stream)

      expect(queue).toHaveBeenCalled()
      expect(captureUnknownException).toHaveBeenCalledWith(queueError)
      expect(stream.error).toHaveBeenCalledWith(queueError)
    })

    it('should report queue failures even when error capture fails', async () => {
      const queueError = new Error('QStash publish failed')
      const handler = jest.fn().mockResolvedValue({
        state: {
          processed: 10,
        },
      })

      queue.mockRejectedValueOnce(queueError)
      captureUnknownException.mockRejectedValueOnce(
        new Error('capture service unavailable')
      )

      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        handler,
      }

      parseRequestJson.mockResolvedValue(createValidPayload({ processed: 5 }))

      const stream = { error: jest.fn() }
      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, stream)

      expect(stream.error).toHaveBeenCalledWith(queueError)
    })

    it('should throw for invalid payload', async () => {
      const handler = jest.fn()
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        handler,
      }

      parseRequestJson.mockResolvedValue({
        type: 'invalid',
        payload: {},
      })

      const wrappedHandler = withWorkflowHandler(config)

      await expect(wrappedHandler({}, { error: jest.fn() })).rejects.toThrow(
        'Invalid workflow queue payload'
      )
      expect(handler).not.toHaveBeenCalled()
    })

    it('should throw for invalid state in payload', async () => {
      const handler = jest.fn()
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        handler,
      }

      parseRequestJson.mockResolvedValue({
        type: 'step',
        payload: {
          state: { invalid: 'state' }, // missing required 'processed' field
          meta: {
            runCount: 0,
            startedAt: Date.now(),
            lastRunAt: Date.now(),
          },
        },
      })

      const wrappedHandler = withWorkflowHandler(config)

      await expect(wrappedHandler({}, { error: jest.fn() })).rejects.toThrow()
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('resource cleanup', () => {
    it('should clear maxTime abort timeout after successful completion', async () => {
      const handler = jest.fn().mockResolvedValue(null)
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxTimeMs: 60000,
        onMaxTimeExceeded: 'error',
        handler,
      }

      parseRequestJson.mockResolvedValue(createValidPayload({ processed: 5 }))

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

      try {
        const wrappedHandler = withWorkflowHandler(config)

        await wrappedHandler({}, { error: jest.fn() })

        expect(setTimeoutSpy).toHaveBeenCalled()
        expect(clearTimeoutSpy).toHaveBeenCalledWith(
          setTimeoutSpy.mock.results[0].value
        )
      } finally {
        setTimeoutSpy.mockRestore()
        clearTimeoutSpy.mockRestore()
      }
    })

    it('should clear maxTime abort timeout after non-abort handler errors', async () => {
      const handlerError = new Error('handler failed')
      const handler = jest.fn().mockRejectedValue(handlerError)
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxTimeMs: 60000,
        onMaxTimeExceeded: 'error',
        handler,
      }

      parseRequestJson.mockResolvedValue(createValidPayload({ processed: 5 }))

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

      try {
        const wrappedHandler = withWorkflowHandler(config)

        await wrappedHandler({}, { error: jest.fn() })

        expect(setTimeoutSpy).toHaveBeenCalled()
        expect(clearTimeoutSpy).toHaveBeenCalledWith(
          setTimeoutSpy.mock.results[0].value
        )
      } finally {
        setTimeoutSpy.mockRestore()
        clearTimeoutSpy.mockRestore()
      }
    })

    it('should not create an abort timeout when only maxRuns is configured', async () => {
      const handler = jest.fn().mockResolvedValue(null)
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        handler,
      }

      parseRequestJson.mockResolvedValue(createValidPayload({ processed: 5 }))

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

      try {
        const wrappedHandler = withWorkflowHandler(config)

        await wrappedHandler({}, { error: jest.fn() })

        expect(setTimeoutSpy).not.toHaveBeenCalled()
        expect(clearTimeoutSpy).not.toHaveBeenCalled()
      } finally {
        setTimeoutSpy.mockRestore()
        clearTimeoutSpy.mockRestore()
      }
    })
  })

  describe('run count tracking', () => {
    it('should increment run count correctly', async () => {
      const handler = jest.fn().mockResolvedValue({ state: { processed: 10 } })
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxRuns: 10,
        onMaxRunsExceeded: 'error',
        handler,
      }

      parseRequestJson.mockResolvedValue(
        createValidPayload({ processed: 5 }, { runCount: 3 })
      )

      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, { error: jest.fn() })

      // Handler should receive runCount: 4 (3 + 1)
      expect(handler).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ runCount: 4 })
      )

      // Re-queued message should have runCount: 4
      expect(queue).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          payload: expect.objectContaining({
            meta: expect.objectContaining({ runCount: 4 }),
          }),
        }),
        expect.any(Object)
      )
    })
  })
})

describe('sendWorkflowEvent', () => {
  const queue = require('@/lib/queue').default

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should queue initial event with correct structure', async () => {
    const route = '/api/v1/test/queue'
    const initialState = { cursor: undefined, processed: 0 }

    await sendWorkflowEvent(route, initialState, { workflowId: 'wf-init' })

    expect(queue).toHaveBeenCalledWith(
      route,
      expect.objectContaining({
        type: 'step',
        payload: expect.objectContaining({
          state: initialState,
          meta: expect.objectContaining({
            runCount: 0,
            startedAt: expect.any(Number),
            lastRunAt: expect.any(Number),
          }),
        }),
      }),
      expect.objectContaining({
        flow: {
          key: 'wf-init',
          parallel: 1,
        },
      })
    )
  })

  it('should pass options to queue', async () => {
    const route = '/api/v1/test/queue'
    const initialState = { processed: 0 }

    await sendWorkflowEvent(route, initialState, {
      delayInSeconds: 10,
      workflowId: 'test-wf',
    })

    expect(queue).toHaveBeenCalledWith(
      route,
      expect.any(Object),
      expect.objectContaining({
        delayInSeconds: 10,
        // initial-delivery dedup is the workflowId
        deduplicationId: 'test-wf',
        flow: {
          key: 'test-wf',
          parallel: 1,
        },
      })
    )
  })

  it('should add workflow-scoped flow control to the initial event', async () => {
    const route = '/api/v1/test/queue'
    const initialState = { processed: 0 }

    await sendWorkflowEvent(route, initialState, {
      workflowId: 'test-workflow',
    })

    expect(queue).toHaveBeenCalledWith(
      route,
      expect.any(Object),
      expect.objectContaining({
        deduplicationId: 'test-workflow',
        flow: {
          key: 'test-workflow',
          parallel: 1,
        },
      })
    )
  })

  it('should default flowKey to workflowId, and override it when provided', async () => {
    const route = '/api/v1/test/queue'

    await sendWorkflowEvent(route, { processed: 0 }, { workflowId: 'wf-1' })
    expect(queue.mock.calls[0][2].flow.key).toBe('wf-1')

    await sendWorkflowEvent(
      route,
      { processed: 0 },
      { workflowId: 'wf-2', flowKey: 'shared-resource' }
    )
    // distinct instance id, shared serialization key
    expect(queue.mock.calls[1][1].payload.meta.workflowId).toBe('wf-2')
    expect(queue.mock.calls[1][2].flow.key).toBe('shared-resource')
    expect(queue.mock.calls[1][1].payload.meta.flowKey).toBe('shared-resource')
  })

  it('should set startedAt and lastRunAt to same value', async () => {
    const route = '/api/v1/test/queue'
    const initialState = { processed: 0 }

    await sendWorkflowEvent(route, initialState, { workflowId: 'wf-x' })

    const payload = queue.mock.calls[0][1].payload

    expect(payload.meta.startedAt).toBe(payload.meta.lastRunAt)
  })
})

// ---------------------------------------------------------------------------
// BUG TESTS
// Each test asserts the desired (correct) behavior. A test failing here means
// the bug is real and unresolved in the source.
// ---------------------------------------------------------------------------

describe('bugs', () => {
  const { parseRequestJson } = require('@/lib/request')
  const { captureUnknownException } = require('@/lib/response')

  const testStateSchema = z.object({
    cursor: z.string().optional(),
    processed: z.number(),
  })

  const createValidPayload = (state, meta) => ({
    type: 'step',
    payload: {
      state,
      meta: {
        runCount: 0,
        startedAt: Date.now() - 1000,
        lastRunAt: Date.now() - 1000,
        workflowId: 'wf-test',
        ...meta,
      },
    },
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // BUG: stream.error is not called when captureUnknownException itself throws.
  //
  // The catch block executes sequentially:
  //   await captureUnknownException(e)   ← throws here
  //   await stream.error(e)              ← never reached
  //
  // This leaves the stream without a teardown signal. The desired behavior is
  // that stream.error is always called with the original handler error regardless
  // of whether captureUnknownException succeeds or fails.
  it('should call stream.error with the original error even when captureUnknownException throws', async () => {
    const handlerError = new Error('Processing failed')

    captureUnknownException.mockRejectedValueOnce(
      new Error('capture service unavailable')
    )

    const handler = jest.fn().mockRejectedValue(handlerError)
    const config = {
      route: '/api/v1/test/queue',
      stateSchema: testStateSchema,
      maxRuns: 10,
      onMaxRunsExceeded: 'error',
      handler,
    }

    parseRequestJson.mockResolvedValue(createValidPayload({ processed: 0 }))

    const stream = { error: jest.fn() }
    const wrappedHandler = withWorkflowHandler(config)

    // Should resolve cleanly - stream.error signals the error to the caller
    await wrappedHandler({}, stream)

    // stream.error must always be called with the original handler error
    expect(stream.error).toHaveBeenCalledWith(handlerError)
  })

  // BUG: if an onMaxRunsExceeded or onMaxTimeExceeded callback throws, the
  // error propagates unhandled - no captureUnknownException, no stream.error.
  // The desired behavior is the same as any other handler error: capture it
  // and signal the stream.
  it('should capture and report to stream when onMaxRunsExceeded callback throws', async () => {
    const callbackError = new Error('callback exploded')
    const onMaxRunsExceeded = jest.fn().mockRejectedValue(callbackError)

    const config = {
      route: '/api/v1/test/queue',
      stateSchema: testStateSchema,
      maxRuns: 3,
      onMaxRunsExceeded,
      handler: jest.fn(),
    }

    parseRequestJson.mockResolvedValue(
      createValidPayload({ processed: 0 }, { runCount: 3 })
    )

    const stream = { error: jest.fn() }
    const wrappedHandler = withWorkflowHandler(config)

    await wrappedHandler({}, stream)

    expect(captureUnknownException).toHaveBeenCalledWith(callbackError)
    expect(stream.error).toHaveBeenCalledWith(callbackError)
  })

  it('should capture and report to stream when onMaxTimeExceeded callback throws', async () => {
    const callbackError = new Error('time callback exploded')
    const onMaxTimeExceeded = jest.fn().mockRejectedValue(callbackError)

    const now = Date.now()
    const config = {
      route: '/api/v1/test/queue',
      stateSchema: testStateSchema,
      maxTimeMs: 1000,
      onMaxTimeExceeded,
      handler: jest.fn(),
    }

    parseRequestJson.mockResolvedValue(
      createValidPayload({ processed: 0 }, { startedAt: now - 5000 })
    )

    const stream = { error: jest.fn() }
    const wrappedHandler = withWorkflowHandler(config)

    await wrappedHandler({}, stream)

    expect(captureUnknownException).toHaveBeenCalledWith(callbackError)
    expect(stream.error).toHaveBeenCalledWith(callbackError)
  })

  // BUG: captureObservation in the abort path can throw, propagating an
  // unhandled error out of the handler. The desired behavior is to swallow
  // the observation failure - the abort has already been handled.
  it('should not propagate when captureObservation throws in the abort path', async () => {
    const { captureObservation } = require('@/lib/error')

    captureObservation.mockRejectedValueOnce(
      new Error('observation service down')
    )

    const handler = jest.fn().mockRejectedValue(new WorkflowAbortError())
    const config = {
      route: '/api/v1/test/queue',
      stateSchema: testStateSchema,
      maxRuns: 10,
      onMaxRunsExceeded: 'error',
      handler,
    }

    parseRequestJson.mockResolvedValue(createValidPayload({ processed: 0 }))

    const stream = { error: jest.fn() }
    const wrappedHandler = withWorkflowHandler(config)

    // Should resolve cleanly, not reject
    await expect(wrappedHandler({}, stream)).resolves.toBeUndefined()
    expect(stream.error).not.toHaveBeenCalled()
  })

  it('should treat WorkflowAbortError from onMaxRunsExceeded callback as a clean abort', async () => {
    const onMaxRunsExceeded = jest
      .fn()
      .mockRejectedValue(new WorkflowAbortError())

    const config = {
      route: '/api/v1/test/queue',
      stateSchema: testStateSchema,
      maxRuns: 3,
      onMaxRunsExceeded,
      handler: jest.fn(),
    }

    parseRequestJson.mockResolvedValue(
      createValidPayload({ processed: 0 }, { runCount: 3 })
    )

    const stream = { error: jest.fn() }
    const wrappedHandler = withWorkflowHandler(config)

    await wrappedHandler({}, stream)

    // Callback aborted intentionally - should be silent, no error reporting
    expect(captureUnknownException).not.toHaveBeenCalled()
    expect(stream.error).not.toHaveBeenCalled()
  })

  it('should treat WorkflowAbortError from onMaxTimeExceeded callback as a clean abort', async () => {
    const onMaxTimeExceeded = jest
      .fn()
      .mockRejectedValue(new WorkflowAbortError())

    const now = Date.now()
    const config = {
      route: '/api/v1/test/queue',
      stateSchema: testStateSchema,
      maxTimeMs: 1000,
      onMaxTimeExceeded,
      handler: jest.fn(),
    }

    parseRequestJson.mockResolvedValue(
      createValidPayload({ processed: 0 }, { startedAt: now - 5000 })
    )

    const stream = { error: jest.fn() }
    const wrappedHandler = withWorkflowHandler(config)

    await wrappedHandler({}, stream)

    expect(captureUnknownException).not.toHaveBeenCalled()
    expect(stream.error).not.toHaveBeenCalled()
  })

  it('should treat standard AbortError from onMaxRunsExceeded callback as a clean abort', async () => {
    const abortError = new Error('underlying op aborted')

    abortError.name = 'AbortError'

    const onMaxRunsExceeded = jest.fn().mockRejectedValue(abortError)

    const config = {
      route: '/api/v1/test/queue',
      stateSchema: testStateSchema,
      maxRuns: 3,
      onMaxRunsExceeded,
      handler: jest.fn(),
    }

    parseRequestJson.mockResolvedValue(
      createValidPayload({ processed: 0 }, { runCount: 3 })
    )

    const stream = { error: jest.fn() }
    const wrappedHandler = withWorkflowHandler(config)

    await wrappedHandler({}, stream)

    expect(captureUnknownException).not.toHaveBeenCalled()
    expect(stream.error).not.toHaveBeenCalled()
  })

  // DESIGN: meta.runCount counts wrapper invocations, including the one
  // that hit the limit gate (handler not executed). This means the callback
  // sees runCount = previous + 1, not the count of runs whose inner handler
  // actually ran.
  //
  // Why: every queue delivery is an "invocation" - the wrapper had to
  // accept, parse, and gate it. Counting only successful inner-handler
  // executions would let runaway re-deliveries grow unbounded without ever
  // incrementing the count, defeating its use as a quota / monitoring
  // signal. Pinned as a regression test so this stays intentional.
  it('should report the gated invocation in runCount (one above completed runs)', async () => {
    const onMaxRunsExceeded = jest.fn()
    const config = {
      route: '/api/v1/test/queue',
      stateSchema: testStateSchema,
      maxRuns: 5,
      onMaxRunsExceeded,
      handler: jest.fn(),
    }

    parseRequestJson.mockResolvedValue(
      createValidPayload({ processed: 0 }, { runCount: 5 })
    )

    const wrappedHandler = withWorkflowHandler(config)

    await wrappedHandler({}, { error: jest.fn() })

    expect(onMaxRunsExceeded).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ runCount: 6 })
    )
  })

  // BUG: The abort timer is cleared in `finally`, which only runs AFTER
  // `stateSchema.parse(result.state)` and `await queue(...)` complete.
  //
  // If the re-queue takes long enough to push past `maxTimeMs`, the
  // timer fires and aborts the AbortController mid-requeue. Even though
  // the handler already resolved with a valid result, the signal ends
  // up aborted, polluting cleanup state.
  //
  // The desired behavior is to clear the abort timer immediately after
  // Promise.race settles successfully, so the signal stays clean while
  // we finish the post-handler bookkeeping.
  it('should clear the abort timer before re-queuing when handler resolves', async () => {
    jest.useFakeTimers()

    try {
      const handler = jest.fn().mockResolvedValue({ state: { processed: 10 } })

      const callOrder = []

      const queueMod = require('@/lib/queue')

      queueMod.default.mockImplementation(async () => {
        callOrder.push('queue')
      })

      const clearTimeoutSpy = jest
        .spyOn(global, 'clearTimeout')
        .mockImplementation((id) => {
          callOrder.push('clearTimeout')

          return jest.requireActual('timers').clearTimeout(id)
        })

      const now = Date.now()
      const config = {
        route: '/api/v1/test/queue',
        stateSchema: testStateSchema,
        maxTimeMs: 60000,
        onMaxTimeExceeded: 'error',
        handler,
      }

      parseRequestJson.mockResolvedValue(
        createValidPayload({ processed: 5 }, { startedAt: now })
      )

      const wrappedHandler = withWorkflowHandler(config)

      await wrappedHandler({}, { error: jest.fn() })

      const clearIdx = callOrder.indexOf('clearTimeout')
      const queueIdx = callOrder.indexOf('queue')

      expect(clearIdx).toBeGreaterThanOrEqual(0)
      expect(queueIdx).toBeGreaterThanOrEqual(0)
      expect(clearIdx).toBeLessThan(queueIdx)

      clearTimeoutSpy.mockRestore()
    } finally {
      jest.useRealTimers()
    }
  })

  // BUG: QStash is at-least-once. The re-queue path doesn't pass a
  // deduplicationId, so a redelivered step (network blip, ack lost) runs
  // the handler twice with the same payload and re-queues twice -
  // forking the workflow.
  //
  // Fix: derive a stable dedup ID per step from a workflow-instance ID
  // plus the next-run number.
  const queue = require('@/lib/queue').default

  it('should carry the caller-supplied workflowId into meta', async () => {
    await sendWorkflowEvent(
      '/api/v1/test/queue',
      { processed: 0 },
      { workflowId: 'wf-explicit' }
    )

    const meta = queue.mock.calls[0][1].payload.meta

    expect(meta.workflowId).toBe('wf-explicit')
  })

  it('should faithfully carry distinct workflowIds across separate calls', async () => {
    await sendWorkflowEvent(
      '/api/v1/test/queue',
      { processed: 0 },
      { workflowId: 'wf-a' }
    )
    await sendWorkflowEvent(
      '/api/v1/test/queue',
      { processed: 0 },
      { workflowId: 'wf-b' }
    )

    const id1 = queue.mock.calls[0][1].payload.meta.workflowId
    const id2 = queue.mock.calls[1][1].payload.meta.workflowId

    expect(id1).toBe('wf-a')
    expect(id2).toBe('wf-b')
    expect(id1).not.toBe(id2)
  })

  it('should use options.workflowId as both the meta workflowId and initial dedup id', async () => {
    await sendWorkflowEvent(
      '/api/v1/test/queue',
      { processed: 0 },
      { workflowId: 'caller-supplied-id' }
    )

    const meta = queue.mock.calls[0][1].payload.meta

    expect(meta.workflowId).toBe('caller-supplied-id')
    expect(queue.mock.calls[0][2].deduplicationId).toBe('caller-supplied-id')
  })

  it('should derive consistent step dedup IDs from a caller-supplied workflowId', async () => {
    const handler = jest.fn().mockResolvedValue({ state: { processed: 10 } })
    const config = {
      route: '/api/v1/test/queue',
      stateSchema: testStateSchema,
      maxRuns: 10,
      onMaxRunsExceeded: 'error',
      handler,
    }

    parseRequestJson.mockResolvedValue({
      type: 'step',
      payload: {
        state: { processed: 5 },
        meta: {
          runCount: 2,
          startedAt: Date.now() - 1000,
          lastRunAt: Date.now() - 1000,
          workflowId: 'caller-supplied-id',
        },
      },
    })

    const wrappedHandler = withWorkflowHandler(config)

    await wrappedHandler({}, { error: jest.fn() })

    expect(queue.mock.calls[0][2].deduplicationId).toBe('caller-supplied-id-4')
  })

  it('should pass a deduplicationId on re-queue', async () => {
    const handler = jest.fn().mockResolvedValue({ state: { processed: 10 } })
    const config = {
      route: '/api/v1/test/queue',
      stateSchema: testStateSchema,
      maxRuns: 10,
      onMaxRunsExceeded: 'error',
      handler,
    }

    parseRequestJson.mockResolvedValue({
      type: 'step',
      payload: {
        state: { processed: 5 },
        meta: {
          runCount: 0,
          startedAt: Date.now() - 1000,
          lastRunAt: Date.now() - 1000,
          workflowId: 'wf-123',
        },
      },
    })

    const wrappedHandler = withWorkflowHandler(config)

    await wrappedHandler({}, { error: jest.fn() })

    expect(queue).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        deduplicationId: expect.stringContaining('wf-123'),
      })
    )
  })

  it('should add workflow-scoped flow control on re-queue', async () => {
    const handler = jest.fn().mockResolvedValue({ state: { processed: 10 } })
    const config = {
      route: '/api/v1/test/queue',
      stateSchema: testStateSchema,
      maxRuns: 10,
      onMaxRunsExceeded: 'error',
      handler,
    }

    parseRequestJson.mockResolvedValue({
      type: 'step',
      payload: {
        state: { processed: 5 },
        meta: {
          runCount: 0,
          startedAt: Date.now() - 1000,
          lastRunAt: Date.now() - 1000,
          workflowId: 'wf-123',
        },
      },
    })

    const wrappedHandler = withWorkflowHandler(config)

    await wrappedHandler({}, { error: jest.fn() })

    expect(queue).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        flow: {
          key: 'wf-123',
          parallel: 1,
        },
      })
    )
  })

  it('should produce different re-queue deduplicationIds across consecutive steps', async () => {
    const handler = jest.fn().mockResolvedValue({ state: { processed: 10 } })
    const config = {
      route: '/api/v1/test/queue',
      stateSchema: testStateSchema,
      maxRuns: 10,
      onMaxRunsExceeded: 'error',
      handler,
    }

    const baseMeta = {
      startedAt: Date.now() - 1000,
      lastRunAt: Date.now() - 1000,
      workflowId: 'wf-abc',
    }

    parseRequestJson.mockResolvedValueOnce({
      type: 'step',
      payload: {
        state: { processed: 5 },
        meta: { ...baseMeta, runCount: 0 },
      },
    })

    const wrappedHandler = withWorkflowHandler(config)

    await wrappedHandler({}, { error: jest.fn() })

    parseRequestJson.mockResolvedValueOnce({
      type: 'step',
      payload: {
        state: { processed: 5 },
        meta: { ...baseMeta, runCount: 1 },
      },
    })

    await wrappedHandler({}, { error: jest.fn() })

    const dedup1 = queue.mock.calls[0][2].deduplicationId
    const dedup2 = queue.mock.calls[1][2].deduplicationId

    expect(dedup1).toBeTruthy()
    expect(dedup2).toBeTruthy()
    expect(dedup1).not.toBe(dedup2)
  })

  it('should produce a stable re-queue deduplicationId for the same step', async () => {
    const handler = jest.fn().mockResolvedValue({ state: { processed: 10 } })
    const config = {
      route: '/api/v1/test/queue',
      stateSchema: testStateSchema,
      maxRuns: 10,
      onMaxRunsExceeded: 'error',
      handler,
    }

    const meta = {
      runCount: 2,
      startedAt: 1000,
      lastRunAt: 2000,
      workflowId: 'wf-xyz',
    }

    parseRequestJson.mockResolvedValue({
      type: 'step',
      payload: { state: { processed: 5 }, meta },
    })

    const wrappedHandler = withWorkflowHandler(config)

    await wrappedHandler({}, { error: jest.fn() })
    await wrappedHandler({}, { error: jest.fn() })

    const dedup1 = queue.mock.calls[0][2].deduplicationId
    const dedup2 = queue.mock.calls[1][2].deduplicationId

    expect(dedup1).toBe(dedup2)
  })

  it('should reject an event whose meta lacks workflowId (no timestamp fallback)', async () => {
    const handler = jest.fn()
    const config = {
      route: '/api/v1/test/queue',
      stateSchema: testStateSchema,
      maxRuns: 10,
      onMaxRunsExceeded: 'error',
      handler,
    }

    parseRequestJson.mockResolvedValue({
      type: 'step',
      payload: {
        state: { processed: 5 },
        meta: {
          runCount: 1,
          startedAt: 12345,
          lastRunAt: 12345,
          // no workflowId - now required, so the envelope is rejected rather
          // than silently deriving a dedup root from startedAt
        },
      },
    })

    const wrappedHandler = withWorkflowHandler(config)

    await expect(wrappedHandler({}, { error: jest.fn() })).rejects.toThrow(
      'Invalid workflow queue payload'
    )
    expect(handler).not.toHaveBeenCalled()
  })

  // BUG: 'error' mode causes a retry storm.
  //
  // When onMaxRunsExceeded === 'error', the wrapper throws
  // MaxRunsExceededError directly from the limit branch (workflow.ts:355).
  // The throw is OUTSIDE the main try/catch (which only wraps the handler
  // execution), so:
  //   - captureUnknownException is never called → telemetry misses it
  //   - stream.error is never called → no teardown signal
  //   - the throw bubbles up to the queue framework, which sees a non-2xx
  //     response and retries the delivery with the same payload, which
  //     re-throws, etc. - up to QStash's retry budget
  //
  // The user's intent for 'error' mode is "alert me loudly", which is a
  // telemetry requirement, not a retry requirement. The desired behavior
  // is to capture + stream-signal + return cleanly so QStash gets a 2xx
  // and stops re-delivering the dead payload.
  //
  // Same bug for onMaxTimeExceeded === 'error'.
  it('should capture exception when maxRuns limit is hit with error mode', async () => {
    const handler = jest.fn()
    const config = {
      route: '/api/v1/test/queue',
      stateSchema: testStateSchema,
      maxRuns: 5,
      onMaxRunsExceeded: 'error',
      handler,
    }

    parseRequestJson.mockResolvedValue(
      createValidPayload({ processed: 0 }, { runCount: 5 })
    )

    const stream = { error: jest.fn() }
    const wrappedHandler = withWorkflowHandler(config)

    await wrappedHandler({}, stream).catch(() => {})

    expect(captureUnknownException).toHaveBeenCalledWith(
      expect.any(MaxRunsExceededError)
    )
  })

  it('should signal stream.error when maxRuns limit is hit with error mode', async () => {
    const handler = jest.fn()
    const config = {
      route: '/api/v1/test/queue',
      stateSchema: testStateSchema,
      maxRuns: 5,
      onMaxRunsExceeded: 'error',
      handler,
    }

    parseRequestJson.mockResolvedValue(
      createValidPayload({ processed: 0 }, { runCount: 5 })
    )

    const stream = { error: jest.fn() }
    const wrappedHandler = withWorkflowHandler(config)

    await wrappedHandler({}, stream).catch(() => {})

    expect(stream.error).toHaveBeenCalledWith(expect.any(MaxRunsExceededError))
  })

  it('should not throw when maxRuns limit is hit with error mode (no QStash retry storm)', async () => {
    const handler = jest.fn()
    const config = {
      route: '/api/v1/test/queue',
      stateSchema: testStateSchema,
      maxRuns: 5,
      onMaxRunsExceeded: 'error',
      handler,
    }

    parseRequestJson.mockResolvedValue(
      createValidPayload({ processed: 0 }, { runCount: 5 })
    )

    const wrappedHandler = withWorkflowHandler(config)

    await expect(
      wrappedHandler({}, { error: jest.fn() })
    ).resolves.toBeUndefined()
  })

  it('should capture exception when maxTime limit is hit with error mode', async () => {
    const handler = jest.fn()
    const config = {
      route: '/api/v1/test/queue',
      stateSchema: testStateSchema,
      maxTimeMs: 1000,
      onMaxTimeExceeded: 'error',
      handler,
    }

    parseRequestJson.mockResolvedValue(
      createValidPayload({ processed: 0 }, { startedAt: Date.now() - 5000 })
    )

    const stream = { error: jest.fn() }
    const wrappedHandler = withWorkflowHandler(config)

    await wrappedHandler({}, stream).catch(() => {})

    expect(captureUnknownException).toHaveBeenCalledWith(
      expect.any(MaxTimeExceededError)
    )
  })

  it('should signal stream.error when maxTime limit is hit with error mode', async () => {
    const handler = jest.fn()
    const config = {
      route: '/api/v1/test/queue',
      stateSchema: testStateSchema,
      maxTimeMs: 1000,
      onMaxTimeExceeded: 'error',
      handler,
    }

    parseRequestJson.mockResolvedValue(
      createValidPayload({ processed: 0 }, { startedAt: Date.now() - 5000 })
    )

    const stream = { error: jest.fn() }
    const wrappedHandler = withWorkflowHandler(config)

    await wrappedHandler({}, stream).catch(() => {})

    expect(stream.error).toHaveBeenCalledWith(expect.any(MaxTimeExceededError))
  })

  it('should not throw when maxTime limit is hit with error mode (no QStash retry storm)', async () => {
    const handler = jest.fn()
    const config = {
      route: '/api/v1/test/queue',
      stateSchema: testStateSchema,
      maxTimeMs: 1000,
      onMaxTimeExceeded: 'error',
      handler,
    }

    parseRequestJson.mockResolvedValue(
      createValidPayload({ processed: 0 }, { startedAt: Date.now() - 5000 })
    )

    const wrappedHandler = withWorkflowHandler(config)

    await expect(
      wrappedHandler({}, { error: jest.fn() })
    ).resolves.toBeUndefined()
  })
})
