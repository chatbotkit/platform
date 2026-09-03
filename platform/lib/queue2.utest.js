/* eslint-disable @typescript-eslint/no-require-imports */
import {
  validateSchema,
  withQueueHandler,
  withQueueHandlerBounded,
} from './queue2'

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn() })),
}))

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
  captureException: jest.fn(),
  captureObservation: jest.fn(),
  captureUnexpectedState: jest.fn(),
  errorToSystemError: jest.fn((error) => error),
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
  withQueue: jest.fn((fn) => fn),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn(),
}))

jest.mock('@/lib/request', () => ({
  parseRequestJson: jest.fn(),
}))

describe('validateSchema', () => {
  const { captureException, captureError } = require('@/lib/error')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should validate with validateAsync method', async () => {
      const schema = {
        validateAsync: jest.fn().mockResolvedValue({ validated: true }),
      }
      const data = { test: 'data' }

      const result = await validateSchema(schema, data)

      expect(schema.validateAsync).toHaveBeenCalledWith(data)
      expect(result).toEqual({ validated: true })
    })

    it('should validate with validate method', async () => {
      const schema = {
        validate: jest.fn().mockReturnValue({
          error: null,
          value: { validated: true },
        }),
      }
      const data = { test: 'data' }

      const result = await validateSchema(schema, data)

      expect(schema.validate).toHaveBeenCalledWith(data)
      expect(result).toEqual({ validated: true })
    })

    it('should validate with parseAsync method', async () => {
      const schema = {
        parseAsync: jest.fn().mockResolvedValue({ validated: true }),
      }
      const data = { test: 'data' }

      const result = await validateSchema(schema, data)

      expect(schema.parseAsync).toHaveBeenCalledWith(data)
      expect(result).toEqual({ validated: true })
    })

    it('should validate with parse method', async () => {
      const schema = {
        parse: jest.fn().mockReturnValue({ validated: true }),
      }
      const data = { test: 'data' }

      const result = await validateSchema(schema, data)

      expect(schema.parse).toHaveBeenCalledWith(data)
      expect(result).toEqual({ validated: true })
    })
  })

  describe('error handling', () => {
    it('should throw for validateAsync errors', async () => {
      const schema = {
        validateAsync: jest
          .fn()
          .mockRejectedValue(new Error('Validation failed')),
      }
      const data = { test: 'data' }

      await expect(validateSchema(schema, data)).rejects.toThrow(
        'Validation failed'
      )
      expect(captureException).toHaveBeenCalled()
    })

    it('should throw for validate errors', async () => {
      const schema = {
        validate: jest.fn().mockReturnValue({
          error: new Error('Validation failed'),
          value: null,
        }),
      }
      const data = { test: 'data' }

      await expect(validateSchema(schema, data)).rejects.toThrow(
        'Validation failed'
      )
      expect(captureError).toHaveBeenCalled()
    })

    it('should throw for parseAsync errors', async () => {
      const schema = {
        parseAsync: jest.fn().mockRejectedValue(new Error('Parse failed')),
      }
      const data = { test: 'data' }

      await expect(validateSchema(schema, data)).rejects.toThrow('Parse failed')
      expect(captureException).toHaveBeenCalled()
    })

    it('should throw for parse errors', async () => {
      const schema = {
        parse: jest.fn().mockImplementation(() => {
          throw new Error('Parse failed')
        }),
      }
      const data = { test: 'data' }

      await expect(validateSchema(schema, data)).rejects.toThrow('Parse failed')
      expect(captureException).toHaveBeenCalled()
    })

    it('should throw for invalid schema config', async () => {
      const schema = {}
      const data = { test: 'data' }

      await expect(validateSchema(schema, data)).rejects.toThrow(
        'Invalid schema config'
      )
      expect(captureException).toHaveBeenCalled()
    })
  })
})

describe('withQueueHandler', () => {
  const { parseRequestJson } = require('@/lib/request')
  const { captureUnknownException } = require('@/lib/response')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should handle valid request with handler', async () => {
    const handler = jest.fn().mockResolvedValue(undefined)
    const handlers = {
      testType: { handler },
    }

    parseRequestJson.mockResolvedValue({
      type: 'testType',
      payload: { data: 'test' },
    })

    const wrappedHandler = withQueueHandler(handlers)
    const req = {}
    const stream = { error: jest.fn() }

    await wrappedHandler(req, stream)

    expect(handler).toHaveBeenCalledWith(
      { data: 'test' },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(stream.error).not.toHaveBeenCalled()
  })

  it('should validate payload with schema', async () => {
    const handler = jest.fn().mockResolvedValue(undefined)
    const schema = {
      parse: jest.fn().mockReturnValue({ validated: true }),
    }
    const handlers = {
      testType: { handler, schema },
    }

    parseRequestJson.mockResolvedValue({
      type: 'testType',
      payload: { data: 'test' },
    })

    const wrappedHandler = withQueueHandler(handlers)
    const req = {}
    const stream = { error: jest.fn() }

    await wrappedHandler(req, stream)

    expect(schema.parse).toHaveBeenCalledWith({ data: 'test' })
    expect(handler).toHaveBeenCalledWith(
      { validated: true },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('should handle unrecognized type', async () => {
    const handlers = {}

    parseRequestJson.mockResolvedValue({
      type: 'unknownType',
      payload: {},
    })

    const wrappedHandler = withQueueHandler(handlers)
    const req = {}
    const stream = { error: jest.fn() }

    await wrappedHandler(req, stream)

    expect(captureUnknownException).toHaveBeenCalled()
    expect(stream.error).toHaveBeenCalled()
  })

  it('should handle handler errors', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('Handler failed'))
    const handlers = {
      testType: { handler },
    }

    parseRequestJson.mockResolvedValue({
      type: 'testType',
      payload: {},
    })

    const wrappedHandler = withQueueHandler(handlers)
    const req = {}
    const stream = { error: jest.fn() }

    await wrappedHandler(req, stream)

    expect(captureUnknownException).toHaveBeenCalled()
    expect(stream.error).toHaveBeenCalled()
  })
})

describe('withQueueHandlerBounded', () => {
  const { requiredUrlParam } = require('@/lib/query.get')
  const { parseRequestJson } = require('@/lib/request')
  const { captureUnknownException } = require('@/lib/response')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should handle valid bounded request', async () => {
    const handler = jest.fn().mockResolvedValue(undefined)
    const handlers = {
      testType: { handler },
    }

    requiredUrlParam.mockReturnValue('param-value')
    parseRequestJson.mockResolvedValue({
      type: 'testType',
      payload: { data: 'test' },
    })

    const wrappedHandler = withQueueHandlerBounded('paramName', handlers)
    const req = {}
    const stream = { error: jest.fn() }

    await wrappedHandler(req, stream)

    expect(requiredUrlParam).toHaveBeenCalledWith(req, 'paramName')
    expect(handler).toHaveBeenCalledWith(
      'param-value',
      { data: 'test' },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(stream.error).not.toHaveBeenCalled()
  })

  it('should validate bounded payload with schema', async () => {
    const handler = jest.fn().mockResolvedValue(undefined)
    const schema = {
      parse: jest.fn().mockReturnValue({ validated: true }),
    }
    const handlers = {
      testType: { handler, schema },
    }

    requiredUrlParam.mockReturnValue('param-value')
    parseRequestJson.mockResolvedValue({
      type: 'testType',
      payload: { data: 'test' },
    })

    const wrappedHandler = withQueueHandlerBounded('paramName', handlers)
    const req = {}
    const stream = { error: jest.fn() }

    await wrappedHandler(req, stream)

    expect(schema.parse).toHaveBeenCalledWith({ data: 'test' })
    expect(handler).toHaveBeenCalledWith(
      'param-value',
      { validated: true },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('should handle unrecognized type in bounded handler', async () => {
    const handlers = {}

    requiredUrlParam.mockReturnValue('param-value')
    parseRequestJson.mockResolvedValue({
      type: 'unknownType',
      payload: {},
    })

    const wrappedHandler = withQueueHandlerBounded('paramName', handlers)
    const req = {}
    const stream = { error: jest.fn() }

    await wrappedHandler(req, stream)

    expect(captureUnknownException).toHaveBeenCalled()
    expect(stream.error).toHaveBeenCalled()
  })

  it('should handle bounded handler errors', async () => {
    const handler = jest
      .fn()
      .mockRejectedValue(new Error('Bounded handler failed'))
    const handlers = {
      testType: { handler },
    }

    requiredUrlParam.mockReturnValue('param-value')
    parseRequestJson.mockResolvedValue({
      type: 'testType',
      payload: {},
    })

    const wrappedHandler = withQueueHandlerBounded('paramName', handlers)
    const req = {}
    const stream = { error: jest.fn() }

    await wrappedHandler(req, stream)

    expect(captureUnknownException).toHaveBeenCalled()
    expect(stream.error).toHaveBeenCalled()
  })
})

describe('timeout behavior', () => {
  const { parseRequestJson } = require('@/lib/request')
  const { requiredUrlParam } = require('@/lib/query.get')
  const { captureUnexpectedState, captureObservation } = require('@/lib/error')

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('withQueueHandler', () => {
    it('should abort signal and call captureUnexpectedState when handler times out', async () => {
      let capturedSignal

      const handler = jest.fn().mockImplementation(async (payload, { signal }) => {
        capturedSignal = signal
        // Resolve when aborted so the outer handler can complete
        await new Promise((resolve) => signal.addEventListener('abort', resolve))
      })

      parseRequestJson.mockResolvedValue({
        type: 'testType',
        payload: { data: 'test' },
      })

      const wrappedHandler = withQueueHandler({ testType: { handler } })
      const stream = { error: jest.fn() }

      const promise = wrappedHandler({}, stream)

      await jest.advanceTimersByTimeAsync(750_000)
      await promise

      expect(capturedSignal.aborted).toBe(true)
      expect(captureUnexpectedState).toHaveBeenCalledWith(
        'Queue handler timed out',
        expect.objectContaining({
          type: 'testType',
          timeoutMs: 750_000,
        })
      )
    })

    it('should not call captureUnexpectedState when handler completes before timeout', async () => {
      const handler = jest.fn().mockResolvedValue(undefined)

      parseRequestJson.mockResolvedValue({ type: 'testType', payload: {} })

      const wrappedHandler = withQueueHandler({ testType: { handler } })
      const stream = { error: jest.fn() }

      await wrappedHandler({}, stream)

      // Advance past the full timeout window to confirm the timer was cleared
      await jest.advanceTimersByTimeAsync(750_000)

      expect(captureUnexpectedState).not.toHaveBeenCalled()
    })

    it('should not call captureUnexpectedState when handler throws before timeout', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('handler error'))

      parseRequestJson.mockResolvedValue({ type: 'testType', payload: {} })

      const wrappedHandler = withQueueHandler({ testType: { handler } })
      const stream = { error: jest.fn() }

      await wrappedHandler({}, stream)

      await jest.advanceTimersByTimeAsync(750_000)

      expect(captureUnexpectedState).not.toHaveBeenCalled()
    })

    it('should pass a non-aborted signal to the handler initially', async () => {
      let capturedSignal

      const handler = jest.fn().mockImplementation(async (payload, { signal }) => {
        capturedSignal = signal
      })

      parseRequestJson.mockResolvedValue({ type: 'testType', payload: {} })

      const wrappedHandler = withQueueHandler({ testType: { handler } })

      await wrappedHandler({}, { error: jest.fn() })

      expect(capturedSignal).toBeDefined()
      expect(capturedSignal.aborted).toBe(false)
    })

    it('should report only the final (80%) mark to Sentry before the handler aborts', async () => {
      const handler = jest.fn().mockImplementation(async (payload, { signal }) => {
        await new Promise((resolve) => signal.addEventListener('abort', resolve))
      })

      parseRequestJson.mockResolvedValue({ type: 'testType', payload: {} })

      const wrappedHandler = withQueueHandler({ testType: { handler } })

      const promise = wrappedHandler({}, { error: jest.fn() })

      // 20% mark - drives the engine via markSignals only, not reported to Sentry
      await jest.advanceTimersByTimeAsync(150_000)
      expect(captureObservation).not.toHaveBeenCalled()

      // 50% mark - still engine-only, not reported to Sentry
      await jest.advanceTimersByTimeAsync(225_000)
      expect(captureObservation).not.toHaveBeenCalled()

      // 80% mark - only the final mark is reported to Sentry, as a warning
      await jest.advanceTimersByTimeAsync(225_000)
      expect(captureObservation).toHaveBeenCalledTimes(1)
      expect(captureObservation).toHaveBeenLastCalledWith(
        'Queue handler reached 80% of timeout budget',
        expect.objectContaining({ type: 'testType', mark: 0.8 }),
        { sentry: true, level: 'warning' }
      )

      // 100% aborts and the timeout notice fires; no further progress notices
      await jest.advanceTimersByTimeAsync(150_000)
      await promise

      expect(captureObservation).toHaveBeenCalledTimes(1)
      expect(captureUnexpectedState).toHaveBeenCalledWith(
        'Queue handler timed out',
        expect.objectContaining({ type: 'testType' })
      )
    })

    it('should not emit progress notices when the handler completes before the first mark', async () => {
      const handler = jest.fn().mockResolvedValue(undefined)

      parseRequestJson.mockResolvedValue({ type: 'testType', payload: {} })

      const wrappedHandler = withQueueHandler({ testType: { handler } })

      await wrappedHandler({}, { error: jest.fn() })

      // Advance past the full timeout window to confirm all timers were cleared
      await jest.advanceTimersByTimeAsync(750_000)

      expect(captureObservation).not.toHaveBeenCalled()
      expect(captureUnexpectedState).not.toHaveBeenCalled()
    })

    it('should expose one markSignal per mark that fires with the mark as reason', async () => {
      let capturedMarkSignals

      const handler = jest
        .fn()
        .mockImplementation(async (payload, { signal, markSignals }) => {
          capturedMarkSignals = markSignals

          await new Promise((resolve) =>
            signal.addEventListener('abort', resolve)
          )
        })

      parseRequestJson.mockResolvedValue({ type: 'testType', payload: {} })

      const wrappedHandler = withQueueHandler({ testType: { handler } })

      const promise = wrappedHandler({}, { error: jest.fn() })

      // let the handler start (it awaits request parsing) so it captures context
      await jest.advanceTimersByTimeAsync(0)

      // one signal per mark, none aborted initially
      expect(capturedMarkSignals).toHaveLength(3)
      expect(capturedMarkSignals.map((signal) => signal.aborted)).toEqual([
        false,
        false,
        false,
      ])

      await jest.advanceTimersByTimeAsync(150_000) // 20%
      expect(capturedMarkSignals[0].aborted).toBe(true)
      expect(capturedMarkSignals[0].reason).toEqual(
        expect.objectContaining({ mark: 0.2, elapsedMs: expect.any(Number) })
      )

      await jest.advanceTimersByTimeAsync(225_000) // 50%
      expect(capturedMarkSignals[1].aborted).toBe(true)
      expect(capturedMarkSignals[1].reason).toEqual(
        expect.objectContaining({ mark: 0.5 })
      )

      await jest.advanceTimersByTimeAsync(225_000) // 80%
      expect(capturedMarkSignals[2].aborted).toBe(true)
      expect(capturedMarkSignals[2].reason).toEqual(
        expect.objectContaining({ mark: 0.8 })
      )

      await jest.advanceTimersByTimeAsync(150_000) // 100% aborts
      await promise
    })

    it('should not fire markSignals when the handler completes before the first mark', async () => {
      let capturedMarkSignals

      const handler = jest
        .fn()
        .mockImplementation(async (payload, { markSignals }) => {
          capturedMarkSignals = markSignals
        })

      parseRequestJson.mockResolvedValue({ type: 'testType', payload: {} })

      const wrappedHandler = withQueueHandler({ testType: { handler } })

      await wrappedHandler({}, { error: jest.fn() })

      // Advance past the full timeout window to confirm all timers were cleared
      await jest.advanceTimersByTimeAsync(750_000)

      expect(capturedMarkSignals.map((signal) => signal.aborted)).toEqual([
        false,
        false,
        false,
      ])
    })
  })

  describe('withQueueHandlerBounded', () => {
    it('should abort signal and call captureUnexpectedState when bounded handler times out', async () => {
      let capturedSignal

      const handler = jest.fn().mockImplementation(async (param, payload, { signal }) => {
        capturedSignal = signal
        await new Promise((resolve) => signal.addEventListener('abort', resolve))
      })

      requiredUrlParam.mockReturnValue('test-param')
      parseRequestJson.mockResolvedValue({ type: 'testType', payload: {} })

      const wrappedHandler = withQueueHandlerBounded('paramName', {
        testType: { handler },
      })
      const stream = { error: jest.fn() }

      const promise = wrappedHandler({}, stream)

      await jest.advanceTimersByTimeAsync(750_000)
      await promise

      expect(capturedSignal.aborted).toBe(true)
      expect(captureUnexpectedState).toHaveBeenCalledWith(
        'Queue handler timed out',
        expect.objectContaining({
          type: 'testType',
          paramName: 'test-param',
          timeoutMs: 750_000,
        })
      )
    })

    it('should not call captureUnexpectedState when bounded handler completes before timeout', async () => {
      const handler = jest.fn().mockResolvedValue(undefined)

      requiredUrlParam.mockReturnValue('test-param')
      parseRequestJson.mockResolvedValue({ type: 'testType', payload: {} })

      const wrappedHandler = withQueueHandlerBounded('paramName', {
        testType: { handler },
      })
      const stream = { error: jest.fn() }

      await wrappedHandler({}, stream)

      await jest.advanceTimersByTimeAsync(750_000)

      expect(captureUnexpectedState).not.toHaveBeenCalled()
    })

    it('should not call captureUnexpectedState when bounded handler throws before timeout', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('bounded error'))

      requiredUrlParam.mockReturnValue('test-param')
      parseRequestJson.mockResolvedValue({ type: 'testType', payload: {} })

      const wrappedHandler = withQueueHandlerBounded('paramName', {
        testType: { handler },
      })
      const stream = { error: jest.fn() }

      await wrappedHandler({}, stream)

      await jest.advanceTimersByTimeAsync(750_000)

      expect(captureUnexpectedState).not.toHaveBeenCalled()
    })
  })
})
