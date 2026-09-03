import Consent from './Consent'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock('@/components/Link', () => {
  return function MockLink({ children, ...props }) {
    return <a {...props}>{children}</a>
  }
})

let mockGtagId

jest.mock('@/components/GTag', () => ({
  get GTAG_ID() {
    return mockGtagId
  },
}))

describe('Consent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    delete window.dataLayer
    mockGtagId = 'G-TEST'
  })

  it('renders nothing when no tag is configured', async () => {
    mockGtagId = undefined

    render(<Consent />)

    await waitFor(() => {
      expect(
        screen.queryByText('We value your privacy')
      ).not.toBeInTheDocument()
    })
  })

  it('renders consent banner when no stored consent exists', async () => {
    render(<Consent />)

    expect(await screen.findByText('We value your privacy')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Analytics Only' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Accept All' })
    ).toBeInTheDocument()
  })

  it('hides banner when valid stored consent exists', async () => {
    window.localStorage.setItem(
      'chatbotkit-consent',
      JSON.stringify({
        analytics: true,
        marketing: false,
        version: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
    )

    render(<Consent />)

    await waitFor(() => {
      expect(
        screen.queryByText('We value your privacy')
      ).not.toBeInTheDocument()
    })
  })

  it('accepts all consent categories and persists choice', async () => {
    render(<Consent />)

    fireEvent.click(await screen.findByRole('button', { name: 'Accept All' }))

    await waitFor(() => {
      expect(
        screen.queryByText('We value your privacy')
      ).not.toBeInTheDocument()
    })

    const storedConsent = JSON.parse(
      window.localStorage.getItem('chatbotkit-consent')
    )

    expect(storedConsent.analytics).toBe(true)
    expect(storedConsent.marketing).toBe(true)
    expect(storedConsent.version).toBe(1)

    expect(Array.isArray(window.dataLayer)).toBe(true)
    expect(
      window.dataLayer.some(
        (entry) =>
          entry &&
          entry.event === 'chatbotkit_consent_update' &&
          entry.chatbotkit_consent_analytics === true &&
          entry.chatbotkit_consent_marketing === true
      )
    ).toBe(true)
  })
})
