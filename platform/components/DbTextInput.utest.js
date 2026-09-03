/* eslint-disable @typescript-eslint/no-require-imports */
import DbTextInput from './DbTextInput'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/components/AutoTextarea', () => {
  const React = jest.requireActual('react')

  return {
    __esModule: true,
    default: React.forwardRef(function AutoTextarea(props, ref) {
      return <textarea {...props} ref={ref} />
    }),
  }
})

jest.mock('@/lib/db.string', () => ({
  isDbText: jest.fn(),
}))

const { isDbText } = require('@/lib/db.string')

describe('DbTextInput', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    isDbText.mockReturnValue(true)
  })

  describe('basic rendering', () => {
    it('should render with default value', () => {
      render(<DbTextInput defaultValue="test content" />)
      expect(screen.getByRole('textbox')).toHaveValue('test content')
    })

    it('should render with empty default value', () => {
      render(<DbTextInput />)
      expect(screen.getByRole('textbox')).toHaveValue('')
    })

    it('should apply custom className', () => {
      const { container } = render(<DbTextInput className="custom-class" />)
      const textarea = container.querySelector('textarea')

      expect(textarea).toHaveClass('custom-class')
    })

    it('should apply wrapperClassName', () => {
      const { container } = render(
        <DbTextInput wrapperClassName="wrapper-class" />
      )
      const wrapper = container.querySelector('.wrapper-class')

      expect(wrapper).toBeInTheDocument()
    })

    it('should apply containerClassName', () => {
      const { container } = render(
        <DbTextInput containerClassName="container-class" />
      )
      const containerDiv = container.querySelector('.container-class')

      expect(containerDiv).toBeInTheDocument()
    })
  })

  describe('controlled mode', () => {
    it('should work as controlled component', () => {
      const setValue = jest.fn()

      render(<DbTextInput value="initial" setValue={setValue} />)

      const textarea = screen.getByRole('textbox')

      expect(textarea).toHaveValue('initial')

      fireEvent.change(textarea, { target: { value: 'updated' } })
      expect(setValue).toHaveBeenCalledWith('updated')
    })

    it('should call onChange callback with event', () => {
      const onChange = jest.fn()

      render(<DbTextInput defaultValue="" onChange={onChange} />)

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'new value' },
      })
      expect(onChange).toHaveBeenCalled()
      expect(onChange.mock.calls[0][0].target.value).toBe('new value')
    })

    it('should work with both setValue and onChange', () => {
      const setValue = jest.fn()
      const onChange = jest.fn()

      render(
        <DbTextInput value="test" setValue={setValue} onChange={onChange} />
      )

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'changed' },
      })

      expect(setValue).toHaveBeenCalledWith('changed')
      expect(onChange).toHaveBeenCalled()
    })
  })

  describe('uncontrolled mode', () => {
    it('should work as uncontrolled component', () => {
      render(<DbTextInput defaultValue="initial" />)

      const textarea = screen.getByRole('textbox')

      fireEvent.change(textarea, { target: { value: 'modified' } })

      expect(textarea).toHaveValue('modified')
    })
  })

  describe('validation', () => {
    it('should clear validation error when value is empty', () => {
      render(<DbTextInput defaultValue="" />)

      const textarea = screen.getByRole('textbox')

      expect(textarea.validationMessage).toBe('')
    })

    it('should clear validation error when isDbText returns true', () => {
      isDbText.mockReturnValue(true)

      const { rerender } = render(<DbTextInput defaultValue="" />)
      const textarea = screen.getByRole('textbox')

      fireEvent.change(textarea, { target: { value: 'valid text' } })
      rerender(<DbTextInput defaultValue="valid text" />)

      expect(textarea.validationMessage).toBe('')
    })

    it('should set validation error when isDbText returns false', () => {
      isDbText.mockReturnValue(false)

      render(<DbTextInput defaultValue="too long text" />)

      const textarea = screen.getByRole('textbox')

      expect(textarea.validity.customError).toBe(true)
    })

    it('should update validation on value change', () => {
      const { rerender } = render(<DbTextInput value="" />)
      const textarea = screen.getByRole('textbox')

      isDbText.mockReturnValue(false)
      rerender(<DbTextInput value="invalid text" />)

      expect(textarea.validity.customError).toBe(true)

      isDbText.mockReturnValue(true)
      rerender(<DbTextInput value="valid text" />)

      expect(textarea.validationMessage).toBe('')
    })
  })

  describe('countTokens prop', () => {
    it('should render TokenAutoTextarea when countTokens is true', () => {
      const { container } = render(<DbTextInput countTokens={true} />)

      expect(container.querySelector('textarea')).toBeInTheDocument()
    })

    it('should render AdvancedAutoTextarea when countTokens is false', () => {
      const { container } = render(<DbTextInput countTokens={false} />)

      expect(container.querySelector('textarea')).toBeInTheDocument()
    })

    it('should render AdvancedAutoTextarea by default', () => {
      const { container } = render(<DbTextInput />)

      expect(container.querySelector('textarea')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle null value', () => {
      render(<DbTextInput value={null} />)
      expect(screen.getByRole('textbox')).toHaveValue('')
    })

    it('should handle undefined value', () => {
      render(<DbTextInput value={undefined} />)
      expect(screen.getByRole('textbox')).toHaveValue('')
    })

    it('should handle rapid value changes', () => {
      const { rerender } = render(<DbTextInput value="v1" />)

      rerender(<DbTextInput value="v2" />)
      rerender(<DbTextInput value="v3" />)

      expect(screen.getByRole('textbox')).toHaveValue('v3')
    })
  })

  describe('passthrough props', () => {
    it('should pass through additional props', () => {
      render(
        <DbTextInput
          placeholder="Enter text"
          disabled={true}
          data-testid="custom-input"
        />
      )

      const textarea = screen.getByRole('textbox')

      expect(textarea).toHaveAttribute('placeholder', 'Enter text')
      expect(textarea).toBeDisabled()
      expect(textarea).toHaveAttribute('data-testid', 'custom-input')
    })
  })
})
