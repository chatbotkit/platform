import { captureException } from '@/lib/error'

import { customEvent } from '@/components/GTag'

import { logAnalyticsEvent } from './analytics'

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
}))

jest.mock('@/components/GTag', () => ({
  customEvent: jest.fn(),
}))

describe('logAnalyticsEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should call customEvent with name and parameters', () => {
      const name = 'test_event'
      const parameters = { key1: 'value1', key2: 'value2' }

      logAnalyticsEvent(name, parameters)

      expect(customEvent).toHaveBeenCalledWith(name, parameters)
      expect(customEvent).toHaveBeenCalledTimes(1)
    })

    it('should handle event with empty parameters', () => {
      const name = 'empty_event'
      const parameters = {}

      logAnalyticsEvent(name, parameters)

      expect(customEvent).toHaveBeenCalledWith(name, parameters)
    })

    it('should handle event with complex nested parameters', () => {
      const name = 'complex_event'
      const parameters = {
        user: { id: '123', name: 'Test' },
        metadata: { timestamp: Date.now(), source: 'test' },
        tags: ['tag1', 'tag2'],
      }

      logAnalyticsEvent(name, parameters)

      expect(customEvent).toHaveBeenCalledWith(name, parameters)
    })

    it('should handle event names with special characters', () => {
      const name = 'user_action:click-button_submit'
      const parameters = { action: 'submit' }

      logAnalyticsEvent(name, parameters)

      expect(customEvent).toHaveBeenCalledWith(name, parameters)
    })
  })

  describe('error handling', () => {
    it('should capture exception when customEvent throws', () => {
      const error = new Error('Analytics error')

      customEvent.mockImplementation(() => {
        throw error
      })

      const name = 'error_event'
      const parameters = { test: 'value' }

      // Should not throw - error is caught internally
      expect(() => logAnalyticsEvent(name, parameters)).not.toThrow()

      expect(captureException).toHaveBeenCalledWith(error)
    })

    it('should continue execution after analytics error', () => {
      customEvent.mockImplementation(() => {
        throw new Error('Analytics failure')
      })

      logAnalyticsEvent('event1', { test: 1 })
      logAnalyticsEvent('event2', { test: 2 })

      expect(captureException).toHaveBeenCalledTimes(2)
    })

    it('should handle TypeError from customEvent', () => {
      const typeError = new TypeError('Invalid event data')

      customEvent.mockImplementation(() => {
        throw typeError
      })

      logAnalyticsEvent('type_error_event', { data: null })

      expect(captureException).toHaveBeenCalledWith(typeError)
    })
  })

  describe('edge cases', () => {
    it('should handle null parameters', () => {
      const name = 'null_params'
      const parameters = null

      logAnalyticsEvent(name, parameters)

      expect(customEvent).toHaveBeenCalledWith(name, null)
    })

    it('should handle undefined parameters', () => {
      const name = 'undefined_params'
      const parameters = undefined

      logAnalyticsEvent(name, parameters)

      expect(customEvent).toHaveBeenCalledWith(name, undefined)
    })

    it('should handle empty string event name', () => {
      const name = ''
      const parameters = { test: 'value' }

      logAnalyticsEvent(name, parameters)

      expect(customEvent).toHaveBeenCalledWith('', parameters)
    })

    it('should handle very long event names', () => {
      const name = 'a'.repeat(1000)
      const parameters = { test: 'value' }

      logAnalyticsEvent(name, parameters)

      expect(customEvent).toHaveBeenCalledWith(name, parameters)
    })

    it('should handle parameters with circular references', () => {
      const parameters = { key: 'value' }

      parameters.self = parameters

      const name = 'circular_event'

      // Should not throw even with circular reference
      expect(() => logAnalyticsEvent(name, parameters)).not.toThrow()

      expect(customEvent).toHaveBeenCalledWith(name, parameters)
    })
  })

  describe('parameter types', () => {
    it('should handle string parameters', () => {
      logAnalyticsEvent('string_event', { value: 'test string' })

      expect(customEvent).toHaveBeenCalled()
    })

    it('should handle number parameters', () => {
      logAnalyticsEvent('number_event', { count: 42, price: 99.99 })

      expect(customEvent).toHaveBeenCalled()
    })

    it('should handle boolean parameters', () => {
      logAnalyticsEvent('boolean_event', { enabled: true, visible: false })

      expect(customEvent).toHaveBeenCalled()
    })

    it('should handle array parameters', () => {
      logAnalyticsEvent('array_event', { items: [1, 2, 3], tags: ['a', 'b'] })

      expect(customEvent).toHaveBeenCalled()
    })

    it('should handle mixed type parameters', () => {
      logAnalyticsEvent('mixed_event', {
        string: 'text',
        number: 123,
        boolean: true,
        array: [1, 2, 3],
        object: { nested: 'value' },
        null: null,
        undefined: undefined,
      })

      expect(customEvent).toHaveBeenCalled()
    })
  })
})
