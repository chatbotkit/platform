import { createDebouncedAction, createThrottledAction } from '@/lib/debounce'

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms))
}

describe('createDebouncedAction (leading throttle)', () => {
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
    await sleep(45)
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

    await d.trigger()
    await d.trigger()
    await sleep(55)
    await d.trigger()

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

    await sleep(35)

    await d1.trigger()
    await d2.trigger()

    expect(a).toBe(2)
    expect(b).toBe(2)
  })
})
