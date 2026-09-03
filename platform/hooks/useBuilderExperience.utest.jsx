jest.mock('@/hooks/useHostname', () => jest.fn())
jest.mock('@/hooks/usePartner', () => jest.fn())
jest.mock('@/hooks/useSearchParam', () => jest.fn())

jest.mock('@/config/site', () => ({
  siteHostname: 'chatbotkit.com',
  siteUrl: 'https://chatbotkit.com',
}))

import useHostname from '@/hooks/useHostname'
import usePartner from '@/hooks/usePartner'
import useSearchParam from '@/hooks/useSearchParam'
import useBuilderExperience, {
  EXPERIENCE_SEARCH_PARAM,
} from '@/hooks/useBuilderExperience'
import usePlatformExperience from '@/hooks/usePlatformExperience'

import { renderHook } from '@testing-library/react'

// @note which hosts serve the builder experience is deployment data - the
// suite pins the hosted-style fixture it was written against
beforeAll(() => {
  process.env.EXPERIENCE_BUILDER_HOSTS = 'chatbotkit.com,*.chatbotkit.com'
})

afterAll(() => {
  delete process.env.EXPERIENCE_BUILDER_HOSTS
})

describe('useBuilderExperience', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    usePartner.mockReturnValue(null)
    useSearchParam.mockReturnValue(undefined)
  })

  it('reports the builder experience on chatbotkit.com', () => {
    useHostname.mockReturnValue('chatbotkit.com')

    const { result } = renderHook(() => useBuilderExperience())

    expect(result.current).toBe(true)
  })

  it('reports the platform experience on other hosts', () => {
    useHostname.mockReturnValue('platform.example.com')

    const { result } = renderHook(() => useBuilderExperience())

    expect(result.current).toBe(false)
  })

  it('forces the platform experience on builder hosts', () => {
    useHostname.mockReturnValue('chatbotkit.com')
    useSearchParam.mockReturnValue('platform')

    const { result } = renderHook(() => useBuilderExperience())

    expect(result.current).toBe(false)
    expect(useSearchParam).toHaveBeenCalledWith(EXPERIENCE_SEARCH_PARAM)
  })

  it('forces the builder experience on platform hosts', () => {
    useHostname.mockReturnValue('platform.example.com')
    useSearchParam.mockReturnValue('builder')

    const { result } = renderHook(() => useBuilderExperience())

    expect(result.current).toBe(true)
  })

  it('falls back to the hostname on unknown values', () => {
    useHostname.mockReturnValue('chatbotkit.com')
    useSearchParam.mockReturnValue('bogus')

    const { result } = renderHook(() => useBuilderExperience())

    expect(result.current).toBe(true)
  })

  it('serves the builder experience to a partner that pins it', () => {
    useHostname.mockReturnValue('backend.acme.dev')
    usePartner.mockReturnValue({ name: 'AgenticOS', experience: 'builder' })

    const { result } = renderHook(() => useBuilderExperience())

    expect(result.current).toBe(true)
  })

  it('keeps the platform experience for a partner that pins nothing', () => {
    useHostname.mockReturnValue('backend.acme.dev')
    usePartner.mockReturnValue({ name: 'AgenticOS', whitelabel: true })

    const { result } = renderHook(() => useBuilderExperience())

    expect(result.current).toBe(false)
  })

  it('lets a partner pin the platform experience on a builder host', () => {
    useHostname.mockReturnValue('acme.chatbotkit.com')
    usePartner.mockReturnValue({ name: 'Acme', experience: 'platform' })

    const { result } = renderHook(() => useBuilderExperience())

    expect(result.current).toBe(false)
  })

  it('lets the forced experience override the partner', () => {
    useHostname.mockReturnValue('backend.acme.dev')
    usePartner.mockReturnValue({ name: 'AgenticOS', experience: 'builder' })
    useSearchParam.mockReturnValue('platform')

    const { result } = renderHook(() => useBuilderExperience())

    expect(result.current).toBe(false)
  })
})

describe('usePlatformExperience', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    useSearchParam.mockReturnValue(undefined)
  })

  it('stays the exact complement under a forced experience', () => {
    useHostname.mockReturnValue('platform.example.com')
    useSearchParam.mockReturnValue('builder')

    const { result } = renderHook(() => usePlatformExperience())

    expect(result.current).toBe(false)
  })
})
