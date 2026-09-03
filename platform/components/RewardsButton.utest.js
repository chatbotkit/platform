import RewardsButton, {
  DISCORD_URL,
  REWARDS_SEEN_STORAGE_KEY,
} from './RewardsButton'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// @note mock ResizeObserver for headlessui/react
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// @note mock GlobalRootPortal to render children directly
jest.mock('@/components/GlobalRoot', () => ({
  GlobalRootPortal: ({ children }) => <div>{children}</div>,
}))

// @note the popup hands the form to formToData before running an action, and
// our jsdom environment swaps in the node FormData - which, unlike the browser
// one, refuses to take a form element. The invite carries no form fields, so we
// stub the serializer out rather than the environment
jest.mock('@/lib/form', () => ({
  formToData: () => ({}),
}))

const queryDot = () => document.querySelector('.bg-blue-500')

describe('RewardsButton', () => {
  beforeEach(() => {
    window.localStorage.clear()

    window.open = jest.fn()
  })

  it('should render the gift button', () => {
    render(<RewardsButton />)

    expect(screen.getByRole('button', { name: 'Rewards' })).toBeInTheDocument()
  })

  it('should show the dot while the invite has not been opened', () => {
    render(<RewardsButton />)

    expect(queryDot()).toBeInTheDocument()
  })

  it('should not show the dot once the invite has been opened before', async () => {
    window.localStorage.setItem(REWARDS_SEEN_STORAGE_KEY, 'true')

    render(<RewardsButton />)

    await waitFor(() => {
      expect(queryDot()).not.toBeInTheDocument()
    })
  })

  it('should pitch the invite when clicked', async () => {
    render(<RewardsButton />)

    fireEvent.click(screen.getByRole('button', { name: 'Rewards' }))

    await waitFor(() => {
      expect(
        screen.getByText(/take part in our community and earn rewards/i)
      ).toBeInTheDocument()
    })

    expect(
      screen.getByRole('button', { name: 'Join Discord' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument()
  })

  it('should open discord from the popup action', async () => {
    render(<RewardsButton />)

    fireEvent.click(screen.getByRole('button', { name: 'Rewards' }))

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Join Discord' })
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Join Discord' }))

    await waitFor(() => {
      expect(window.open).toHaveBeenCalledWith(
        DISCORD_URL,
        '_blank',
        'noopener,noreferrer'
      )
    })
  })

  it('should retire the dot once the invite has been opened', async () => {
    render(<RewardsButton />)

    expect(queryDot()).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Rewards' }))

    await waitFor(() => {
      expect(queryDot()).not.toBeInTheDocument()
    })

    expect(window.localStorage.getItem(REWARDS_SEEN_STORAGE_KEY)).toEqual('true')
  })
})
