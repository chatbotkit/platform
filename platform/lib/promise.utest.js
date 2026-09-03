import { captureError } from '@/lib/error'
import {
  allTrue,
  anyTrue,
  awaitWithAbortGrace,
  fallbackOnFailure,
  neitherTrue,
  wait,
} from '@/lib/promise'

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
}))

describe('Promise Boolean Functions', () => {
  describe('allTrue', () => {
    it('should return true if all promises resolve to truthy values', async () => {
      const promises = [
        Promise.resolve(true),
        Promise.resolve('non-empty'),
        Promise.resolve(42),
      ]

      await expect(allTrue(promises)).resolves.toBe(true)
    })

    it('should return false if any promise resolves to a falsy value', async () => {
      const promises = [
        Promise.resolve(true),
        Promise.resolve(false),
        Promise.resolve(42),
      ]

      await expect(allTrue(promises)).resolves.toBe(false)
    })
  })

  describe('anyTrue', () => {
    it('should return true if any promise resolves to a truthy value', async () => {
      const promises = [
        Promise.resolve(false),
        Promise.resolve(null),
        Promise.resolve('yes'),
      ]

      await expect(anyTrue(promises)).resolves.toBe(true)
    })

    it('should return false if all promises resolve to falsy values', async () => {
      const promises = [
        Promise.resolve(false),
        Promise.resolve(0),
        Promise.resolve(''),
      ]

      await expect(anyTrue(promises)).resolves.toBe(false)
    })
  })

  describe('neitherTrue', () => {
    it('should return true if no promises resolve to truthy values', async () => {
      const promises = [
        Promise.resolve(false),
        Promise.resolve(null),
        Promise.resolve(undefined),
      ]

      await expect(neitherTrue(promises)).resolves.toBe(true)
    })

    it('should return false if any promise resolves to a truthy value', async () => {
      const promises = [
        Promise.resolve(false),
        Promise.resolve('non-empty'),
        Promise.resolve(0),
      ]

      await expect(neitherTrue(promises)).resolves.toBe(false)
    })
  })
})

describe('fallbackOnFailure', () => {
  it('should return the promise result if it resolves', async () => {
    const promise = Promise.resolve('success')
    const result = await fallbackOnFailure(promise, 'default')

    expect(result).toBe('success')
  })

  it('should return the default value if the promise rejects', async () => {
    const promise = Promise.reject(new Error('failure'))
    const result = await fallbackOnFailure(promise, 'default')

    expect(result).toBe('default')
    expect(captureError).toHaveBeenCalledWith(expect.any(Error))
  })
})

describe('wait', () => {
  it('should resolve when the signal is aborted', async () => {
    const controller = new AbortController()
    let resolved = false

    const promise = wait(controller.signal).then(() => {
      resolved = true
    })

    await Promise.resolve()

    expect(resolved).toBe(false)

    controller.abort()

    await promise

    expect(resolved).toBe(true)
  })

  it('should resolve immediately when the signal is already aborted', async () => {
    const controller = new AbortController()

    controller.abort()

    const addEventListenerSpy = jest.spyOn(
      controller.signal,
      'addEventListener'
    )

    await expect(wait(controller.signal)).resolves.toBeUndefined()

    expect(addEventListenerSpy).not.toHaveBeenCalled()
  })

  it('should remove the abort listener after resolving', async () => {
    const controller = new AbortController()
    const removeEventListenerSpy = jest.spyOn(
      controller.signal,
      'removeEventListener'
    )

    const promise = wait(controller.signal)

    controller.abort()

    await promise

    expect(removeEventListenerSpy).toHaveBeenCalledTimes(1)
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'abort',
      expect.any(Function)
    )
  })
})

describe('awaitWithAbortGrace', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('resolves with the promise value when there is no signal', async () => {
    await expect(
      awaitWithAbortGrace(Promise.resolve('ok'), undefined, 1000, () => 'bypass')
    ).resolves.toBe('ok')
  })

  it('resolves with the promise value when the signal never aborts', async () => {
    const controller = new AbortController()

    await expect(
      awaitWithAbortGrace(
        Promise.resolve('ok'),
        controller.signal,
        1000,
        () => 'bypass'
      )
    ).resolves.toBe('ok')
  })

  it('bypasses with onBypass when the promise does not settle within the grace after abort', async () => {
    const controller = new AbortController()

    let resolveInner

    const inner = new Promise((resolve) => {
      resolveInner = resolve
    })

    const promise = awaitWithAbortGrace(
      inner,
      controller.signal,
      1000,
      () => 'bypassed'
    )

    controller.abort()

    // grace has not elapsed yet - still waiting on the (stuck) inner promise
    await jest.advanceTimersByTimeAsync(999)

    let settled = false

    void promise.then(() => {
      settled = true
    })

    await Promise.resolve()

    expect(settled).toBe(false)

    // grace elapses - now we bypass
    await jest.advanceTimersByTimeAsync(1)

    await expect(promise).resolves.toBe('bypassed')

    // resolve the orphaned inner so it does not linger
    resolveInner('late')
  })

  it('still returns the promise value if it settles within the grace after abort', async () => {
    const controller = new AbortController()

    let resolveInner

    const inner = new Promise((resolve) => {
      resolveInner = resolve
    })

    const promise = awaitWithAbortGrace(
      inner,
      controller.signal,
      1000,
      () => 'bypassed'
    )

    controller.abort()

    // the cooperative operation finishes inside the grace window
    resolveInner('real')

    await expect(promise).resolves.toBe('real')
  })

  it('gives the grace even when the signal is already aborted at call time', async () => {
    const controller = new AbortController()

    controller.abort()

    let resolveInner

    const inner = new Promise((resolve) => {
      resolveInner = resolve
    })

    const promise = awaitWithAbortGrace(
      inner,
      controller.signal,
      1000,
      () => 'bypassed'
    )

    // still inside the grace - the inner promise can win
    resolveInner('real')

    await expect(promise).resolves.toBe('real')
  })

  it('propagates a rejection that occurs before the bypass', async () => {
    const controller = new AbortController()

    await expect(
      awaitWithAbortGrace(
        Promise.reject(new Error('boom')),
        controller.signal,
        1000,
        () => 'bypassed'
      )
    ).rejects.toThrow('boom')
  })

  it('removes the abort listener after settling', async () => {
    const controller = new AbortController()

    const removeEventListenerSpy = jest.spyOn(
      controller.signal,
      'removeEventListener'
    )

    await awaitWithAbortGrace(
      Promise.resolve('ok'),
      controller.signal,
      1000,
      () => 'bypassed'
    )

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'abort',
      expect.any(Function)
    )
  })
})
