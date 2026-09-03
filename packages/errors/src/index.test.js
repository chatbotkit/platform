/* eslint-disable @typescript-eslint/no-require-imports */
import { UnexpectedStateError, captureUnexpectedState } from './index'

jest.mock('@chatbotkit-dev/observability', () => ({
  __esModule: true,

  default: {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    setTag: jest.fn(),
  },
}))

describe('UnexpectedStateError', () => {
  it('should create error with message only', () => {
    const message = 'Test error message'
    const error = new UnexpectedStateError(message)

    expect(error.message).toBe(message)
    expect(error.data).toBeUndefined()
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(UnexpectedStateError)
  })

  it('should create error with message and context', () => {
    const message = 'Test error message'
    const context = { key: 'value' }
    const error = new UnexpectedStateError(message, context)

    expect(error.message).toBe(message)
    expect(error.data).toEqual(context)
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(UnexpectedStateError)
  })

  it('should handle null context', () => {
    const message = 'Test error message'
    const error = new UnexpectedStateError(message, null)

    expect(error.message).toBe(message)
    expect(error.data).toBeUndefined()
  })

  it('should handle undefined context', () => {
    const message = 'Test error message'
    const error = new UnexpectedStateError(message, undefined)

    expect(error.message).toBe(message)
    expect(error.data).toBeUndefined()
  })

  it('should handle string context', () => {
    const message = 'Test error message'
    const context = 'string context'
    const error = new UnexpectedStateError(message, context)

    expect(error.message).toBe(message)
    expect(error.data).toEqual(context)
  })

  it('should handle complex object context', () => {
    const message = 'Test error message'

    const context = {
      module: 'test.js',
      function: 'testFunction',
      details: { key: 'value', nested: { prop: 'test' } },
    }

    const error = new UnexpectedStateError(message, context)

    expect(error.message).toBe(message)
    expect(error.data).toEqual(context)
    expect(error.data.module).toBe('test.js')
    expect(error.data.function).toBe('testFunction')
    expect(error.data.details.nested.prop).toBe('test')
  })
})

describe('captureUnexpectedState observability integration', () => {
  const observability = jest.requireMock('@chatbotkit-dev/observability')
    .default
  const mockCaptureException = jest.mocked(observability.captureException)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should send context data to the reporter when provided', async () => {
    const message = 'Test error with context'

    const context = {
      userId: '123',
      action: 'testAction',
      requestId: 'req-456',
    }

    await captureUnexpectedState(message, context)

    expect(mockCaptureException).toHaveBeenCalledTimes(1)

    const [error, reportedContext] = mockCaptureException.mock.calls[0]

    // verify the error is an UnexpectedStateError with correct message

    expect(error).toBeInstanceOf(UnexpectedStateError)
    expect(error.message).toBe(message)
    expect(error.data).toEqual(context)

    // verify the context is passed to the reporter

    expect(reportedContext).toEqual(context)
  })

  it('should send string context to the reporter', async () => {
    const message = 'Test error with string context'
    const context = 'debug information string'

    await captureUnexpectedState(message, context)

    expect(mockCaptureException).toHaveBeenCalledTimes(1)

    const [error, reportedContext] = mockCaptureException.mock.calls[0]

    expect(error).toBeInstanceOf(UnexpectedStateError)
    expect(error.message).toBe(message)
    expect(error.data).toBe(context)
    expect(reportedContext).toBe(context)
  })

  it('should send complex nested context to the reporter', async () => {
    const message = 'Test error with complex context'

    const context = {
      request: {
        method: 'POST',
        url: '/api/test',
        headers: { 'content-type': 'application/json' },
        body: { field: 'value' },
      },
      user: {
        id: 'user-123',
        email: 'test@example.com',
      },
      metadata: {
        timestamp: '2025-08-13T10:00:00Z',
        version: '1.0.0',
      },
    }

    await captureUnexpectedState(message, context)

    expect(mockCaptureException).toHaveBeenCalledTimes(1)

    const [error, reportedContext] = mockCaptureException.mock.calls[0]

    expect(error).toBeInstanceOf(UnexpectedStateError)
    expect(error.message).toBe(message)
    expect(error.data).toEqual(context)
    expect(reportedContext).toEqual(context)

    // verify nested structure is preserved

    expect(reportedContext.request.method).toBe('POST')
    expect(reportedContext.user.id).toBe('user-123')
    expect(reportedContext.metadata.version).toBe('1.0.0')
  })

  it('should send undefined to the reporter when no context provided', async () => {
    const message = 'Test error without context'

    await captureUnexpectedState(message)

    expect(mockCaptureException).toHaveBeenCalledTimes(1)

    const [error, reportedContext] = mockCaptureException.mock.calls[0]

    expect(error).toBeInstanceOf(UnexpectedStateError)
    expect(error.message).toBe(message)
    expect(error.data).toBeUndefined()
    expect(reportedContext).toBeUndefined()
  })

  it('should send undefined to the reporter when null context provided', async () => {
    const message = 'Test error with null context'

    await captureUnexpectedState(message, null)

    expect(mockCaptureException).toHaveBeenCalledTimes(1)

    const [error, reportedContext] = mockCaptureException.mock.calls[0]

    expect(error).toBeInstanceOf(UnexpectedStateError)
    expect(error.message).toBe(message)
    expect(error.data).toBeUndefined()
    expect(reportedContext).toBeUndefined()
  })

  it('should send undefined to the reporter when undefined context provided', async () => {
    const message = 'Test error with undefined context'

    await captureUnexpectedState(message, undefined)

    expect(mockCaptureException).toHaveBeenCalledTimes(1)

    const [error, reportedContext] = mockCaptureException.mock.calls[0]

    expect(error).toBeInstanceOf(UnexpectedStateError)
    expect(error.message).toBe(message)
    expect(error.data).toBeUndefined()
    expect(reportedContext).toBeUndefined()
  })

  it('should handle reporter errors gracefully', async () => {
    const message = 'Test error with the reporter failure'
    const context = { key: 'value' }

    // mock the reporter to throw an error

    mockCaptureException.mockRejectedValueOnce(
      new Error('the reporter service unavailable')
    )

    // this should not throw even if the reporter fails

    await expect(
      captureUnexpectedState(message, context)
    ).resolves.toBeUndefined()

    expect(mockCaptureException).toHaveBeenCalledTimes(1)
  })
})

describe('captureUnexpectedState backward compatibility', () => {
  it('should accept message-only calls without throwing', async () => {
    // this should not throw an error

    await expect(
      captureUnexpectedState('Test message')
    ).resolves.toBeUndefined()
  })

  it('should accept message and context calls without throwing', async () => {
    // this should not throw an error

    await expect(
      captureUnexpectedState('Test message', { key: 'value' })
    ).resolves.toBeUndefined()
  })

  it('should accept message and string context calls without throwing', async () => {
    // this should not throw an error

    await expect(
      captureUnexpectedState('Test message', 'string context')
    ).resolves.toBeUndefined()
  })

  it('should accept message and null context calls without throwing', async () => {
    // this should not throw an error

    await expect(
      captureUnexpectedState('Test message', null)
    ).resolves.toBeUndefined()
  })

  it('should accept message and undefined context calls without throwing', async () => {
    // this should not throw an error

    await expect(
      captureUnexpectedState('Test message', undefined)
    ).resolves.toBeUndefined()
  })
})

describe('captureException excluded errors', () => {
  const observability = jest.requireMock('@chatbotkit-dev/observability')
    .default
  const mockCaptureException = jest.mocked(observability.captureException)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should not send BotInputError to the reporter', async () => {
    const { BotInputError, captureException } = await import('./index')

    const error = new BotInputError(
      'Invalid input for ability "test": missing required field'
    )

    await captureException(error)

    // @note BotInputError should be excluded from the reporter logging
    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  it('should not send UserInputError to the reporter', async () => {
    const { UserInputError, captureException } = await import('./index')

    const error = new UserInputError('Invalid user input')

    await captureException(error)

    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  it('should not send UserAuthError to the reporter', async () => {
    const { UserAuthError, captureException } = await import('./index')

    const error = new UserAuthError('Authentication failed')

    await captureException(error)

    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  it('should send other errors to the reporter', async () => {
    const { captureException } = await import('./index')

    const error = new Error('Some other error')

    await captureException(error)

    expect(mockCaptureException).toHaveBeenCalledWith(error, undefined)
  })

  it('should not send ObservationError to the reporter', async () => {
    const { ObservationError, captureException } = await import('./index')

    const error = new ObservationError(
      'skillset action returned large response',
      { tokenCount: 150000 }
    )

    await captureException(error)

    // @note ObservationError should be excluded from the reporter logging
    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  it('should not send ContentModerationError to the reporter', async () => {
    const { ContentModerationError, captureException } = await import('./index')

    const error = new ContentModerationError('Inappropriate content (400)')

    await captureException(error)

    // @note content moderation rejections are expected provider behaviour
    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  it('should not send UnexpectedStateError via captureObservation to the reporter', async () => {
    const { captureObservation } = await import('./index')

    await captureObservation('Chunked handler aborted', { runCount: 3 })

    // @note captureObservation creates ObservationError which should not go to the reporter
    expect(mockCaptureException).not.toHaveBeenCalled()
  })
})

describe('captureObservation the reporter opt-in', () => {
  const observability = jest.requireMock('@chatbotkit-dev/observability')
    .default
  const mockCaptureException = jest.mocked(observability.captureException)
  const mockCaptureMessage = jest.mocked(observability.captureMessage)

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('reports an opted-in observation to the reporter as a message, not an exception', async () => {
    const { captureObservation } = await import('./index')

    const context = {
      event: 'runaway_text_run_detected',
      repeatedPhrase: 'let me call lint',
      repeatCount: 6,
    }

    await captureObservation('runaway text run detected', context, {
      sentry: true,
      level: 'warning',
    })

    expect(mockCaptureException).not.toHaveBeenCalled()
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1)

    const [message, captureContext] = mockCaptureMessage.mock.calls[0]

    expect(message).toBe('runaway text run detected')
    expect(captureContext.level).toBe('warning')
    expect(captureContext.extra).toEqual(context)
    // @note grouped by the observation event so related stuck runs cluster
    expect(captureContext.tags.observation).toBe('runaway_text_run_detected')
    expect(captureContext.fingerprint).toEqual([
      'observation',
      'runaway_text_run_detected',
    ])
  })

  it('defaults the the reporter level to warning when not specified', async () => {
    const { captureObservation } = await import('./index')

    await captureObservation('call limit max reached', { event: 'x' }, {
      sentry: true,
    })

    expect(mockCaptureMessage.mock.calls[0][1].level).toBe('warning')
  })

  it('keeps non-opted-in observations out of the reporter entirely', async () => {
    const { captureObservation } = await import('./index')

    await captureObservation('Slow function call', { ms: 1200 })

    expect(mockCaptureException).not.toHaveBeenCalled()
    expect(mockCaptureMessage).not.toHaveBeenCalled()
  })
})

describe('captureError console.trace behavior', () => {
  let consoleTraceSpy

  beforeEach(() => {
    consoleTraceSpy = jest.spyOn(console, 'trace').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    consoleTraceSpy.mockRestore()
    jest.restoreAllMocks()
  })

  it('should call console.trace when error has stack', async () => {
    const { captureError } = await import('./index')

    const error = new Error('Test error with stack')

    await captureError(error)

    expect(consoleTraceSpy).toHaveBeenCalledWith(error)
  })

  it('should not call console.trace when error lacks stack', async () => {
    const { captureError } = await import('./index')

    const error = { message: 'Error without stack' }

    await captureError(error)

    expect(consoleTraceSpy).not.toHaveBeenCalled()
  })

  it('should not call console.trace for undefined error', async () => {
    const { captureError } = await import('./index')

    await captureError(undefined)

    expect(consoleTraceSpy).not.toHaveBeenCalled()
  })

  it('should not call console.trace for null error', async () => {
    const { captureError } = await import('./index')

    await captureError(null)

    expect(consoleTraceSpy).not.toHaveBeenCalled()
  })

  it('should not call console.trace for ObservationError', async () => {
    const { captureError, ObservationError } = await import('./index')

    const error = new ObservationError('Test observation', { data: 'test' })

    await captureError(error)

    // @note ObservationError should not reach console.trace as it's filtered out
    expect(consoleTraceSpy).not.toHaveBeenCalled()
  })
})

describe('captureException console.trace behavior', () => {
  let consoleTraceSpy

  beforeEach(() => {
    consoleTraceSpy = jest.spyOn(console, 'trace').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    consoleTraceSpy.mockRestore()
    jest.restoreAllMocks()
  })

  it('should call console.trace when error has stack', async () => {
    const { captureException } = await import('./index')

    const error = new Error('Test error with stack')

    await captureException(error)

    expect(consoleTraceSpy).toHaveBeenCalledWith(error)
  })

  it('should not call console.trace when error lacks stack', async () => {
    const { captureException } = await import('./index')

    const error = { message: 'Error without stack' }

    await captureException(error)

    expect(consoleTraceSpy).not.toHaveBeenCalled()
  })
})

describe('errorToErrorResponse', () => {
  it('should handle undefined error', () => {
    const { errorToErrorResponse } = require('./index')

    const result = errorToErrorResponse(undefined)

    expect(result).toEqual({
      code: 'GENERIC_ERROR',
      message: 'An unknown error occurred',
    })
  })

  it('should handle null error', () => {
    const { errorToErrorResponse } = require('./index')

    const result = errorToErrorResponse(null)

    expect(result).toEqual({
      code: 'GENERIC_ERROR',
      message: 'An unknown error occurred',
    })
  })

  it('should handle Error instance', () => {
    const { errorToErrorResponse } = require('./index')

    const error = new Error('Test error')
    const result = errorToErrorResponse(error)

    expect(result).toEqual({
      code: 'GENERIC_ERROR',
      message: 'Test error',
    })
  })

  it('should handle SystemError instance', () => {
    const { errorToErrorResponse, SystemError } = require('./index')

    const error = new SystemError('Test system error', 'TEST_CODE')
    const result = errorToErrorResponse(error)

    expect(result).toEqual({
      code: 'TEST_CODE',
      message: 'Test system error',
    })
  })

  it('should handle string error', () => {
    const { errorToErrorResponse } = require('./index')

    const result = errorToErrorResponse('String error message')

    expect(result).toEqual({
      code: 'GENERIC_ERROR',
      message: 'String error message',
    })
  })
})

describe('errorToSafeErrorResponse', () => {
  it('should expose SafeError details', () => {
    const { SafeError, errorToSafeErrorResponse } = require('./index')

    const error = new SafeError('Visible message', 'VISIBLE_CODE')
    const result = errorToSafeErrorResponse(error)

    expect(result).toEqual({
      code: 'VISIBLE_CODE',
      message: 'Visible message',
    })
  })

  it('should hide regular Error details', () => {
    const { errorToSafeErrorResponse } = require('./index')

    const result = errorToSafeErrorResponse(new Error('Internal detail'))

    expect(result).toEqual({
      code: 'GENERIC_ERROR',
      message: 'Something went wrong',
    })
  })

  it('should hide SystemError details unless explicitly safe', () => {
    const { SystemError, errorToSafeErrorResponse } = require('./index')

    const error = new SystemError('Internal system detail', 'INTERNAL_CODE')
    const result = errorToSafeErrorResponse(error)

    expect(result).toEqual({
      code: 'GENERIC_ERROR',
      message: 'Something went wrong',
    })
  })
})

describe('ContentModerationError', () => {
  it('is a SafeError carrying the CONTENT_MODERATION code and no data', () => {
    const {
      ContentModerationError,
      SafeError,
      CONTENT_MODERATION_ERROR_CODE,
    } = require('./index')

    const error = new ContentModerationError('Inappropriate content (400)')

    expect(error).toBeInstanceOf(SafeError)
    expect(error.code).toBe(CONTENT_MODERATION_ERROR_CODE)
    expect(error.message).toBe('Inappropriate content (400)')
    expect(error.data).toBeUndefined()
  })

  it('does not leak any data when serialized', () => {
    const { ContentModerationError } = require('./index')

    const serialized = JSON.parse(
      JSON.stringify(new ContentModerationError('blocked (400)'))
    )

    // @note message is non-enumerable on Error, code is the only own prop
    expect(serialized).toEqual({ code: 'CONTENT_MODERATION' })
    expect(serialized).not.toHaveProperty('data')
    expect(serialized).not.toHaveProperty('body')
  })

  it('is exposed through errorToSafeErrorResponse', () => {
    const { ContentModerationError, errorToSafeErrorResponse } = require('./index')

    const result = errorToSafeErrorResponse(
      new ContentModerationError('blocked (400)')
    )

    expect(result).toEqual({
      code: 'CONTENT_MODERATION',
      message: 'blocked (400)',
    })
  })
})

describe('isContentModerationError', () => {
  it('detects ContentModerationError instances', () => {
    const { ContentModerationError, isContentModerationError } = require('./index')

    expect(isContentModerationError(new ContentModerationError('x'))).toBe(true)
  })

  it('detects errors carrying the CONTENT_MODERATION code', () => {
    const { SystemError, isContentModerationError } = require('./index')

    expect(
      isContentModerationError(new SystemError('x', 'CONTENT_MODERATION'))
    ).toBe(true)
  })

  it('returns false for unrelated errors and nullish values', () => {
    const { SystemError, isContentModerationError } = require('./index')

    expect(isContentModerationError(new SystemError('x', 'VR_BAD_REQUEST'))).toBe(
      false
    )
    expect(isContentModerationError(new Error('x'))).toBe(false)
    expect(isContentModerationError(null)).toBe(false)
    expect(isContentModerationError(undefined)).toBe(false)
  })
})

describe('extractCauseChain', () => {
  it('returns undefined when there is no cause', () => {
    const { extractCauseChain } = require('./index')

    expect(extractCauseChain(new Error('terminated'))).toBeUndefined()
    expect(extractCauseChain(null)).toBeUndefined()
    expect(extractCauseChain(undefined)).toBeUndefined()
    expect(extractCauseChain('a raw string')).toBeUndefined()
  })

  it('summarizes a single undici-style cause (name, message, code)', () => {
    const { extractCauseChain } = require('./index')

    const cause = Object.assign(new Error('other side closed'), {
      code: 'UND_ERR_SOCKET',
    })

    const error = new Error('terminated', { cause })

    expect(extractCauseChain(error)).toEqual([
      { name: 'Error', message: 'other side closed', code: 'UND_ERR_SOCKET' },
    ])
  })

  it('walks a nested cause chain', () => {
    const { extractCauseChain } = require('./index')

    const root = Object.assign(new Error('ECONNRESET'), { code: 'ECONNRESET' })
    const mid = new Error('socket hang up', { cause: root })
    const top = new Error('terminated', { cause: mid })

    expect(extractCauseChain(top)).toEqual([
      { name: 'Error', message: 'socket hang up', code: undefined },
      { name: 'Error', message: 'ECONNRESET', code: 'ECONNRESET' },
    ])
  })

  it('caps the chain at the maximum depth', () => {
    const { extractCauseChain } = require('./index')

    let error = new Error('root')

    for (let i = 0; i < 8; i++) {
      error = new Error(`level-${i}`, { cause: error })
    }

    expect(extractCauseChain(error)).toHaveLength(5)
  })

  it('does not loop forever on a circular cause chain', () => {
    const { extractCauseChain } = require('./index')

    const a = new Error('a')
    const b = new Error('b', { cause: a })

    a.cause = b // @note circular

    expect(extractCauseChain(b)).toHaveLength(2)
  })

  it('handles a string cause', () => {
    const { extractCauseChain } = require('./index')

    const error = new Error('wrap')

    error.cause = 'raw string reason'

    expect(extractCauseChain(error)).toEqual([
      { name: undefined, message: 'raw string reason', code: undefined },
    ])
  })
})

describe('captureException cause context', () => {
  const observability = jest.requireMock('@chatbotkit-dev/observability')
    .default
  const mockCaptureException = jest.mocked(observability.captureException)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('attaches the cause chain under extra.cause', async () => {
    const { captureException } = require('./index')

    const cause = Object.assign(new Error('other side closed'), {
      code: 'UND_ERR_SOCKET',
    })

    const error = new Error('terminated', { cause })

    await captureException(error)

    const [captured, context] = mockCaptureException.mock.calls[0]

    expect(captured).toBe(error)
    expect(context).toEqual({
      extra: {
        cause: [
          {
            name: 'Error',
            message: 'other side closed',
            code: 'UND_ERR_SOCKET',
          },
        ],
      },
    })
  })

  it('passes undefined context when there is no cause and no data', async () => {
    const { captureException } = require('./index')

    const error = new Error('plain')

    await captureException(error)

    expect(mockCaptureException).toHaveBeenCalledWith(error, undefined)
  })

  it('merges the cause into existing error.data without clobbering it', async () => {
    const { SystemError, captureException } = require('./index')

    const cause = Object.assign(new Error('boom'), { code: 'ECONNRESET' })

    const error = new SystemError('wrapped', 'GENERIC_ERROR', {
      foo: 'bar',
      extra: { existing: true },
    })

    error.cause = cause

    await captureException(error)

    const [, context] = mockCaptureException.mock.calls[0]

    expect(context).toEqual({
      foo: 'bar',
      extra: {
        existing: true,
        cause: [{ name: 'Error', message: 'boom', code: 'ECONNRESET' }],
      },
    })
  })
})

describe('errorToSystemError cause preservation', () => {
  const observability = jest.requireMock('@chatbotkit-dev/observability')
    .default
  const mockCaptureException = jest.mocked(observability.captureException)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('preserves the original error as the cause when wrapping', () => {
    const { SystemError, errorToSystemError } = require('./index')

    const original = Object.assign(new Error('terminated'), {
      code: 'UND_ERR_SOCKET',
    })

    const wrapped = errorToSystemError(original)

    expect(wrapped).toBeInstanceOf(SystemError)
    expect(wrapped).not.toBe(original)
    expect(wrapped.cause).toBe(original)
  })

  it('returns an existing SystemError untouched (no cause added)', () => {
    const { SystemError, errorToSystemError } = require('./index')

    const sys = new SystemError('x', 'CODE')

    expect(errorToSystemError(sys)).toBe(sys)
    expect(sys.cause).toBeUndefined()
  })

  it('surfaces the preserved cause to the reporter after wrapping', async () => {
    const { errorToSystemError, captureException } = require('./index')

    const original = Object.assign(new Error('terminated'), {
      code: 'UND_ERR_SOCKET',
    })

    await captureException(errorToSystemError(original))

    const [, context] = mockCaptureException.mock.calls[0]

    expect(context.extra.cause).toEqual([
      { name: 'Error', message: 'terminated', code: 'UND_ERR_SOCKET' },
    ])
  })

  it('keeps the cause non-enumerable so it cannot leak via serialization', () => {
    const { errorToSystemError } = require('./index')

    const original = Object.assign(new Error('terminated'), {
      code: 'UND_ERR_SOCKET',
      requestBody: 'super-secret',
    })

    const wrapped = errorToSystemError(original)

    // @note readable for extractCauseChain/the reporter...
    expect(wrapped.cause).toBe(original)

    // @note ...but invisible to enumeration and JSON serialization, so an
    // accidental raw serialization of the SystemError can never expose the
    // underlying error to the client.
    expect(Object.prototype.propertyIsEnumerable.call(wrapped, 'cause')).toBe(
      false
    )
    expect(Object.keys(wrapped)).not.toContain('cause')
    expect(JSON.stringify(wrapped)).not.toContain('super-secret')
  })
})
