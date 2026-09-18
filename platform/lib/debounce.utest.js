import { createDebouncedAction, createThrottledAction } from '@/lib/debounce'

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms))
}

describe('createDebouncedAction (leading throttle)', () => {
  // @note the window is measured with Date.now(), so a real clock lets a
  // loaded CI runner push the second trigger past it; fake timers pin it
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('immediate first trigger', async () => {
    let count = 0

    const d = createDebouncedAction({
      action: () => {
        count += 1
      },
      intervalMs: 50,
    })

    await d.trigger()

    expect(count).toBe(1)
  })

  test('suppresses inside window', async () => {
    let count = 0

    const d = createDebouncedAction({
      action: () => {
        count += 1
      },
      intervalMs: 60,
    })

    await d.trigger()
    await d.trigger()
    await d.trigger()

    expect(count).toBe(1)
  })

  test('re-fires after window', async () => {
    let count = 0

    const d = createDebouncedAction({
      action: () => {
        count += 1
      },
      intervalMs: 40,
    })

    await d.trigger()
    await jest.advanceTimersByTimeAsync(45)
    await d.trigger()

    expect(count).toBe(2)
  })

  test('force bypasses window', async () => {
    let count = 0

    const d = createDebouncedAction({
      action: () => {
        count += 1
      },
      intervalMs: 1000,
    })

    await d.trigger()
    await d.force()
    await d.force()

    expect(count).toBe(3)
  })

  test('remaining + reset', async () => {
    let count = 0

    const d = createDebouncedAction({
      action: () => {
        count += 1
      },
      intervalMs: 80,
    })

    await d.trigger()

    expect(d.remaining()).toBeGreaterThan(0)

    d.reset()

    expect(d.remaining()).toBe(0)

    await d.trigger()

    expect(count).toBe(2)
  })

  test('async action supported', async () => {
    const events = []

    const d = createDebouncedAction({
      action: async () => {
        await sleep(10)
        events.push('done')
      },
      intervalMs: 50,
    })

    // the action sleeps on the fake clock, so each trigger is driven by hand
    async function triggerAndSettle() {
      const pending = d.trigger()

      await jest.advanceTimersByTimeAsync(10)

      await pending
    }

    await triggerAndSettle()
    await triggerAndSettle()
    await jest.advanceTimersByTimeAsync(55)
    await triggerAndSettle()

    expect(events).toEqual(['done', 'done'])
  })

  test('alias createThrottledAction behaves identically', async () => {
    let a = 0
    let b = 0

    const d1 = createDebouncedAction({
      action: () => {
        a += 1
      },
      intervalMs: 30,
    })

    const d2 = createThrottledAction({
      action: () => {
        b += 1
      },
      intervalMs: 30,
    })

    await d1.trigger()
    await d2.trigger()
    await d1.trigger()
    await d2.trigger() // suppressed

    await jest.advanceTimersByTimeAsync(35)

    await d1.trigger()
    await d2.trigger()

    expect(a).toBe(2)
    expect(b).toBe(2)
  })
})
