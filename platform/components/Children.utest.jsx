import Children from './Children'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

describe('Children', () => {
  describe('basic functionality', () => {
    it('should render static children', () => {
      const { container } = render(
        <Children>
          <div>Static content</div>
        </Children>
      )

      expect(container.querySelector('div')).toHaveTextContent('Static content')
    })

    it('should render string children', () => {
      const { container } = render(<Children>Hello World</Children>)

      expect(container).toHaveTextContent('Hello World')
    })

    it('should pass props to function children', () => {
      const mockFn = jest.fn(() => <div>Function result</div>)

      render(
        <Children foo="bar" baz={42}>
          {mockFn}
        </Children>
      )
      expect(mockFn).toHaveBeenCalledWith({ foo: 'bar', baz: 42 })
    })

    it('should render result of function children', () => {
      const { container } = render(
        <Children name="Test">{({ name }) => <div>Hello {name}</div>}</Children>
      )

      expect(container).toHaveTextContent('Hello Test')
    })
  })

  describe('edge cases', () => {
    it('should handle null children', () => {
      const { container } = render(<Children>{null}</Children>)

      expect(container.firstChild).toBeNull()
    })

    it('should handle undefined children', () => {
      const { container } = render(<Children>{undefined}</Children>)

      expect(container.firstChild).toBeNull()
    })

    it('should handle empty children', () => {
      const { container } = render(<Children>{''}</Children>)

      expect(container).toHaveTextContent('')
    })

    it('should handle boolean children', () => {
      const { container } = render(<Children>{false}</Children>)

      expect(container.firstChild).toBeNull()
    })

    it('should handle number children', () => {
      const { container } = render(<Children>{42}</Children>)

      expect(container).toHaveTextContent('42')
    })
  })

  describe('function children variations', () => {
    it('should memoize function children correctly', () => {
      const fn1 = () => <div>First</div>
      const fn2 = () => <div>Second</div>

      const { rerender, container } = render(<Children>{fn1}</Children>)

      expect(container).toHaveTextContent('First')

      rerender(<Children>{fn2}</Children>)
      expect(container).toHaveTextContent('Second')
    })

    it('should memoize static children correctly', () => {
      const { rerender, container } = render(<Children>First</Children>)

      expect(container).toHaveTextContent('First')

      rerender(<Children>Second</Children>)
      expect(container).toHaveTextContent('Second')
    })

    it('should handle function returning null', () => {
      const { container } = render(<Children>{() => null}</Children>)

      expect(container.firstChild).toBeNull()
    })

    it('should handle function returning fragment', () => {
      const { container } = render(
        <Children>
          {() => (
            <>
              <span>A</span>
              <span>B</span>
            </>
          )}
        </Children>
      )

      expect(container.querySelectorAll('span')).toHaveLength(2)
    })
  })

  describe('props forwarding', () => {
    it('should forward all props to function children', () => {
      const mockFn = jest.fn(() => <div>Test</div>)

      render(
        <Children a={1} b="two" c={true} d={null} e={undefined}>
          {mockFn}
        </Children>
      )
      expect(mockFn).toHaveBeenCalledWith({
        a: 1,
        b: 'two',
        c: true,
        d: null,
        e: undefined,
      })
    })

    it('should not pass children prop to function children', () => {
      const mockFn = jest.fn(() => <div>Test</div>)

      render(<Children foo="bar">{mockFn}</Children>)
      expect(mockFn).toHaveBeenCalledWith({ foo: 'bar' })
      expect(mockFn).not.toHaveBeenCalledWith(
        expect.objectContaining({ children: expect.anything() })
      )
    })

    it('should handle spread props', () => {
      const mockFn = jest.fn(() => <div>Test</div>)
      const props = { x: 1, y: 2, z: 3 }

      render(<Children {...props}>{mockFn}</Children>)
      expect(mockFn).toHaveBeenCalledWith(props)
    })
  })

  describe('render behavior', () => {
    it('should handle multiple render calls with same function', () => {
      const fn = jest.fn(() => <div>Test</div>)
      const { rerender } = render(<Children>{fn}</Children>)

      // Initial render
      expect(fn).toHaveBeenCalledTimes(1)

      // Rerender with same function - should use memoized render function
      rerender(<Children>{fn}</Children>)
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should update when props change', () => {
      const fn = jest.fn((props) => <div>{props.value}</div>)
      const { rerender, container } = render(
        <Children value="first">{fn}</Children>
      )

      expect(container).toHaveTextContent('first')

      rerender(<Children value="second">{fn}</Children>)
      expect(container).toHaveTextContent('second')
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })
})
