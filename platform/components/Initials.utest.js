import Initials from './Initials'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

describe('Initials', () => {
  describe('rendering', () => {
    it('should render initials text', () => {
      const { container } = render(<Initials initials="AB" />)

      const text = container.querySelector('text')

      expect(text).toBeInTheDocument()
      expect(text).toHaveTextContent('AB')
    })

    it('should render with default viewBox', () => {
      const { container } = render(<Initials initials="CD" />)

      const svg = container.querySelector('svg')

      expect(svg).toHaveAttribute('viewBox', '0 0 100 100')
    })

    it('should render with correct text positioning', () => {
      const { container } = render(<Initials initials="EF" />)

      const text = container.querySelector('text')

      expect(text).toHaveAttribute('x', '52%')
      expect(text).toHaveAttribute('y', '52%')
      expect(text).toHaveAttribute('dominant-baseline', 'middle')
      expect(text).toHaveAttribute('text-anchor', 'middle')
    })

    it('should apply custom props to svg element', () => {
      const { container } = render(
        <Initials initials="GH" className="custom-class" data-testid="test" />
      )

      const svg = container.querySelector('svg')

      expect(svg).toHaveClass('custom-class')
      expect(svg).toHaveAttribute('data-testid', 'test')
    })

    it('should handle empty initials', () => {
      const { container } = render(<Initials initials="" />)

      const text = container.querySelector('text')

      expect(text).toBeInTheDocument()
      expect(text).toHaveTextContent('')
    })

    it('should handle single character initials', () => {
      const { container } = render(<Initials initials="A" />)

      const text = container.querySelector('text')

      expect(text).toHaveTextContent('A')
    })

    it('should handle multi-character initials', () => {
      const { container } = render(<Initials initials="ABC" />)

      const text = container.querySelector('text')

      expect(text).toHaveTextContent('ABC')
    })

    it('should have correct text styling', () => {
      const { container } = render(<Initials initials="IJ" />)

      const text = container.querySelector('text')

      expect(text).toHaveAttribute('fill', 'currentColor')
      expect(text).toHaveAttribute('font-family', 'inherit')
      expect(text).toHaveAttribute('font-size', '40')
      expect(text).toHaveStyle({ userSelect: 'none' })
    })
  })

  describe('edge cases', () => {
    it('should handle null initials', () => {
      const { container } = render(<Initials initials={null} />)

      const text = container.querySelector('text')

      expect(text).toBeInTheDocument()
    })

    it('should handle undefined initials', () => {
      const { container } = render(<Initials initials={undefined} />)

      const text = container.querySelector('text')

      expect(text).toBeInTheDocument()
    })
  })
})
