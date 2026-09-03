import memcache from '@/lib/memcache'

import { slidingWindow } from './ratelimit'

// @note this file used to mock `@upstash/ratelimit` and assert that a limiter
// was constructed with the right algorithm and cached per limit shape. All of
// that moved into the installed key-value module, which owns it and tests it.
// What is left here is the platform's side of the seam: it asks for a decision
// and passes the answer through.

jest.mock('@/lib/memcache', () => ({
  __esModule: true,
  default: {
    slidingWindow: jest.fn(),
  },
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn() })),
}))

describe('slidingWindow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('passes the key, allowance and window through', async () => {
    memcache.slidingWindow.mockResolvedValue({ success: true })

    await slidingWindow('rating-user-1', 5, '60 m')

    expect(memcache.slidingWindow).toHaveBeenCalledWith(
      'rating-user-1',
      5,
      '60 m'
    )
  })

  it('reports success', async () => {
    memcache.slidingWindow.mockResolvedValue({ success: true })

    expect(await slidingWindow('key', 1, '10 s')).toEqual({ success: true })
  })

  it('reports refusal', async () => {
    memcache.slidingWindow.mockResolvedValue({ success: false })

    expect(await slidingWindow('key', 1, '10 s')).toEqual({ success: false })
  })

  it('does not swallow an error from the store', async () => {
    // @note failing open on a backend timeout is the backend's judgement to
    // make, and it makes it. The platform must not add a second, blanket catch
    // on top, or a genuine fault reads as "within limit" for every caller.

    memcache.slidingWindow.mockRejectedValue(new Error('store unavailable'))

    await expect(slidingWindow('key', 1, '10 s')).rejects.toThrow(
      'store unavailable'
    )
  })
})
