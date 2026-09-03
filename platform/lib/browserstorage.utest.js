import {
  getFallbackStorage,
  getLocalStorage,
  getLocalStorageWithExpiry,
  getSessionStorage,
} from '@/lib/browserstorage'

describe('SafeStorageHandler', () => {
  let localStorage, sessionStorage

  beforeAll(() => {
    localStorage = getLocalStorage()
    sessionStorage = getSessionStorage()
  })

  beforeEach(() => {
    localStorage.setItem('testKey', 'testValue')
    sessionStorage.setItem('testKey', 'testValue')
  })

  afterEach(() => {
    localStorage.removeItem('testKey')
    sessionStorage.removeItem('testKey')
  })

  test('should get an item from localStorage using getItem', () => {
    expect(localStorage.getItem('testKey')).toBe('testValue')
  })

  test('should set an item in localStorage using setItem', () => {
    localStorage.setItem('newKey', 'newValue')
    expect(localStorage.getItem('newKey')).toBe('newValue')
    localStorage.removeItem('newKey')
  })

  test('should delete an item from localStorage using removeItem', () => {
    localStorage.removeItem('testKey')
    expect(localStorage.getItem('testKey')).toBe(null)
  })

  test('should get an item from localStorage directly', () => {
    expect(localStorage.testKey).toBe('testValue')
  })

  test('should set an item in localStorage directly', () => {
    localStorage.newKey = 'newValue'
    expect(localStorage.newKey).toBe('newValue')
    delete localStorage.newKey
  })

  test('should delete an item from localStorage directly', () => {
    delete localStorage.testKey
    expect(localStorage.testKey).toBe(null)
  })

  test('should get an item from sessionStorage using getItem', () => {
    expect(sessionStorage.getItem('testKey')).toBe('testValue')
  })

  test('should set an item in sessionStorage using setItem', () => {
    sessionStorage.setItem('newKey', 'newValue')
    expect(sessionStorage.getItem('newKey')).toBe('newValue')
    sessionStorage.removeItem('newKey')
  })

  test('should delete an item from sessionStorage using removeItem', () => {
    sessionStorage.removeItem('testKey')
    expect(sessionStorage.getItem('testKey')).toBe(null)
  })

  test('should get an item from sessionStorage directly', () => {
    expect(sessionStorage.testKey).toBe('testValue')
  })

  test('should set an item in sessionStorage directly', () => {
    sessionStorage.newKey = 'newValue'
    expect(sessionStorage.newKey).toBe('newValue')
    delete sessionStorage.newKey
  })

  test('should delete an item from sessionStorage directly', () => {
    delete sessionStorage.testKey
    expect(sessionStorage.testKey).toBe(null)
  })

  test('should support length property on localStorage', () => {
    const initialLength = localStorage.length

    localStorage.setItem('lengthTestKey', 'value')

    expect(localStorage.length).toBe(initialLength + 1)

    localStorage.removeItem('lengthTestKey')

    expect(localStorage.length).toBe(initialLength)
  })

  test('should support key() method on localStorage', () => {
    localStorage.setItem('keyTestKey', 'keyTestValue')

    let found = false

    for (let i = 0; i < localStorage.length; i++) {
      if (localStorage.key(i) === 'keyTestKey') {
        found = true

        break
      }
    }

    expect(found).toBe(true)

    localStorage.removeItem('keyTestKey')
  })

  test('should return null for out of bounds key() index', () => {
    expect(localStorage.key(99999)).toBe(null)
  })
})

describe('getFallbackStorage', () => {
  let fallbackStorage

  beforeAll(() => {
    fallbackStorage = getFallbackStorage()
  })

  beforeEach(() => {
    fallbackStorage.setItem('testKey', 'testValue')
  })

  afterEach(() => {
    fallbackStorage.removeItem('testKey')
  })

  test('should get an item from fallbackStorage using getItem', () => {
    expect(fallbackStorage.getItem('testKey')).toBe('testValue')
  })

  test('should set an item in fallbackStorage using setItem', () => {
    fallbackStorage.setItem('newKey', 'newValue')
    expect(fallbackStorage.getItem('newKey')).toBe('newValue')
    fallbackStorage.removeItem('newKey')
  })

  test('should delete an item from fallbackStorage using removeItem', () => {
    fallbackStorage.removeItem('testKey')
    expect(fallbackStorage.getItem('testKey')).toBe(null)
  })

  test('should get an item from fallbackStorage directly', () => {
    expect(fallbackStorage.testKey).toBe('testValue')
  })

  test('should set an item in fallbackStorage directly', () => {
    fallbackStorage.newKey = 'newValue'
    expect(fallbackStorage.newKey).toBe('newValue')
    delete fallbackStorage.newKey
  })

  test('should delete an item from fallbackStorage directly', () => {
    delete fallbackStorage.testKey
    expect(fallbackStorage.testKey).toBe(null)
  })
})

describe('getLocalStorageWithExpiry', () => {
  let storageWithExpiry

  beforeAll(() => {
    storageWithExpiry = getLocalStorageWithExpiry(1000) // 1 second expiry for testing
  })

  afterEach(() => {
    storageWithExpiry.removeItem('testKey')
    storageWithExpiry.removeItem('expiredKey')
  })

  test('should store and retrieve item before expiry', () => {
    storageWithExpiry.setItem('testKey', 'testValue')
    expect(storageWithExpiry.getItem('testKey')).toBe('testValue')
  })

  test('should return null for expired item', async () => {
    storageWithExpiry.setItem('expiredKey', 'expiredValue', 100) // 100ms expiry

    // wait for expiry

    await new Promise((resolve) => setTimeout(resolve, 150))

    expect(storageWithExpiry.getItem('expiredKey')).toBe(null)
  })

  test('should remove item explicitly', () => {
    storageWithExpiry.setItem('testKey', 'testValue')
    storageWithExpiry.removeItem('testKey')

    expect(storageWithExpiry.getItem('testKey')).toBe(null)
  })

  test('should handle custom expiry time', () => {
    const customExpiry = 2000 // 2 seconds

    storageWithExpiry.setItem('testKey', 'testValue', customExpiry)

    expect(storageWithExpiry.getItem('testKey')).toBe('testValue')
  })

  test('should handle invalid JSON gracefully', () => {
    const localStorage = getLocalStorage()

    localStorage.setItem('invalidKey', 'invalid json')

    expect(storageWithExpiry.getItem('invalidKey')).toBe(null)
    expect(localStorage.getItem('invalidKey')).toBe(null) // should be cleaned up
  })

  test('should cleanup expired items', async () => {
    // set multiple items with different expiry times

    storageWithExpiry.setItem('item1', 'value1', 100) // expires quickly
    storageWithExpiry.setItem('item2', 'value2', 5000) // expires later

    // wait for first item to expire

    await new Promise((resolve) => setTimeout(resolve, 150))

    // run cleanup

    storageWithExpiry.cleanup()

    expect(storageWithExpiry.getItem('item1')).toBe(null)
    expect(storageWithExpiry.getItem('item2')).toBe('value2')

    // cleanup remaining items

    storageWithExpiry.removeItem('item2')
  })

  test('should handle Peek-style message hiding workflow', () => {
    const storage = getLocalStorageWithExpiry(7 * 24 * 60 * 60 * 1000) // 7 days like Peek component
    const messageId = 'test123'
    const storageKey = `hideMessagePeak-${messageId}`

    // initially, message should be visible (not hidden)

    expect(storage.getItem(storageKey)).toBe(null)

    // hide the message (like clicking the X button)

    storage.setItem(storageKey, 'true')

    // message should now be hidden

    expect(storage.getItem(storageKey)).toBe('true')

    // simulate visibility check in component

    const isVisible = storage.getItem(storageKey) !== 'true'

    expect(isVisible).toBe(false)

    // cleanup

    storage.removeItem(storageKey)
  })

  test('should persist across different message IDs', () => {
    const storage = getLocalStorageWithExpiry(7 * 24 * 60 * 60 * 1000)
    const messageId1 = 'test123'
    const messageId2 = 'test456'
    const storageKey1 = `hideMessagePeak-${messageId1}`
    const storageKey2 = `hideMessagePeak-${messageId2}`

    // hide first message

    storage.setItem(storageKey1, 'true')

    // second message should still be visible

    expect(storage.getItem(storageKey1)).toBe('true')
    expect(storage.getItem(storageKey2)).toBe(null)

    // hide second message
    storage.setItem(storageKey2, 'true')

    // both should be hidden

    expect(storage.getItem(storageKey1)).toBe('true')
    expect(storage.getItem(storageKey2)).toBe('true')

    // cleanup

    storage.removeItem(storageKey1)
    storage.removeItem(storageKey2)
  })

  test('should automatically expire Peek messages after configured time', async () => {
    const messageId = 'test123'
    const storageKey = `hideMessagePeak-${messageId}`

    // set item with very short expiry for testing

    const shortExpiryStorage = getLocalStorageWithExpiry(50) // 50ms

    shortExpiryStorage.setItem(storageKey, 'true')

    expect(shortExpiryStorage.getItem(storageKey)).toBe('true')

    // wait for expiry

    await new Promise((resolve) => setTimeout(resolve, 100))

    // should be automatically expired and message visible again

    expect(shortExpiryStorage.getItem(storageKey)).toBe(null)

    const isVisible = shortExpiryStorage.getItem(storageKey) !== 'true'

    expect(isVisible).toBe(true) // Message should be visible again after expiry
  })
})

describe('Edge Cases and Error Handling', () => {
  describe('localStorage edge cases', () => {
    let localStorage

    beforeAll(() => {
      localStorage = getLocalStorage()
    })

    test('should handle non-existent keys', () => {
      expect(localStorage.getItem('nonExistentKey')).toBe(null)
      expect(localStorage.nonExistentKey).toBe(null)
    })

    test('should handle empty string values', () => {
      localStorage.setItem('emptyKey', '')

      expect(localStorage.getItem('emptyKey')).toBe('')
      expect(localStorage.emptyKey).toBe('')

      localStorage.removeItem('emptyKey')
    })

    test('should handle special characters in keys', () => {
      const specialKey = 'key with spaces & symbols!@#$%'

      localStorage.setItem(specialKey, 'specialValue')

      expect(localStorage.getItem(specialKey)).toBe('specialValue')

      localStorage.removeItem(specialKey)
    })

    test('should handle numeric values as strings', () => {
      localStorage.setItem('numericKey', '123')

      expect(localStorage.getItem('numericKey')).toBe('123')
      expect(typeof localStorage.getItem('numericKey')).toBe('string')

      localStorage.removeItem('numericKey')
    })

    test('should handle boolean values as strings', () => {
      localStorage.setItem('booleanKey', 'true')

      expect(localStorage.getItem('booleanKey')).toBe('true')
      expect(typeof localStorage.getItem('booleanKey')).toBe('string')

      localStorage.removeItem('booleanKey')
    })
  })

  describe('sessionStorage edge cases', () => {
    let sessionStorage

    beforeAll(() => {
      sessionStorage = getSessionStorage()
    })

    test('should handle non-existent keys', () => {
      expect(sessionStorage.getItem('nonExistentKey')).toBe(null)
      expect(sessionStorage.nonExistentKey).toBe(null)
    })

    test('should handle empty string values', () => {
      sessionStorage.setItem('emptyKey', '')

      expect(sessionStorage.getItem('emptyKey')).toBe('')
      expect(sessionStorage.emptyKey).toBe('')

      sessionStorage.removeItem('emptyKey')
    })
  })

  describe('fallbackStorage edge cases', () => {
    let fallbackStorage

    beforeAll(() => {
      fallbackStorage = getFallbackStorage()
    })

    test('should handle non-existent keys', () => {
      expect(fallbackStorage.getItem('nonExistentKey')).toBe(null)
      expect(fallbackStorage.nonExistentKey).toBe(null)
    })

    test('should handle empty string values', () => {
      fallbackStorage.setItem('emptyKey', '')

      expect(fallbackStorage.getItem('emptyKey')).toBe('')
      expect(fallbackStorage.emptyKey).toBe('')

      fallbackStorage.removeItem('emptyKey')
    })

    test('should handle rapid sequential operations', () => {
      // test rapid write/read operations

      for (let i = 0; i < 100; i++) {
        const key = `rapidKey${i}`
        const value = `rapidValue${i}`

        fallbackStorage.setItem(key, value)

        expect(fallbackStorage.getItem(key)).toBe(value)

        fallbackStorage.removeItem(key)

        expect(fallbackStorage.getItem(key)).toBe(null)
      }
    })

    test('should maintain data independence between instances', () => {
      const storage1 = getFallbackStorage()
      const storage2 = getFallbackStorage()

      storage1.setItem('testKey', 'value1')
      storage2.setItem('testKey', 'value2')

      expect(storage1.getItem('testKey')).toBe('value1')
      expect(storage2.getItem('testKey')).toBe('value2')
    })
  })

  describe('consistency tests', () => {
    test('all storage types should have consistent API', () => {
      const storages = [
        getLocalStorage(),
        getSessionStorage(),
        getFallbackStorage(),
      ]

      storages.forEach((storage, index) => {
        const testKey = `consistencyKey${index}`
        const testValue = `consistencyValue${index}`

        // test setItem/getItem

        storage.setItem(testKey, testValue)

        expect(storage.getItem(testKey)).toBe(testValue)

        // test direct property access

        expect(storage[testKey]).toBe(testValue)

        // test direct property assignment

        storage[`${testKey}2`] = `${testValue}2`

        expect(storage.getItem(`${testKey}2`)).toBe(`${testValue}2`)

        // test removeItem

        storage.removeItem(testKey)

        expect(storage.getItem(testKey)).toBe(null)

        // test delete operator

        storage[`${testKey}3`] = `${testValue}3`

        delete storage[`${testKey}3`]

        expect(storage.getItem(`${testKey}3`)).toBe(null)
      })
    })
  })

  describe('performance tests', () => {
    test('should handle large number of operations efficiently', () => {
      const storage = getFallbackStorage()
      const startTime = performance.now()
      const numOps = 1000

      // perform many operations

      for (let i = 0; i < numOps; i++) {
        storage.setItem(`perfKey${i}`, `perfValue${i}`)
        storage.getItem(`perfKey${i}`)
      }

      const endTime = performance.now()
      const timePerOp = (endTime - startTime) / (numOps * 2) // 2 ops per iteration

      // should complete operations in reasonable time (less than 1ms per operation)

      expect(timePerOp).toBeLessThan(1)

      // cleanup

      for (let i = 0; i < numOps; i++) {
        storage.removeItem(`perfKey${i}`)
      }
    })

    test('should handle concurrent-like operations', () => {
      const storage = getFallbackStorage()
      const keys = []

      // simulate concurrent operations by interleaving writes and reads

      for (let i = 0; i < 50; i++) {
        const key = `concurrentKey${i}`

        keys.push(key)
        storage.setItem(key, `value${i}`)

        // read from previously set keys

        if (i > 0) {
          expect(storage.getItem(keys[i - 1])).toBe(`value${i - 1}`)
        }
      }

      // verify all values are still correct

      keys.forEach((key, index) => {
        expect(storage.getItem(key)).toBe(`value${index}`)
        storage.removeItem(key)
      })
    })
  })

  describe('browser environment simulation', () => {
    test('should gracefully handle undefined localStorage', () => {
      const originalLocalStorage = global.localStorage

      // simulate environment where localStorage is undefined

      delete global.localStorage

      const storage = getLocalStorage()

      // should fall back to fallback storage

      storage.setItem('testKey', 'testValue')

      expect(storage.getItem('testKey')).toBe('testValue')

      // restore original localStorage

      global.localStorage = originalLocalStorage
    })

    test('should gracefully handle undefined sessionStorage', () => {
      const originalSessionStorage = global.sessionStorage

      // simulate environment where sessionStorage is undefined

      delete global.sessionStorage

      const storage = getSessionStorage()

      // should fall back to fallback storage

      storage.setItem('testKey', 'testValue')

      expect(storage.getItem('testKey')).toBe('testValue')

      // restore original sessionStorage

      global.sessionStorage = originalSessionStorage
    })

    test('should handle storage that throws on access', () => {
      const originalLocalStorage = global.localStorage

      // mock localStorage that throws on access (private browsing mode)

      Object.defineProperty(global, 'localStorage', {
        get: () => {
          throw new Error('localStorage is not available')
        },

        configurable: true,
      })

      const storage = getLocalStorage()

      // should fall back to fallback storage without throwing

      expect(() => {
        storage.setItem('testKey', 'testValue')

        expect(storage.getItem('testKey')).toBe('testValue')
      }).not.toThrow()

      // restore original localStorage

      Object.defineProperty(global, 'localStorage', {
        value: originalLocalStorage,
        configurable: true,
        writable: true,
      })
    })

    test('should handle storage methods that throw', () => {
      const originalLocalStorage = global.localStorage

      // mock localStorage that throws on setItem (quota exceeded)

      const mockStorage = {
        getItem: jest.fn().mockReturnValue(null),
        setItem: jest.fn().mockImplementation(() => {
          throw new Error('QuotaExceededError')
        }),
        removeItem: jest.fn().mockImplementation(() => {
          throw new Error('RemoveError')
        }),
      }

      global.localStorage = mockStorage

      const storage = getLocalStorage()

      // should not throw when setItem fails

      expect(() => {
        storage.setItem('testKey', 'testValue')
      }).not.toThrow()

      // should not throw when removeItem fails

      expect(() => {
        storage.removeItem('testKey')
      }).not.toThrow()

      // should return null when getting non-existent item

      expect(storage.getItem('testKey')).toBe(null)

      // restore original localStorage

      global.localStorage = originalLocalStorage
    })

    test('should handle sessionStorage methods that throw', () => {
      const originalSessionStorage = global.sessionStorage

      // mock sessionStorage that throws on various operations

      const mockStorage = {
        getItem: jest.fn().mockImplementation(() => {
          throw new Error('GetItemError')
        }),
        setItem: jest.fn().mockImplementation(() => {
          throw new Error('SetItemError')
        }),
        removeItem: jest.fn().mockImplementation(() => {
          throw new Error('RemoveItemError')
        }),
      }

      global.sessionStorage = mockStorage

      const storage = getSessionStorage()

      // should not throw and should return null when getItem fails

      expect(() => {
        const result = storage.getItem('testKey')

        expect(result).toBe(null)
      }).not.toThrow()

      // should not throw when setItem fails

      expect(() => {
        storage.setItem('testKey', 'testValue')
      }).not.toThrow()

      // should not throw when removeItem fails

      expect(() => {
        storage.removeItem('testKey')
      }).not.toThrow()

      // restore original sessionStorage

      global.sessionStorage = originalSessionStorage
    })

    test('should handle SecurityError when storage access is blocked in cross-origin iframe', () => {
      const originalLocalStorage = global.localStorage

      // mock localStorage that throws SecurityError (Firefox cross-origin iframe)

      Object.defineProperty(global, 'localStorage', {
        get: () => {
          const error = new DOMException(
            'The operation is insecure.',
            'SecurityError'
          )

          error.code = 18

          throw error
        },

        configurable: true,
      })

      const storage = getLocalStorage()

      // should fall back to fallback storage without throwing

      expect(() => {
        storage.setItem('testKey', 'testValue')

        expect(storage.getItem('testKey')).toBe('testValue')
      }).not.toThrow()

      // restore original localStorage

      Object.defineProperty(global, 'localStorage', {
        value: originalLocalStorage,
        configurable: true,
        writable: true,
      })
    })
  })

  describe('enumeration support', () => {
    test('should support Object.keys on storage proxy', () => {
      const storage = getLocalStorage()

      // clean up any existing test keys

      storage.removeItem('enumKey1')
      storage.removeItem('enumKey2')
      storage.removeItem('enumKey3')

      storage.setItem('enumKey1', 'value1')
      storage.setItem('enumKey2', 'value2')
      storage.setItem('enumKey3', 'value3')

      const keys = Object.keys(storage)

      expect(keys).toContain('enumKey1')
      expect(keys).toContain('enumKey2')
      expect(keys).toContain('enumKey3')

      // cleanup

      storage.removeItem('enumKey1')
      storage.removeItem('enumKey2')
      storage.removeItem('enumKey3')
    })

    test('should support Object.entries on storage proxy', () => {
      const storage = getLocalStorage()

      // clean up any existing test keys

      storage.removeItem('entryKey1')
      storage.removeItem('entryKey2')

      storage.setItem('entryKey1', 'value1')
      storage.setItem('entryKey2', 'value2')

      const entries = Object.entries(storage)
      const entriesMap = Object.fromEntries(entries)

      expect(entriesMap.entryKey1).toBe('value1')
      expect(entriesMap.entryKey2).toBe('value2')

      // cleanup

      storage.removeItem('entryKey1')
      storage.removeItem('entryKey2')
    })

    test('should return empty array when enumeration throws', () => {
      const originalLocalStorage = global.localStorage

      // mock localStorage that throws on length access

      const mockStorage = {
        length: 0,
        key: jest.fn().mockImplementation(() => {
          throw new DOMException('The operation is insecure.', 'SecurityError')
        }),
        getItem: jest.fn().mockReturnValue(null),
        setItem: jest.fn().mockImplementation(() => {
          throw new DOMException('The operation is insecure.', 'SecurityError')
        }),
        removeItem: jest.fn(),
      }

      global.localStorage = mockStorage

      const storage = getLocalStorage()

      // should not throw when enumerating

      expect(() => {
        const keys = Object.keys(storage)

        expect(Array.isArray(keys)).toBe(true)
      }).not.toThrow()

      // restore original localStorage

      global.localStorage = originalLocalStorage
    })
  })

  describe('stress tests', () => {
    test('should handle very large values', () => {
      const storage = getFallbackStorage()
      const largeValue = 'x'.repeat(10000) // 10KB string

      storage.setItem('largeKey', largeValue)

      expect(storage.getItem('largeKey')).toBe(largeValue)
      expect(storage.getItem('largeKey').length).toBe(10000)

      storage.removeItem('largeKey')

      expect(storage.getItem('largeKey')).toBe(null)
    })

    test('should handle many simultaneous keys', () => {
      const storage = getFallbackStorage()
      const numKeys = 1000
      const keys = []

      // set many keys

      for (let i = 0; i < numKeys; i++) {
        const key = `stressKey${i}`

        keys.push(key)
        storage.setItem(key, `value${i}`)
      }

      // verify all keys exist and have correct values

      keys.forEach((key, index) => {
        expect(storage.getItem(key)).toBe(`value${index}`)
      })

      // remove all keys

      keys.forEach((key) => {
        storage.removeItem(key)

        expect(storage.getItem(key)).toBe(null)
      })
    })

    test('should handle rapid add/remove cycles', () => {
      const storage = getFallbackStorage()
      const cycles = 100

      for (let i = 0; i < cycles; i++) {
        // add multiple keys

        for (let j = 0; j < 10; j++) {
          const key = `cycleKey${i}_${j}`

          storage.setItem(key, `value${i}_${j}`)
        }

        // verify they exist
        for (let j = 0; j < 10; j++) {
          const key = `cycleKey${i}_${j}`

          expect(storage.getItem(key)).toBe(`value${i}_${j}`)
        }

        // remove them

        for (let j = 0; j < 10; j++) {
          const key = `cycleKey${i}_${j}`

          storage.removeItem(key)

          expect(storage.getItem(key)).toBe(null)
        }
      }
    })
  })

  describe('type safety tests', () => {
    test('should handle various input types gracefully', () => {
      const storage = getFallbackStorage()

      // test basic string keys first

      storage.setItem('stringKey', 'stringValue')

      expect(storage.getItem('stringKey')).toBe('stringValue')

      storage.removeItem('stringKey')

      // test numeric keys - when passed to setItem, they are used as-is
      // but when we retrieve them, we need to use the same type

      storage.setItem(123, 'numericValue')

      expect(storage.getItem(123)).toBe('numericValue')

      storage.removeItem(123)

      // rest boolean keys - same pattern

      storage.setItem(true, 'booleanValue')

      expect(storage.getItem(true)).toBe('booleanValue')

      storage.removeItem(true)

      // test string versions of numeric/boolean keys

      storage.setItem('123', 'stringNumericValue')

      expect(storage.getItem('123')).toBe('stringNumericValue')

      storage.removeItem('123')

      storage.setItem('true', 'stringBooleanValue')

      expect(storage.getItem('true')).toBe('stringBooleanValue')

      storage.removeItem('true')
    })

    test('should handle special key characters', () => {
      const storage = getFallbackStorage()

      const specialKeys = [
        'key with spaces',
        'key\twith\ttabs',
        'key\nwith\nnewlines',
        'key"with"quotes',
        "key'with'apostrophes",
        'key\\with\\backslashes',
        'key/with/slashes',
        'key.with.dots',
        'key,with,commas',
        'key;with;semicolons',
        'key:with:colons',
        'key[with]brackets',
        'key{with}braces',
        'key(with)parentheses',
        'key<with>angles',
        'key=with=equals',
        'key+with+plus',
        'key-with-dashes',
        'key_with_underscores',
        'key|with|pipes',
        'key&with&ampersands',
        'key%with%percents',
        'key$with$dollars',
        'key#with#hashes',
        'key@with@ats',
        'key!with!exclamations',
        'key?with?questions',
        'key*with*asterisks',
        'key^with^carets',
        'key~with~tildes',
        'key`with`backticks',
      ]

      specialKeys.forEach((key) => {
        const value = `value_for_${key.replace(/[^a-zA-Z0-9]/g, '_')}`

        expect(() => {
          storage.setItem(key, value)

          expect(storage.getItem(key)).toBe(value)

          storage.removeItem(key)

          expect(storage.getItem(key)).toBe(null)
        }).not.toThrow()
      })
    })
  })
})
