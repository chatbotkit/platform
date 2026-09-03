import FancyLink from './FancyLink'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    pathname: '/',
    query: {},
  })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  usePathname: jest.fn(() => '/'),
}))

jest.mock('@/components/Link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

jest.mock('@/components/DynamicIcon', () => ({
  __esModule: true,
  default: ({ icon, className }) => (
    <span data-testid="dynamic-icon" data-icon={icon} className={className} />
  ),
}))

describe('FancyLink', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render link with href', () => {
      render(<FancyLink href="/test">Test Link</FancyLink>)

      const link = screen.getByRole('link')

      expect(link).toHaveAttribute('href', '/test')
      expect(link).toHaveTextContent('Test Link')
    })

    it('should render with children', () => {
      render(
        <FancyLink href="/path">
          <span>Child content</span>
        </FancyLink>
      )

      expect(screen.getByText('Child content')).toBeInTheDocument()
    })

    it('should pass through additional props', () => {
      render(
        <FancyLink href="/test" data-testid="custom-link" title="Test Title">
          Link
        </FancyLink>
      )

      const link = screen.getByTestId('custom-link')

      expect(link).toHaveAttribute('title', 'Test Title')
    })
  })

  describe('external link detection', () => {
    it('should detect http URLs as external', () => {
      render(<FancyLink href="http://example.com">External</FancyLink>)

      const icon = screen.getByTestId('dynamic-icon')

      expect(icon).toHaveAttribute('data-icon', '@favicon/http://example.com')
    })

    it('should detect https URLs as external', () => {
      render(<FancyLink href="https://example.com">External</FancyLink>)

      const icon = screen.getByTestId('dynamic-icon')

      expect(icon).toHaveAttribute('data-icon', '@favicon/https://example.com')
    })

    it('should not show icon for internal links without icon prop', () => {
      render(<FancyLink href="/internal">Internal</FancyLink>)

      expect(screen.queryByTestId('dynamic-icon')).not.toBeInTheDocument()
    })

    it('should show custom icon when provided', () => {
      render(
        <FancyLink href="/internal" icon="@lucide/star">
          With Icon
        </FancyLink>
      )

      const icon = screen.getByTestId('dynamic-icon')

      expect(icon).toHaveAttribute('data-icon', '@lucide/star')
    })
  })

  describe('text content processing', () => {
    it('should strip https:// from text content', () => {
      render(
        <FancyLink href="https://example.com">https://example.com</FancyLink>
      )

      expect(screen.getByRole('link')).toHaveTextContent('example.com')
    })

    it('should strip http:// from text content', () => {
      render(
        <FancyLink href="http://example.com">http://example.com</FancyLink>
      )

      expect(screen.getByRole('link')).toHaveTextContent('example.com')
    })

    it('should strip www. from text content', () => {
      render(
        <FancyLink href="https://www.example.com">
          https://www.example.com
        </FancyLink>
      )

      expect(screen.getByRole('link')).toHaveTextContent('example.com')
    })

    it('should strip trailing slashes from text content', () => {
      render(
        <FancyLink href="https://example.com/">https://example.com/</FancyLink>
      )

      expect(screen.getByRole('link')).toHaveTextContent('example.com')
    })

    it('should not process non-text children', () => {
      render(
        <FancyLink href="https://example.com">
          <span>Custom content</span>
        </FancyLink>
      )

      expect(screen.getByText('Custom content')).toBeInTheDocument()
    })

    it('should handle multiple text children', () => {
      render(
        <FancyLink href="https://example.com">
          {'https://'}
          {'example.com/'}
        </FancyLink>
      )

      expect(screen.getByRole('link')).toHaveTextContent('example.com')
    })
  })

  describe('styling', () => {
    it('should apply base classes', () => {
      render(<FancyLink href="/test">Link</FancyLink>)

      const link = screen.getByRole('link')

      expect(link).toHaveClass('group')
      expect(link).toHaveClass('inline-flex')
      expect(link).toHaveClass('rounded-full')
    })

    it('should merge custom className', () => {
      render(
        <FancyLink href="/test" className="custom-class">
          Link
        </FancyLink>
      )

      const link = screen.getByRole('link')

      expect(link).toHaveClass('group')
      expect(link).toHaveClass('custom-class')
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
      expect(FancyLink.isExternal('/internal')).toBe(false)
    })

    it('should return falsy for empty string', () => {
      expect(FancyLink.isExternal('')).toBeFalsy()
    })

    it('should return falsy for null', () => {
      expect(FancyLink.isExternal(null)).toBeFalsy()
    })

    it('should return falsy for undefined', () => {
      expect(FancyLink.isExternal(undefined)).toBeFalsy()
    })
  })
})
