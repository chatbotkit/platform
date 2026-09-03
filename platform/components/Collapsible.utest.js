import useScrollHeight from '@/hooks/useScrollHeight'

import Collapsible from './Collapsible'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/hooks/useScrollHeight', () => ({
  __esModule: true,
  default: jest.fn(() => 100),
}))

describe('Collapsible', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render children', () => {
      render(
        <Collapsible>
          <div>Test content</div>
        </Collapsible>
      )
      expect(screen.getByText('Test content')).toBeInTheDocument()
    })

    it('should wrap children in inner div', () => {
      const { container } = render(
        <Collapsible>
          <div>Test content</div>
        </Collapsible>
      )
      const innerDiv = container.querySelector('div > div')

      expect(innerDiv).toBeInTheDocument()
      expect(innerDiv).toHaveTextContent('Test content')
    })
  })

  describe('height management', () => {
    it('should set height based on useScrollHeight when not disabled', () => {
      useScrollHeight.mockReturnValue(150)

      const { container } = render(
        <Collapsible>
          <div>Content</div>
        </Collapsible>
      )
      const wrapper = container.firstChild

      expect(wrapper).toHaveStyle({ height: '150px' })
    })

    it('should not set height when disabled', () => {
      useScrollHeight.mockReturnValue(150)

      const { container } = render(
        <Collapsible disabled>
          <div>Content</div>
        </Collapsible>
      )
      const wrapper = container.firstChild

      expect(wrapper).not.toHaveStyle({ height: '150px' })
    })

    it('should handle string height value', () => {
      useScrollHeight.mockReturnValue('auto')

      const { container } = render(
        <Collapsible>
          <div>Content</div>
        </Collapsible>
      )
      const wrapper = container.firstChild

      expect(wrapper).toHaveStyle({ height: 'auto' })
    })

    it('should override height with style prop', () => {
      useScrollHeight.mockReturnValue(150)

      const { container } = render(
        <Collapsible style={{ height: '200px' }}>
          <div>Content</div>
        </Collapsible>
      )
      const wrapper = container.firstChild

      expect(wrapper).toHaveStyle({ height: '200px' })
    })

    it('should not override when style.height is null', () => {
      useScrollHeight.mockReturnValue(150)

      const { container } = render(
        <Collapsible style={{ height: null }}>
          <div>Content</div>
        </Collapsible>
      )
      const wrapper = container.firstChild

      expect(wrapper).toHaveStyle({ height: '150px' })
    })
  })

  describe('custom element type', () => {
    it('should render as div by default', () => {
      const { container } = render(
        <Collapsible>
          <div>Content</div>
        </Collapsible>
      )

      expect(container.firstChild.tagName).toBe('DIV')
    })

    it('should render as custom element when as prop provided', () => {
      const { container } = render(
        <Collapsible as="section">
          <div>Content</div>
        </Collapsible>
      )

      expect(container.firstChild.tagName).toBe('SECTION')
    })
  })

  describe('className handling', () => {
    it('should apply custom className to wrapper', () => {
      render(
        <Collapsible className="custom-wrapper">
          <div>Content</div>
        </Collapsible>
      )

      const wrapper = document.querySelector('.custom-wrapper')

      expect(wrapper).toBeInTheDocument()
    })

    it('should apply innerClassName to inner div', () => {
      render(
        <Collapsible innerClassName="custom-inner">
          <div data-testid="content">Content</div>
        </Collapsible>
      )

      const innerDiv = screen.getByTestId('content').parentElement

      expect(innerDiv).toHaveClass('custom-inner')
    })
  })

  describe('forwarded ref', () => {
    it('should forward ref to wrapper element', () => {
      const ref = { current: null }

      render(
        <Collapsible ref={ref}>
          <div>Content</div>
        </Collapsible>
      )
      expect(ref.current).toBeTruthy()
      expect(ref.current.tagName).toBe('DIV')
    })
  })

  describe('style merging', () => {
    it('should merge custom styles with height', () => {
      useScrollHeight.mockReturnValue(100)

      const { container } = render(
        <Collapsible style={{ backgroundColor: 'red', padding: '10px' }}>
          <div>Content</div>
        </Collapsible>
      )
      const wrapper = container.firstChild

      expect(wrapper).toHaveStyle({
        height: '100px',
        backgroundColor: 'red',
        padding: '10px',
      })
    })
  })

  describe('disabled prop', () => {
    it('should pass disabled prop to wrapper', () => {
      const { container } = render(
        <Collapsible disabled>
          <div>Content</div>
        </Collapsible>
      )

      expect(container.firstChild).toHaveAttribute('disabled')
    })

    it('should call useScrollHeight with disabled flag', () => {
      render(
        <Collapsible disabled>
          <div>Content</div>
        </Collapsible>
      )
      expect(useScrollHeight).toHaveBeenCalledWith(expect.anything(), true)
    })
  })

  describe('props spreading', () => {
    it('should pass through additional props', () => {
      const { container } = render(
        <Collapsible data-testid="collapsible" aria-label="Test">
          <div>Content</div>
        </Collapsible>
      )

      expect(container.firstChild).toHaveAttribute('data-testid', 'collapsible')
      expect(container.firstChild).toHaveAttribute('aria-label', 'Test')
    })
  })
})
