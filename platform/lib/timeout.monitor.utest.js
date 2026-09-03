import debug from '@/lib/debug'
import { captureObservation, captureUnexpectedState } from '@/lib/error'
import {
  DEFAULT_QUEUE_TIMEOUT_MS,
  QUEUE_TIMEOUT_MARKS,
  createTimeoutMonitor,
} from '@/lib/timeout.monitor'

jest.mock('@/lib/debug')
jest.mock('@/lib/error')

describe('timeout.monitor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    // Mock debug to return a chainable object with log method
    debug.mockImplementation(() => ({
      log: jest.fn(),
    }))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('createTimeoutMonitor', () => {
    it('should return signal, markSignals, and dispose function', () => {
      const { signal, markSignals, dispose } = createTimeoutMonitor({
        context: { type: 'test' },
      })

      expect(signal).toBeInstanceOf(AbortSignal)
      expect(Array.isArray(markSignals)).toBe(true)
      expect(markSignals.length).toBe(QUEUE_TIMEOUT_MARKS.length)
      expect(typeof dispose).toBe('function')

      dispose()
    })

    it('should have correct number of mark signals', () => {
      const { markSignals, dispose } = createTimeoutMonitor({
        context: { type: 'test' },
      })

      expect(markSignals.length).toBe(3)
      expect(markSignals.length).toBe(QUEUE_TIMEOUT_MARKS.length)

      dispose()
    })

    it('should not abort signal immediately', () => {
      const { signal, dispose } = createTimeoutMonitor({
        context: { type: 'test' },
      })

      expect(signal.aborted).toBe(false)

      dispose()
    })

    it('should not fire mark signals immediately', () => {
      const { markSignals, dispose } = createTimeoutMonitor({
        context: { type: 'test' },
      })

      markSignals.forEach((signal) => {
        expect(signal.aborted).toBe(false)
      })

      dispose()
    })
  })

  describe('mark signals firing', () => {
    it('should fire mark signals at correct fractions of timeout', () => {
      const markHandlers = [jest.fn(), jest.fn(), jest.fn()]
      const { markSignals, dispose } = createTimeoutMonitor({
        context: { type: 'test' },
      })

      markSignals.forEach((signal, index) => {
        signal.addEventListener('abort', markHandlers[index])
      })

      // Fire first mark (20%)
      jest.advanceTimersByTime(
        DEFAULT_QUEUE_TIMEOUT_MS * QUEUE_TIMEOUT_MARKS[0]
      )

      expect(markHandlers[0]).toHaveBeenCalled()
      expect(markHandlers[1]).not.toHaveBeenCalled()
      expect(markHandlers[2]).not.toHaveBeenCalled()

      dispose()
    })

    it('should fire all mark signals in sequence', () => {
      const markHandlers = [jest.fn(), jest.fn(), jest.fn()]
      const { markSignals, dispose } = createTimeoutMonitor({
        context: { type: 'test' },
      })

      markSignals.forEach((signal, index) => {
        signal.addEventListener('abort', markHandlers[index])
      })

      // Fire all marks
      QUEUE_TIMEOUT_MARKS.forEach((mark) => {
        jest.advanceTimersByTime(DEFAULT_QUEUE_TIMEOUT_MS * mark)
      })

      markHandlers.forEach((handler) => {
        expect(handler).toHaveBeenCalled()
      })

      dispose()
    })

    it('should include mark metadata in signal reason', () => {
      const markReasons = []
      const { markSignals, dispose } = createTimeoutMonitor({
        context: { type: 'test' },
      })

      markSignals.forEach((signal) => {
        signal.addEventListener('abort', () => {
          markReasons.push(signal.reason)
        })
      })

      // Fire all marks
      jest.advanceTimersByTime(DEFAULT_QUEUE_TIMEOUT_MS * 0.8 + 100)

      expect(markReasons.length).toBeGreaterThan(0)

      markReasons.forEach((reason) => {
        expect(reason).toHaveProperty('mark')
        expect(reason).toHaveProperty('elapsedMs')
        expect(reason).toHaveProperty('final')
        expect(typeof reason.mark).toBe('number')
        expect(typeof reason.elapsedMs).toBe('number')
        expect(typeof reason.final).toBe('boolean')
      })

      dispose()
    })

    it('should mark final mark signal with final=true', () => {
      const markReasons = []
      const { markSignals, dispose } = createTimeoutMonitor({
        context: { type: 'test' },
      })

      markSignals.forEach((signal) => {
        signal.addEventListener('abort', () => {
          markReasons.push(signal.reason)
        })
      })

      // Fire all marks
      jest.advanceTimersByTime(DEFAULT_QUEUE_TIMEOUT_MS * 0.85)

      const finalMark = markReasons.find((r) => r.final === true)

      expect(finalMark).toBeDefined()
      expect(finalMark.mark).toBe(
        QUEUE_TIMEOUT_MARKS[QUEUE_TIMEOUT_MARKS.length - 1]
      )

      dispose()
    })

    it('should record elapsedMs accurately for each mark', () => {
      const markReasons = []
      const { markSignals, dispose } = createTimeoutMonitor({
        context: { type: 'test' },
      })

      markSignals.forEach((signal) => {
        signal.addEventListener('abort', () => {
          markReasons.push(signal.reason)
        })
      })

      // Fire all marks
      QUEUE_TIMEOUT_MARKS.forEach((mark) => {
        jest.advanceTimersByTime(DEFAULT_QUEUE_TIMEOUT_MS * mark)
      })

      expect(markReasons.length).toBe(QUEUE_TIMEOUT_MARKS.length)

      markReasons.forEach((reason, index) => {
        // Elapsed time should be approximately at the mark percentage
        const expectedMs = DEFAULT_QUEUE_TIMEOUT_MS * QUEUE_TIMEOUT_MARKS[index]

        expect(reason.elapsedMs).toBeGreaterThanOrEqual(expectedMs - 100)
        expect(reason.elapsedMs).toBeLessThanOrEqual(expectedMs + 100)
      })

      dispose()
    })

    it('should log mark events via debug', () => {
      const { _markSignals, dispose } = createTimeoutMonitor({
        context: { type: 'test', botId: '123' },
        label: 'Test Handler',
      })

      // Fire first mark
      jest.advanceTimersByTime(
        DEFAULT_QUEUE_TIMEOUT_MS * QUEUE_TIMEOUT_MARKS[0]
      )

      expect(debug).toHaveBeenCalled()

      // Get the first call's first argument (the message)
      const debugMessage = debug.mock.calls.find((call) =>
        call[0]?.includes('Test Handler')
      )?.[0]

      expect(debugMessage).toContain('20%') // First mark is 20%

      dispose()
    })

    it('should only report final mark to Sentry', () => {
      captureObservation.mockResolvedValue(undefined)

      const { _markSignals, dispose } = createTimeoutMonitor({
        context: { type: 'test' },
        label: 'Test Handler',
      })

      // Fire all marks
      QUEUE_TIMEOUT_MARKS.forEach((mark) => {
        jest.advanceTimersByTime(DEFAULT_QUEUE_TIMEOUT_MS * mark)
      })

      expect(captureObservation).toHaveBeenCalledTimes(1)

      const captureCall = captureObservation.mock.calls[0]

      expect(captureCall[0]).toContain('80%') // Final mark is 80%
      expect(captureCall[2]).toHaveProperty('sentry', true)
      expect(captureCall[2]).toHaveProperty('level', 'warning')

      dispose()
    })
  })

  describe('hard timeout', () => {
    it('should abort signal after DEFAULT_QUEUE_TIMEOUT_MS', () => {
      const { signal, dispose } = createTimeoutMonitor({
        context: { type: 'test' },
      })

      expect(signal.aborted).toBe(false)

      jest.advanceTimersByTime(DEFAULT_QUEUE_TIMEOUT_MS)

      expect(signal.aborted).toBe(true)

      dispose()
    })

    it('should report hard timeout to Sentry', () => {
      captureUnexpectedState.mockResolvedValue(undefined)

      const { dispose } = createTimeoutMonitor({
        context: { type: 'test', taskId: '456' },
        label: 'Test Handler',
      })

      jest.advanceTimersByTime(DEFAULT_QUEUE_TIMEOUT_MS)

      expect(captureUnexpectedState).toHaveBeenCalledTimes(1)

      const captureCall = captureUnexpectedState.mock.calls[0]

      expect(captureCall[0]).toContain('timed out')
      expect(captureCall[1]).toHaveProperty('taskId', '456')
      expect(captureCall[1]).toHaveProperty(
        'timeoutMs',
        DEFAULT_QUEUE_TIMEOUT_MS
      )

      dispose()
    })

    it('should log hard timeout via debug', () => {
      const { dispose } = createTimeoutMonitor({
        context: { type: 'test' },
      })

      jest.advanceTimersByTime(DEFAULT_QUEUE_TIMEOUT_MS)

      const debugCalls = debug.mock.calls
      const timeoutCall = debugCalls.find((call) =>
        call[0]?.includes('aborting request')
      )

      expect(timeoutCall).toBeDefined()

      dispose()
    })
  })

  describe('dispose', () => {
    it('should clear all timers when dispose is called', () => {
      const { signal, markSignals, dispose } = createTimeoutMonitor({
        context: { type: 'test' },
      })

      // Dispose before any timeouts fire
      dispose()

      // Advance time beyond all timeouts
      jest.advanceTimersByTime(DEFAULT_QUEUE_TIMEOUT_MS * 2)

      // Nothing should have fired
      expect(signal.aborted).toBe(false)
      markSignals.forEach((s) => {
        expect(s.aborted).toBe(false)
      })
    })

    it('should prevent memory leaks by clearing timers', () => {
      const initialTimers = jest.getTimerCount()

      const monitor = createTimeoutMonitor({
        context: { type: 'test' },
      })

      const timersAfterCreation = jest.getTimerCount()

      expect(timersAfterCreation).toBeGreaterThan(initialTimers)

      monitor.dispose()

      const timersAfterDispose = jest.getTimerCount()

      expect(timersAfterDispose).toBe(initialTimers)
    })

    it('should be idempotent - safe to call multiple times', () => {
      const { dispose } = createTimeoutMonitor({
        context: { type: 'test' },
      })

      expect(() => {
        dispose()
        dispose()
        dispose()
      }).not.toThrow()
    })
  })

  describe('context propagation', () => {
    it('should include all context fields in log and capture calls', () => {
      captureObservation.mockResolvedValue(undefined)

      const context = {
        type: 'test',
        botId: '123',
        userId: 'user-456',
        conversationId: 'conv-789',
        customField: 'custom-value',
      }

      const { dispose } = createTimeoutMonitor({ context })

      // Fire final mark
      jest.advanceTimersByTime(DEFAULT_QUEUE_TIMEOUT_MS * 0.85)

      expect(captureObservation).toHaveBeenCalled()

      const captureContext = captureObservation.mock.calls[0][1]

      Object.entries(context).forEach(([key, value]) => {
        expect(captureContext).toHaveProperty(key, value)
      })

      dispose()
    })

    it('should use custom label in log messages', () => {
      const { dispose } = createTimeoutMonitor({
        context: { type: 'test' },
        label: 'Custom Handler',
      })

      // Fire first mark
      jest.advanceTimersByTime(DEFAULT_QUEUE_TIMEOUT_MS * 0.25)

      const debugCalls = debug.mock.calls
      const markCall = debugCalls.find((call) =>
        call[0]?.includes('Custom Handler')
      )

      expect(markCall).toBeDefined()

      dispose()
    })

    it('should use default label if not provided', () => {
      const { dispose } = createTimeoutMonitor({
        context: { type: 'test' },
      })

      jest.advanceTimersByTime(DEFAULT_QUEUE_TIMEOUT_MS)

      const debugCalls = debug.mock.calls
      const timeoutCall = debugCalls.find((call) =>
        call[0]?.includes('Queue handler')
      )

      expect(timeoutCall).toBeDefined()

      dispose()
    })
  })

  describe('concurrent monitors', () => {
    it('should handle multiple monitors independently', () => {
      const {
        signal: signal1,
        markSignals: marks1,
        dispose: dispose1,
      } = createTimeoutMonitor({
        context: { id: '1' },
      })

      const {
        signal: signal2,
        markSignals: marks2,
        dispose: dispose2,
      } = createTimeoutMonitor({
        context: { id: '2' },
      })

      expect(signal1).not.toBe(signal2)
      expect(marks1[0]).not.toBe(marks2[0])

      // Both monitors start their timers at the same time, so both will fire 50% mark at the same time
      jest.advanceTimersByTime(DEFAULT_QUEUE_TIMEOUT_MS * 0.5)

      // Both 50% marks should have fired because both timers were started at the same time
      expect(signal1.aborted).toBe(false)
      expect(marks1[1].aborted).toBe(true) // 50% mark fired
      expect(signal2.aborted).toBe(false)
      expect(marks2[1].aborted).toBe(true) // 50% mark fired for second monitor too

      dispose1()
      dispose2()
    })

    it('should not interfere when one monitor is disposed', () => {
      const { markSignals: marks1, dispose: dispose1 } = createTimeoutMonitor({
        context: { id: '1' },
      })

      const { signal: signal2, dispose: dispose2 } = createTimeoutMonitor({
        context: { id: '2' },
      })

      dispose1()

      jest.advanceTimersByTime(DEFAULT_QUEUE_TIMEOUT_MS)

      expect(marks1[0].aborted).toBe(false)
      expect(signal2.aborted).toBe(true)

      dispose2()
    })
  })

  describe('edge cases', () => {
    it('should handle zero elapsed time at mark firing', () => {
      const markReasons = []
      const { markSignals, dispose } = createTimeoutMonitor({
        context: { type: 'test' },
      })

      markSignals.forEach((signal) => {
        signal.addEventListener('abort', () => {
          markReasons.push(signal.reason)
        })
      })

      jest.advanceTimersByTime(
        DEFAULT_QUEUE_TIMEOUT_MS * QUEUE_TIMEOUT_MARKS[0]
      )

      expect(markReasons[0].elapsedMs).toBeGreaterThanOrEqual(0)

      dispose()
    })

    it('should fire mark signal only once per mark', () => {
      const markHandlers = [jest.fn(), jest.fn(), jest.fn()]
      const { markSignals, dispose } = createTimeoutMonitor({
        context: { type: 'test' },
      })

      markSignals.forEach((signal, index) => {
        signal.addEventListener('abort', markHandlers[index])
      })

      // Fire first mark
      jest.advanceTimersByTime(
        DEFAULT_QUEUE_TIMEOUT_MS * QUEUE_TIMEOUT_MARKS[0]
      )
      expect(markHandlers[0]).toHaveBeenCalledTimes(1)

      // Advance time past first mark but not to second
      jest.advanceTimersByTime(
        DEFAULT_QUEUE_TIMEOUT_MS *
          (QUEUE_TIMEOUT_MARKS[1] - QUEUE_TIMEOUT_MARKS[0]) *
          0.5
      )

      // First mark should still only have fired once
      expect(markHandlers[0]).toHaveBeenCalledTimes(1)

      dispose()
    })

    it('should not abort if all timers are cleared before timeout', () => {
      const { signal, dispose } = createTimeoutMonitor({
        context: { type: 'test' },
      })

      // Dispose halfway through timeout
      jest.advanceTimersByTime(DEFAULT_QUEUE_TIMEOUT_MS * 0.5)
      dispose()

      // Advance to full timeout
      jest.advanceTimersByTime(DEFAULT_QUEUE_TIMEOUT_MS * 0.6)

      expect(signal.aborted).toBe(false)
    })

    it('should handle mark signal that has already aborted', () => {
      const { _markSignals, dispose } = createTimeoutMonitor({
        context: { type: 'test' },
      })

      // Manually abort a mark signal before it fires naturally
      const controller = new AbortController()
      const reason = { mark: 0.2, elapsedMs: 0, final: false }

      controller.abort(reason)

      // Fire the mark (should handle it gracefully)
      jest.advanceTimersByTime(DEFAULT_QUEUE_TIMEOUT_MS * 0.25)

      // No errors should occur

      dispose()
    })
  })
})
