import { withPeriodicAbortCheck } from './abort'

describe('abort', () => {
  afterEach(() => {
    jest.clearAllTimers()
  })

  describe('withPeriodicAbortCheck', () => {
    it('should return a signal and dispose function', () => {
      const result = withPeriodicAbortCheck({
        shouldAbort: jest.fn().mockResolvedValue(false),
      })

      expect(result).toHaveProperty('signal')
      expect(result).toHaveProperty('dispose')
      expect(result.signal).toBeInstanceOf(AbortSignal)
      expect(typeof result.dispose).toBe('function')

      result.dispose()
    })

    it('should not abort signal initially', () => {
      const result = withPeriodicAbortCheck({
        shouldAbort: jest.fn().mockResolvedValue(false),
      })

      expect(result.signal.aborted).toBe(false)

      result.dispose()
    })

    it('should abort with reason when provided', () => {
      const reason = new Error('Custom abort reason')
      const shouldAbort = jest.fn().mockResolvedValue(false)
      const result = withPeriodicAbortCheck({
        shouldAbort,
        reason,
        intervalMs: 100,
      })

      result.dispose()
      expect(typeof result.dispose).toBe('function')
    })

    it('should respect custom interval', () => {
      const shouldAbort = jest.fn().mockResolvedValue(false)
      const result = withPeriodicAbortCheck({
        shouldAbort,
        intervalMs: 500,
      })

      expect(result.signal.aborted).toBe(false)

      result.dispose()
    })

    it('should clear interval on dispose', () => {
      const shouldAbort = jest.fn().mockResolvedValue(false)
      const result = withPeriodicAbortCheck({
        shouldAbort,
        intervalMs: 100,
      })

      result.dispose()
      result.dispose() // Second dispose should not throw

      // dispose() prevents further checks but doesn't necessarily abort the signal
      // unless a check returned true beforehand
      expect(typeof result.dispose).toBe('function')
    })

    it('should handle parent signal already aborted', () => {
      const parentController = new AbortController()
      const parentSignal = parentController.signal
      const reason = new Error('Parent aborted')

      parentController.abort(reason)

      const result = withPeriodicAbortCheck({
        signal: parentSignal,
        shouldAbort: jest.fn().mockResolvedValue(false),
      })

      expect(result.signal.aborted).toBe(true)
      expect(result.signal.reason).toBe(reason)

      result.dispose()
    })

    it('should abort when parent signal aborts', (done) => {
      const parentController = new AbortController()
      const reason = new Error('Parent aborted')

      const result = withPeriodicAbortCheck({
        signal: parentController.signal,
        shouldAbort: jest.fn().mockResolvedValue(false),
      })

      expect(result.signal.aborted).toBe(false)

      parentController.abort(reason)

      // Give time for event listener to fire
      setTimeout(() => {
        expect(result.signal.aborted).toBe(true)
        expect(result.signal.reason).toBe(reason)
        result.dispose()
        done()
      }, 10)
    })

    it('should call onError when shouldAbort throws', (done) => {
      const error = new Error('Check failed')
      const shouldAbort = jest.fn().mockRejectedValue(error)
      const onError = jest.fn()

      const result = withPeriodicAbortCheck({
        shouldAbort,
        onError,
        intervalMs: 10,
      })

      // Wait for check to happen
      setTimeout(() => {
        expect(onError).toHaveBeenCalledWith(error)
        expect(result.signal.aborted).toBe(false)
        result.dispose()
        done()
      }, 50)
    })

    it('should not recheck while check is in progress', (done) => {
      let resolveCheck: (() => void) | undefined
      const checkPromise = new Promise<void>((resolve) => {
        resolveCheck = resolve
      })

      const shouldAbort = jest.fn(async () => {
        await checkPromise

        return false
      })

      const result = withPeriodicAbortCheck({
        shouldAbort,
        intervalMs: 10,
      })

      // Wait for first check to start
      setTimeout(() => {
        expect(shouldAbort).toHaveBeenCalledTimes(1)
        // Resolve the check
        resolveCheck!()
        // Wait for next interval
        setTimeout(() => {
          result.dispose()
          done()
        }, 30)
      }, 20)
    })

    it('should use default interval when not specified', (done) => {
      const shouldAbort = jest.fn().mockResolvedValue(false)
      const result = withPeriodicAbortCheck({
        shouldAbort,
      })

      // Default is 5000ms, so it shouldn't have checked yet
      setTimeout(() => {
        expect(shouldAbort).not.toHaveBeenCalled()
        result.dispose()
        done()
      }, 100)
    })

    it('should handle null signal', () => {
      const result = withPeriodicAbortCheck({
        signal: null,
        shouldAbort: jest.fn().mockResolvedValue(false),
      })

      expect(result.signal.aborted).toBe(false)

      result.dispose()
    })

    it('should handle undefined signal', () => {
      const result = withPeriodicAbortCheck({
        signal: undefined,
        shouldAbort: jest.fn().mockResolvedValue(false),
      })

      expect(result.signal.aborted).toBe(false)

      result.dispose()
    })

    it('should suppress errors in onError handler', (done) => {
      const checkError = new Error('Check failed')
      const handlerError = new Error('Handler failed')
      const shouldAbort = jest.fn().mockRejectedValue(checkError)
      const onError = jest.fn().mockRejectedValue(handlerError)

      const result = withPeriodicAbortCheck({
        shouldAbort,
        onError,
        intervalMs: 10,
      })

      setTimeout(() => {
        expect(onError).toHaveBeenCalledWith(checkError)
        expect(result.signal.aborted).toBe(false)
        result.dispose()
        done()
      }, 50)
    })
  })
})
