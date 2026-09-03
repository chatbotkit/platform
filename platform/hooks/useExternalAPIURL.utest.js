import { getExternalAPIHostURL } from '@/lib/host'

import { useAPIHostname } from '@/hooks/useHostname'

import useExternalAPIURL from './useExternalAPIURL'

import { renderHook } from '@testing-library/react'

jest.mock('@/hooks/useHostname', () => ({
  useAPIHostname: jest.fn(),
}))
jest.mock('@/lib/host', () => ({
  getExternalAPIHostURL: jest.fn(),
}))

describe('useExternalAPIURL', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should build external API URL using resolved hostname', () => {
    useAPIHostname.mockReturnValue('api.example.com')
    getExternalAPIHostURL.mockReturnValue('https://api.example.com/v1/ping')

    const { result } = renderHook(() => useExternalAPIURL())

    const url = result.current('/v1/ping')

    expect(url).toBe('https://api.example.com/v1/ping')
    expect(getExternalAPIHostURL).toHaveBeenCalledWith(
      '/v1/ping',
      'api.example.com'
    )
  })

  it('should update callback behavior when hostname changes', () => {
    useAPIHostname.mockReturnValue('api-first.example.com')
    getExternalAPIHostURL.mockReturnValueOnce(
      'https://api-first.example.com/one'
    )

    const { result, rerender } = renderHook(() => useExternalAPIURL())

    expect(result.current('/one')).toBe('https://api-first.example.com/one')

    useAPIHostname.mockReturnValue('api-second.example.com')
    getExternalAPIHostURL.mockReturnValueOnce(
      'https://api-second.example.com/two'
    )

    rerender()

    expect(result.current('/two')).toBe('https://api-second.example.com/two')
  })
})
