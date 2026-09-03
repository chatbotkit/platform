class SafeStorageHandler implements ProxyHandler<Storage> {
  get(target: Storage, prop: string | symbol): unknown {
    if (prop === 'getItem') {
      return (key: string): string | null => {
        try {
          // @note browser storage can throw in private mode or when disabled

          return target.getItem(key)
        } catch {
          return null
        }
      }
    } else if (prop === 'setItem') {
      return (key: string, value: string): void => {
        try {
          // @note storage can throw when quota exceeded or in private mode

          target.setItem(key, value)
        } catch {
          return
        }
      }
    } else if (prop === 'removeItem') {
      return (key: string): void => {
        try {
          // @note storage can throw when quota exceeded or in private mode

          target.removeItem(key)
        } catch {
          return
        }
      }
    } else if (prop === 'clear') {
      return (): void => {
        try {
          target.clear()
        } catch {
          return
        }
      }
    } else if (prop === 'key') {
      return (index: number): string | null => {
        try {
          // @note key() method for iterating storage keys

          return target.key(index)
        } catch {
          return null
        }
      }
    } else if (prop === 'length') {
      try {
        // @note length property for storage size

        return target.length
      } catch {
        return 0
      }
    } else {
      try {
        // @note direct property access uses getItem internally

        return target.getItem(prop as string)
      } catch {
        return null
      }
    }
  }

  set(target: Storage, prop: string | symbol, value: string): boolean {
    try {
      target.setItem(prop as string, value)

      return true
    } catch {
      // @note return false when storage operation fails
      return false
    }
  }

  deleteProperty(target: Storage, prop: string | symbol): boolean {
    try {
      target.removeItem(prop as string)

      return true
    } catch {
      return false
    }
  }

  ownKeys(target: Storage): (string | symbol)[] {
    try {
      // @note enumerate all storage keys safely for Object.keys/entries

      const keys: string[] = []

      for (let i = 0; i < target.length; i++) {
        const key = target.key(i)

        if (key !== null) {
          keys.push(key)
        }
      }

      return keys
    } catch {
      // @note return empty array when storage access is blocked

      return []
    }
  }

  getOwnPropertyDescriptor(
    target: Storage,
    prop: string | symbol
  ): PropertyDescriptor | undefined {
    try {
      // @note required for Object.keys/entries to work with ownKeys trap

      const value = target.getItem(prop as string)

      if (value !== null) {
        return {
          value,
          writable: true,
          enumerable: true,
          configurable: true,
        }
      }

      return undefined
    } catch {
      return undefined
    }
  }
}

/**
 * Check if storage is accessible without throwing SecurityError
 */
function isStorageAccessible(storage: Storage): boolean {
  try {
    // @note test actual storage access, not just existence check

    const testKey = '__storage_test__'

    storage.setItem(testKey, testKey)
    storage.removeItem(testKey)

    return true
  } catch {
    // @note storage access blocked in cross-origin iframe or private mode

    return false
  }
}

export function getFallbackStorage(): Storage {
  const fallbackStorage = new Map<string, string>()

  return new Proxy(fallbackStorage, {
    get(target: Map<string, string>, prop: string | symbol): unknown {
      if (prop === 'key') {
        return (index: number): string | null => {
          const keys = Array.from(target.keys())

          return keys[index] ?? null
        }
      } else if (prop === 'getItem') {
        return (key: string): string | null =>
          target.has(key) ? target.get(key)! : null
      } else if (prop === 'setItem') {
        return (key: string, value: string): void => {
          target.set(key, value)
        }
      } else if (prop === 'removeItem') {
        return (key: string): void => {
          target.delete(key)
        }
      } else if (prop === 'clear') {
        return (): void => {
          target.clear()
        }
      } else if (prop === 'length') {
        return target.size
      } else {
        // @note direct property access returns stored value or null

        return target.get(prop as string) ?? null
      }
    },

    set(
      target: Map<string, string>,
      prop: string | symbol,
      value: string
    ): boolean {
      target.set(prop as string, value)

      return true
    },

    deleteProperty(
      target: Map<string, string>,
      prop: string | symbol
    ): boolean {
      target.delete(prop as string)

      return true
    },
  }) as unknown as Storage
}

export function getLocalStorage(): Storage {
  try {
    // @note localStorage may be undefined in server environments or when disabled

    if (
      typeof localStorage !== 'undefined' &&
      isStorageAccessible(localStorage)
    ) {
      return new Proxy(localStorage, new SafeStorageHandler())
    }
  } catch {
    // @note access to localStorage can throw in private browsing mode or cross-origin iframe
  }

  // @note fallback to memory-based storage when localStorage unavailable

  return getFallbackStorage()
}

export function getSessionStorage(): Storage {
  try {
    // @note sessionStorage may be undefined in server environments or when disabled

    if (
      typeof sessionStorage !== 'undefined' &&
      isStorageAccessible(sessionStorage)
    ) {
      return new Proxy(sessionStorage, new SafeStorageHandler())
    }
  } catch {
    // @note access to sessionStorage can throw in private browsing mode or cross-origin iframe
  }

  // @note fallback to memory-based storage when sessionStorage unavailable

  return getFallbackStorage()
}

interface StorageItem {
  value: string
  expiry: number
}

interface StorageWithExpiry {
  key: (index: number) => string | null
  setItem: (key: string, value: string, expiryMs?: number) => void
  getItem: (key: string) => string | null
  removeItem: (key: string) => void
  clear: () => void
  cleanup: (keyPrefix?: string | null) => void
}

/**
 * Create a localStorage wrapper with expiry functionality
 */
export function getLocalStorageWithExpiry(
  defaultExpiryMs: number = 7 * 24 * 60 * 60 * 1000
): StorageWithExpiry {
  const localStorage = getLocalStorage()

  return {
    key: (index: number): string | null => {
      return localStorage.key(index)
    },

    setItem(
      key: string,
      value: string,
      expiryMs: number = defaultExpiryMs
    ): void {
      const item: StorageItem = {
        value,
        expiry: Date.now() + expiryMs,
      }

      localStorage.setItem(key, JSON.stringify(item))
    },

    getItem(key: string): string | null {
      const itemStr = localStorage.getItem(key)

      if (!itemStr) {
        return null
      }

      try {
        const item = JSON.parse(itemStr) as StorageItem

        // @note check if item has expired

        if (Date.now() > item.expiry) {
          localStorage.removeItem(key)

          return null
        }

        return item.value
      } catch {
        // @note invalid JSON, clean up and return null

        localStorage.removeItem(key)

        return null
      }
    },

    removeItem(key: string): void {
      localStorage.removeItem(key)
    },

    clear(): void {
      localStorage.clear()
    },

    cleanup(keyPrefix: string | null = null): void {
      // @note cleanup expired items from localStorage with optional key prefix filter

      try {
        const storage = getLocalStorage()

        const keysToRemove: string[] = []

        // @note safely iterate through localStorage keys

        if (storage.length !== undefined && storage.key) {
          // @note standard localStorage API

          for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i)

            // @note if keyPrefix specified, only process keys that start with it

            if (key && (!keyPrefix || key.startsWith(keyPrefix))) {
              // @note use proxy storage to safely get raw JSON

              const itemStr = storage.getItem(key)

              if (itemStr) {
                try {
                  const item = JSON.parse(itemStr) as StorageItem

                  if (item.expiry && Date.now() > item.expiry) {
                    keysToRemove.push(key)
                  }
                } catch {
                  // @note invalid JSON format, also clean it up if it matches
                  // our expiry pattern

                  if (!keyPrefix) {
                    // @note only clean up invalid JSON if no prefix filter to
                    // avoid affecting other data

                    keysToRemove.push(key)
                  }
                }
              }
            }
          }
        } else {
          // @note fallback for proxy storage without length/key methods
          // @note cannot iterate over all keys, so skip cleanup to avoid
          // affecting other data
        }

        keysToRemove.forEach((key) => storage.removeItem(key))
      } catch {
        // @note fail silently to maintain compatibility
      }
    },
  }
}
