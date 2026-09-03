import Spinner from './Spinner'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

describe('Spinner', () => {
  describe('basic functionality', () => {
    it('should render an SVG element', () => {
      const { container } = render(<Spinner />)
      const svg = container.querySelector('svg')

      expect(svg).toBeInTheDocument()
      expect(svg?.tagName).toBe('svg')
    })

    it('should have correct viewBox dimensions', () => {
      const { container } = render(<Spinner />)
      const svg = container.querySelector('svg')

      expect(svg).toHaveAttribute('viewBox', '0 0 20 20')
    })

    it('should have no fill by default', () => {
      const { container } = render(<Spinner />)
      const svg = container.querySelector('svg')

      expect(svg).toHaveAttribute('fill', 'none')
    })
  })

  describe('styling', () => {
    it('should apply animate-spin class', () => {
      const { container } = render(<Spinner />)
      const svg = container.querySelector('svg')

      expect(svg).toHaveClass('animate-spin')
    })

    it('should apply custom className', () => {
      const { container } = render(<Spinner className="custom-spinner" />)
      const svg = container.querySelector('svg')

      expect(svg).toHaveClass('animate-spin')
      expect(svg).toHaveClass('custom-spinner')
    })

    it('should apply multiple custom classes', () => {
      const { container } = render(
        <Spinner className="custom-spinner size-6 text-blue-500" />
      )
      const svg = container.querySelector('svg')

      expect(svg).toHaveClass('animate-spin')
      expect(svg).toHaveClass('custom-spinner')
      expect(svg).toHaveClass('size-6')
      expect(svg).toHaveClass('text-blue-500')
    })
  })

  describe('SVG structure', () => {
    it('should contain circle element', () => {
      const { container } = render(<Spinner />)
      const circle = container.querySelector('circle')

      expect(circle).toBeInTheDocument()
    })

    it('should contain path element', () => {
      const { container } = render(<Spinner />)
      const path = container.querySelector('path')

      expect(path).toBeInTheDocument()
    })

    it('should have correct circle attributes', () => {
      const { container } = render(<Spinner />)
      const circle = container.querySelector('circle')

      expect(circle).toHaveAttribute('cx', '10')
      expect(circle).toHaveAttribute('cy', '10')
      expect(circle).toHaveAttribute('r', '8')
      expect(circle).toHaveAttribute('stroke', 'currentColor')
      expect(circle).toHaveAttribute('stroke-width', '2')
      expect(circle).toHaveAttribute('opacity', '0.2')
    })

    it('should have correct path attributes', () => {
      const { container } = render(<Spinner />)
      const path = container.querySelector('path')

      expect(path).toHaveAttribute('d', 'M10 2a8 8 0 0 1 8 8')
      expect(path).toHaveAttribute('stroke', 'currentColor')
      expect(path).toHaveAttribute('stroke-width', '2')
    })
  })

  describe('props forwarding', () => {
    it('should forward additional props', () => {
      const { container } = render(
        <Spinner data-testid="spinner-test" aria-label="Loading" />
      )
      const svg = container.querySelector('svg')

      expect(svg).toHaveAttribute('data-testid', 'spinner-test')
      expect(svg).toHaveAttribute('aria-label', 'Loading')
    })

    it('should handle role prop', () => {
      const { container } = render(<Spinner role="status" />)
      const svg = container.querySelector('svg')

      expect(svg).toHaveAttribute('role', 'status')
    })

    it('should handle aria-hidden prop', () => {
      const { container } = render(<Spinner aria-hidden="true" />)
      const svg = container.querySelector('svg')

      expect(svg).toHaveAttribute('aria-hidden', 'true')
    })
  })

  describe('edge cases', () => {
    it('should render without any props', () => {
      const { container } = render(<Spinner />)

      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('should handle empty className', () => {
      const { container } = render(<Spinner className="" />)
      const svg = container.querySelector('svg')

      expect(svg).toHaveClass('animate-spin')
    })

    it('should handle undefined className', () => {
      const { container } = render(<Spinner className={undefined} />)
      const svg = container.querySelector('svg')

      expect(svg).toHaveClass('animate-spin')
    })
  })
})
