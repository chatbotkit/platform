import Ping from './Ping'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

describe('Ping', () => {
  describe('basic functionality', () => {
    it('should render without crashing', () => {
      const { container } = render(<Ping />)

      expect(container).toBeInTheDocument()
    })

    it('should render two span elements for animation', () => {
      const { container } = render(<Ping />)
      const spans = container.querySelectorAll('span')

      // @note outer span + two animation spans = 3 total
      expect(spans.length).toBeGreaterThanOrEqual(3)
    })

    it('should have animate-ping class on animation element', () => {
      const { container } = render(<Ping />)
      const animatingSpan = container.querySelector('.animate-ping')

      expect(animatingSpan).toBeInTheDocument()
      expect(animatingSpan).toHaveClass('animate-ping')
    })

    it('should have proper flex and size classes', () => {
      const { container } = render(<Ping />)
      const flexContainer = container.querySelector('.flex')

      expect(flexContainer).toBeInTheDocument()
      expect(flexContainer).toHaveClass('relative', 'flex', 'h-3', 'w-3')
    })
  })

  describe('props forwarding', () => {
    it('should forward className prop', () => {
      const { container } = render(<Ping className="custom-class" />)
      const outerSpan = container.firstChild

      expect(outerSpan).toHaveClass('custom-class')
    })

    it('should forward data attributes', () => {
      const { container } = render(<Ping data-testid="ping-component" />)
      const outerSpan = container.firstChild

      expect(outerSpan).toHaveAttribute('data-testid', 'ping-component')
    })

    it('should forward multiple props', () => {
      const { container } = render(
        <Ping className="test" id="ping-id" aria-label="Loading" />
      )
      const outerSpan = container.firstChild

      expect(outerSpan).toHaveClass('test')
      expect(outerSpan).toHaveAttribute('id', 'ping-id')
      expect(outerSpan).toHaveAttribute('aria-label', 'Loading')
    })
  })

  describe('styling', () => {
    it('should apply indigo color classes to animation elements', () => {
      const { container } = render(<Ping />)
      const animatingSpan = container.querySelector('.bg-indigo-600')
      const solidSpan = container.querySelector('.bg-indigo-500')

      expect(animatingSpan).toBeInTheDocument()
      expect(solidSpan).toBeInTheDocument()
    })

    it('should have rounded-full class on both circles', () => {
      const { container } = render(<Ping />)
      const roundedElements = container.querySelectorAll('.rounded-full')

      expect(roundedElements.length).toBeGreaterThanOrEqual(2)
    })

    it('should have opacity on animating element', () => {
      const { container } = render(<Ping />)
      const animatingSpan = container.querySelector('.animate-ping')

      expect(animatingSpan).toHaveClass('opacity-75')
    })

    it('should position elements correctly', () => {
      const { container } = render(<Ping />)
      const absoluteSpan = container.querySelector('.absolute')
      const relativeSpans = container.querySelectorAll('.relative')

      expect(absoluteSpan).toBeInTheDocument()
      expect(relativeSpans.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('edge cases', () => {
    it('should handle null props', () => {
      expect(() => {
        render(<Ping className={null} />)
      }).not.toThrow()
    })

    it('should handle undefined props', () => {
      expect(() => {
        render(<Ping className={undefined} />)
      }).not.toThrow()
    })

    it('should handle empty string className', () => {
      const { container } = render(<Ping className="" />)

      expect(container.firstChild).toBeInTheDocument()
    })
  })
})
