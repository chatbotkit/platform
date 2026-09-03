import useMediaQuery from './useMediaQuery'

import { act, renderHook, waitFor } from '@testing-library/react'

describe('useMediaQuery', () => {
  let originalMatchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    jest.clearAllMocks()
  })

  it('should return the current media query match state', async () => {
    window.matchMedia = jest.fn(() => ({
      matches: true,
      media: '(min-width: 768px)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }))

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))

    await waitFor(() => {
      expect(result.current).toBe(true)
    })
  })

  it('should update when the media query emits a change event', async () => {
    let matches = false
    let onChange

    window.matchMedia = jest.fn(() => ({
      get matches() {
        return matches
      },
      media: '(min-width: 768px)',
      addEventListener: jest.fn((event, listener) => {
        if (event === 'change') {
          onChange = listener
        }
      }),
      removeEventListener: jest.fn(),
    }))

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))

    await waitFor(() => {
      expect(result.current).toBe(false)
    })

    matches = true

    act(() => {
      onChange()
    })

    await waitFor(() => {
      expect(result.current).toBe(true)
    })
  })

  it('should fall back to the default value when matchMedia is unavailable', async () => {
    window.matchMedia = undefined

    const { result } = renderHook(() =>
      useMediaQuery('(min-width: 768px)', true)
    )

    await waitFor(() => {
      expect(result.current).toBe(true)
    })
  })

  it('should use window resize as a fallback when addEventListener is unavailable', async () => {
    let matches = false

    window.matchMedia = jest.fn(() => ({
      get matches() {
        return matches
      },
      media: '(min-width: 768px)',
    }))

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))

    await waitFor(() => {
      expect(result.current).toBe(false)
    })

    matches = true

    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    await waitFor(() => {
      expect(result.current).toBe(true)
    })
  })
})
