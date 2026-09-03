/* eslint-disable @typescript-eslint/no-require-imports */
import useQuerySessionOption from './useQuerySessionOption'

import { renderHook } from '@testing-library/react'

jest.mock('@/hooks/useSearchParams', () => jest.fn())
jest.mock('@/lib/browserstorage', () => ({
  getSessionStorage: jest.fn(),
}))

describe('useQuerySessionOption', () => {
  const useSearchParams = require('@/hooks/useSearchParams')
  const { getSessionStorage } = require('@/lib/browserstorage')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns query param value and persists it to session storage', () => {
    const sessionStorage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
    }

    useSearchParams.mockReturnValue(new URLSearchParams('theme=dark'))
    getSessionStorage.mockReturnValue(sessionStorage)

    const { result } = renderHook(() => useQuerySessionOption('theme'))

    expect(result.current).toBe('dark')
    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      'session-options:theme',
      'dark'
    )
  })

  it('returns stored session value when query param is missing', () => {
    const sessionStorage = {
      getItem: jest.fn(() => 'compact'),
      setItem: jest.fn(),
    }

    useSearchParams.mockReturnValue(new URLSearchParams(''))
    getSessionStorage.mockReturnValue(sessionStorage)

    const { result } = renderHook(() => useQuerySessionOption('layout'))

    expect(result.current).toBe('compact')
    expect(sessionStorage.getItem).toHaveBeenCalledWith(
      'session-options:layout'
    )
    expect(sessionStorage.setItem).not.toHaveBeenCalled()
  })

  it('returns undefined when neither query param nor storage value exists', () => {
    const sessionStorage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
    }

    useSearchParams.mockReturnValue(null)
    getSessionStorage.mockReturnValue(sessionStorage)

    const { result } = renderHook(() => useQuerySessionOption('tab'))

    expect(result.current).toBeUndefined()
  })

  it('supports custom storageKey option for persistence and retrieval', () => {
    const sessionStorage = {
      getItem: jest.fn(() => 'saved'),
      setItem: jest.fn(),
    }

    useSearchParams.mockReturnValue(new URLSearchParams(''))
    getSessionStorage.mockReturnValue(sessionStorage)

    const { result } = renderHook(() =>
      useQuerySessionOption('mode', { storageKey: 'custom-storage-key' })
    )

    expect(result.current).toBe('saved')
    expect(sessionStorage.getItem).toHaveBeenCalledWith('custom-storage-key')
  })
})
