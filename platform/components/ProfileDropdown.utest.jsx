import ProfileDropdown from './ProfileDropdown'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

// @note the suite renders the real headless ui menu so the items are only
// asserted once the dropdown is open. Only the environment (session, router,
// theme, fetch) and the leaf components that reach into it are mocked.

jest.mock('@/hooks/useSession', () => {
  return function useSession() {
    return {
      name: 'Test User',
      data: { user: { id: 'test-user', name: 'Test User' } },
    }
  }
})

jest.mock('@/hooks/useRouter', () => {
  return function useRouter() {
    return { asPath: '/overview', push: jest.fn() }
  }
})

jest.mock('@/hooks/useSignout', () => {
  return function useSignout() {
    return { signout: jest.fn() }
  }
})

jest.mock('@/hooks/useTheme', () => {
  return function useTheme() {
    return { forcedTheme: null }
  }
})

jest.mock('@/hooks/useFetch', () => {
  return function useFetch() {
    return { fetch: jest.fn() }
  }
})

jest.mock('@/components/DarkModeSwitch', () => {
  return function DarkModeSwitch() {
    return <div data-testid="dark-mode-switch" />
  }
})

jest.mock(
  '@/components/Link',
  () =>
    function Link({ href, children, ...props }) {
      return (
        <a href={typeof href === 'string' ? href : href?.pathname} {...props}>
          {children}
        </a>
      )
    }
)

function openDropdown(props) {
  render(<ProfileDropdown {...props} />)

  fireEvent.click(screen.getByText('Open user menu'))
}

// @note headless ui renders each Menu.Item as a fragment, merging the menuitem
// role onto the anchor itself - so the links answer to `menuitem`, not `link`.
const queryItem = (name) => screen.queryByRole('menuitem', { name })

describe('ProfileDropdown', () => {
  describe('app links', () => {
    it('offers apps and the hub when asked', () => {
      openDropdown({ withApps: true, withHub: true })

      expect(queryItem('Apps')).toBeInTheDocument()
      expect(queryItem('Hub')).toBeInTheDocument()
    })

    it('drops the section entirely when both are gated off', () => {
      openDropdown({ withApps: false, withHub: false })

      expect(queryItem('Apps')).not.toBeInTheDocument()
      expect(queryItem('Hub')).not.toBeInTheDocument()
    })
  })
})
