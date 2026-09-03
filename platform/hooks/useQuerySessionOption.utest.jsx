import { renderHook } from '@testing-library/react'

import { getSessionStorage } from '@/lib/browserstorage'

import useQuerySessionOption from './useQuerySessionOption'

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
}))

jest.mock('@/lib/browserstorage', () => ({
  getSessionStorage: jest.fn(),
}))

const { useSearchParams } = require('next/navigation')

describe('useQuerySessionOption', () => {
  let sessionStorageMock

  beforeEach(() => {
    jest.clearAllMocks()

    sessionStorageMock = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
    }

    getSessionStorage.mockReturnValue(sessionStorageMock)
    useSearchParams.mockReturnValue(new URLSearchParams())
  })

  it('should return the query value when present', () => {
    useSearchParams.mockReturnValue(new URLSearchParams('_embed=dashboard'))

    const { result } = renderHook(() => useQuerySessionOption('_embed'))

    expect(result.current).toBe('dashboard')
  })

  it('should persist the query value to session storage', () => {
    useSearchParams.mockReturnValue(new URLSearchParams('_theme=dark'))

    renderHook(() => useQuerySessionOption('_theme'))

    expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
      'session-options:_theme',
      'dark'
    )
  })

  it('should fall back to session storage when the query value is missing', () => {
    sessionStorageMock.getItem.mockImplementation((key) => {
      if (key === 'session-options:_embed') {
        return 'dashboard'
      }

      return null
    })

    const { result } = renderHook(() => useQuerySessionOption('_embed'))

    expect(result.current).toBe('dashboard')
  })

  it('should return undefined when neither query nor session storage has a value', () => {
    const { result } = renderHook(() => useQuerySessionOption('_embed'))

    expect(result.current).toBe(undefined)
  })

  it('should update when the key changes', () => {
    useSearchParams.mockReturnValue(new URLSearchParams('_embed=dashboard'))

    const { result, rerender } = renderHook(
      ({ keyName }) => useQuerySessionOption(keyName),
      {
        initialProps: {
          keyName: '_embed',
        },
      }
    )

    expect(result.current).toBe('dashboard')

    useSearchParams.mockReturnValue(new URLSearchParams('_theme=dark'))

    rerender({
      keyName: '_theme',
    })

    expect(result.current).toBe('dark')
  })
})
