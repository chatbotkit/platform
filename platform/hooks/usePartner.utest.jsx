import usePartner from './usePartner'

import { renderHook } from '@testing-library/react'

const originalGetEntriesByType = performance.getEntriesByType?.bind(performance)

function setServerTimingEntries(entries) {
  performance.getEntriesByType = (type) =>
    type === 'navigation' ? [{ serverTiming: entries }] : []
}

describe('usePartner', () => {
  beforeEach(() => {
    document.documentElement.dataset.partner = '0'
    delete document.documentElement.dataset.partnerName
    delete document.documentElement.dataset.partnerLogo
    delete document.documentElement.dataset.partnerIcon
    delete document.documentElement.dataset.partnerWhitelabel

    setServerTimingEntries([])
  })

  afterAll(() => {
    if (originalGetEntriesByType) {
      performance.getEntriesByType = originalGetEntriesByType
    }
  })

  describe('basic functionality', () => {
    it('should return null when document partner is not set', () => {
      const { result } = renderHook(() => usePartner())

      expect(result.current).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should return null when partner marker is disabled', () => {
      const { result } = renderHook(() => usePartner())

      expect(result.current).toBeNull()
    })

    it('should return partner with undefined optional metadata fields', () => {
      document.documentElement.dataset.partner = '1'
      delete document.documentElement.dataset.partnerName

      const { result } = renderHook(() => usePartner())

      expect(result.current).toEqual({
        name: undefined,
        logo: undefined,
        icon: undefined,
        whitelabel: false,
      })
    })

    it('should default whitelabel to false when missing', () => {
      document.documentElement.dataset.partner = '1'
      document.documentElement.dataset.partnerName = 'Test Partner'

      const { result } = renderHook(() => usePartner())

      expect(result.current).toEqual({
        name: 'Test Partner',
        logo: undefined,
        icon: undefined,
        whitelabel: false,
      })
    })

    it('should fallback to document partner metadata', () => {
      document.documentElement.dataset.partner = '1'
      document.documentElement.dataset.partnerName = 'QSBX'
      document.documentElement.dataset.partnerLogo = '/partners/acme/logo.svg'
      document.documentElement.dataset.partnerIcon = '/partners/acme/icon.png'
      document.documentElement.dataset.partnerWhitelabel = '1'

      const { result } = renderHook(() => usePartner())

      expect(result.current).toEqual({
        name: 'QSBX',
        logo: '/partners/acme/logo.svg',
        icon: '/partners/acme/icon.png',
        whitelabel: true,
      })
    })
  })

  describe('server-timing fallback', () => {
    function encode(branding) {
      return Buffer.from(JSON.stringify(branding), 'utf8').toString('base64')
    }

    it('should resolve partner from Server-Timing when document dataset is not set', () => {
      setServerTimingEntries([
        {
          name: 'partner',
          description: encode({
            name: 'AgenticOS',
            logo: '/partners/acme/logo.svg',
            icon: '/partners/acme/icon.png',
            whitelabel: true,
          }),
        },
      ])

      const { result } = renderHook(() => usePartner())

      expect(result.current).toEqual({
        name: 'AgenticOS',
        logo: '/partners/acme/logo.svg',
        icon: '/partners/acme/icon.png',
        whitelabel: true,
      })
    })

    it('should return null when Server-Timing entry is missing', () => {
      setServerTimingEntries([
        { name: 'cache', description: 'hit' },
      ])

      const { result } = renderHook(() => usePartner())

      expect(result.current).toBeNull()
    })

    it('should return null when Server-Timing description is malformed', () => {
      setServerTimingEntries([
        { name: 'partner', description: 'not-base64-json' },
      ])

      const { result } = renderHook(() => usePartner())

      expect(result.current).toBeNull()
    })

    it('should prefer document dataset over Server-Timing', () => {
      document.documentElement.dataset.partner = '1'
      document.documentElement.dataset.partnerName = 'Document Partner'

      setServerTimingEntries([
        {
          name: 'partner',
          description: encode({ name: 'Timing Partner', whitelabel: false }),
        },
      ])

      const { result } = renderHook(() => usePartner())

      expect(result.current).toEqual({
        name: 'Document Partner',
        logo: undefined,
        icon: undefined,
        whitelabel: false,
      })
    })
  })

  describe('hook updates', () => {
    it('should read latest document dataset on remount', () => {
      const { result, unmount } = renderHook(() => usePartner())

      expect(result.current).toBeNull()

      unmount()

      document.documentElement.dataset.partner = '1'
      document.documentElement.dataset.partnerName = 'Updated Partner'

      const { result: updatedResult } = renderHook(() => usePartner())

      expect(updatedResult.current).toEqual({
        name: 'Updated Partner',
        logo: undefined,
        icon: undefined,
        whitelabel: false,
      })
    })
  })
})
