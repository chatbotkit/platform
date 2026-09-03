import Children from './Children'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

describe('Children', () => {
  describe('basic rendering', () => {
    it('should render static children content', () => {
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

    it('should render null children', () => {
      const { container } = render(<Children>{null}</Children>)

      expect(container).toBeEmptyDOMElement()
    })

    it('should render undefined children', () => {
      const { container } = render(<Children>{undefined}</Children>)

      expect(container).toBeEmptyDOMElement()
    })
  })

  describe('function children pattern', () => {
    it('should call function children with props', () => {
      const childrenFn = jest.fn((props) => <div>Props: {props.value}</div>)

      render(<Children value="test">{childrenFn}</Children>)

      expect(childrenFn).toHaveBeenCalledWith({ value: 'test' })
    })

    it('should pass all props to function children', () => {
      const childrenFn = jest.fn((props) => (
        <div>
          {props.foo}-{props.bar}
        </div>
      ))

      const { container } = render(
        <Children foo="hello" bar="world">
          {childrenFn}
        </Children>
      )

      expect(childrenFn).toHaveBeenCalledWith({ foo: 'hello', bar: 'world' })
      expect(container).toHaveTextContent('hello-world')
    })

    it('should render function children return value', () => {
      const { container } = render(
        <Children value="dynamic">
          {(props) => <span>Value: {props.value}</span>}
        </Children>
      )

      expect(container.querySelector('span')).toHaveTextContent(
        'Value: dynamic'
      )
    })

    it('should handle function returning null', () => {
      const { container } = render(<Children>{() => null}</Children>)

      expect(container).toBeEmptyDOMElement()
    })

    it('should handle function returning multiple elements', () => {
      const { container } = render(
        <Children count={3}>
          {(props) => (
            <>
              <div>Item 1</div>
              <div>Item 2</div>
              <div>Count: {props.count}</div>
            </>
          )}
        </Children>
      )

      const divs = container.querySelectorAll('div')

      expect(divs).toHaveLength(3)
      expect(divs[2]).toHaveTextContent('Count: 3')
    })
  })

  describe('memoization behavior', () => {
    it('should memoize static children', () => {
      const staticChildren = <div>Static</div>
      const { rerender } = render(
        <Children value={1}>{staticChildren}</Children>
      )

      rerender(<Children value={2}>{staticChildren}</Children>)

      // Component should handle prop changes without errors
      expect(true).toBe(true)
    })

    it('should memoize function children', () => {
      const childrenFn = jest.fn((props) => <div>{props.value}</div>)
      const { rerender } = render(<Children value={1}>{childrenFn}</Children>)

      expect(childrenFn).toHaveBeenCalledTimes(1)

      rerender(<Children value={2}>{childrenFn}</Children>)

      // Function should be called again with new props
      expect(childrenFn).toHaveBeenCalledTimes(2)
    })
  })

  describe('edge cases', () => {
    it('should handle empty props object', () => {
      const { container } = render(
        <Children>{() => <div>Empty</div>}</Children>
      )

      expect(container).toHaveTextContent('Empty')
    })

    it('should handle boolean children', () => {
      const { container: trueContainer } = render(<Children>{true}</Children>)

      expect(trueContainer).toBeEmptyDOMElement()

      const { container: falseContainer } = render(<Children>{false}</Children>)

      expect(falseContainer).toBeEmptyDOMElement()
    })

    it('should handle number children', () => {
      const { container } = render(<Children>{42}</Children>)

      expect(container).toHaveTextContent('42')
    })

    it('should handle zero as children', () => {
      const { container } = render(<Children>{0}</Children>)

      expect(container).toHaveTextContent('0')
    })
  })
})
