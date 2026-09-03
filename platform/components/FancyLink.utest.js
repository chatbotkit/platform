import FancyLink from './FancyLink'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/DynamicIcon', () => {
  return function MockDynamicIcon({ icon, className }) {
    return (
      <span data-testid="dynamic-icon" data-icon={icon} className={className} />
    )
  }
})

jest.mock('@/components/Link', () => {
  return function MockLink({ children, href, className, ...props }) {
    return (
      <a href={href} className={className} {...props}>
        {children}
      </a>
    )
  }
})

describe('FancyLink', () => {
  describe('basic rendering', () => {
    it('should render link with text content', () => {
      render(<FancyLink href="https://example.com">Example Link</FancyLink>)

      const link = screen.getByRole('link')

      expect(link).toHaveAttribute('href', 'https://example.com')
      expect(link).toHaveTextContent('Example Link')
    })

    it('should render link with custom icon', () => {
      render(
        <FancyLink href="/test" icon="test-icon">
          Test
        </FancyLink>
      )

      const icon = screen.getByTestId('dynamic-icon')

      expect(icon).toHaveAttribute('data-icon', 'test-icon')
    })

    it('should pass through additional props', () => {
      render(
        <FancyLink href="/test" data-custom="value">
          Test
        </FancyLink>
      )

      const link = screen.getByRole('link')

      expect(link).toHaveAttribute('data-custom', 'value')
    })

    it('should apply custom className', () => {
      render(
        <FancyLink href="/test" className="custom-class">
          Test
        </FancyLink>
      )

      const link = screen.getByRole('link')

      expect(link.className).toContain('custom-class')
    })
  })

  describe('isExternal detection', () => {
    it('should detect http URLs as external', () => {
      render(<FancyLink href="http://example.com">Example</FancyLink>)

      const icon = screen.getByTestId('dynamic-icon')

      expect(icon).toHaveAttribute('data-icon', '@favicon/http://example.com')
    })

    it('should detect https URLs as external', () => {
      render(<FancyLink href="https://example.com">Example</FancyLink>)

      const icon = screen.getByTestId('dynamic-icon')

      expect(icon).toHaveAttribute('data-icon', '@favicon/https://example.com')
    })

    it('should not show icon for internal links without custom icon', () => {
      render(<FancyLink href="/internal">Internal</FancyLink>)

      const icon = screen.queryByTestId('dynamic-icon')

      expect(icon).not.toBeInTheDocument()
    })

    it('should show custom icon for internal links', () => {
      render(
        <FancyLink href="/internal" icon="custom-icon">
          Internal
        </FancyLink>
      )

      const icon = screen.getByTestId('dynamic-icon')

      expect(icon).toHaveAttribute('data-icon', 'custom-icon')
    })
  })

  describe('text content processing', () => {
    it('should remove https:// prefix from text', () => {
      render(
        <FancyLink href="https://example.com">https://example.com</FancyLink>
      )

      expect(screen.getByText('example.com')).toBeInTheDocument()
    })

    it('should remove http:// prefix from text', () => {
      render(
        <FancyLink href="http://example.com">http://example.com</FancyLink>
      )

      expect(screen.getByText('example.com')).toBeInTheDocument()
    })

    it('should remove www. prefix from text', () => {
      render(
        <FancyLink href="https://www.example.com">
          https://www.example.com
        </FancyLink>
      )

      expect(screen.getByText('example.com')).toBeInTheDocument()
    })

    it('should remove trailing slashes from text', () => {
      render(
        <FancyLink href="https://example.com/">https://example.com//</FancyLink>
      )

      expect(screen.getByText('example.com')).toBeInTheDocument()
    })

    it('should not process non-text children', () => {
      render(
        <FancyLink href="/test">
          <span>Custom Element</span>
        </FancyLink>
      )

      expect(screen.getByText('Custom Element')).toBeInTheDocument()
    })

    it('should handle mixed text and element children', () => {
      render(
        <FancyLink href="/test">
          Text <span>Element</span>
        </FancyLink>
      )

      expect(screen.getByText('Element')).toBeInTheDocument()
    })

    it('should concatenate multiple text children', () => {
      render(
        <FancyLink href="https://example.com">https:// example.com</FancyLink>
      )

      expect(screen.getByText('example.com')).toBeInTheDocument()
    })
  })

  describe('FancyLink.isExternal static method', () => {
    it('should return true for http URLs', () => {
      expect(FancyLink.isExternal('http://example.com')).toBe(true)
    })

    it('should return true for https URLs', () => {
      expect(FancyLink.isExternal('https://example.com')).toBe(true)
    })

    it('should return false for relative URLs', () => {
      expect(FancyLink.isExternal('/relative/path')).toBeFalsy()
    })

    it('should return false for anchor links', () => {
      expect(FancyLink.isExternal('#anchor')).toBeFalsy()
    })

    it('should return false for null', () => {
      expect(FancyLink.isExternal(null)).toBeFalsy()
    })

    it('should return false for undefined', () => {
      expect(FancyLink.isExternal(undefined)).toBeFalsy()
    })

    it('should return false for empty string', () => {
      expect(FancyLink.isExternal('')).toBeFalsy()
    })
  })

  describe('edge cases', () => {
    it('should handle empty children', () => {
      render(<FancyLink href="/test"></FancyLink>)

      const link = screen.getByRole('link')

      expect(link).toBeInTheDocument()
    })

    it('should handle URL with path and query', () => {
      render(
        <FancyLink href="https://example.com/path?query=value">
          https://example.com/path?query=value
        </FancyLink>
      )

      expect(
        screen.getByText('example.com/path?query=value')
      ).toBeInTheDocument()
    })

    it('should handle URLs with subdomain', () => {
      render(
        <FancyLink href="https://sub.example.com">
          https://sub.example.com
        </FancyLink>
      )

      expect(screen.getByText('sub.example.com')).toBeInTheDocument()
    })

    it('should handle single slash', () => {
      render(
        <FancyLink href="https://example.com/">https://example.com/</FancyLink>
      )

      expect(screen.getByText('example.com')).toBeInTheDocument()
    })
  })
})
