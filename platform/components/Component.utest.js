/* eslint-disable @typescript-eslint/no-require-imports */
import { createRef } from 'react'

import Component from './Component'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

describe('Component', () => {
  describe('basic functionality', () => {
    it('should render as React.Fragment by default', () => {
      const { container } = render(<Component>Content</Component>)

      expect(container.textContent).toBe('Content')
    })

    it('should render as specified element', () => {
      const { container } = render(<Component as="div">Content</Component>)

      const div = container.querySelector('div')

      expect(div).toBeInTheDocument()
      expect(div.textContent).toBe('Content')
    })

    it('should pass props to rendered element', () => {
      const { container } = render(
        <Component as="div" className="test-class" id="test-id">
          Content
        </Component>
      )

      const div = container.querySelector('div')

      expect(div).toHaveClass('test-class')
      expect(div).toHaveAttribute('id', 'test-id')
    })
  })

  describe('as prop variants', () => {
    it('should render as div', () => {
      const { container } = render(<Component as="div">Text</Component>)

      expect(container.querySelector('div')).toBeInTheDocument()
    })

    it('should render as span', () => {
      const { container } = render(<Component as="span">Text</Component>)

      expect(container.querySelector('span')).toBeInTheDocument()
    })

    it('should render as button', () => {
      const { container } = render(<Component as="button">Click</Component>)

      const button = container.querySelector('button')

      expect(button).toBeInTheDocument()
      expect(button.textContent).toBe('Click')
    })

    it('should render as section', () => {
      const { container } = render(<Component as="section">Section</Component>)

      expect(container.querySelector('section')).toBeInTheDocument()
    })

    it('should render as article', () => {
      const { container } = render(<Component as="article">Article</Component>)

      expect(container.querySelector('article')).toBeInTheDocument()
    })

    it('should render as header', () => {
      const { container } = render(<Component as="header">Header</Component>)

      expect(container.querySelector('header')).toBeInTheDocument()
    })

    it('should render as footer', () => {
      const { container } = render(<Component as="footer">Footer</Component>)

      expect(container.querySelector('footer')).toBeInTheDocument()
    })

    it('should render as nav', () => {
      const { container } = render(<Component as="nav">Nav</Component>)

      expect(container.querySelector('nav')).toBeInTheDocument()
    })
  })

  describe('ref forwarding', () => {
    it('should forward ref to rendered element', () => {
      const ref = createRef()

      render(
        <Component as="div" ref={ref}>
          Content
        </Component>
      )

      expect(ref.current).toBeInstanceOf(HTMLDivElement)
      expect(ref.current.textContent).toBe('Content')
    })

    it('should forward ref to button', () => {
      const ref = createRef()

      render(
        <Component as="button" ref={ref}>
          Click
        </Component>
      )

      expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    })

    it('should forward ref to span', () => {
      const ref = createRef()

      render(
        <Component as="span" ref={ref}>
          Text
        </Component>
      )

      expect(ref.current).toBeInstanceOf(HTMLSpanElement)
    })

    it('should handle ref with null as prop', () => {
      const ref = createRef()
      const { container } = render(
        <Component as="div" ref={ref}>
          Test
        </Component>
      )

      expect(ref.current).toBeTruthy()
      expect(container.querySelector('div')).toBe(ref.current)
    })
  })

  describe('children handling', () => {
    it('should render text children', () => {
      const { container } = render(<Component as="div">Plain text</Component>)

      expect(container.textContent).toBe('Plain text')
    })

    it('should render element children', () => {
      const { container } = render(
        <Component as="div">
          <span>Nested</span>
        </Component>
      )

      expect(container.querySelector('span')).toHaveTextContent('Nested')
    })

    it('should render multiple children', () => {
      const { container } = render(
        <Component as="div">
          <span>First</span>
          <span>Second</span>
        </Component>
      )

      expect(container.querySelectorAll('span')).toHaveLength(2)
    })

    it('should render number children', () => {
      const { container } = render(<Component as="div">{42}</Component>)

      expect(container.textContent).toBe('42')
    })

    it('should render zero', () => {
      const { container } = render(<Component as="div">{0}</Component>)

      expect(container.textContent).toBe('0')
    })

    it('should handle null children', () => {
      const { container } = render(<Component as="div">{null}</Component>)

      expect(container.textContent).toBe('')
    })

    it('should handle undefined children', () => {
      const { container } = render(<Component as="div">{undefined}</Component>)

      expect(container.textContent).toBe('')
    })

    it('should handle array of children', () => {
      const { container } = render(
        <Component as="div">
          {[<span key="1">A</span>, <span key="2">B</span>]}
        </Component>
      )

      expect(container.querySelectorAll('span')).toHaveLength(2)
    })
  })

  describe('props handling', () => {
    it('should pass className', () => {
      const { container } = render(
        <Component as="div" className="custom-class">
          Content
        </Component>
      )

      expect(container.querySelector('div')).toHaveClass('custom-class')
    })

    it('should pass id', () => {
      const { container } = render(
        <Component as="div" id="custom-id">
          Content
        </Component>
      )

      expect(container.querySelector('div')).toHaveAttribute('id', 'custom-id')
    })

    it('should pass data attributes', () => {
      const { container } = render(
        <Component as="div" data-test="value">
          Content
        </Component>
      )

      expect(container.querySelector('div')).toHaveAttribute(
        'data-test',
        'value'
      )
    })

    it('should pass aria attributes', () => {
      const { container } = render(
        <Component as="div" aria-label="Label">
          Content
        </Component>
      )

      expect(container.querySelector('div')).toHaveAttribute(
        'aria-label',
        'Label'
      )
    })

    it('should pass style', () => {
      const { container } = render(
        <Component as="div" style={{ color: 'red' }}>
          Content
        </Component>
      )

      expect(container.querySelector('div')).toHaveStyle({ color: 'red' })
    })

    it('should pass event handlers', () => {
      const handleClick = jest.fn()
      const { container } = render(
        <Component as="button" onClick={handleClick}>
          Click
        </Component>
      )

      const button = container.querySelector('button')

      button.click()
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should pass multiple props', () => {
      const { container } = render(
        <Component
          as="div"
          className="class1"
          id="id1"
          data-test="test"
          aria-label="label"
        >
          Content
        </Component>
      )

      const div = container.querySelector('div')

      expect(div).toHaveClass('class1')
      expect(div).toHaveAttribute('id', 'id1')
      expect(div).toHaveAttribute('data-test', 'test')
      expect(div).toHaveAttribute('aria-label', 'label')
    })
  })

  describe('edge cases', () => {
    it('should render null when as is null', () => {
      const { container } = render(<Component as={null}>Content</Component>)

      expect(container.textContent).toBe('')
    })

    it('should render as React.Fragment when as is undefined', () => {
      const { container } = render(
        <Component as={undefined}>Content</Component>
      )

      expect(container.textContent).toBe('Content')
    })

    it('should render null when as is false', () => {
      const { container } = render(<Component as={false}>Content</Component>)

      expect(container.textContent).toBe('')
    })

    it('should handle empty string as', () => {
      const { container } = render(<Component as="">Content</Component>)

      expect(container.textContent).toBe('')
    })

    it('should render as React.Fragment by default', () => {
      const { container } = render(
        <Component>
          <span>Nested</span>
        </Component>
      )

      expect(container.textContent).toContain('Nested')
    })

    it('should handle no children', () => {
      const { container } = render(<Component as="div" />)

      expect(container.querySelector('div')).toBeInTheDocument()
      expect(container.querySelector('div').textContent).toBe('')
    })
  })

  describe('custom components', () => {
    it('should render as custom component', () => {
      const CustomComponent = ({ children, ...props }) => (
        <div className="custom" {...props}>
          {children}
        </div>
      )

      const { container } = render(
        <Component as={CustomComponent}>Content</Component>
      )

      expect(container.querySelector('.custom')).toBeInTheDocument()
      expect(container.querySelector('.custom').textContent).toBe('Content')
    })

    it('should pass props to custom component', () => {
      const CustomComponent = ({ children, testProp, ...props }) => (
        <div data-test={testProp} {...props}>
          {children}
        </div>
      )

      const { container } = render(
        <Component as={CustomComponent} testProp="value">
          Content
        </Component>
      )

      expect(container.querySelector('div')).toHaveAttribute(
        'data-test',
        'value'
      )
    })

    it('should forward ref to custom component', () => {
      const CustomComponent = ({ children, ...props }, ref) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      )

      const ForwardedComponent = require('react').forwardRef(CustomComponent)
      const ref = createRef()

      render(
        <Component as={ForwardedComponent} ref={ref}>
          Content
        </Component>
      )

      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })
  })
})
