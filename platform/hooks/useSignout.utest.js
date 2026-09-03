import useSignout from './useSignout'

import '@testing-library/jest-dom'
import { act, renderHook } from '@testing-library/react'

const mockPush = jest.fn()
const mockSignOut = jest.fn()
const mockFetch = jest.fn(() => Promise.resolve({ data: {} }))

jest.mock('next-auth/react', () => ({
  signOut: (...args) => mockSignOut(...args),
}))

jest.mock('@/hooks/useFetch', () => () => ({
  fetch: mockFetch,
}))

jest.mock('@/hooks/useRouter', () => () => ({
  push: mockPush,
  asPath: '/current-path',
}))

describe('useSignout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return signout function', () => {
    const { result } = renderHook(() => useSignout())

    expect(result.current.signout).toBeDefined()
    expect(typeof result.current.signout).toBe('function')
  })

  it('should call unswitch endpoint before signing out', async () => {
    const { result } = renderHook(() => useSignout())

    await act(async () => {
      await result.current.signout()
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/me/team/unswitch', {
      data: {},
    })
    expect(mockSignOut).toHaveBeenCalled()
  })

  it('should use current path as default callbackUrl', async () => {
    const { result } = renderHook(() => useSignout())

    await act(async () => {
      await result.current.signout()
    })

    expect(mockSignOut).toHaveBeenCalledWith({
      callbackUrl: '/current-path',
    })
  })

  it('should use provided callbackUrl when specified', async () => {
    const { result } = renderHook(() => useSignout())

    await act(async () => {
      await result.current.signout({ callbackUrl: '/custom-path' })
    })

    expect(mockSignOut).toHaveBeenCalledWith({
      callbackUrl: '/custom-path',
    })
  })

  it('should call unswitch before signOut', async () => {
    const callOrder = []

    mockFetch.mockImplementation(() => {
      callOrder.push('unswitch')

      return Promise.resolve({ data: {} })
    })

    mockSignOut.mockImplementation(() => {
      callOrder.push('signOut')
    })

    const { result } = renderHook(() => useSignout())

    await act(async () => {
      await result.current.signout()
    })

    expect(callOrder).toEqual(['unswitch', 'signOut'])
  })
})
