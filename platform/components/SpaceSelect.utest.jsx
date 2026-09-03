import SpaceSelect from './SpaceSelect'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/components/Link', () => {
  return function Link({ children, href, ...props }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }
})

describe('SpaceSelect', () => {
  describe('basic rendering', () => {
    it('should render input with placeholder', () => {
      render(<SpaceSelect />)
      expect(
        screen.getByPlaceholderText('Enter space ID...')
      ).toBeInTheDocument()
    })

    it('should render with default value', () => {
      render(<SpaceSelect defaultValue="space123" />)
      expect(screen.getByDisplayValue('space123')).toBeInTheDocument()
    })

    it('should render with controlled value', () => {
      render(<SpaceSelect value="controlled-space" />)
      expect(screen.getByDisplayValue('controlled-space')).toBeInTheDocument()
    })

    it('should apply wrapper className', () => {
      const { container } = render(
        <SpaceSelect wrapperClassName="custom-wrapper" />
      )

      expect(container.querySelector('.custom-wrapper')).toBeInTheDocument()
    })

    it('should apply container className', () => {
      const { container } = render(
        <SpaceSelect containerClassName="custom-container" />
      )

      expect(container.querySelector('.custom-container')).toBeInTheDocument()
    })
  })

  describe('external link', () => {
    it('should show external link when value is present', () => {
      render(<SpaceSelect defaultValue="space123" />)

      const link = screen.getByRole('link')

      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/spaces/space123')
      expect(link).toHaveAttribute('target', '_blank')
    })

    it('should not show external link when value is empty', () => {
      render(<SpaceSelect defaultValue="" />)
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })

    it('should show link after user enters value', () => {
      render(<SpaceSelect />)
      expect(screen.queryByRole('link')).not.toBeInTheDocument()

      const input = screen.getByPlaceholderText('Enter space ID...')

      fireEvent.change(input, { target: { value: 'newspace' } })

      const link = screen.getByRole('link')

      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/spaces/newspace')
    })

    it('should hide link when value is cleared', () => {
      render(<SpaceSelect defaultValue="space123" />)
      expect(screen.getByRole('link')).toBeInTheDocument()

      const input = screen.getByDisplayValue('space123')

      fireEvent.change(input, { target: { value: '' } })

      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })
  })

  describe('user interaction', () => {
    it('should update value on change', () => {
      render(<SpaceSelect />)

      const input = screen.getByPlaceholderText('Enter space ID...')

      fireEvent.change(input, { target: { value: 'newspace123' } })

      expect(input).toHaveValue('newspace123')
    })

    it('should call onChange callback when provided', () => {
      const onChange = jest.fn()

      render(<SpaceSelect onChange={onChange} />)

      const input = screen.getByPlaceholderText('Enter space ID...')

      fireEvent.change(input, { target: { value: 'test' } })

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ value: 'test' }),
        })
      )
    })

    it('should not update when disabled', () => {
      render(<SpaceSelect defaultValue="original" disabled />)

      const input = screen.getByDisplayValue('original')

      fireEvent.change(input, { target: { value: 'new' } })

      expect(input).toHaveValue('original')
    })

    it('should not call onChange when disabled', () => {
      const onChange = jest.fn()

      render(<SpaceSelect disabled onChange={onChange} />)

      const input = screen.getByPlaceholderText('Enter space ID...')

      fireEvent.change(input, { target: { value: 'test' } })

      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('disabled state', () => {
    it('should disable input when disabled prop is true', () => {
      render(<SpaceSelect disabled />)
      expect(screen.getByPlaceholderText('Enter space ID...')).toBeDisabled()
    })

    it('should apply disabled class to external link icon', () => {
      const { container } = render(
        <SpaceSelect defaultValue="space123" disabled />
      )
      const icon = container.querySelector('.default-link')

      expect(icon).toHaveClass('disabled')
    })

    it('should not apply disabled class when not disabled', () => {
      const { container } = render(<SpaceSelect defaultValue="space123" />)
      const icon = container.querySelector('.default-link')

      expect(icon).not.toHaveClass('disabled')
    })
  })

  describe('controlled vs uncontrolled', () => {
    it('should work as uncontrolled component with defaultValue', () => {
      render(<SpaceSelect defaultValue="initial" />)

      const input = screen.getByDisplayValue('initial')

      fireEvent.change(input, { target: { value: 'updated' } })

      expect(input).toHaveValue('updated')
    })

    it('should prioritize value over defaultValue', () => {
      render(<SpaceSelect value="controlled" defaultValue="ignored" />)
      expect(screen.getByDisplayValue('controlled')).toBeInTheDocument()
      expect(screen.queryByDisplayValue('ignored')).not.toBeInTheDocument()
    })

    it('should update the input when the controlled value prop changes', () => {
      const { rerender } = render(<SpaceSelect value="first" />)

      expect(screen.getByDisplayValue('first')).toBeInTheDocument()

      rerender(<SpaceSelect value="second" />)

      expect(screen.getByDisplayValue('second')).toBeInTheDocument()
      expect(screen.queryByDisplayValue('first')).not.toBeInTheDocument()
    })

    it('should render empty when value is "" even with a defaultValue', () => {
      render(<SpaceSelect value="" defaultValue="fallback" />)

      const input = screen.getByPlaceholderText('Enter space ID...')

      expect(input).toHaveValue('')
      expect(screen.queryByDisplayValue('fallback')).not.toBeInTheDocument()
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })

    it('should clear the input when the controlled value is reset to ""', () => {
      const { rerender } = render(<SpaceSelect value="space1" />)

      expect(screen.getByRole('link')).toBeInTheDocument()

      rerender(<SpaceSelect value="" />)

      expect(screen.getByPlaceholderText('Enter space ID...')).toHaveValue('')
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })

    it('should default to empty string when no value provided', () => {
      render(<SpaceSelect />)

      const input = screen.getByPlaceholderText('Enter space ID...')

      expect(input).toHaveValue('')
    })
  })

  describe('props forwarding', () => {
    it('should forward additional props to input', () => {
      render(<SpaceSelect data-testid="custom-input" />)
      expect(screen.getByTestId('custom-input')).toBeInTheDocument()
    })

    it('should maintain input type as text', () => {
      render(<SpaceSelect />)

      const input = screen.getByPlaceholderText('Enter space ID...')

      expect(input).toHaveAttribute('type', 'text')
    })
  })

  describe('edge cases', () => {
    it('should handle rapid value changes', () => {
      render(<SpaceSelect />)

      const input = screen.getByPlaceholderText('Enter space ID...')

      fireEvent.change(input, { target: { value: 'a' } })
      fireEvent.change(input, { target: { value: 'ab' } })
      fireEvent.change(input, { target: { value: 'abc' } })

      expect(input).toHaveValue('abc')
    })

    it('should handle special characters in space ID', () => {
      render(<SpaceSelect defaultValue="space-123_test" />)
      expect(screen.getByDisplayValue('space-123_test')).toBeInTheDocument()
    })

    it('should update link href when value changes', () => {
      render(<SpaceSelect defaultValue="original" />)

      const input = screen.getByDisplayValue('original')

      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        '/spaces/original'
      )

      fireEvent.change(input, { target: { value: 'updated' } })

      expect(screen.getByRole('link')).toHaveAttribute('href', '/spaces/updated')
    })
  })
})
