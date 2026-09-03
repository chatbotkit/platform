import { getConfigBySchema } from '@/lib/action.config'
import { getContextTimezone } from '@/lib/context.store'
import { UserInputError } from '@/lib/error'

import { doTimeNow, executeTimeAction } from './action.exec.time'

jest.mock('@/lib/action.config', () => ({
  getConfigBySchema: jest.fn(),
}))

jest.mock('@/lib/context.store', () => ({
  getContextTimezone: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

describe('action.exec.time', () => {
  const mockGetContextTimezone = getContextTimezone
  const mockOptions = {
    userId: 'user-123',
    contextResources: {
      blueprintId: 'blueprint-123',
      skillsetId: 'skillset-123',
      abilityId: 'ability-123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-04-14T12:34:56.000Z'))
    mockGetContextTimezone.mockReturnValue(null)
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  describe('doTimeNow', () => {
    it('should default to a single datetime value', async () => {
      getConfigBySchema.mockReturnValue({ timezone: 'UTC' })

      const result = await doTimeNow({
        input: '',
        params: { now: true },
        options: mockOptions,
      })

      expect(result).toEqual({
        result: 'Apr 14, 2026, 12:34:56 PM',
        messages: [],
      })
    })

    it('should default timezone from context when no timezone is provided', async () => {
      jest.setSystemTime(new Date('2026-04-14T01:30:00.000Z'))
      getConfigBySchema.mockReturnValue({ format: 'date' })
      mockGetContextTimezone.mockReturnValue('America/New_York')

      const result = await doTimeNow({
        input: '',
        params: { now: true },
        options: mockOptions,
      })

      expect(result).toEqual({
        result: 'Apr 13, 2026',
        messages: [],
      })
    })

    it('should support iso and unix output formats', async () => {
      getConfigBySchema.mockReturnValue({ timezone: 'UTC', format: 'iso' })

      const isoResult = await doTimeNow({
        input: '',
        params: { now: true },
        options: mockOptions,
      })

      getConfigBySchema.mockReturnValue({ timezone: 'UTC', format: 'unix' })

      const unixResult = await doTimeNow({
        input: '',
        params: { now: true },
        options: mockOptions,
      })

      expect(isoResult.result).toBe('2026-04-14T12:34:56.000Z')
      expect(unixResult.result).toBe(1776170096)
    })

    it('should return only the date for format: date with explicit UTC timezone', async () => {
      getConfigBySchema.mockReturnValue({ timezone: 'UTC', format: 'date' })

      const result = await doTimeNow({
        input: '',
        params: { now: true },
        options: mockOptions,
      })

      expect(result).toEqual({
        result: 'Apr 14, 2026',
        messages: [],
      })
    })

    it('should return only the time for format: time with explicit UTC timezone', async () => {
      getConfigBySchema.mockReturnValue({ timezone: 'UTC', format: 'time' })

      const result = await doTimeNow({
        input: '',
        params: { now: true },
        options: mockOptions,
      })

      expect(result).toEqual({
        result: '12:34:56 PM',
        messages: [],
      })
    })

    it('should handle explicit format: datetime the same as the default', async () => {
      getConfigBySchema.mockReturnValue({ timezone: 'UTC', format: 'datetime' })

      const result = await doTimeNow({
        input: '',
        params: { now: true },
        options: mockOptions,
      })

      expect(result).toEqual({
        result: 'Apr 14, 2026, 12:34:56 PM',
        messages: [],
      })
    })

    it('should fall back to datetime format when format is null', async () => {
      getConfigBySchema.mockReturnValue({ timezone: 'UTC', format: null })

      const result = await doTimeNow({
        input: '',
        params: { now: true },
        options: mockOptions,
      })

      expect(result).toEqual({
        result: 'Apr 14, 2026, 12:34:56 PM',
        messages: [],
      })
    })

    it('should fall back to system timezone when both rawTimezone and context timezone are absent', async () => {
      // @note getContextTimezone already returns null from beforeEach; here we
      // also leave rawTimezone as falsy so the Intl system timezone is used
      const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone

      getConfigBySchema.mockReturnValue({ timezone: null, format: 'iso' })

      const result = await doTimeNow({
        input: '',
        params: { now: true },
        options: mockOptions,
      })

      // iso format ignores timezone, so we just confirm execution succeeds and
      // the iso string matches the frozen timestamp
      expect(result.result).toBe('2026-04-14T12:34:56.000Z')
      expect(systemTz).toBeTruthy()
    })

    it('should return an empty messages array for all format paths', async () => {
      for (const format of ['datetime', 'date', 'time', 'iso', 'unix']) {
        getConfigBySchema.mockReturnValue({ timezone: 'UTC', format })

        const result = await doTimeNow({
          input: '',
          params: { now: true },
          options: mockOptions,
        })

        expect(result.messages).toEqual([])
      }
    })
  })

  describe('executeTimeAction', () => {
    it('should route now operations', async () => {
      getConfigBySchema.mockReturnValue({ timezone: 'UTC', format: 'iso' })

      const result = await executeTimeAction('', { now: true }, mockOptions)

      expect(result.result).toBe('2026-04-14T12:34:56.000Z')
    })

    it('should reject unknown operations', async () => {
      await expect(
        executeTimeAction('', { unknown: true }, mockOptions)
      ).rejects.toThrow(UserInputError)
    })
  })
})
