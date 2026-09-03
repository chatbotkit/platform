import { forwardRef } from 'react'

import AutoTextarea from './AutoTextarea'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@chatbotkit/react/components/AutoTextarea', () => {
  return forwardRef(function MockAutoTextarea(props, ref) {
    return <textarea {...props} ref={ref} />
  })
})

describe('AutoTextarea', () => {
  describe('basic functionality', () => {
    it('should render a textarea', () => {
      render(<AutoTextarea />)

      const textarea = screen.getByRole('textbox')

      expect(textarea).toBeInTheDocument()
      expect(textarea.tagName).toBe('TEXTAREA')
    })

    it('should accept value prop', () => {
      render(<AutoTextarea value="test content" readOnly />)
      expect(screen.getByRole('textbox')).toHaveValue('test content')
    })

    it('should handle onChange events', () => {
      const handleChange = jest.fn()

      render(<AutoTextarea onChange={handleChange} />)

      const textarea = screen.getByRole('textbox')

      fireEvent.change(textarea, { target: { value: 'new value' } })
      expect(handleChange).toHaveBeenCalledTimes(1)
    })

    it('should handle placeholder prop', () => {
      render(<AutoTextarea placeholder="Enter text here" />)
      expect(screen.getByPlaceholderText('Enter text here')).toBeInTheDocument()
    })
  })

  describe('styling', () => {
    it('should apply default classes', () => {
      render(<AutoTextarea />)

      const textarea = screen.getByRole('textbox')

      expect(textarea).toHaveClass('min-h-[5rem]')
      expect(textarea).toHaveClass('resize-none')
      expect(textarea).toHaveClass('overflow-hidden')
      expect(textarea).toHaveClass('w-full')
    })

    it('should apply custom className', () => {
      render(<AutoTextarea className="custom-textarea" />)

      const textarea = screen.getByRole('textbox')

      expect(textarea).toHaveClass('custom-textarea')
      expect(textarea).toHaveClass('min-h-[5rem]')
    })

    it('should merge custom className with defaults', () => {
      render(<AutoTextarea className="border-2 p-4" />)

      const textarea = screen.getByRole('textbox')

      expect(textarea).toHaveClass('border-2')
      expect(textarea).toHaveClass('p-4')
      expect(textarea).toHaveClass('min-h-[5rem]')
      expect(textarea).toHaveClass('w-full')
    })
  })

  describe('ref forwarding', () => {
    it('should forward ref to underlying textarea', () => {
      const ref = { current: null }

      render(<AutoTextarea ref={ref} />)
      expect(ref.current).not.toBeNull()
      expect(ref.current?.tagName).toBe('TEXTAREA')
    })

    it('should allow imperative access via ref', () => {
      const ref = { current: null }

      render(<AutoTextarea ref={ref} />)
      expect(ref.current).toHaveProperty('focus')
      expect(ref.current).toHaveProperty('blur')
    })

    it('should handle ref callback', () => {
      const refCallback = jest.fn()

      render(<AutoTextarea ref={refCallback} />)
      expect(refCallback).toHaveBeenCalled()
      expect(refCallback.mock.calls[0][0]).toBeInstanceOf(HTMLTextAreaElement)
    })
  })

  describe('props forwarding', () => {
    it('should forward additional props', () => {
      render(
        <AutoTextarea
          data-testid="test-textarea"
          aria-label="Custom textarea"
          name="content"
        />
      )

      const textarea = screen.getByRole('textbox')

      expect(textarea).toHaveAttribute('data-testid', 'test-textarea')
      expect(textarea).toHaveAttribute('aria-label', 'Custom textarea')
      expect(textarea).toHaveAttribute('name', 'content')
    })

    it('should handle disabled prop', () => {
      render(<AutoTextarea disabled />)
      expect(screen.getByRole('textbox')).toBeDisabled()
    })

    it('should handle readOnly prop', () => {
      render(<AutoTextarea readOnly value="read only text" />)

      const textarea = screen.getByRole('textbox')

      expect(textarea).toHaveAttribute('readOnly')
    })

    it('should handle rows prop', () => {
      render(<AutoTextarea rows={10} />)
      expect(screen.getByRole('textbox')).toHaveAttribute('rows', '10')
    })

    it('should handle maxLength prop', () => {
      render(<AutoTextarea maxLength={100} />)
      expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '100')
    })
  })

  describe('controlled component behavior', () => {
    it('should work as controlled component', () => {
      const { rerender } = render(<AutoTextarea value="initial" readOnly />)

      expect(screen.getByRole('textbox')).toHaveValue('initial')

      rerender(<AutoTextarea value="updated" readOnly />)
      expect(screen.getByRole('textbox')).toHaveValue('updated')
    })

    it('should work as uncontrolled component', () => {
      render(<AutoTextarea defaultValue="default text" />)
      expect(screen.getByRole('textbox')).toHaveValue('default text')
    })
  })

  describe('event handling', () => {
    it('should handle onBlur event', () => {
      const handleBlur = jest.fn()

      render(<AutoTextarea onBlur={handleBlur} />)

      const textarea = screen.getByRole('textbox')

      fireEvent.blur(textarea)
      expect(handleBlur).toHaveBeenCalledTimes(1)
    })

    it('should handle onFocus event', () => {
      const handleFocus = jest.fn()

      render(<AutoTextarea onFocus={handleFocus} />)

      const textarea = screen.getByRole('textbox')

      fireEvent.focus(textarea)
      expect(handleFocus).toHaveBeenCalledTimes(1)
    })

    it('should handle onKeyDown event', () => {
      const handleKeyDown = jest.fn()

      render(<AutoTextarea onKeyDown={handleKeyDown} />)

      const textarea = screen.getByRole('textbox')

      fireEvent.keyDown(textarea, { key: 'Enter' })
      expect(handleKeyDown).toHaveBeenCalledTimes(1)
    })
  })

  describe('edge cases', () => {
    it('should render without any props', () => {
      render(<AutoTextarea />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('should handle empty string value', () => {
      render(<AutoTextarea value="" readOnly />)
      expect(screen.getByRole('textbox')).toHaveValue('')
    })

    it('should handle empty className', () => {
      render(<AutoTextarea className="" />)

      const textarea = screen.getByRole('textbox')

      expect(textarea).toHaveClass('min-h-[5rem]')
    })

    it('should handle undefined className', () => {
      render(<AutoTextarea className={undefined} />)

      const textarea = screen.getByRole('textbox')

      expect(textarea).toHaveClass('min-h-[5rem]')
    })
  })
})
