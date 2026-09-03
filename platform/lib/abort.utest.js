import { withPeriodicAbortCheck } from './abort'

describe('withPeriodicAbortCheck', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('should abort when the parent signal aborts', () => {
    const parentController = new AbortController()
    const check = withPeriodicAbortCheck({
      signal: parentController.signal,
      shouldAbort: jest.fn(() => false),
    })

    parentController.abort('parent aborted')

    expect(check.signal.aborted).toBe(true)
    expect(check.signal.reason).toBe('parent aborted')
  })

  it('should abort when the periodic check returns true', async () => {
    jest.useFakeTimers()

    const reason = new Error('checked abort')
    const shouldAbort = jest
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)

    const check = withPeriodicAbortCheck({
      intervalMs: 10,
      reason,
      shouldAbort,
    })

    await jest.advanceTimersByTimeAsync(10)

    expect(check.signal.aborted).toBe(false)

    await jest.advanceTimersByTimeAsync(10)

    expect(check.signal.aborted).toBe(true)
    expect(check.signal.reason).toBe(reason)
  })

  it('should stop checking after dispose', async () => {
    jest.useFakeTimers()

    const shouldAbort = jest.fn(() => false)
    const check = withPeriodicAbortCheck({
      intervalMs: 10,
      shouldAbort,
    })

    check.dispose()

    await jest.advanceTimersByTimeAsync(10)

    expect(shouldAbort).not.toHaveBeenCalled()
  })

  it('should abort immediately when the parent signal is already aborted', () => {
    const parentController = new AbortController()

    parentController.abort('pre-aborted')

    const shouldAbort = jest.fn(() => false)

    const check = withPeriodicAbortCheck({
      signal: parentController.signal,
      shouldAbort,
    })

    // @note the signal must be aborted synchronously, not deferred to interval
    expect(check.signal.aborted).toBe(true)
    expect(check.signal.reason).toBe('pre-aborted')
    expect(shouldAbort).not.toHaveBeenCalled()
  })

  it('should work without a parent signal (interval only)', async () => {
    jest.useFakeTimers()

    const shouldAbort = jest.fn().mockResolvedValue(true)

    const check = withPeriodicAbortCheck({
      intervalMs: 10,
      shouldAbort,
    })

    // @note no signal means the signal starts not-aborted
    expect(check.signal.aborted).toBe(false)

    await jest.advanceTimersByTimeAsync(10)

    expect(check.signal.aborted).toBe(true)
  })

  it('should call onError when shouldAbort throws', async () => {
    jest.useFakeTimers()

    const thrownError = new Error('check failed')
    const shouldAbort = jest.fn().mockRejectedValue(thrownError)
    const onError = jest.fn()

    const check = withPeriodicAbortCheck({
      intervalMs: 10,
      shouldAbort,
      onError,
    })

    await jest.advanceTimersByTimeAsync(10)

    expect(onError).toHaveBeenCalledWith(thrownError)
    // @note a failed check must not abort the signal - it should remain active
    expect(check.signal.aborted).toBe(false)

    check.dispose()
  })

  it('should not abort when shouldAbort throws but no onError is provided', async () => {
    jest.useFakeTimers()

    const shouldAbort = jest.fn().mockRejectedValue(new Error('check failed'))

    const check = withPeriodicAbortCheck({
      intervalMs: 10,
      shouldAbort,
    })

    await jest.advanceTimersByTimeAsync(10)

    // @note an error in shouldAbort must never abort the signal unintentionally
    expect(check.signal.aborted).toBe(false)

    check.dispose()
  })

  it('should not run a second check while a previous check is still in-flight', async () => {
    jest.useFakeTimers()

    let resolveFirst
    const firstCheckPromise = new Promise((resolve) => {
      resolveFirst = () => resolve(false)
    })

    const shouldAbort = jest.fn().mockReturnValueOnce(firstCheckPromise)

    withPeriodicAbortCheck({
      intervalMs: 10,
      shouldAbort,
    })

    // advance timer to start the first check - it is now in-flight
    jest.advanceTimersByTime(10)

    // advance timer again - a second interval fires while the first is still running
    jest.advanceTimersByTime(10)

    // resolve the first check
    resolveFirst()
    await Promise.resolve()

    // @note the concurrent-check guard means shouldAbort is called only once
    expect(shouldAbort).toHaveBeenCalledTimes(1)
  })

  it('should clean up parent signal listener after dispose', () => {
    const parentController = new AbortController()
    const shouldAbort = jest.fn(() => false)

    const check = withPeriodicAbortCheck({
      signal: parentController.signal,
      shouldAbort,
    })

    check.dispose()

    // aborting the parent after dispose must not affect the already-disposed check
    parentController.abort('late abort')

    // @note the signal stays not-aborted because the listener was removed
    expect(check.signal.aborted).toBe(false)
  })

  it('should not abort twice when parent aborts and dispose is called', () => {
    const parentController = new AbortController()
    const shouldAbort = jest.fn(() => false)

    const check = withPeriodicAbortCheck({
      signal: parentController.signal,
      shouldAbort,
    })

    parentController.abort('once')

    // calling dispose after abort must not throw
    expect(() => check.dispose()).not.toThrow()
    expect(check.signal.aborted).toBe(true)
  })
})
