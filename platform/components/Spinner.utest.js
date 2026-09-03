import Spinner from './Spinner'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

describe('Spinner', () => {
  describe('basic functionality', () => {
    it('should render SVG element', () => {
      const { container } = render(<Spinner />)

      const svg = container.querySelector('svg')

      expect(svg).toBeInTheDocument()
    })

    it('should have animate-spin class', () => {
      const { container } = render(<Spinner />)

      const svg = container.querySelector('svg')

      expect(svg).toHaveClass('animate-spin')
    })

    it('should have correct viewBox', () => {
      const { container } = render(<Spinner />)

      const svg = container.querySelector('svg')

      expect(svg).toHaveAttribute('viewBox', '0 0 20 20')
    })

    it('should have fill="none"', () => {
      const { container } = render(<Spinner />)

      const svg = container.querySelector('svg')

      expect(svg).toHaveAttribute('fill', 'none')
    })

    it('should render circle element', () => {
      const { container } = render(<Spinner />)

      const circle = container.querySelector('circle')

      expect(circle).toBeInTheDocument()
      expect(circle).toHaveAttribute('cx', '10')
      expect(circle).toHaveAttribute('cy', '10')
      expect(circle).toHaveAttribute('r', '8')
    })

    it('should render path element', () => {
      const { container } = render(<Spinner />)

      const path = container.querySelector('path')

      expect(path).toBeInTheDocument()
      expect(path).toHaveAttribute('d', 'M10 2a8 8 0 0 1 8 8')
    })
  })

  describe('className handling', () => {
    it('should accept custom className', () => {
      const { container } = render(<Spinner className="custom-class" />)

      const svg = container.querySelector('svg')

      expect(svg).toHaveClass('custom-class')
      expect(svg).toHaveClass('animate-spin')
    })

    it('should merge multiple classNames', () => {
      const { container } = render(<Spinner className="class-1 class-2" />)

      const svg = container.querySelector('svg')

      expect(svg).toHaveClass('class-1')
      expect(svg).toHaveClass('class-2')
      expect(svg).toHaveClass('animate-spin')
    })

    it('should work without custom className', () => {
      const { container } = render(<Spinner />)

      const svg = container.querySelector('svg')

      expect(svg).toHaveClass('animate-spin')
    })
  })

  describe('props spreading', () => {
    it('should accept aria-label', () => {
      const { container } = render(<Spinner aria-label="Loading..." />)

      const svg = container.querySelector('svg')

      expect(svg).toHaveAttribute('aria-label', 'Loading...')
    })

    it('should accept data attributes', () => {
      const { container } = render(<Spinner data-testid="spinner-test" />)

      const svg = container.querySelector('svg')

      expect(svg).toHaveAttribute('data-testid', 'spinner-test')
    })

    it('should accept width and height', () => {
      const { container } = render(<Spinner width="32" height="32" />)

      const svg = container.querySelector('svg')

      expect(svg).toHaveAttribute('width', '32')
      expect(svg).toHaveAttribute('height', '32')
    })

    it('should accept role attribute', () => {
      const { container } = render(<Spinner role="status" />)

      const svg = container.querySelector('svg')

      expect(svg).toHaveAttribute('role', 'status')
    })

    it('should accept style prop', () => {
      const { container } = render(<Spinner style={{ color: 'red' }} />)

      const svg = container.querySelector('svg')

      expect(svg).toHaveStyle({ color: 'red' })
    })
  })

  describe('edge cases', () => {
    it('should handle undefined className', () => {
      const { container } = render(<Spinner className={undefined} />)

      const svg = container.querySelector('svg')

      expect(svg).toHaveClass('animate-spin')
    })

    it('should handle null className', () => {
      const { container } = render(<Spinner className={null} />)

      const svg = container.querySelector('svg')

      expect(svg).toHaveClass('animate-spin')
    })

    it('should handle empty className', () => {
      const { container } = render(<Spinner className="" />)

      const svg = container.querySelector('svg')

      expect(svg).toHaveClass('animate-spin')
    })

    it('should handle multiple renders', () => {
      const { rerender, container } = render(<Spinner className="class-1" />)

      let svg = container.querySelector('svg')

      expect(svg).toHaveClass('class-1')

      rerender(<Spinner className="class-2" />)

      svg = container.querySelector('svg')
      expect(svg).toHaveClass('class-2')
      expect(svg).not.toHaveClass('class-1')
    })
  })
})
