import DotsLoader, { DIAMOND, DOT } from './DotsLoader'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

describe('DotsLoader', () => {
  describe('basic functionality', () => {
    it('should render three animated dots by default', () => {
      const { container } = render(<DotsLoader />)

      const dots = container.querySelectorAll('span')

      expect(dots).toHaveLength(3)

      dots.forEach((dot) => {
        expect(dot).toHaveClass('animate-pulse')
        expect(dot.textContent).toBe(DOT)
      })
    })

    it('should render with default DOT character', () => {
      const { container } = render(<DotsLoader />)

      const dots = container.querySelectorAll('span')

      dots.forEach((dot) => {
        expect(dot.textContent).toBe('●')
      })
    })

    it('should apply default classes', () => {
      const { container } = render(<DotsLoader />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveClass('inline-flex')
      expect(wrapper).toHaveClass('flex-row')
      expect(wrapper).toHaveClass('gap-2')
      expect(wrapper).toHaveClass('select-none')
    })
  })

  describe('custom dot character', () => {
    it('should render with DIAMOND character', () => {
      const { container } = render(<DotsLoader dot={DIAMOND} />)

      const dots = container.querySelectorAll('span')

      dots.forEach((dot) => {
        expect(dot.textContent).toBe('◆')
      })
    })

    it('should render with custom character', () => {
      const { container } = render(<DotsLoader dot="⚡" />)

      const dots = container.querySelectorAll('span')

      dots.forEach((dot) => {
        expect(dot.textContent).toBe('⚡')
      })
    })

    it('should render with emoji', () => {
      const { container } = render(<DotsLoader dot="🔥" />)

      const dots = container.querySelectorAll('span')

      dots.forEach((dot) => {
        expect(dot.textContent).toBe('🔥')
      })
    })

    it('should render with text character', () => {
      const { container } = render(<DotsLoader dot="." />)

      const dots = container.querySelectorAll('span')

      dots.forEach((dot) => {
        expect(dot.textContent).toBe('.')
      })
    })
  })

  describe('animation delays', () => {
    it('should apply different animation delays to each dot', () => {
      const { container } = render(<DotsLoader />)

      const dots = Array.from(container.querySelectorAll('span'))

      expect(dots[0]).toHaveClass('[animation-delay:-0.3s]')
      expect(dots[1]).toHaveClass('[animation-delay:-0.15s]')
      expect(dots[2]).not.toHaveClass('[animation-delay:-0.3s]')
      expect(dots[2]).not.toHaveClass('[animation-delay:-0.15s]')
    })

    it('should animate all dots with pulse animation', () => {
      const { container } = render(<DotsLoader />)

      const dots = container.querySelectorAll('span')

      dots.forEach((dot) => {
        expect(dot).toHaveClass('animate-pulse')
      })
    })
  })

  describe('custom className', () => {
    it('should apply custom className', () => {
      const { container } = render(<DotsLoader className="custom-class" />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveClass('custom-class')
    })

    it('should merge custom className with default classes', () => {
      const { container } = render(
        <DotsLoader className="text-red-500 text-xl" />
      )
      const wrapper = container.firstChild

      expect(wrapper).toHaveClass('text-red-500')
      expect(wrapper).toHaveClass('text-xl')
      expect(wrapper).toHaveClass('inline-flex')
      expect(wrapper).toHaveClass('flex-row')
    })
  })

  describe('additional props', () => {
    it('should forward data attributes', () => {
      const { container } = render(<DotsLoader data-testid="loader" />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveAttribute('data-testid', 'loader')
    })

    it('should forward aria attributes', () => {
      const { container } = render(
        <DotsLoader aria-label="Loading" aria-busy="true" />
      )
      const wrapper = container.firstChild

      expect(wrapper).toHaveAttribute('aria-label', 'Loading')
      expect(wrapper).toHaveAttribute('aria-busy', 'true')
    })

    it('should forward style prop', () => {
      const { container } = render(<DotsLoader style={{ fontSize: '2rem' }} />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveStyle({ fontSize: '2rem' })
    })

    it('should forward role prop', () => {
      const { container } = render(<DotsLoader role="status" />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveAttribute('role', 'status')
    })
  })

  describe('exported constants', () => {
    it('should export DOT constant', () => {
      expect(DOT).toBe('●')
    })

    it('should export DIAMOND constant', () => {
      expect(DIAMOND).toBe('◆')
    })
  })

  describe('edge cases', () => {
    it('should handle empty string as dot', () => {
      const { container } = render(<DotsLoader dot="" />)

      const dots = container.querySelectorAll('span')

      dots.forEach((dot) => {
        expect(dot.textContent).toBe('')
      })
    })

    it('should handle null className', () => {
      const { container } = render(<DotsLoader className={null} />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveClass('inline-flex')
    })

    it('should handle undefined className', () => {
      const { container } = render(<DotsLoader className={undefined} />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveClass('inline-flex')
    })

    it('should handle multiple custom classes', () => {
      const { container } = render(
        <DotsLoader className="class1 class2 class3" />
      )
      const wrapper = container.firstChild

      expect(wrapper).toHaveClass('class1')
      expect(wrapper).toHaveClass('class2')
      expect(wrapper).toHaveClass('class3')
    })
  })

  describe('accessibility', () => {
    it('should be non-selectable with select-none class', () => {
      const { container } = render(<DotsLoader />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveClass('select-none')
    })

    it('should work with screen reader labels', () => {
      render(<DotsLoader aria-label="Loading content" role="status" />)

      const loader = screen.getByRole('status')

      expect(loader).toHaveAttribute('aria-label', 'Loading content')
    })
  })
})
