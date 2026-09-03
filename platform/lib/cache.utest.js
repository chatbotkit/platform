import {
  bypassCache,
  clearCache,
  rollingCache,
  swrCache,
  ttlCache,
} from '@/lib/cache'
import { defer } from '@/lib/defer'
import memcache from '@/lib/memcache'
import { getRandomId } from '@/lib/string'

jest.mock('@/lib/memcache', () => ({
  get: jest.fn(),
  set: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
}))

jest.mock('@/lib/defer', () => ({
  defer: jest.fn(),
}))

describe('ttlCache', () => {
  const mockValue = { data: getRandomId('text-data-') }
  const durationInSeconds = 60

  const fetchFunction = jest.fn()

  const ORIGINAL_SKIP_FUNCTION_CACHE = process.env.SKIP_FUNCTION_CACHE

  beforeEach(() => {
    delete process.env.SKIP_FUNCTION_CACHE
  })

  afterEach(() => {
    process.env.SKIP_FUNCTION_CACHE = ORIGINAL_SKIP_FUNCTION_CACHE

    jest.clearAllMocks()
  })

  test('should fetch and cache the data if cache is empty', async () => {
    const mockKey = getRandomId('test-key-')

    memcache.get.mockResolvedValue(null)
    fetchFunction.mockResolvedValue(mockValue)

    const result = await ttlCache(mockKey, durationInSeconds, fetchFunction)

    expect(result).toEqual(mockValue)
    expect(memcache.get).toHaveBeenCalledWith(mockKey)
    expect(fetchFunction).toHaveBeenCalled()
    expect(memcache.set).toHaveBeenCalledWith(mockKey, mockValue, {
      ex: durationInSeconds,
    })
  })

  test('should return the cached data and not fetch new data if cache is not empty', async () => {
    const mockKey = getRandomId('test-key-')

    memcache.get.mockResolvedValue(mockValue)

    const result = await ttlCache(mockKey, durationInSeconds, fetchFunction)

    expect(result).toEqual(mockValue)
    expect(memcache.get).toHaveBeenCalledWith(mockKey)
    expect(fetchFunction).not.toHaveBeenCalled()
    expect(memcache.set).not.toHaveBeenCalled()
  })
})

describe('swrCache', () => {
  const mockValue = { data: getRandomId('text-data-') }
  const durationInSeconds = 60

  const fetchFunction = jest.fn()

  const ORIGINAL_SKIP_FUNCTION_CACHE = process.env.SKIP_FUNCTION_CACHE

  beforeEach(() => {
    delete process.env.SKIP_FUNCTION_CACHE
  })

  afterEach(() => {
    process.env.SKIP_FUNCTION_CACHE = ORIGINAL_SKIP_FUNCTION_CACHE

    jest.clearAllMocks()
  })

  test('should populate the cache if empty and return the fetched data', async () => {
    const mockKey = getRandomId('test-key-')

    memcache.get.mockResolvedValue(null)

    fetchFunction.mockResolvedValue(mockValue)

    const result = await swrCache(mockKey, durationInSeconds, fetchFunction)

    expect(result).toEqual(mockValue)
    expect(memcache.get).toHaveBeenCalledWith(mockKey)
    expect(fetchFunction).toHaveBeenCalled()
    expect(memcache.set).toHaveBeenCalledWith(mockKey, mockValue, {
      ex: durationInSeconds,
    })
  })

  test('should return cached data and asynchronously revalidate cache', async () => {
    const mockKey = getRandomId('test-key-')

    memcache.get.mockResolvedValue(mockValue)

    fetchFunction.mockResolvedValue({ data: 'newData' })

    const result = await swrCache(mockKey, durationInSeconds, fetchFunction)

    expect(result).toEqual(mockValue)
    expect(memcache.get).toHaveBeenCalledWith(mockKey)

    expect(defer).toHaveBeenCalled()

    await defer.mock.calls[0][0]

    expect(fetchFunction).toHaveBeenCalled()

    expect(memcache.set).toHaveBeenCalledWith(
      mockKey,
      { data: 'newData' },
      { ex: durationInSeconds }
    )
  })
})

describe('rollingCache', () => {
  const mockValue = { data: getRandomId('text-data-') }
  const durationInSeconds = 60

  const fetchFunction = jest.fn()

  const ORIGINAL_SKIP_FUNCTION_CACHE = process.env.SKIP_FUNCTION_CACHE

  beforeEach(() => {
    delete process.env.SKIP_FUNCTION_CACHE
  })

  afterEach(() => {
    process.env.SKIP_FUNCTION_CACHE = ORIGINAL_SKIP_FUNCTION_CACHE

    jest.clearAllMocks()
  })

  test('should populate the cache if empty and set expiration', async () => {
    const mockKey = getRandomId('test-key-')

    memcache.get.mockResolvedValue(null)

    fetchFunction.mockResolvedValue(mockValue)

    const result = await rollingCache(mockKey, durationInSeconds, fetchFunction)

    expect(result).toEqual(mockValue)
    expect(memcache.get).toHaveBeenCalledWith(mockKey)
    expect(fetchFunction).toHaveBeenCalled()
    expect(memcache.set).toHaveBeenCalledWith(mockKey, mockValue, {
      ex: durationInSeconds,
    })
  })

  test('should use cached data and extend its expiration if it exists', async () => {
    const mockKey = getRandomId('test-key-')

    memcache.get.mockResolvedValue(mockValue)

    const result = await rollingCache(mockKey, durationInSeconds, fetchFunction)

    expect(result).toEqual(mockValue)
    expect(memcache.get).toHaveBeenCalledWith(mockKey)
    expect(fetchFunction).not.toHaveBeenCalled()
    expect(memcache.expire).toHaveBeenCalledWith(mockKey, durationInSeconds)
  })
})

describe('bypassCache', () => {
  const mockValue = { data: getRandomId('text-data-') }
  const durationInSeconds = 60

  const fetchFunction = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should always call the fetch function and not use cache', async () => {
    const mockKey = getRandomId('test-key-')

    fetchFunction.mockResolvedValue(mockValue)

    const result = await bypassCache(mockKey, durationInSeconds, fetchFunction)

    expect(result).toEqual(mockValue)
    expect(fetchFunction).toHaveBeenCalled()
    expect(memcache.get).not.toHaveBeenCalled()
    expect(memcache.set).not.toHaveBeenCalled()
  })

  test('should handle errors from fetch function', async () => {
    const mockKey = getRandomId('test-key-')
    const errorMessage = 'Fetch failed'

    fetchFunction.mockRejectedValue(new Error(errorMessage))

    await expect(
      bypassCache(mockKey, durationInSeconds, fetchFunction)
    ).rejects.toThrow(errorMessage)

    expect(fetchFunction).toHaveBeenCalled()
    expect(memcache.get).not.toHaveBeenCalled()
    expect(memcache.set).not.toHaveBeenCalled()
  })
})

describe('clearCache', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should call memcache.del with the provided key', async () => {
    const mockKey = getRandomId('test-key-')

    memcache.del.mockResolvedValue(1)

    await clearCache(mockKey)

    expect(memcache.del).toHaveBeenCalledWith(mockKey)
  })

  test('should handle memcache.del errors', async () => {
    const mockKey = getRandomId('test-key-')
    const errorMessage = 'Delete failed'

    memcache.del.mockRejectedValue(new Error(errorMessage))

    await expect(clearCache(mockKey)).rejects.toThrow(errorMessage)

    expect(memcache.del).toHaveBeenCalledWith(mockKey)
  })
})

describe('ttlCache - additional scenarios', () => {
  const mockValue = { data: getRandomId('text-data-') }
  const durationInSeconds = 60

  const fetchFunction = jest.fn()

  const ORIGINAL_SKIP_FUNCTION_CACHE = process.env.SKIP_FUNCTION_CACHE

  beforeEach(() => {
    delete process.env.SKIP_FUNCTION_CACHE
  })

  afterEach(() => {
    process.env.SKIP_FUNCTION_CACHE = ORIGINAL_SKIP_FUNCTION_CACHE

    jest.clearAllMocks()
  })

  test('should skip cache when SKIP_FUNCTION_CACHE environment variable is set', async () => {
    const mockKey = getRandomId('test-key-')

    process.env.SKIP_FUNCTION_CACHE = 'true'

    fetchFunction.mockResolvedValue(mockValue)

    const result = await ttlCache(mockKey, durationInSeconds, fetchFunction)

    expect(result).toEqual(mockValue)
    expect(memcache.get).not.toHaveBeenCalled()
    expect(fetchFunction).toHaveBeenCalled()
    expect(memcache.set).toHaveBeenCalledWith(mockKey, mockValue, {
      ex: durationInSeconds,
    })
  })

  test('should skip cache when skip parameter is explicitly true', async () => {
    const mockKey = getRandomId('test-key-')

    fetchFunction.mockResolvedValue(mockValue)

    const result = await ttlCache(
      mockKey,
      durationInSeconds,
      fetchFunction,
      true
    )

    expect(result).toEqual(mockValue)
    expect(memcache.get).not.toHaveBeenCalled()
    expect(fetchFunction).toHaveBeenCalled()
    expect(memcache.set).toHaveBeenCalledWith(mockKey, mockValue, {
      ex: durationInSeconds,
    })
  })

  test('should not set cache when durationInSeconds is 0', async () => {
    const mockKey = getRandomId('test-key-')

    memcache.get.mockResolvedValue(null)
    fetchFunction.mockResolvedValue(mockValue)

    const result = await ttlCache(mockKey, 0, fetchFunction)

    expect(result).toEqual(mockValue)
    expect(memcache.get).toHaveBeenCalledWith(mockKey)
    expect(fetchFunction).toHaveBeenCalled()
    expect(memcache.set).not.toHaveBeenCalled()
  })

  test('should handle errors from fetch function', async () => {
    const mockKey = getRandomId('test-key-')
    const errorMessage = 'Fetch failed'

    memcache.get.mockResolvedValue(null)
    fetchFunction.mockRejectedValue(new Error(errorMessage))

    await expect(
      ttlCache(mockKey, durationInSeconds, fetchFunction)
    ).rejects.toThrow(errorMessage)

    expect(memcache.get).toHaveBeenCalledWith(mockKey)
    expect(fetchFunction).toHaveBeenCalled()
  })

  test('should handle errors from memcache.get', async () => {
    const mockKey = getRandomId('test-key-')
    const errorMessage = 'Cache get failed'

    memcache.get.mockRejectedValue(new Error(errorMessage))

    await expect(
      ttlCache(mockKey, durationInSeconds, fetchFunction)
    ).rejects.toThrow(errorMessage)

    expect(memcache.get).toHaveBeenCalledWith(mockKey)
    expect(fetchFunction).not.toHaveBeenCalled()
  })

  test('should handle null return value from fetch function', async () => {
    const mockKey = getRandomId('test-key-')

    memcache.get.mockResolvedValue(null)
    fetchFunction.mockResolvedValue(null)

    const result = await ttlCache(mockKey, durationInSeconds, fetchFunction)

    expect(result).toBeNull()
    expect(memcache.get).toHaveBeenCalledWith(mockKey)
    expect(fetchFunction).toHaveBeenCalled()
    expect(memcache.set).toHaveBeenCalledWith(mockKey, null, {
      ex: durationInSeconds,
    })
  })

  test('should handle undefined return value from fetch function', async () => {
    const mockKey = getRandomId('test-key-')

    memcache.get.mockResolvedValue(null)
    fetchFunction.mockResolvedValue(undefined)

    const result = await ttlCache(mockKey, durationInSeconds, fetchFunction)

    expect(result).toBeUndefined()
    expect(memcache.get).toHaveBeenCalledWith(mockKey)
    expect(fetchFunction).toHaveBeenCalled()
    expect(memcache.set).toHaveBeenCalledWith(mockKey, undefined, {
      ex: durationInSeconds,
    })
  })
})

describe('swrCache - additional scenarios', () => {
  const mockValue = { data: getRandomId('text-data-') }
  const durationInSeconds = 60

  const fetchFunction = jest.fn()

  const ORIGINAL_SKIP_FUNCTION_CACHE = process.env.SKIP_FUNCTION_CACHE

  beforeEach(() => {
    delete process.env.SKIP_FUNCTION_CACHE
  })

  afterEach(() => {
    process.env.SKIP_FUNCTION_CACHE = ORIGINAL_SKIP_FUNCTION_CACHE

    jest.clearAllMocks()
  })

  test('should skip cache when SKIP_FUNCTION_CACHE environment variable is set', async () => {
    const mockKey = getRandomId('test-key-')

    process.env.SKIP_FUNCTION_CACHE = 'true'

    fetchFunction.mockResolvedValue(mockValue)

    const result = await swrCache(mockKey, durationInSeconds, fetchFunction)

    expect(result).toEqual(mockValue)
    expect(memcache.get).not.toHaveBeenCalled()
    expect(fetchFunction).toHaveBeenCalled()
  })

  test('should skip cache when skip parameter is explicitly true', async () => {
    const mockKey = getRandomId('test-key-')

    fetchFunction.mockResolvedValue(mockValue)

    const result = await swrCache(
      mockKey,
      durationInSeconds,
      fetchFunction,
      true
    )

    expect(result).toEqual(mockValue)
    expect(memcache.get).not.toHaveBeenCalled()
    expect(fetchFunction).toHaveBeenCalled()
  })

  test('should not set cache when durationInSeconds is 0', async () => {
    const mockKey = getRandomId('test-key-')

    memcache.get.mockResolvedValue(null)
    fetchFunction.mockResolvedValue(mockValue)

    const result = await swrCache(mockKey, 0, fetchFunction)

    expect(result).toEqual(mockValue)
    expect(fetchFunction).toHaveBeenCalled()
    expect(memcache.set).not.toHaveBeenCalled()
  })

  test('should handle errors from fetch function when cache is empty', async () => {
    const mockKey = getRandomId('test-key-')
    const errorMessage = 'Fetch failed'

    memcache.get.mockResolvedValue(null)
    fetchFunction.mockRejectedValue(new Error(errorMessage))

    await expect(
      swrCache(mockKey, durationInSeconds, fetchFunction)
    ).rejects.toThrow(errorMessage)

    expect(fetchFunction).toHaveBeenCalled()
  })

  test('should handle null return value from fetch function', async () => {
    const mockKey = getRandomId('test-key-')

    memcache.get.mockResolvedValue(null)
    fetchFunction.mockResolvedValue(null)

    const result = await swrCache(mockKey, durationInSeconds, fetchFunction)

    expect(result).toBeNull()
    expect(fetchFunction).toHaveBeenCalled()
  })
})

describe('rollingCache - additional scenarios', () => {
  const mockValue = { data: getRandomId('text-data-') }
  const durationInSeconds = 60

  const fetchFunction = jest.fn()

  const ORIGINAL_SKIP_FUNCTION_CACHE = process.env.SKIP_FUNCTION_CACHE

  beforeEach(() => {
    delete process.env.SKIP_FUNCTION_CACHE
  })

  afterEach(() => {
    process.env.SKIP_FUNCTION_CACHE = ORIGINAL_SKIP_FUNCTION_CACHE

    jest.clearAllMocks()
  })

  test('should skip cache when SKIP_FUNCTION_CACHE environment variable is set', async () => {
    const mockKey = getRandomId('test-key-')

    process.env.SKIP_FUNCTION_CACHE = 'true'

    fetchFunction.mockResolvedValue(mockValue)

    const result = await rollingCache(mockKey, durationInSeconds, fetchFunction)

    expect(result).toEqual(mockValue)
    expect(memcache.get).not.toHaveBeenCalled()
    expect(fetchFunction).toHaveBeenCalled()
    expect(memcache.set).toHaveBeenCalledWith(mockKey, mockValue, {
      ex: durationInSeconds,
    })
  })

  test('should skip cache when skip parameter is explicitly true', async () => {
    const mockKey = getRandomId('test-key-')

    fetchFunction.mockResolvedValue(mockValue)

    const result = await rollingCache(
      mockKey,
      durationInSeconds,
      fetchFunction,
      true
    )

    expect(result).toEqual(mockValue)
    expect(memcache.get).not.toHaveBeenCalled()
    expect(fetchFunction).toHaveBeenCalled()
    expect(memcache.set).toHaveBeenCalledWith(mockKey, mockValue, {
      ex: durationInSeconds,
    })
  })

  test('should not set cache when durationInSeconds is 0', async () => {
    const mockKey = getRandomId('test-key-')

    memcache.get.mockResolvedValue(null)
    fetchFunction.mockResolvedValue(mockValue)

    const result = await rollingCache(mockKey, 0, fetchFunction)

    expect(result).toEqual(mockValue)
    expect(memcache.get).toHaveBeenCalledWith(mockKey)
    expect(fetchFunction).toHaveBeenCalled()
    expect(memcache.set).not.toHaveBeenCalled()
    expect(memcache.expire).not.toHaveBeenCalled()
  })

  test('should extend expiration even when durationInSeconds is 0 and cache exists', async () => {
    const mockKey = getRandomId('test-key-')

    memcache.get.mockResolvedValue(mockValue)

    const result = await rollingCache(mockKey, 0, fetchFunction)

    expect(result).toEqual(mockValue)
    expect(memcache.get).toHaveBeenCalledWith(mockKey)
    expect(fetchFunction).not.toHaveBeenCalled()
    expect(memcache.expire).toHaveBeenCalledWith(mockKey, 0)
  })

  test('should handle errors from fetch function', async () => {
    const mockKey = getRandomId('test-key-')
    const errorMessage = 'Fetch failed'

    memcache.get.mockResolvedValue(null)
    fetchFunction.mockRejectedValue(new Error(errorMessage))

    await expect(
      rollingCache(mockKey, durationInSeconds, fetchFunction)
    ).rejects.toThrow(errorMessage)

    expect(memcache.get).toHaveBeenCalledWith(mockKey)
    expect(fetchFunction).toHaveBeenCalled()
  })

  test('should handle errors from memcache.get', async () => {
    const mockKey = getRandomId('test-key-')
    const errorMessage = 'Cache get failed'

    memcache.get.mockRejectedValue(new Error(errorMessage))

    await expect(
      rollingCache(mockKey, durationInSeconds, fetchFunction)
    ).rejects.toThrow(errorMessage)

    expect(memcache.get).toHaveBeenCalledWith(mockKey)
    expect(fetchFunction).not.toHaveBeenCalled()
  })

  test('should handle null return value from fetch function', async () => {
    const mockKey = getRandomId('test-key-')

    memcache.get.mockResolvedValue(null)
    fetchFunction.mockResolvedValue(null)

    const result = await rollingCache(mockKey, durationInSeconds, fetchFunction)

    expect(result).toBeNull()
    expect(memcache.get).toHaveBeenCalledWith(mockKey)
    expect(fetchFunction).toHaveBeenCalled()
    expect(memcache.set).toHaveBeenCalledWith(mockKey, null, {
      ex: durationInSeconds,
    })
  })
})
