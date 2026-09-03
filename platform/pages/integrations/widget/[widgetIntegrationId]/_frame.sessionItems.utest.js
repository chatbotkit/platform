import { getLocalStorage } from '@/lib/browserstorage'

import {
  getSessionItemExpiry,
  getSessionItemKey,
  getSessionItemValue,
  sessionItemPrefix,
  setSessionItemExpiry,
  setSessionItemValue,
} from './frame'

describe('Session Item Functions', () => {
  let localStorage

  beforeEach(() => {
    localStorage = getLocalStorage()

    // clean up any existing session keys

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)

      if (key && key.startsWith(sessionItemPrefix)) {
        localStorage.removeItem(key)
      }
    }
  })

  afterEach(() => {
    // clean up after each test

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)

      if (key && key.startsWith(sessionItemPrefix)) {
        localStorage.removeItem(key)
      }
    }
  })

  describe('getSessionItemKey', () => {
    it('should generate key with session prefix', () => {
      const key = getSessionItemKey('my-session', 'my-key')

      expect(key).toBe('session-my-session-my-key')
    })

    it('should handle empty key', () => {
      const key = getSessionItemKey('my-session', '')

      expect(key).toBe('session-my-session-')
    })

    it('should handle special characters', () => {
      const key = getSessionItemKey('sess-123', 'key.name')

      expect(key).toBe('session-sess-123-key.name')
    })
  })

  describe('getSessionItemValue', () => {
    it('should return undefined for non-existent key', () => {
      const value = getSessionItemValue('test-session', 'non-existent')

      expect(value).toBeUndefined()
    })

    it('should return value for valid non-expired item', () => {
      const futureExpiry = new Date(Date.now() + 60000).toISOString()

      localStorage.setItem(
        getSessionItemKey('test-session', 'key1'),
        JSON.stringify({ value: 'test-value', expiresAt: futureExpiry })
      )

      const value = getSessionItemValue('test-session', 'key1')

      expect(value).toBe('test-value')
    })

    it('should return undefined and remove expired item', () => {
      const pastExpiry = new Date(Date.now() - 1000).toISOString()

      localStorage.setItem(
        getSessionItemKey('test-session', 'expired-key'),
        JSON.stringify({ value: 'expired-value', expiresAt: pastExpiry })
      )

      const value = getSessionItemValue('test-session', 'expired-key')

      expect(value).toBeUndefined()
      expect(
        localStorage.getItem(getSessionItemKey('test-session', 'expired-key'))
      ).toBeNull()
    })

    it('should handle invalid JSON gracefully', () => {
      localStorage.setItem(
        getSessionItemKey('test-session', 'invalid'),
        'not-valid-json'
      )

      const value = getSessionItemValue('test-session', 'invalid')

      expect(value).toBeUndefined()
    })

    it('should handle object values', () => {
      const futureExpiry = new Date(Date.now() + 60000).toISOString()
      const objectValue = { foo: 'bar', count: 42 }

      localStorage.setItem(
        getSessionItemKey('test-session', 'object-key'),
        JSON.stringify({ value: objectValue, expiresAt: futureExpiry })
      )

      const value = getSessionItemValue('test-session', 'object-key')

      expect(value).toEqual(objectValue)
    })

    it('should handle array values', () => {
      const futureExpiry = new Date(Date.now() + 60000).toISOString()
      const arrayValue = [1, 2, 3, 'four']

      localStorage.setItem(
        getSessionItemKey('test-session', 'array-key'),
        JSON.stringify({ value: arrayValue, expiresAt: futureExpiry })
      )

      const value = getSessionItemValue('test-session', 'array-key')

      expect(value).toEqual(arrayValue)
    })
  })

  describe('setSessionItemValue', () => {
    it('should store value with expiry', () => {
      const expiry = Date.now() + 60000

      setSessionItemValue('test-session', 'new-key', 'new-value', expiry)

      const stored = JSON.parse(
        localStorage.getItem(getSessionItemKey('test-session', 'new-key'))
      )

      expect(stored.value).toBe('new-value')
      expect(stored.expiresAt).toBe(expiry)
    })

    it('should use default expiry when not provided', () => {
      const beforeSet = Date.now()

      setSessionItemValue('test-session', 'default-expiry', 'value')

      const stored = JSON.parse(
        localStorage.getItem(
          getSessionItemKey('test-session', 'default-expiry')
        )
      )

      expect(stored.value).toBe('value')

      // @note default expiry should be start of next day

      expect(stored.expiresAt).toBeGreaterThan(beforeSet)
    })

    it('should not update if value is identical', () => {
      const expiry = Date.now() + 60000
      const key = getSessionItemKey('test-session', 'no-update')

      setSessionItemValue('test-session', 'no-update', 'same-value', expiry)

      const firstWrite = localStorage.getItem(key)

      // set same value again

      setSessionItemValue('test-session', 'no-update', 'same-value', expiry)

      const secondWrite = localStorage.getItem(key)

      expect(firstWrite).toBe(secondWrite)
    })

    it('should update when value changes', () => {
      const expiry = Date.now() + 60000

      setSessionItemValue('test-session', 'update-key', 'first-value', expiry)

      const first = JSON.parse(
        localStorage.getItem(getSessionItemKey('test-session', 'update-key'))
      )

      expect(first.value).toBe('first-value')

      setSessionItemValue('test-session', 'update-key', 'second-value', expiry)

      const second = JSON.parse(
        localStorage.getItem(getSessionItemKey('test-session', 'update-key'))
      )

      expect(second.value).toBe('second-value')
    })

    it('should store object values', () => {
      const expiry = Date.now() + 60000
      const objectValue = { nested: { data: true }, arr: [1, 2] }

      setSessionItemValue('test-session', 'object-key', objectValue, expiry)

      const stored = JSON.parse(
        localStorage.getItem(getSessionItemKey('test-session', 'object-key'))
      )

      expect(stored.value).toEqual(objectValue)
    })
  })

  describe('getSessionItemExpiry', () => {
    it('should return undefined for non-existent key', () => {
      const expiry = getSessionItemExpiry('test-session', 'non-existent')

      expect(expiry).toBeUndefined()
    })

    it('should return Date object for existing item', () => {
      const futureExpiry = new Date(Date.now() + 60000).toISOString()

      localStorage.setItem(
        getSessionItemKey('test-session', 'expiry-test'),
        JSON.stringify({ value: 'test', expiresAt: futureExpiry })
      )

      const expiry = getSessionItemExpiry('test-session', 'expiry-test')

      expect(expiry).toBeInstanceOf(Date)
      expect(expiry.toISOString()).toBe(futureExpiry)
    })

    it('should return Invalid Date for item without expiresAt', () => {
      localStorage.setItem(
        getSessionItemKey('test-session', 'no-expiry'),
        JSON.stringify({ value: 'test' })
      )

      const expiry = getSessionItemExpiry('test-session', 'no-expiry')

      expect(expiry).toBeInstanceOf(Date)
      expect(isNaN(expiry.getTime())).toBe(true)
    })
  })

  describe('setSessionItemExpiry', () => {
    it('should do nothing for non-existent key', () => {
      setSessionItemExpiry('test-session', 'non-existent', Date.now() + 60000)

      expect(
        localStorage.getItem(getSessionItemKey('test-session', 'non-existent'))
      ).toBeNull()
    })

    it('should update expiry for existing item', () => {
      const initialExpiry = Date.now() + 30000
      const newExpiry = Date.now() + 90000

      localStorage.setItem(
        getSessionItemKey('test-session', 'update-expiry'),
        JSON.stringify({ value: 'test-value', expiresAt: initialExpiry })
      )

      setSessionItemExpiry('test-session', 'update-expiry', newExpiry)

      const stored = JSON.parse(
        localStorage.getItem(getSessionItemKey('test-session', 'update-expiry'))
      )

      expect(stored.value).toBe('test-value')
      expect(stored.expiresAt).toBe(newExpiry)
    })

    it('should preserve value when updating expiry', () => {
      const objectValue = { complex: 'data', num: 123 }
      const initialExpiry = Date.now() + 30000
      const newExpiry = Date.now() + 90000

      localStorage.setItem(
        getSessionItemKey('test-session', 'preserve-value'),
        JSON.stringify({ value: objectValue, expiresAt: initialExpiry })
      )

      setSessionItemExpiry('test-session', 'preserve-value', newExpiry)

      const stored = JSON.parse(
        localStorage.getItem(
          getSessionItemKey('test-session', 'preserve-value')
        )
      )

      expect(stored.value).toEqual(objectValue)
    })
  })
})
