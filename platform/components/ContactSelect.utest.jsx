import ContactSelect from './ContactSelect'

import '@testing-library/jest-dom'
import { fireEvent, render } from '@testing-library/react'

jest.mock('@/components/Link', () => {
  return function Link({ children, ...props }) {
    return <a {...props}>{children}</a>
  }
})

describe('ContactSelect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic rendering', () => {
    it('should render input field', () => {
      const { container } = render(<ContactSelect />)

      const input = container.querySelector('input')

      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('type', 'text')
      expect(input).toHaveAttribute('placeholder', 'Enter contact ID...')
    })

    it('should render with defaultValue', () => {
      const { container } = render(<ContactSelect defaultValue="contact-123" />)

      const input = container.querySelector('input')

      expect(input).toHaveValue('contact-123')
    })

    it('should render with controlled value', () => {
      const { container } = render(<ContactSelect value="contact-456" />)

      const input = container.querySelector('input')

      expect(input).toHaveValue('contact-456')
    })

    it('should apply wrapperClassName', () => {
      const { container } = render(
        <ContactSelect wrapperClassName="custom-wrapper" />
      )

      const wrapper = container.firstChild

      expect(wrapper).toHaveClass('custom-wrapper')
    })

    it('should apply containerClassName', () => {
      const { container } = render(
        <ContactSelect containerClassName="custom-container" />
      )

      const flexContainer = container.querySelector('.flex')

      expect(flexContainer).toHaveClass('custom-container')
    })

    it('should pass through additional props to input', () => {
      const { container } = render(<ContactSelect data-testid="test-input" />)

      const input = container.querySelector('input')

      expect(input).toHaveAttribute('data-testid', 'test-input')
    })
  })

  describe('link display', () => {
    it('should not show link when value is empty', () => {
      const { container } = render(<ContactSelect />)

      const link = container.querySelector('a')

      expect(link).not.toBeInTheDocument()
    })

    it('should show link when value is provided', () => {
      const { container } = render(<ContactSelect defaultValue="contact-123" />)

      const link = container.querySelector('a')

      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/contacts/contact-123')
      expect(link).toHaveAttribute('target', '_blank')
    })

    it('should show link icon with correct classes', () => {
      const { container } = render(<ContactSelect defaultValue="contact-123" />)

      const icon = container.querySelector('svg')

      expect(icon).toBeInTheDocument()
      expect(icon).toHaveClass('h-5', 'w-5', 'default-link')
    })

    it('should update link when value changes', () => {
      const { container } = render(<ContactSelect />)

      const input = container.querySelector('input')

      fireEvent.change(input, { target: { value: 'new-contact' } })

      const link = container.querySelector('a')

      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/contacts/new-contact')
    })

    it('should remove link when value is cleared', () => {
      const { container } = render(<ContactSelect defaultValue="contact-123" />)

      let link = container.querySelector('a')

      expect(link).toBeInTheDocument()

      const input = container.querySelector('input')

      fireEvent.change(input, { target: { value: '' } })

      link = container.querySelector('a')
      expect(link).not.toBeInTheDocument()
    })
  })

  describe('input interactions', () => {
    it('should call onChange when input changes', () => {
      const onChange = jest.fn()
      const { container } = render(<ContactSelect onChange={onChange} />)

      const input = container.querySelector('input')

      fireEvent.change(input, { target: { value: 'test-contact' } })

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ value: 'test-contact' }),
        })
      )
    })

    it('should update internal state on change', () => {
      const { container } = render(<ContactSelect />)

      const input = container.querySelector('input')

      fireEvent.change(input, { target: { value: 'new-value' } })

      expect(input).toHaveValue('new-value')
    })

    it('should handle multiple changes', () => {
      const onChange = jest.fn()
      const { container } = render(<ContactSelect onChange={onChange} />)

      const input = container.querySelector('input')

      fireEvent.change(input, { target: { value: 'first' } })
      fireEvent.change(input, { target: { value: 'second' } })
      fireEvent.change(input, { target: { value: 'third' } })

      expect(onChange).toHaveBeenCalledTimes(3)
      expect(input).toHaveValue('third')
    })
  })

  describe('disabled state', () => {
    it('should disable input when disabled prop is true', () => {
      const { container } = render(<ContactSelect disabled />)

      const input = container.querySelector('input')

      expect(input).toBeDisabled()
    })

    it('should not call onChange when disabled', () => {
      const onChange = jest.fn()
      const { container } = render(
        <ContactSelect disabled onChange={onChange} />
      )

      const input = container.querySelector('input')

      fireEvent.change(input, { target: { value: 'test' } })

      expect(onChange).not.toHaveBeenCalled()
    })

    it('should not update value when disabled', () => {
      const { container } = render(
        <ContactSelect disabled defaultValue="initial" />
      )

      const input = container.querySelector('input')

      fireEvent.change(input, { target: { value: 'new-value' } })

      expect(input).toHaveValue('initial')
    })

    it('should apply disabled class to link icon', () => {
      const { container } = render(
        <ContactSelect disabled defaultValue="contact-123" />
      )

      const icon = container.querySelector('svg')

      expect(icon).toHaveClass('disabled')
    })
  })

  describe('input attributes', () => {
    it('should have spellCheck disabled', () => {
      const { container } = render(<ContactSelect />)

      const input = container.querySelector('input')

      expect(input).toHaveAttribute('spellCheck', 'false')
    })

    it('should use text input type', () => {
      const { container } = render(<ContactSelect />)

      const input = container.querySelector('input')

      expect(input).toHaveAttribute('type', 'text')
    })
  })

  describe('edge cases', () => {
    it('should handle undefined defaultValue', () => {
      const { container } = render(<ContactSelect />)

      const input = container.querySelector('input')

      expect(input).toHaveValue('')
    })

    it('should handle empty string defaultValue', () => {
      const { container } = render(<ContactSelect defaultValue="" />)

      const input = container.querySelector('input')

      expect(input).toHaveValue('')
    })

    it('should prioritize controlled value over defaultValue', () => {
      const { container } = render(
        <ContactSelect defaultValue="default" value="controlled" />
      )

      const input = container.querySelector('input')

      expect(input).toHaveValue('controlled')
    })

    it('should handle null onChange gracefully', () => {
      const { container } = render(<ContactSelect onChange={null} />)

      const input = container.querySelector('input')

      expect(() => {
        fireEvent.change(input, { target: { value: 'test' } })
      }).not.toThrow()
    })

    it('should handle undefined onChange gracefully', () => {
      const { container } = render(<ContactSelect />)

      const input = container.querySelector('input')

      expect(() => {
        fireEvent.change(input, { target: { value: 'test' } })
      }).not.toThrow()
    })
  })

  describe('styling and layout', () => {
    it('should have flex layout for container', () => {
      const { container } = render(<ContactSelect />)

      const flexContainer = container.querySelector('.flex')

      expect(flexContainer).toHaveClass(
        'flex',
        'flex-row',
        'gap-2',
        'items-center'
      )
    })
  })
})
