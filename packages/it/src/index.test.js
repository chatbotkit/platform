import {
  cancelable,
  events,
  promises,
  throttle,
  throttleWithVariability,
  yieldSequentiallyFromParallel,
} from './index'

jest.retryTimes(3)

describe('events', () => {
  it('should yield events as they are pushed and stop when fn completes', async () => {
    const results = []

    const pushEvents = async (push) => {
      push('event1')
      await new Promise((resolve) => setTimeout(resolve, 50))
      push('event2')
      await new Promise((resolve) => setTimeout(resolve, 50))
      push('event3')
    }

    const gen = events(pushEvents)

    for await (const event of gen) {
      results.push(event)
    }

    expect(results).toEqual(['event1', 'event2', 'event3'])
  })

  it('should handle rapid successive events', async () => {
    const results = []

    const pushEvents = (push) => {
      push('event1')
      push('event2')
      push('event3')
    }

    const gen = events(pushEvents)

    for await (const event of gen) {
      results.push(event)
    }

    expect(results).toEqual(['event1', 'event2', 'event3'])
  })

  it('should yield an event pushed after the consumer is already awaiting it', async () => {
    let releasePush
    const waitForPush = new Promise((resolve) => {
      releasePush = resolve
    })

    let releaseCompletion
    const waitForCompletion = new Promise((resolve) => {
      releaseCompletion = resolve
    })

    const pushEvents = async (push) => {
      await waitForPush

      push('event1')

      await waitForCompletion
    }

    const gen = events(pushEvents)
    const firstValue = gen.next()

    let settled = false

    firstValue.then(() => {
      settled = true
    })

    await Promise.resolve()

    expect(settled).toBe(false)

    releasePush()

    await expect(firstValue).resolves.toEqual({
      done: false,
      value: 'event1',
    })

    releaseCompletion()

    await expect(gen.next()).resolves.toEqual({
      done: true,
      value: undefined,
    })
  })

  it('should continue yielding until fn completes, even if there are delays', async () => {
    const results = []

    const pushEvents = async (push) => {
      push('event1')

      await new Promise((resolve) => setTimeout(resolve, 200))

      push('event2')
    }

    const gen = events(pushEvents)

    for await (const event of gen) {
      results.push(event)
    }

    expect(results).toEqual(['event1', 'event2'])
  })

  it('should handle scenario when no events are pushed before fn completes', async () => {
    const results = []

    const pushEvents = async () => {
      // no events are pushed
    }

    const gen = events(pushEvents)

    for await (const event of gen) {
      results.push(event)
    }

    expect(results).toEqual([])
  })

  it('should propagate exceptions from fn', async () => {
    const results = []

    const pushEvents = async (push) => {
      push('event1')

      throw new Error('Test Error')
    }

    const gen = events(pushEvents)

    try {
      for await (const event of gen) {
        results.push(event)
      }

      throw new Error('Should not reach this line')
    } catch (error) {
      expect(error.message).toEqual('Test Error')
    }

    expect(results).toEqual(['event1']) // ensure it yields events before the error
  })

  it('should handle errors even if no events are pushed', async () => {
    const pushEvents = async () => {
      throw new Error('Error with no events')
    }

    const gen = events(pushEvents)

    try {
      for await (const event of gen) {
        event // This block should not execute
      }

      throw new Error('Should not reach this line') // ensures the error is thrown before this line
    } catch (error) {
      expect(error.message).toEqual('Error with no events')
    }
  })

  it('should not stall if fn never resolves nor pushes events', async () => {
    const results = []

    const pushEvents = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10000)) // 10-second delay
    }

    const gen = events(pushEvents)

    for await (const event of gen) {
      results.push(event)
    }

    expect(results).toEqual([])
  })

  it('should not stall if push is never called due to an early error in fn', async () => {
    const results = []

    const pushEvents = async () => {
      throw new Error('Early failure')
    }

    const gen = events(pushEvents)

    try {
      for await (const event of gen) {
        results.push(event)
      }
    } catch (error) {
      expect(error.message).toEqual('Early failure')
    }

    expect(results).toEqual([])
  })
})

describe('cancelable', () => {
  it('should yield values from the source generator until aborted', async () => {
    const controller = new AbortController()

    async function* generateValues() {
      yield 'event1'
      yield 'event2'
      yield 'event3'
    }

    const results = []

    for await (const event of cancelable(generateValues(), controller.signal)) {
      results.push(event)

      if (event === 'event2') {
        controller.abort()
      }
    }

    expect(results).toEqual(['event1', 'event2'])
  })

  it('should complete if the signal is already aborted', async () => {
    const controller = new AbortController()
    const source = {
      next: jest.fn().mockResolvedValue({ done: false, value: 'event1' }),
      return: jest.fn().mockResolvedValue({ done: true, value: undefined }),
      throw: jest.fn(),
      [Symbol.asyncIterator]() {
        return this
      },
    }

    controller.abort()

    const gen = cancelable(source, controller.signal)

    await expect(gen.next()).resolves.toEqual({
      done: true,
      value: undefined,
    })

    expect(source.next).not.toHaveBeenCalled()
    expect(source.return).toHaveBeenCalledTimes(1)
  })

  it('should complete when aborted while waiting for the next value', async () => {
    const controller = new AbortController()

    async function* generateValues() {
      await new Promise(() => {})
    }

    const gen = cancelable(generateValues(), controller.signal)
    const nextValue = gen.next()

    let settled = false

    nextValue.then(() => {
      settled = true
    })

    await Promise.resolve()

    expect(settled).toBe(false)

    controller.abort()

    await expect(nextValue).resolves.toEqual({
      done: true,
      value: undefined,
    })
  })

  it('should call return on the source generator when the consumer stops early', async () => {
    const controller = new AbortController()
    const source = {
      next: jest.fn().mockResolvedValue({ done: false, value: 'event1' }),
      return: jest.fn().mockResolvedValue({ done: true, value: undefined }),
      throw: jest.fn(),
      [Symbol.asyncIterator]() {
        return this
      },
    }

    const gen = cancelable(source, controller.signal)

    await expect(gen.next()).resolves.toEqual({
      done: false,
      value: 'event1',
    })

    await expect(gen.return()).resolves.toEqual({
      done: true,
      value: undefined,
    })

    expect(source.return).toHaveBeenCalledTimes(1)
  })
})

describe('promises', () => {
  function delay(ms, value) {
    return new Promise((resolve) => setTimeout(() => resolve(value), ms))
  }

  function rejectDelay(ms, error) {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(error)), ms)
    )
  }

  it('should not yield anything if there are no promises', async () => {
    const res = []

    for await (const result of promises([])) {
      res.push(result)
    }

    expect(res).toEqual([])
  })

  it('should yield promises in the order they resolve', async () => {
    const prs = [delay(300, 'First'), delay(200, 'Second'), delay(100, 'Third')]
    const res = []

    for await (const result of promises(prs)) {
      res.push(result)
    }

    expect(res).toEqual(['Third', 'Second', 'First'])
  })

  it('should handle multiple promises resolving at the same time', async () => {
    const prs = [delay(100, 'First'), delay(100, 'Second'), delay(100, 'Third')]
    const res = []

    for await (const result of promises(prs)) {
      res.push(result)
    }

    expect(res.sort()).toEqual(['First', 'Second', 'Third'].sort())
  })

  it('should handle mix of resolved and rejected promises', async () => {
    const prs = [
      delay(300, 'First'),
      rejectDelay(200, 'Error'),
      delay(100, 'Third'),
    ]

    const res = []

    try {
      for await (const result of promises(prs)) {
        res.push(result)
      }
    } catch (error) {
      res.push(error.message)
    }

    expect(res).toContain('Third')
    expect(res).toContain('Error')
  })
})

describe('throttle', () => {
  async function* generateValues(values) {
    for (const value of values) {
      yield value
    }
  }

  it('should yield values with at least the specified delay', async () => {
    const values = [1, 2, 3, 4]
    const ms = 100
    const throttledGenerator = throttle(generateValues(values), ms)
    const startTime = Date.now()
    const results = []

    for await (const value of throttledGenerator) {
      results.push(value)
    }

    const endTime = Date.now()
    const elapsedTime = endTime - startTime

    expect(results).toEqual(values)
    expect(elapsedTime).toBeGreaterThanOrEqual(ms * (values.length - 1))
  })

  it('should work correctly with an empty generator', async () => {
    const values = []
    const ms = 100
    const throttledGenerator = throttle(generateValues(values), ms)
    const results = []

    for await (const value of throttledGenerator) {
      results.push(value)
    }

    expect(results).toEqual(values)
  })

  it('should handle single value generators correctly', async () => {
    const values = [42]
    const ms = 100
    const throttledGenerator = throttle(generateValues(values), ms)
    const results = []

    for await (const value of throttledGenerator) {
      results.push(value)
    }

    expect(results).toEqual(values)
  })
})

describe('throttleWithVariability', () => {
  async function* generateValues(values) {
    for (const value of values) {
      yield value
    }
  }

  it('should yield values with variable delays around baseMs', async () => {
    const values = [1, 2, 3, 4]
    const baseMs = 100
    const variability = 50 // +/- 25 ms

    const throttledGenerator = throttleWithVariability(
      generateValues(values),
      baseMs,
      variability
    )

    const results = []
    let prevTime = Date.now()

    for await (const value of throttledGenerator) {
      const currentTime = Date.now()
      const delay = currentTime - prevTime

      prevTime = currentTime

      results.push(value)

      const tolerance = 10 // ms

      expect(delay).toBeGreaterThanOrEqual(baseMs - variability / 2 - tolerance)
      expect(delay).toBeLessThanOrEqual(baseMs + variability / 2 + tolerance)
    }

    expect(results).toEqual(values)
  })

  it('should handle an empty generator correctly', async () => {
    const values = []
    const baseMs = 100
    const variability = 50

    const throttledGenerator = throttleWithVariability(
      generateValues(values),
      baseMs,
      variability
    )

    const results = []

    for await (const value of throttledGenerator) {
      results.push(value)
    }

    expect(results).toEqual(values)
  })

  it('should handle a single value generator correctly', async () => {
    const values = [42]
    const baseMs = 100
    const variability = 50

    const throttledGenerator = throttleWithVariability(
      generateValues(values),
      baseMs,
      variability
    )

    const results = []

    for await (const value of throttledGenerator) {
      results.push(value)
    }

    expect(results).toEqual(values)
  })
})

describe('yieldSequentiallyFromParallel', () => {
  async function* createGenerator(label, delays) {
    for (const delay of delays) {
      await new Promise((res) => setTimeout(res, delay))

      yield `${label}${delay}`
    }
  }

  it('preserves order of generator output based on array position', async () => {
    const genA = createGenerator('A', [300, 100])
    const genB = createGenerator('B', [100, 50])
    const genC = createGenerator('C', [200, 100])

    const result = []

    for await (const value of yieldSequentiallyFromParallel([
      genA,
      genB,
      genC,
    ])) {
      result.push(value)
    }

    expect(result).toEqual(['A300', 'A100', 'B100', 'B50', 'C200', 'C100'])
  })

  it('handles empty generators gracefully', async () => {
    async function* emptyGen() {}

    const genA = createGenerator('A', [50])
    const genB = emptyGen()
    const genC = createGenerator('C', [10])

    const result = []

    for await (const value of yieldSequentiallyFromParallel([
      genA,
      genB,
      genC,
    ])) {
      result.push(value)
    }

    expect(result).toEqual(['A50', 'C10'])
  })

  it('works with a single generator', async () => {
    const genA = createGenerator('A', [100, 200])

    const result = []

    for await (const value of yieldSequentiallyFromParallel([genA])) {
      result.push(value)
    }

    expect(result).toEqual(['A100', 'A200'])
  })

  it('works with no generators', async () => {
    const result = []

    for await (const value of yieldSequentiallyFromParallel([])) {
      result.push(value)
    }

    expect(result).toEqual([])
  })

  it('works with a single generator function', async () => {
    async function* genA() {
      await new Promise((res) => setTimeout(res, 100))

      yield 'A'
    }

    const result = []

    for await (const value of yieldSequentiallyFromParallel([genA])) {
      result.push(value)
    }

    expect(result).toEqual(['A'])
  })

  it('works when the generators are functions', async () => {
    async function* genA() {
      await new Promise((res) => setTimeout(res, 100))

      yield 'A'
    }

    async function* genB() {
      await new Promise((res) => setTimeout(res, 50))

      yield 'B'
    }

    const result = []

    for await (const value of yieldSequentiallyFromParallel([genA, genB])) {
      result.push(value)
    }

    expect(result).toEqual(['A', 'B'])
  })

  it('works with normal generators', async () => {
    function* normalGen(label, delays) {
      for (const delay of delays) {
        yield `${label}${delay}`
      }
    }

    const genA = normalGen('A', [300, 100])
    const genB = normalGen('B', [100, 50])
    const genC = normalGen('C', [200, 100])

    const result = []

    for await (const value of yieldSequentiallyFromParallel([
      genA,
      genB,
      genC,
    ])) {
      result.push(value)
    }

    expect(result).toEqual(['A300', 'A100', 'B100', 'B50', 'C200', 'C100'])
  })
})

describe('yieldSequentiallyFromParallel', () => {
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async function* makeGenerator(values, delayMs = 0) {
    for (const v of values) {
      if (delayMs) {
        await delay(delayMs)
      }

      yield v
    }
  }

  it('yieldSequentiallyFromParallel yields all values in order, no loss', async () => {
    const gen1 = () => makeGenerator([1, 2, 3], 10)
    const gen2 = () => makeGenerator([4, 5], 1)
    const gen3 = () => makeGenerator([6], 5)

    const result = []

    for await (const v of yieldSequentiallyFromParallel([gen1, gen2, gen3])) {
      result.push(v)
    }

    expect(result).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('yieldSequentiallyFromParallel is robust under stress', async () => {
    for (let i = 0; i < 20; i++) {
      const gen1 = () =>
        makeGenerator([`a${i}-1`, `a${i}-2`], Math.random() * 5)

      const gen2 = () => makeGenerator([`b${i}-1`], Math.random() * 5)

      const gen3 = () =>
        makeGenerator([`c${i}-1`, `c${i}-2`, `c${i}-3`], Math.random() * 5)

      const expected = [
        `a${i}-1`,
        `a${i}-2`,
        `b${i}-1`,
        `c${i}-1`,
        `c${i}-2`,
        `c${i}-3`,
      ]

      const result = []

      for await (const v of yieldSequentiallyFromParallel([gen1, gen2, gen3])) {
        result.push(v)
      }

      expect(result).toEqual(expected)
    }
  })

  it('yieldSequentiallyFromParallel must start all generators at the same time', async () => {
    let gen1StartTime = 0
    let gen2StartTime = 0
    let gen3StartTime = 0

    const testStartTime = Date.now()

    async function* gen1() {
      gen1StartTime = Date.now() - testStartTime

      yield* await makeGenerator([1, 2, 3], 10)
    }

    async function* gen2() {
      gen2StartTime = Date.now() - testStartTime

      yield* await makeGenerator([4, 5], 1)
    }

    async function* gen3() {
      gen3StartTime = Date.now() - testStartTime

      yield* await makeGenerator([6], 5)
    }

    const result = []

    for await (const v of yieldSequentiallyFromParallel([gen1, gen2, gen3])) {
      result.push(v)
    }

    expect(result).toEqual([1, 2, 3, 4, 5, 6])

    expect(gen1StartTime).toBeLessThanOrEqual(1)
    expect(gen2StartTime).toBeLessThanOrEqual(1)
    expect(gen3StartTime).toBeLessThanOrEqual(1)
  })

  it('yieldSequentiallyFromParallel must run handlers concurrently after first yield', async () => {
    const handlerStartTimes = []

    async function* gen1() {
      yield 'gen1-first'

      // simulate a slow handler
      handlerStartTimes.push({ gen: 1, time: Date.now() })
      await new Promise((res) => setTimeout(res, 200))

      yield 'gen1-result'
    }

    async function* gen2() {
      yield 'gen2-first'

      // simulate a slow handler
      handlerStartTimes.push({ gen: 2, time: Date.now() })
      await new Promise((res) => setTimeout(res, 200))

      yield 'gen2-result'
    }

    async function* gen3() {
      yield 'gen3-first'

      // simulate a slow handler
      handlerStartTimes.push({ gen: 3, time: Date.now() })
      await new Promise((res) => setTimeout(res, 200))

      yield 'gen3-result'
    }

    const startTime = Date.now()
    const result = []

    for await (const v of yieldSequentiallyFromParallel([gen1, gen2, gen3])) {
      result.push(v)
    }

    const totalTime = Date.now() - startTime

    // all values should be yielded in sequential order
    expect(result).toEqual([
      'gen1-first',
      'gen1-result',
      'gen2-first',
      'gen2-result',
      'gen3-first',
      'gen3-result',
    ])

    // if handlers run concurrently, all 3 should start within a small window
    // and total time should be ~200ms (not ~600ms)
    const firstStart = Math.min(...handlerStartTimes.map((h) => h.time))
    const lastStart = Math.max(...handlerStartTimes.map((h) => h.time))
    const startSpread = lastStart - firstStart

    // all handlers should start within 50ms of each other (concurrent)
    // if sequential, spread would be ~400ms (200ms per handler)
    expect(startSpread).toBeLessThan(50)

    // total time should be closer to 200ms than 600ms
    expect(totalTime).toBeLessThan(400)
  })

  it('concurrent handlers with different durations yield in correct order', async () => {
    // gen1 is slow (300ms), gen2 is fast (50ms), gen3 is medium (150ms)
    // all should start concurrently, but values must come in gen1, gen2, gen3 order

    const completionOrder = []

    async function* gen1() {
      yield 'gen1-start'

      await new Promise((res) => setTimeout(res, 300))
      completionOrder.push('gen1')

      yield 'gen1-done'
    }

    async function* gen2() {
      yield 'gen2-start'

      await new Promise((res) => setTimeout(res, 50))
      completionOrder.push('gen2')

      yield 'gen2-done'
    }

    async function* gen3() {
      yield 'gen3-start'

      await new Promise((res) => setTimeout(res, 150))
      completionOrder.push('gen3')

      yield 'gen3-done'
    }

    const result = []

    for await (const v of yieldSequentiallyFromParallel([gen1, gen2, gen3])) {
      result.push(v)
    }

    // values must be yielded in generator order regardless of completion speed
    expect(result).toEqual([
      'gen1-start',
      'gen1-done',
      'gen2-start',
      'gen2-done',
      'gen3-start',
      'gen3-done',
    ])

    // gen2 should have finished first, then gen3, then gen1 (concurrent)
    expect(completionOrder).toEqual(['gen2', 'gen3', 'gen1'])
  })

  it('one generator throwing does not prevent others from completing', async () => {
    const results = []

    async function* gen1() {
      yield 'gen1-start'

      await new Promise((res) => setTimeout(res, 50))

      yield 'gen1-done'
    }

    async function* gen2() {
      yield 'gen2-start'

      throw new Error('gen2 exploded')
    }

    async function* gen3() {
      yield 'gen3-start'

      await new Promise((res) => setTimeout(res, 50))

      yield 'gen3-done'
    }

    try {
      for await (const v of yieldSequentiallyFromParallel([gen1, gen2, gen3])) {
        results.push(v)
      }
    } catch (e) {
      results.push(`error:${e.message}`)
    }

    // gen1 should complete fully, then gen2 should throw
    expect(results).toEqual([
      'gen1-start',
      'gen1-done',
      'gen2-start',
      'error:gen2 exploded',
    ])
  })

  it('many generators (10) run concurrently not sequentially', async () => {
    const count = 10
    const handlerDelay = 100
    const handlerStarts = []

    function makeGen(id) {
      return async function* () {
        yield `${id}-first`

        handlerStarts.push(Date.now())
        await new Promise((res) => setTimeout(res, handlerDelay))

        yield `${id}-result`
      }
    }

    const generators = Array.from({ length: count }, (_, i) => makeGen(i))

    const startTime = Date.now()
    const result = []

    for await (const v of yieldSequentiallyFromParallel(generators)) {
      result.push(v)
    }

    const totalTime = Date.now() - startTime

    // verify ordering: each gen's values in sequence
    for (let i = 0; i < count; i++) {
      const idx = i * 2

      expect(result[idx]).toBe(`${i}-first`)
      expect(result[idx + 1]).toBe(`${i}-result`)
    }

    expect(result).toHaveLength(count * 2)

    // if concurrent: total ~100ms. if sequential: ~1000ms
    expect(totalTime).toBeLessThan(300)

    // all handlers should start within a tight window
    const spread = Math.max(...handlerStarts) - Math.min(...handlerStarts)

    expect(spread).toBeLessThan(50)
  })

  it('generator yielding multiple values after concurrent work preserves all values', async () => {
    async function* gen1() {
      yield 'a1'

      await new Promise((res) => setTimeout(res, 100))

      yield 'a2'
      yield 'a3'
      yield 'a4'
    }

    async function* gen2() {
      yield 'b1'

      await new Promise((res) => setTimeout(res, 100))

      yield 'b2'
      yield 'b3'
    }

    const result = []

    for await (const v of yieldSequentiallyFromParallel([gen1, gen2])) {
      result.push(v)
    }

    expect(result).toEqual(['a1', 'a2', 'a3', 'a4', 'b1', 'b2', 'b3'])
  })

  it('generator that yields nothing after first yield works correctly', async () => {
    async function* gen1() {
      yield 'only-value'
    }

    async function* gen2() {
      yield 'gen2-first'

      await new Promise((res) => setTimeout(res, 50))

      yield 'gen2-second'
    }

    const result = []

    for await (const v of yieldSequentiallyFromParallel([gen1, gen2])) {
      result.push(v)
    }

    expect(result).toEqual(['only-value', 'gen2-first', 'gen2-second'])
  })

  it('slow consumer does not cause value loss', async () => {
    async function* gen1() {
      yield 'a'

      await new Promise((res) => setTimeout(res, 10))

      yield 'b'
    }

    async function* gen2() {
      yield 'c'

      await new Promise((res) => setTimeout(res, 10))

      yield 'd'
    }

    const result = []

    for await (const v of yieldSequentiallyFromParallel([gen1, gen2])) {
      // simulate slow consumer
      await new Promise((res) => setTimeout(res, 100))

      result.push(v)
    }

    expect(result).toEqual(['a', 'b', 'c', 'd'])
  })
})
