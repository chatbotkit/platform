import RevealToken from './RevealToken'

import '@testing-library/jest-dom'
import { fireEvent, render } from '@testing-library/react'

describe('RevealToken', () => {
  const getInput = (container) => container.querySelector('input')

  describe('basic rendering', () => {
    it('renders as password input by default', () => {
      const { container } = render(<RevealToken />)
      const input = getInput(container)

      expect(input).toHaveAttribute('type', 'password')
    })

    it('renders with default value', () => {
      const { container } = render(<RevealToken defaultToken="test-token" />)
      const input = getInput(container)

      expect(input).toHaveValue('test-token')
    })

    it('applies additional props', () => {
      const { container } = render(
        <RevealToken placeholder="Enter token" className="custom-class" />
      )
      const input = getInput(container)

      expect(input).toHaveAttribute('placeholder', 'Enter token')
      expect(input).toHaveClass('custom-class')
    })

    it('has autocomplete disabled', () => {
      const { container } = render(<RevealToken />)
      const input = getInput(container)

      expect(input).toHaveAttribute('autocomplete', 'off')
      expect(input).toHaveAttribute('data-lpignore', 'true')
    })
  })

  describe('controlled state', () => {
    it('works as controlled component', () => {
      const setToken = jest.fn()
      const { container } = render(
        <RevealToken token="initial-token" setToken={setToken} />
      )

      const input = getInput(container)

      expect(input).toHaveValue('initial-token')

      fireEvent.change(input, { target: { value: 'new-token' } })
      expect(setToken).toHaveBeenCalledWith('new-token')
    })

    it('works as uncontrolled component', () => {
      const { container } = render(<RevealToken defaultToken="initial-token" />)

      const input = getInput(container)

      expect(input).toHaveValue('initial-token')

      fireEvent.change(input, { target: { value: 'updated-token' } })
      expect(input).toHaveValue('updated-token')
    })

    it('calls onChange callback when provided', () => {
      const onChange = jest.fn()
      const { container } = render(<RevealToken onChange={onChange} />)

      const input = getInput(container)

      fireEvent.change(input, { target: { value: 'test' } })

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange.mock.calls[0][0].target.value).toBe('test')
    })
  })

  describe('visibility toggle', () => {
    it('reveals token on focus', () => {
      const { container } = render(<RevealToken defaultToken="secret-token" />)
      const input = getInput(container)

      expect(input).toHaveAttribute('type', 'password')

      fireEvent.focus(input)
      expect(input).toHaveAttribute('type', 'text')
    })

    it('hides token on blur', () => {
      const { container } = render(<RevealToken defaultToken="secret-token" />)
      const input = getInput(container)

      fireEvent.focus(input)
      expect(input).toHaveAttribute('type', 'text')

      fireEvent.blur(input)
      expect(input).toHaveAttribute('type', 'password')
    })

    it('calls onFocus callback when provided', () => {
      const onFocus = jest.fn()
      const { container } = render(<RevealToken onFocus={onFocus} />)

      const input = getInput(container)

      fireEvent.focus(input)

      expect(onFocus).toHaveBeenCalledTimes(1)
    })

    it('calls onBlur callback when provided', () => {
      const onBlur = jest.fn()
      const { container } = render(<RevealToken onBlur={onBlur} />)

      const input = getInput(container)

      fireEvent.focus(input)
      fireEvent.blur(input)

      expect(onBlur).toHaveBeenCalledTimes(1)
    })
  })

  describe('edge cases', () => {
    it('handles null token value', () => {
      const { container } = render(<RevealToken token={null} />)
      const input = getInput(container)

      expect(input).toHaveValue('')
    })

    it('handles undefined token value', () => {
      const { container } = render(<RevealToken token={undefined} />)
      const input = getInput(container)

      expect(input).toHaveValue('')
    })

    it('handles empty string token', () => {
      const { container } = render(<RevealToken token="" />)
      const input = getInput(container)

      expect(input).toHaveValue('')
    })

    it('handles multiple focus/blur cycles', () => {
      const { container } = render(<RevealToken defaultToken="test" />)
      const input = getInput(container)

      fireEvent.focus(input)
      expect(input).toHaveAttribute('type', 'text')

      fireEvent.blur(input)
      expect(input).toHaveAttribute('type', 'password')

      fireEvent.focus(input)
      expect(input).toHaveAttribute('type', 'text')

      fireEvent.blur(input)
      expect(input).toHaveAttribute('type', 'password')
    })
  })

  describe('callback combinations', () => {
    it('calls both onChange and setToken', () => {
      const onChange = jest.fn()
      const setToken = jest.fn()
      const { container } = render(
        <RevealToken onChange={onChange} setToken={setToken} />
      )

      const input = getInput(container)

      fireEvent.change(input, { target: { value: 'new-value' } })

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(setToken).toHaveBeenCalledWith('new-value')
    })

    it('calls onFocus before revealing token', () => {
      const onFocus = jest.fn()
      const { container } = render(<RevealToken onFocus={onFocus} />)

      const input = getInput(container)

      fireEvent.focus(input)

      expect(onFocus).toHaveBeenCalled()
      expect(input).toHaveAttribute('type', 'text')
    })

    it('calls onBlur before hiding token', () => {
      const onBlur = jest.fn()
      const { container } = render(<RevealToken onBlur={onBlur} />)

      const input = getInput(container)

      fireEvent.focus(input)
      fireEvent.blur(input)

      expect(onBlur).toHaveBeenCalled()
      expect(input).toHaveAttribute('type', 'password')
    })
  })
})
