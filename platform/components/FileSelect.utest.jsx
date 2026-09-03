import FileSelect from './FileSelect'

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

describe('FileSelect', () => {
  describe('basic rendering', () => {
    it('should render input with placeholder', () => {
      render(<FileSelect />)
      expect(
        screen.getByPlaceholderText('Enter file ID...')
      ).toBeInTheDocument()
    })

    it('should render with default value', () => {
      render(<FileSelect defaultValue="file123" />)
      expect(screen.getByDisplayValue('file123')).toBeInTheDocument()
    })

    it('should render with controlled value', () => {
      render(<FileSelect value="controlled-file" />)
      expect(screen.getByDisplayValue('controlled-file')).toBeInTheDocument()
    })

    it('should apply wrapper className', () => {
      const { container } = render(
        <FileSelect wrapperClassName="custom-wrapper" />
      )

      expect(container.querySelector('.custom-wrapper')).toBeInTheDocument()
    })

    it('should apply container className', () => {
      const { container } = render(
        <FileSelect containerClassName="custom-container" />
      )

      expect(container.querySelector('.custom-container')).toBeInTheDocument()
    })
  })

  describe('external link', () => {
    it('should show external link when value is present', () => {
      render(<FileSelect defaultValue="file123" />)

      const link = screen.getByRole('link')

      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/files/file123')
      expect(link).toHaveAttribute('target', '_blank')
    })

    it('should not show external link when value is empty', () => {
      render(<FileSelect defaultValue="" />)
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })

    it('should show link after user enters value', () => {
      render(<FileSelect />)
      expect(screen.queryByRole('link')).not.toBeInTheDocument()

      const input = screen.getByPlaceholderText('Enter file ID...')

      fireEvent.change(input, { target: { value: 'newfile' } })

      const link = screen.getByRole('link')

      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/files/newfile')
    })

    it('should hide link when value is cleared', () => {
      render(<FileSelect defaultValue="file123" />)
      expect(screen.getByRole('link')).toBeInTheDocument()

      const input = screen.getByDisplayValue('file123')

      fireEvent.change(input, { target: { value: '' } })

      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })
  })

  describe('user interaction', () => {
    it('should update value on change', () => {
      render(<FileSelect />)

      const input = screen.getByPlaceholderText('Enter file ID...')

      fireEvent.change(input, { target: { value: 'newfile123' } })

      expect(input).toHaveValue('newfile123')
    })

    it('should call onChange callback when provided', () => {
      const onChange = jest.fn()

      render(<FileSelect onChange={onChange} />)

      const input = screen.getByPlaceholderText('Enter file ID...')

      fireEvent.change(input, { target: { value: 'test' } })

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ value: 'test' }),
        })
      )
    })

    it('should not update when disabled', () => {
      render(<FileSelect defaultValue="original" disabled />)

      const input = screen.getByDisplayValue('original')

      fireEvent.change(input, { target: { value: 'new' } })

      expect(input).toHaveValue('original')
    })

    it('should not call onChange when disabled', () => {
      const onChange = jest.fn()

      render(<FileSelect disabled onChange={onChange} />)

      const input = screen.getByPlaceholderText('Enter file ID...')

      fireEvent.change(input, { target: { value: 'test' } })

      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('disabled state', () => {
    it('should disable input when disabled prop is true', () => {
      render(<FileSelect disabled />)
      expect(screen.getByPlaceholderText('Enter file ID...')).toBeDisabled()
    })

    it('should apply disabled class to external link icon', () => {
      const { container } = render(
        <FileSelect defaultValue="file123" disabled />
      )
      const icon = container.querySelector('.default-link')

      expect(icon).toHaveClass('disabled')
    })

    it('should not apply disabled class when not disabled', () => {
      const { container } = render(<FileSelect defaultValue="file123" />)
      const icon = container.querySelector('.default-link')

      expect(icon).not.toHaveClass('disabled')
    })
  })

  describe('controlled vs uncontrolled', () => {
    it('should work as uncontrolled component with defaultValue', () => {
      render(<FileSelect defaultValue="initial" />)

      const input = screen.getByDisplayValue('initial')

      fireEvent.change(input, { target: { value: 'updated' } })

      expect(input).toHaveValue('updated')
    })

    it('should prioritize value over defaultValue', () => {
      render(<FileSelect value="controlled" defaultValue="ignored" />)
      expect(screen.getByDisplayValue('controlled')).toBeInTheDocument()
      expect(screen.queryByDisplayValue('ignored')).not.toBeInTheDocument()
    })

    it('should default to empty string when no value provided', () => {
      render(<FileSelect />)

      const input = screen.getByPlaceholderText('Enter file ID...')

      expect(input).toHaveValue('')
    })
  })

  describe('props forwarding', () => {
    it('should forward additional props to input', () => {
      render(<FileSelect data-testid="custom-input" />)
      expect(screen.getByTestId('custom-input')).toBeInTheDocument()
    })

    it('should maintain input type as text', () => {
      render(<FileSelect />)

      const input = screen.getByPlaceholderText('Enter file ID...')

      expect(input).toHaveAttribute('type', 'text')
    })
  })

  describe('edge cases', () => {
    it('should handle rapid value changes', () => {
      render(<FileSelect />)

      const input = screen.getByPlaceholderText('Enter file ID...')

      fireEvent.change(input, { target: { value: 'a' } })
      fireEvent.change(input, { target: { value: 'ab' } })
      fireEvent.change(input, { target: { value: 'abc' } })

      expect(input).toHaveValue('abc')
    })

    it('should handle special characters in file ID', () => {
      render(<FileSelect defaultValue="file-123_test" />)
      expect(screen.getByDisplayValue('file-123_test')).toBeInTheDocument()
    })

    it('should update link href when value changes', () => {
      render(<FileSelect defaultValue="original" />)

      const input = screen.getByDisplayValue('original')

      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        '/files/original'
      )

      fireEvent.change(input, { target: { value: 'updated' } })

      expect(screen.getByRole('link')).toHaveAttribute('href', '/files/updated')
    })
  })
})
