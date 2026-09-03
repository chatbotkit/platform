import KeyCombo from './KeyCombo'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

describe('KeyCombo', () => {
  let originalPlatform
  let originalNavigator

  beforeEach(() => {
    jest.clearAllMocks()
    // Save original values
    originalNavigator = global.navigator
    originalPlatform = global.navigator?.platform
  })

  afterEach(() => {
    // Restore original navigator
    if (originalNavigator) {
      global.navigator = originalNavigator
    }
  })

  describe('basic functionality', () => {
    it('should render without crashing', () => {
      Object.defineProperty(global.navigator, 'platform', {
        value: 'Win32',
        writable: true,
        configurable: true,
      })

      render(<KeyCombo secondKey="K" />)
      expect(screen.getByText('CTRL')).toBeInTheDocument()
    })

    it('should render second key', () => {
      Object.defineProperty(global.navigator, 'platform', {
        value: 'Win32',
        writable: true,
        configurable: true,
      })

      render(<KeyCombo secondKey="S" />)
      expect(screen.getByText('S')).toBeInTheDocument()
    })

    it('should use kbd elements for keys', () => {
      Object.defineProperty(global.navigator, 'platform', {
        value: 'Win32',
        writable: true,
        configurable: true,
      })

      const { container } = render(<KeyCombo secondKey="K" />)
      const kbdElements = container.querySelectorAll('kbd')

      expect(kbdElements).toHaveLength(2)
    })
  })

  describe('platform detection - Mac', () => {
    it('should display ⌘ for Mac platform', () => {
      Object.defineProperty(global.navigator, 'platform', {
        value: 'MacIntel',
        writable: true,
        configurable: true,
      })

      render(<KeyCombo secondKey="K" />)
      expect(screen.getByText('⌘')).toBeInTheDocument()
    })

    it('should detect MacIntel platform', () => {
      Object.defineProperty(global.navigator, 'platform', {
        value: 'MacIntel',
        writable: true,
        configurable: true,
      })

      render(<KeyCombo secondKey="V" />)
      expect(screen.getByText('⌘')).toBeInTheDocument()
      expect(screen.queryByText('CTRL')).not.toBeInTheDocument()
    })

    it('should detect MacPPC platform', () => {
      Object.defineProperty(global.navigator, 'platform', {
        value: 'MacPPC',
        writable: true,
        configurable: true,
      })

      render(<KeyCombo secondKey="C" />)
      expect(screen.getByText('⌘')).toBeInTheDocument()
    })

    it('should be case-insensitive for Mac detection', () => {
      Object.defineProperty(global.navigator, 'platform', {
        value: 'macintosh',
        writable: true,
        configurable: true,
      })

      render(<KeyCombo secondKey="X" />)
      expect(screen.getByText('⌘')).toBeInTheDocument()
    })
  })

  describe('platform detection - Windows', () => {
    it('should display CTRL for Windows platform', () => {
      Object.defineProperty(global.navigator, 'platform', {
        value: 'Win32',
        writable: true,
        configurable: true,
      })

      render(<KeyCombo secondKey="K" />)
      expect(screen.getByText('CTRL')).toBeInTheDocument()
    })

    it('should detect Win64 platform', () => {
      Object.defineProperty(global.navigator, 'platform', {
        value: 'Win64',
        writable: true,
        configurable: true,
      })

      render(<KeyCombo secondKey="P" />)
      expect(screen.getByText('CTRL')).toBeInTheDocument()
    })

    it('should detect Windows platform variant', () => {
      Object.defineProperty(global.navigator, 'platform', {
        value: 'Windows',
        writable: true,
        configurable: true,
      })

      render(<KeyCombo secondKey="N" />)
      expect(screen.getByText('CTRL')).toBeInTheDocument()
    })
  })

  describe('platform detection - Linux', () => {
    it('should display CTRL for Linux platform', () => {
      Object.defineProperty(global.navigator, 'platform', {
        value: 'Linux x86_64',
        writable: true,
        configurable: true,
      })

      render(<KeyCombo secondKey="T" />)
      expect(screen.getByText('CTRL')).toBeInTheDocument()
    })

    it('should display CTRL for Linux i686', () => {
      Object.defineProperty(global.navigator, 'platform', {
        value: 'Linux i686',
        writable: true,
        configurable: true,
      })

      render(<KeyCombo secondKey="F" />)
      expect(screen.getByText('CTRL')).toBeInTheDocument()
    })
  })

  describe('second key variations', () => {
    beforeEach(() => {
      Object.defineProperty(global.navigator, 'platform', {
        value: 'Win32',
        writable: true,
        configurable: true,
      })
    })

    it('should render single character key', () => {
      render(<KeyCombo secondKey="K" />)
      expect(screen.getByText('K')).toBeInTheDocument()
    })

    it('should render special key name', () => {
      render(<KeyCombo secondKey="Enter" />)
      expect(screen.getByText('Enter')).toBeInTheDocument()
    })

    it('should render function key', () => {
      render(<KeyCombo secondKey="F5" />)
      expect(screen.getByText('F5')).toBeInTheDocument()
    })

    it('should render arrow key', () => {
      render(<KeyCombo secondKey="↑" />)
      expect(screen.getByText('↑')).toBeInTheDocument()
    })

    it('should render number key', () => {
      render(<KeyCombo secondKey="1" />)
      expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('should render symbol key', () => {
      render(<KeyCombo secondKey="/" />)
      expect(screen.getByText('/')).toBeInTheDocument()
    })
  })

  describe('custom props', () => {
    beforeEach(() => {
      Object.defineProperty(global.navigator, 'platform', {
        value: 'Win32',
        writable: true,
        configurable: true,
      })
    })

    it('should apply custom className', () => {
      const { container } = render(
        <KeyCombo secondKey="K" className="custom-class" />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('should apply custom style', () => {
      const { container } = render(
        <KeyCombo secondKey="K" style={{ color: 'red' }} />
      )

      expect(container.firstChild).toHaveStyle({ color: 'red' })
    })

    it('should apply data attributes', () => {
      const { container } = render(
        <KeyCombo secondKey="K" data-testid="key-combo" />
      )

      expect(container.firstChild).toHaveAttribute('data-testid', 'key-combo')
    })

    it('should spread additional props to span', () => {
      const { container } = render(
        <KeyCombo secondKey="K" title="Keyboard shortcut" />
      )

      expect(container.firstChild).toHaveAttribute('title', 'Keyboard shortcut')
    })
  })

  describe('edge cases', () => {
    it('should handle undefined navigator', () => {
      const originalNavigator = global.navigator

      delete global.navigator

      render(<KeyCombo secondKey="K" />)
      expect(screen.getByText('CTRL')).toBeInTheDocument()

      global.navigator = originalNavigator
    })

    it('should handle empty secondKey', () => {
      Object.defineProperty(global.navigator, 'platform', {
        value: 'Win32',
        writable: true,
        configurable: true,
      })

      render(<KeyCombo secondKey="" />)

      const kbdElements = screen
        .getAllByRole('generic')
        .filter((el) =>
          el.tagName === 'SPAN' ? el.querySelector('kbd') : false
        )

      expect(kbdElements.length).toBeGreaterThan(0)
    })

    it('should handle unknown platform', () => {
      Object.defineProperty(global.navigator, 'platform', {
        value: 'Unknown',
        writable: true,
        configurable: true,
      })

      render(<KeyCombo secondKey="K" />)
      expect(screen.getByText('CTRL')).toBeInTheDocument()
    })
  })
})
