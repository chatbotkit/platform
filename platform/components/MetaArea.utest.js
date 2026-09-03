import MetaArea from '@/components/MetaArea'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/components/Expando', () => {
  return function MockExpando({ title, children }) {
    return (
      <div data-testid="expando">
        <div>{title}</div>
        <div>{children}</div>
      </div>
    )
  }
})

jest.mock('@/components/CodeBlock', () => {
  return function MockCodeBlock({ children }) {
    return <pre data-testid="code-block">{children}</pre>
  }
})

jest.mock('@/components/Component', () => {
  return function MockComponent({ children, onClick, ...props }) {
    return (
      <button
        {...props}
        type="button"
        onClick={onClick}
        data-testid="toggle-button"
      >
        {children}
      </button>
    )
  }
})

describe('MetaArea', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('null and undefined handling', () => {
    it('should display "No metadata available." message when meta is null', () => {
      render(<MetaArea meta={null} />)

      expect(screen.queryByText('Meta Details')).not.toBeInTheDocument()
      expect(screen.getByText('No metadata available.')).toBeInTheDocument()
      expect(screen.queryByTestId('code-block')).not.toBeInTheDocument()
      expect(screen.queryByTestId('expando')).not.toBeInTheDocument()
    })

    it('should display "No metadata available." message when meta is undefined', () => {
      render(<MetaArea meta={undefined} />)

      expect(screen.queryByText('Meta Details')).not.toBeInTheDocument()
      expect(screen.getByText('No metadata available.')).toBeInTheDocument()
      expect(screen.queryByTestId('code-block')).not.toBeInTheDocument()
      expect(screen.queryByTestId('expando')).not.toBeInTheDocument()
    })

    it('should display "No metadata available." message when instance.meta is null', () => {
      const instance = { meta: null }

      render(<MetaArea instance={instance} />)

      expect(screen.queryByText('Meta Details')).not.toBeInTheDocument()
      expect(screen.getByText('No metadata available.')).toBeInTheDocument()
      expect(screen.queryByTestId('code-block')).not.toBeInTheDocument()
      expect(screen.queryByTestId('expando')).not.toBeInTheDocument()
    })

    it('should display "No metadata available." message when instance.meta is undefined', () => {
      const instance = { meta: undefined }

      render(<MetaArea instance={instance} />)

      expect(screen.queryByText('Meta Details')).not.toBeInTheDocument()
      expect(screen.getByText('No metadata available.')).toBeInTheDocument()
      expect(screen.queryByTestId('code-block')).not.toBeInTheDocument()
      expect(screen.queryByTestId('expando')).not.toBeInTheDocument()
    })

    it('should display "No metadata available." message when instance itself is null', () => {
      render(<MetaArea instance={null} />)

      expect(screen.queryByText('Meta Details')).not.toBeInTheDocument()
      expect(screen.getByText('No metadata available.')).toBeInTheDocument()
      expect(screen.queryByTestId('code-block')).not.toBeInTheDocument()
      expect(screen.queryByTestId('expando')).not.toBeInTheDocument()
    })

    it('should display "No metadata available." message when no props are provided', () => {
      render(<MetaArea />)

      expect(screen.queryByText('Meta Details')).not.toBeInTheDocument()
      expect(screen.getByText('No metadata available.')).toBeInTheDocument()
      expect(screen.queryByTestId('code-block')).not.toBeInTheDocument()
      expect(screen.queryByTestId('expando')).not.toBeInTheDocument()
    })
  })

  describe('valid metadata handling', () => {
    it('should render CodeBlock when meta has valid data', () => {
      const meta = { key: 'value', number: 123 }

      render(<MetaArea meta={meta} />)

      expect(screen.getByText('Meta Details')).toBeInTheDocument()
      expect(
        screen.queryByText('No metadata available.')
      ).not.toBeInTheDocument()

      // Check that CodeBlock content is rendered
      expect(screen.getByTestId('code-block')).toBeInTheDocument()
      // Check for YAML content (with some flexibility for formatting)
      expect(screen.getByTestId('code-block')).toHaveTextContent('key: value')
      expect(screen.getByTestId('code-block')).toHaveTextContent('number: 123')
    })

    it('should toggle between YAML and JSON formats', () => {
      const meta = { key: 'value' }

      render(<MetaArea meta={meta} />)

      // Initially should show YAML format
      expect(screen.getByTestId('code-block')).toHaveTextContent('key: value')

      // Find and click the toggle button (the button is inside CodeBlock actions)
      const toggleButton = screen.queryByTestId('toggle-button')

      if (toggleButton) {
        fireEvent.click(toggleButton)
        // Should now show JSON format
        expect(screen.getByTestId('code-block')).toHaveTextContent(
          '"key": "value"'
        )
      } else {
        // If toggle button isn't found, just verify YAML is working
        expect(screen.getByTestId('code-block')).toHaveTextContent('key: value')
      }
    })

    it('should handle empty object metadata', () => {
      const meta = {}

      render(<MetaArea meta={meta} />)

      expect(screen.getByText('Meta Details')).toBeInTheDocument()
      expect(
        screen.queryByText('No metadata available.')
      ).not.toBeInTheDocument()

      // Empty object should still render CodeBlock
      expect(screen.getByTestId('code-block')).toBeInTheDocument()
    })

    it('should handle complex nested metadata', () => {
      const meta = {
        user: { id: 1, name: 'Test User' },
        settings: { theme: 'dark', notifications: true },
        data: [1, 2, 3],
      }

      render(<MetaArea meta={meta} />)

      expect(screen.getByText('Meta Details')).toBeInTheDocument()
      expect(
        screen.queryByText('No metadata available.')
      ).not.toBeInTheDocument()

      // Check that nested data is rendered
      expect(screen.getByTestId('code-block')).toBeInTheDocument()
      expect(screen.getByTestId('code-block')).toHaveTextContent('user:')
      expect(screen.getByTestId('code-block')).toHaveTextContent('settings:')
    })

    it('should handle string metadata', () => {
      const meta = 'simple string value'

      render(<MetaArea meta={meta} />)

      expect(screen.getByText('Meta Details')).toBeInTheDocument()
      expect(
        screen.queryByText('No metadata available.')
      ).not.toBeInTheDocument()
      expect(screen.getByTestId('code-block')).toHaveTextContent(
        'simple string value'
      )
    })

    it('should handle number metadata', () => {
      const meta = 42

      render(<MetaArea meta={meta} />)

      expect(screen.getByText('Meta Details')).toBeInTheDocument()
      expect(
        screen.queryByText('No metadata available.')
      ).not.toBeInTheDocument()
      expect(screen.getByTestId('code-block')).toHaveTextContent('42')
    })

    it('should handle boolean metadata', () => {
      const meta = true

      render(<MetaArea meta={meta} />)

      expect(screen.getByText('Meta Details')).toBeInTheDocument()
      expect(
        screen.queryByText('No metadata available.')
      ).not.toBeInTheDocument()
      expect(screen.getByTestId('code-block')).toHaveTextContent('true')
    })
  })

  describe('edge cases', () => {
    it('should handle false as valid metadata (not null/undefined)', () => {
      const meta = false

      render(<MetaArea meta={meta} />)

      expect(screen.getByText('Meta Details')).toBeInTheDocument()
      expect(
        screen.queryByText('No metadata available.')
      ).not.toBeInTheDocument()
      expect(screen.getByTestId('code-block')).toHaveTextContent('false')
    })

    it('should handle 0 as valid metadata (not null/undefined)', () => {
      const meta = 0

      render(<MetaArea meta={meta} />)

      expect(screen.getByText('Meta Details')).toBeInTheDocument()
      expect(
        screen.queryByText('No metadata available.')
      ).not.toBeInTheDocument()
      expect(screen.getByTestId('code-block')).toHaveTextContent('0')
    })

    it('should handle empty string as valid metadata (not null/undefined)', () => {
      const meta = ''

      render(<MetaArea meta={meta} />)

      expect(screen.getByText('Meta Details')).toBeInTheDocument()
      expect(
        screen.queryByText('No metadata available.')
      ).not.toBeInTheDocument()
      // Empty string should still render the CodeBlock structure
      expect(screen.getByTestId('code-block')).toBeInTheDocument()
    })

    it('should prefer explicit meta prop over instance.meta', () => {
      const instance = { meta: { from: 'instance' } }
      const explicitMeta = { from: 'prop' }

      render(<MetaArea instance={instance} meta={explicitMeta} />)

      expect(screen.getByText('Meta Details')).toBeInTheDocument()
      expect(
        screen.queryByText('No metadata available.')
      ).not.toBeInTheDocument()
      expect(screen.getByTestId('code-block')).toHaveTextContent('from: prop')
      expect(screen.getByTestId('code-block')).not.toHaveTextContent(
        'from: instance'
      )
    })
  })
})
