/**
 * @jest-environment node
 */

import {
  CLOCK_INTERVAL,
  CLOCK_ROUTE,
  getClockDeduplicationId,
  startClock,
  tick,
} from '@/lib/clock'

jest.mock('@/lib/debug', () => ({
  __esModule: true,

  default: () => ({
    log: () => ({}),
  }),
}))

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(async () => undefined),
}))

jest.mock('@/lib/queue', () => ({
  queue: jest.fn(async () => undefined),
}))

const { queue } = jest.requireMock('@/lib/queue')
const { captureException } = jest.requireMock('@/lib/error')

describe('startClock', () => {
  let stop

  beforeEach(() => {
    jest.clearAllMocks()

    jest.useFakeTimers()

    jest.setSystemTime(0)
  })

  afterEach(() => {
    stop?.()

    stop = undefined

    jest.useRealTimers()
  })

  it('ticks every ten minutes', () => {
    expect(CLOCK_INTERVAL).toBe(10 * 60 * 1000)
  })

  // @note a container in a restart loop must not fan out every maintenance job
  // on each crash
  it('does not tick at start', async () => {
    stop = startClock()

    await jest.advanceTimersByTimeAsync(CLOCK_INTERVAL - 1)

    expect(queue).not.toHaveBeenCalled()
  })

  it('publishes a clock10 event to the clock route once per interval', async () => {
    stop = startClock()

    await jest.advanceTimersByTimeAsync(CLOCK_INTERVAL)

    expect(queue).toHaveBeenCalledTimes(1)

    expect(queue).toHaveBeenCalledWith(
      CLOCK_ROUTE,
      { type: 'clock10', payload: {} },
      { deduplicationId: 'clock10-1' }
    )

    await jest.advanceTimersByTimeAsync(CLOCK_INTERVAL)

    expect(queue).toHaveBeenCalledTimes(2)

    expect(queue).toHaveBeenLastCalledWith(
      CLOCK_ROUTE,
      { type: 'clock10', payload: {} },
      { deduplicationId: 'clock10-2' }
    )
  })

  it('stops ticking once stopped', async () => {
    stop = startClock()

    await jest.advanceTimersByTimeAsync(CLOCK_INTERVAL)

    stop()

    stop = undefined

    await jest.advanceTimersByTimeAsync(CLOCK_INTERVAL * 5)

    expect(queue).toHaveBeenCalledTimes(1)
  })
})

describe('tick', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('reports a failed publish rather than throwing, so the clock keeps going', async () => {
    const failure = new Error('queue is down')

    queue.mockRejectedValueOnce(failure)

    await expect(tick(0)).resolves.toBeUndefined()

    expect(captureException).toHaveBeenCalledWith(failure)
  })
})

describe('getClockDeduplicationId', () => {
  // @note two instances in the same window produce the same id, which is what
  // lets a deduplicating queue collapse them
  it('is stable within a ten-minute window and changes across them', () => {
    expect(getClockDeduplicationId(0)).toBe('clock10-0')

    expect(getClockDeduplicationId(CLOCK_INTERVAL - 1)).toBe('clock10-0')

    expect(getClockDeduplicationId(CLOCK_INTERVAL)).toBe('clock10-1')
  })
})
