import usePartner from './usePartner'

import { renderHook, waitFor } from '@testing-library/react'

describe('usePartner', () => {
  const originalDataset = { ...document.documentElement.dataset }
  const originalGetEntriesByType = performance.getEntriesByType

  beforeEach(() => {
    jest.clearAllMocks()
    document.documentElement.dataset.partner = undefined
    document.documentElement.dataset.partnerName = undefined
    document.documentElement.dataset.partnerLogo = undefined
    document.documentElement.dataset.partnerIcon = undefined
    document.documentElement.dataset.partnerWhitelabel = undefined
    performance.getEntriesByType = jest.fn(() => [])
  })

  afterEach(() => {
    document.documentElement.dataset.partner = originalDataset.partner
    document.documentElement.dataset.partnerName = originalDataset.partnerName
    document.documentElement.dataset.partnerLogo = originalDataset.partnerLogo
    document.documentElement.dataset.partnerIcon = originalDataset.partnerIcon
    document.documentElement.dataset.partnerWhitelabel =
      originalDataset.partnerWhitelabel
    performance.getEntriesByType = originalGetEntriesByType
  })

  it('returns partner data from document dataset', async () => {
    document.documentElement.dataset.partner = '1'
    document.documentElement.dataset.partnerName = 'Acme'
    document.documentElement.dataset.partnerLogo = 'logo.svg'
    document.documentElement.dataset.partnerIcon = 'icon.svg'
    document.documentElement.dataset.partnerWhitelabel = '1'

    const { result } = renderHook(() => usePartner())

    await waitFor(() => {
      expect(result.current).toEqual({
        name: 'Acme',
        logo: 'logo.svg',
        icon: 'icon.svg',
        whitelabel: true,
      })
    })
  })

  it('falls back to server timing when dataset is unavailable', async () => {
    const payload = {
      name: 'Timing Partner',
      logo: 'timing-logo.svg',
      icon: 'timing-icon.svg',
      whitelabel: false,
    }

    performance.getEntriesByType = jest.fn(() => [
      {
        serverTiming: [
          {
            name: 'partner',
            description: btoa(JSON.stringify(payload)),
          },
        ],
      },
    ])

    const { result } = renderHook(() => usePartner())

    await waitFor(() => {
      expect(result.current).toEqual(payload)
    })
  })

  it('returns null when neither dataset nor valid server timing exists', async () => {
    performance.getEntriesByType = jest.fn(() => [
      {
        serverTiming: [{ name: 'partner', description: 'invalid-base64' }],
      },
    ])

    const { result } = renderHook(() => usePartner())

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })
})
