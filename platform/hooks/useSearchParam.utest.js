/* eslint-disable @typescript-eslint/no-require-imports */
import useSearchParam from './useSearchParam'

import { renderHook } from '@testing-library/react'

jest.mock('@/hooks/useSearchParams', () => jest.fn())

describe('useSearchParam', () => {
  const useSearchParams = require('@/hooks/useSearchParams')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns value for existing key', () => {
    useSearchParams.mockReturnValue(new URLSearchParams('foo=bar&baz=qux'))

    const { result } = renderHook(() => useSearchParam('foo'))

    expect(result.current).toBe('bar')
  })

  it('returns undefined when key does not exist', () => {
    useSearchParams.mockReturnValue(new URLSearchParams('foo=bar'))

    const { result } = renderHook(() => useSearchParam('missing'))

    expect(result.current).toBeUndefined()
  })

  it('returns undefined when value is empty string', () => {
    useSearchParams.mockReturnValue(new URLSearchParams('foo='))

    const { result } = renderHook(() => useSearchParam('foo'))

    expect(result.current).toBeUndefined()
  })

  it('returns undefined when search params are null', () => {
    useSearchParams.mockReturnValue(null)

    const { result } = renderHook(() => useSearchParam('foo'))

    expect(result.current).toBeUndefined()
  })
})
