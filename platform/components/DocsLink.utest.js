import DocsLink, { getDocsHref } from './DocsLink'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/Link', () => {
  return function MockLink({ children, href, ...props }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }
})

describe('DocsLink', () => {
  describe('rendering', () => {
    it('should render a fully qualified documentation link', () => {
      render(<DocsLink slug="getting-started">Getting Started</DocsLink>)

      const link = screen.getByRole('link')

      expect(link).toHaveAttribute(
        'href',
        'https://chatbotkit.com/docs/getting-started'
      )
      expect(link).toHaveTextContent('Getting Started')
    })

    it('should link to the documentation root without a slug', () => {
      render(<DocsLink>Documentation</DocsLink>)

      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        'https://chatbotkit.com/docs'
      )
    })

    it('should open in a new tab by default', () => {
      render(<DocsLink slug="api">API</DocsLink>)

      expect(screen.getByRole('link')).toHaveAttribute('target', '_blank')
    })

    it('should apply the component and custom classes', () => {
      render(
        <DocsLink slug="overview" className="custom-class">
          Overview
        </DocsLink>
      )

      expect(screen.getByRole('link')).toHaveClass('docks-link', 'custom-class')
    })

    it('should forward additional props', () => {
      render(
        <DocsLink
          slug="guide"
          data-testid="docs-link"
          aria-label="Guide link"
          rel="noopener noreferrer"
        >
          Guide
        </DocsLink>
      )

      const link = screen.getByTestId('docs-link')

      expect(link).toHaveAttribute('aria-label', 'Guide link')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('should support a custom target', () => {
      render(
        <DocsLink slug="guide" target="_self">
          Guide
        </DocsLink>
      )

      expect(screen.getByRole('link')).toHaveAttribute('target', '_self')
    })

    it('should render without children', () => {
      render(<DocsLink slug="guide" />)

      expect(screen.getByRole('link')).toBeInTheDocument()
    })

    it('should render React elements as children', () => {
      render(
        <DocsLink slug="guide">
          <span>Formatted</span> Text
        </DocsLink>
      )

      expect(screen.getByRole('link')).toHaveTextContent('Formatted Text')
    })
  })

  describe('URL generation', () => {
    it('should generate a fully qualified root URL', () => {
      expect(getDocsHref()).toBe('https://chatbotkit.com/docs')
    })

    it('should generate nested documentation URLs', () => {
      expect(getDocsHref('api/v1/bots/create')).toBe(
        'https://chatbotkit.com/docs/api/v1/bots/create'
      )
    })

    it('should preserve a trailing slash', () => {
      expect(getDocsHref('guide/')).toBe('https://chatbotkit.com/docs/guide/')
    })

    it('should normalize a leading slash', () => {
      expect(getDocsHref('/already-prefixed')).toBe(
        'https://chatbotkit.com/docs/already-prefixed'
      )
    })

    it('should preserve query strings and fragments', () => {
      expect(getDocsHref('?mode=preview')).toBe(
        'https://chatbotkit.com/docs?mode=preview'
      )
      expect(getDocsHref('#authentication')).toBe(
        'https://chatbotkit.com/docs#authentication'
      )
    })

    it('should render an empty slug with a trailing slash', () => {
      render(<DocsLink slug="">Documentation</DocsLink>)

      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        'https://chatbotkit.com/docs/'
      )
    })

    it('should resolve a relative custom href against chatbotkit.com', () => {
      render(
        <DocsLink slug="guide" href="/docs/guide-v1">
          Guide
        </DocsLink>
      )

      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        'https://chatbotkit.com/docs/guide-v1'
      )
    })

    it('should preserve an absolute custom href', () => {
      render(
        <DocsLink slug="guide" href="https://external.com/docs/guide">
          External Guide
        </DocsLink>
      )

      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        'https://external.com/docs/guide'
      )
    })

    it('should update when a custom href changes', () => {
      const { rerender } = render(
        <DocsLink slug="guide" href="/docs/guide-v1">
          Guide V1
        </DocsLink>
      )

      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        'https://chatbotkit.com/docs/guide-v1'
      )

      rerender(
        <DocsLink slug="guide" href="/docs/guide-v2">
          Guide V2
        </DocsLink>
      )

      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        'https://chatbotkit.com/docs/guide-v2'
      )
    })
  })
})
