/* eslint-disable @typescript-eslint/no-require-imports */
import useSearchParams from './useSearchParams'

import { renderHook } from '@testing-library/react'

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
}))

describe('useSearchParams', () => {
  const { useSearchParams: useNextSearchParams } = require('next/navigation')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns search params from next/navigation', () => {
    const params = new URLSearchParams('foo=bar')

    useNextSearchParams.mockReturnValue(params)

    const { result } = renderHook(() => useSearchParams())

    expect(result.current).toBe(params)
  })

  it('returns null when next/navigation has no params', () => {
    useNextSearchParams.mockReturnValue(null)

    const { result } = renderHook(() => useSearchParams())

    expect(result.current).toBeNull()
  })
})
