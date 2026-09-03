// @note the platform's own clock, for deployments with nothing outside to tick
// it.
//
// Nothing in the platform outlives a request except the server process itself,
// so that is what publishes the `clock10` tick - always, on every server, as a
// standard part of running the platform. A queue backend that keeps schedules
// of its own may tick the same route from outside as well; the handlers behind
// it are maintenance sweeps and tolerate a second pass.
//
// It publishes rather than running the handlers, so a tick from here takes the
// same path as one from outside: the shared-secret check, the timeout monitor,
// and whatever the installed queue does with a delivery.
//
// Two limits, both inherited from where this runs. A deployment with several
// instances ticks once per instance, and only a queue that deduplicates across
// processes collapses them - the barebone one does not, and says so. A
// serverless host ends the interval with the instance, so a deployment there
// needs its queue backend to keep the schedule.

import { TEN_MINUTES_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import debug from '@/lib/debug'
import { captureException } from '@/lib/error'
import { queue } from '@/lib/queue'

export const CLOCK_ROUTE = '/api/system/clock/queue'

/**
 * @note the literal rather than the route module's constant, because importing
 * the route here would load every queue module it fans out to at server start.
 * The route's own test asserts the same value.
 */
export const CLOCK10_EVENT_TYPE = 'clock10'

/**
 * @note not configurable. The event is named for its period, and every handler
 * behind it sizes its work to ten minutes.
 */
export const CLOCK_INTERVAL = TEN_MINUTES_IN_MILLISECONDS

/**
 * @note one id per ten-minute window, so two instances publishing in the same
 * window are collapsed by a queue that deduplicates.
 */
export function getClockDeduplicationId(now: number): string {
  return `${CLOCK10_EVENT_TYPE}-${Math.floor(now / CLOCK_INTERVAL)}`
}

/**
 * Publishes one clock tick. A failed publish is reported and swallowed so the
 * interval that called it keeps going.
 */
export async function tick(now: number = Date.now()): Promise<void> {
  debug(`clock tick`).log('clock.tick')

  try {
    await queue(
      CLOCK_ROUTE,
      { type: CLOCK10_EVENT_TYPE, payload: {} },
      { deduplicationId: getClockDeduplicationId(now) }
    )
  } catch (error) {
    await captureException(error)
  }
}

/**
 * Starts the clock.
 *
 * @note the first tick lands ten minutes after start, not at start. A container
 * in a restart loop would otherwise fan out every maintenance job on each
 * crash. The timer is unref'd so it never keeps a stopping process alive.
 *
 * @returns a function that stops the clock
 */
export function startClock(): () => void {
  debug(`clock started`, { interval: CLOCK_INTERVAL }).log('clock.start')

  const timer = setInterval(() => {
    void tick()
  }, CLOCK_INTERVAL)

  timer.unref?.()

  return () => {
    clearInterval(timer)
  }
}
