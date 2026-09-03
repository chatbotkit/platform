import { getExternalFrontendHostURL, getExternalHostURL } from '@/lib/host'
import memcache from '@/lib/memcache'
import {
  DEFAULT_EXPIRES_IN_SECONDS,
  getShortId,
  getShortURL,
  getTempShortURL,
  retrieveShortURL,
  storeShortURL,
  storeTempShortURL,
} from '@/lib/short'

jest.mock('@/lib/memcache', () => ({
  set: jest.fn(),
  get: jest.fn(),
}))

describe('getShortURL', () => {
  it('must return the same URL for already short URLs', async () => {
    const url = getExternalHostURL('/s/123')

    const shortURL = await getShortURL(url)

    expect(shortURL).toBe(url)
  })

  it('stores a new URL in Redis and returns the short proxy URL', async () => {
    memcache.set.mockResolvedValue('OK')

    const longUrl = 'https://chatbotkit.com/very/long/path?with=params&and=more'

    const shortURL = await getShortURL(longUrl)

    expect(memcache.set).toHaveBeenCalledTimes(1)
    expect(shortURL).toMatch(/\/s\/[0-9a-f-]+/)
  })

  it('generates the same short URL for the same input URL', async () => {
    memcache.set.mockResolvedValue('OK')

    const longUrl = 'https://chatbotkit.com/stable/url'

    const first = await getShortURL(longUrl)
    const second = await getShortURL(longUrl)

    expect(first).toBe(second)
  })

  it('must return the same URL for already short frontend URLs', async () => {
    const url = getExternalFrontendHostURL('/s/abc')

    const shortURL = await getShortURL(url)

    expect(shortURL).toBe(url)
    expect(memcache.set).not.toHaveBeenCalled()
  })
})

describe('getTempShortURL', () => {
  it('must return the same URL for already short URLs', async () => {
    const url = getExternalHostURL('/s/123')

    const shortURL = await getTempShortURL(url)

    expect(shortURL).toBe(url)
  })

  it('stores a URL with TTL and returns the short proxy URL', async () => {
    memcache.set.mockResolvedValue('OK')

    const longUrl = 'https://chatbotkit.com/temporary/resource'

    const shortURL = await getTempShortURL(longUrl)

    expect(memcache.set).toHaveBeenCalledWith(
      expect.stringMatching(/^short:/),
      longUrl,
      { ex: DEFAULT_EXPIRES_IN_SECONDS }
    )
    expect(shortURL).toMatch(/\/s\/[0-9a-f-]+/)
  })

  it('uses a custom TTL when provided', async () => {
    memcache.set.mockResolvedValue('OK')

    const longUrl = 'https://chatbotkit.com/custom-temporary/resource'

    await getTempShortURL(longUrl, 3600)

    expect(memcache.set).toHaveBeenCalledWith(
      expect.stringMatching(/^short:/),
      longUrl,
      { ex: 3600 }
    )
  })

  it('must return the same URL for already short frontend URLs', async () => {
    const url = getExternalFrontendHostURL('/s/xyz')

    const shortURL = await getTempShortURL(url, 123)

    expect(shortURL).toBe(url)
    expect(memcache.set).not.toHaveBeenCalled()
  })
})

describe('getShortId', () => {
  it('returns a deterministic UUID v5 for a given URL', async () => {
    const id1 = await getShortId('https://example.com/page')
    const id2 = await getShortId('https://example.com/page')

    expect(id1).toBe(id2)
  })

  it('returns different IDs for different URLs', async () => {
    const id1 = await getShortId('https://example.com/page-a')
    const id2 = await getShortId('https://example.com/page-b')

    expect(id1).not.toBe(id2)
  })

  it('returns a valid UUID-formatted string', async () => {
    const id = await getShortId('https://example.com/')

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })
})

describe('storeShortURL', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    memcache.set.mockResolvedValue('OK')
  })

  it('stores the URL in Redis using the short:* key pattern', async () => {
    const url = 'https://chatbotkit.com/some/page'

    await storeShortURL(url)

    expect(memcache.set).toHaveBeenCalledTimes(1)

    const [key, value] = memcache.set.mock.calls[0]

    expect(key).toMatch(/^short:[0-9a-f-]+$/)
    expect(value).toBe(url)
  })

  it('returns the short ID string', async () => {
    const shortId = await storeShortURL('https://chatbotkit.com/page')

    expect(typeof shortId).toBe('string')
    expect(shortId).toMatch(/^[0-9a-f-]+$/)
  })

  it('stores without any TTL option', async () => {
    await storeShortURL('https://chatbotkit.com/permanent')

    const callArgs = memcache.set.mock.calls[0]

    // storeShortURL must NOT pass an expiry option
    expect(callArgs).toHaveLength(2)
  })

  it('propagates Redis errors', async () => {
    memcache.set.mockRejectedValue(new Error('redis down'))

    await expect(
      storeShortURL('https://chatbotkit.com/failure-case')
    ).rejects.toThrow('redis down')
  })
})

describe('storeTempShortURL', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    memcache.set.mockResolvedValue('OK')
  })

  it('stores the URL in Redis with the expiry option', async () => {
    const url = 'https://chatbotkit.com/transient'

    await storeTempShortURL(url)

    expect(memcache.set).toHaveBeenCalledWith(
      expect.stringMatching(/^short:[0-9a-f-]+$/),
      url,
      { ex: DEFAULT_EXPIRES_IN_SECONDS }
    )
  })

  it('uses EXPIRES_IN_SECONDS constant for the TTL', () => {
    expect(typeof DEFAULT_EXPIRES_IN_SECONDS).toBe('number')
    expect(DEFAULT_EXPIRES_IN_SECONDS).toBeGreaterThan(0)
  })

  it('uses a custom TTL when provided', async () => {
    const url = 'https://chatbotkit.com/transient-custom'

    await storeTempShortURL(url, 3600)

    expect(memcache.set).toHaveBeenCalledWith(
      expect.stringMatching(/^short:[0-9a-f-]+$/),
      url,
      { ex: 3600 }
    )
  })
})

describe('retrieveShortURL', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('retrieves the URL stored under the short:* key', async () => {
    const storedUrl = 'https://chatbotkit.com/original'

    memcache.get.mockResolvedValue(storedUrl)

    const result = await retrieveShortURL('abc-123')

    expect(memcache.get).toHaveBeenCalledWith('short:abc-123')
    expect(result).toBe(storedUrl)
  })

  it('returns null when the short ID does not exist in Redis', async () => {
    memcache.get.mockResolvedValue(null)

    const result = await retrieveShortURL('nonexistent-id')

    expect(result).toBeNull()
  })

  it('propagates Redis get errors', async () => {
    memcache.get.mockRejectedValue(new Error('read failed'))

    await expect(retrieveShortURL('abc-123')).rejects.toThrow('read failed')
  })
})
