import NavHeader from './NavHeader'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock(
  './Link',
  () =>
    function Link({ href, className, children }) {
      return (
        <a href={href} className={className}>
          {children}
        </a>
      )
    }
)

describe('NavHeader', () => {
  describe('basic functionality', () => {
    it('should render title', () => {
      render(<NavHeader link="/home" caption="Home" title="Test Title" />)
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
        'Test Title'
      )
    })

    it('should render back link with caption', () => {
      render(<NavHeader link="/docs" caption="Documentation" title="Test" />)

      const link = screen.getByRole('link')

      expect(link).toHaveAttribute('href', '/docs')
      expect(link.textContent).toContain('back to Documentation')
    })

    it('should render without beta tag by default', () => {
      render(<NavHeader link="/home" caption="Home" title="Test Title" />)
      expect(screen.queryByText('BETA')).toBeNull()
    })
  })

  describe('beta tag', () => {
    it('should render BETA tag when beta is true', () => {
      render(<NavHeader link="/home" caption="Home" title="Test" beta={true} />)
      expect(screen.getByText('BETA')).toBeTruthy()
    })

    it('should render custom beta text when beta is string', () => {
      render(
        <NavHeader link="/home" caption="Home" title="Test" beta="ALPHA" />
      )
      expect(screen.getByText('ALPHA')).toBeTruthy()
    })

    it('should not render beta tag when beta is false', () => {
      render(
        <NavHeader link="/home" caption="Home" title="Test" beta={false} />
      )
      expect(screen.queryByText('BETA')).toBeNull()
    })

    it('should not render beta tag when beta is undefined', () => {
      render(<NavHeader link="/home" caption="Home" title="Test" />)
      expect(screen.queryByText('BETA')).toBeNull()
    })

    it('should render beta tag in sup element', () => {
      const { container } = render(
        <NavHeader link="/home" caption="Home" title="Test" beta={true} />
      )
      const sup = container.querySelector('sup.beta')

      expect(sup).not.toBeNull()
      expect(sup.textContent).toBe('BETA')
    })
  })

  describe('link properties', () => {
    it('should use correct link href', () => {
      render(<NavHeader link="/custom/path" caption="Custom" title="Test" />)

      const link = screen.getByRole('link')

      expect(link).toHaveAttribute('href', '/custom/path')
    })

    it('should handle root path', () => {
      render(<NavHeader link="/" caption="Home" title="Test" />)

      const link = screen.getByRole('link')

      expect(link).toHaveAttribute('href', '/')
    })

    it('should handle nested paths', () => {
      render(<NavHeader link="/docs/api/v1" caption="API" title="Test" />)

      const link = screen.getByRole('link')

      expect(link).toHaveAttribute('href', '/docs/api/v1')
    })

    it('should render left arrow in link', () => {
      const { container } = render(
        <NavHeader link="/home" caption="Home" title="Test" />
      )
      const arrow = container.querySelector('.absolute')

      expect(arrow.textContent).toBe('←')
    })
  })

  describe('layout and styling', () => {
    it('should apply correct container classes', () => {
      const { container } = render(
        <NavHeader link="/home" caption="Home" title="Test" />
      )
      const wrapper = container.querySelector('.content-prose.space-y-4')

      expect(wrapper).not.toBeNull()
    })

    it('should apply correct heading classes', () => {
      const { container } = render(
        <NavHeader link="/home" caption="Home" title="Test" />
      )
      const heading = container.querySelector('h1')

      expect(heading).toHaveClass('text-4xl', 'font-bold')
    })

    it('should apply correct link classes', () => {
      render(<NavHeader link="/home" caption="Home" title="Test" />)

      const link = screen.getByRole('link')

      expect(link).toHaveClass('print:hidden', 'text-sm', 'default-link')
    })

    it('should have transition classes on arrow', () => {
      const { container } = render(
        <NavHeader link="/home" caption="Home" title="Test" />
      )
      const arrow = container.querySelector('.absolute')

      expect(arrow).toHaveClass('group-hover:-translate-x-1', 'transition-all')
    })
  })

  describe('edge cases', () => {
    it('should handle empty caption', () => {
      render(<NavHeader link="/home" caption="" title="Test" />)

      const link = screen.getByRole('link')

      expect(link.textContent).toContain('back to')
    })

    it('should handle empty title', () => {
      render(<NavHeader link="/home" caption="Home" title="" />)

      expect(
        screen.queryByRole('heading', { level: 1 })
      ).not.toBeInTheDocument()
    })

    it('should handle special characters in title', () => {
      render(<NavHeader link="/home" caption="Home" title="Test & <Special>" />)
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
        'Test & <Special>'
      )
    })

    it('should handle special characters in caption', () => {
      render(<NavHeader link="/home" caption="Docs & Guides" title="Test" />)

      const link = screen.getByRole('link')

      expect(link.textContent).toContain('back to Docs & Guides')
    })

    it('should handle unicode in title', () => {
      render(<NavHeader link="/home" caption="Home" title="测试 Title" />)
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
        '测试 Title'
      )
    })

    it('should handle very long titles', () => {
      const longTitle = 'Very Long Title '.repeat(20)

      render(<NavHeader link="/home" caption="Home" title={longTitle} />)
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
        longTitle
      )
    })

    it('should handle numeric beta values', () => {
      render(<NavHeader link="/home" caption="Home" title="Test" beta={123} />)
      expect(screen.getByText('123')).toBeTruthy()
    })

    it('should handle empty string beta', () => {
      render(<NavHeader link="/home" caption="Home" title="Test" beta="" />)
      expect(screen.queryByText('BETA')).toBeNull()
    })
  })

  describe('children prop', () => {
    it('should not render children div when children is not provided', () => {
      const { container } = render(
        <NavHeader link="/home" caption="Home" title="Test" />
      )
      // @note based on commented code, children rendering is disabled
      const childrenDiv = container.querySelector('.print\\:hidden:not(a)')

      expect(childrenDiv).toBeNull()
    })

    it('should render children content', () => {
      render(
        <NavHeader link="/home" caption="Home" title="Test">
          <div className="test-child">Child Content</div>
        </NavHeader>
      )
      expect(screen.queryByText('Child Content')).not.toBeNull()
    })
  })

  describe('accessibility', () => {
    it('should have proper heading structure', () => {
      render(<NavHeader link="/home" caption="Home" title="Test Title" />)

      const heading = screen.getByRole('heading', { level: 1 })

      expect(heading).toBeTruthy()
    })

    it('should have accessible link', () => {
      render(<NavHeader link="/docs" caption="Documentation" title="Test" />)

      const link = screen.getByRole('link', { name: /back to Documentation/i })

      expect(link).toBeTruthy()
    })

    it('should render link with meaningful text', () => {
      render(<NavHeader link="/home" caption="Overview" title="Test" />)

      const link = screen.getByRole('link')

      expect(link.textContent).toMatch(/back to Overview/i)
    })
  })
})
