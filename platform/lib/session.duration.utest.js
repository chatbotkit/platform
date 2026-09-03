/**
 * @jest-environment node
 */
import { ONE_DAY_IN_SECONDS } from '@chatbotkit-dev/time'

import { resolveSessionDuration } from '@/lib/session.duration'

describe('resolveSessionDuration', () => {
  it('treats null as auto (persist with the default 1 day TTL)', () => {
    expect(resolveSessionDuration(null)).toEqual({
      persist: true,
      ttlSecs: ONE_DAY_IN_SECONDS,
    })
  })

  it('treats undefined as auto (persist with the default 1 day TTL)', () => {
    expect(resolveSessionDuration(undefined)).toEqual({
      persist: true,
      ttlSecs: ONE_DAY_IN_SECONDS,
    })
  })

  it('treats 0 as no session (does not persist)', () => {
    expect(resolveSessionDuration(0)).toEqual({
      persist: false,
      ttlSecs: 0,
    })
  })

  it('converts a positive duration from milliseconds to seconds', () => {
    expect(resolveSessionDuration(3600000)).toEqual({
      persist: true,
      ttlSecs: 3600,
    })
  })

  it('floors sub-second durations to a 1 second TTL (never EX 0)', () => {
    expect(resolveSessionDuration(1)).toEqual({ persist: true, ttlSecs: 1 })
    expect(resolveSessionDuration(400)).toEqual({ persist: true, ttlSecs: 1 })
    expect(resolveSessionDuration(499)).toEqual({ persist: true, ttlSecs: 1 })
  })

  it('rounds durations to the nearest second', () => {
    expect(resolveSessionDuration(1499).ttlSecs).toBe(1)
    expect(resolveSessionDuration(1500).ttlSecs).toBe(2)
  })
})
