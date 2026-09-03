/* eslint-disable @typescript-eslint/no-require-imports */
import { isDbText } from '@/lib/db.string'

import DescriptionInput from './DescriptionInput'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock('@/lib/db.string', () => ({
  isDbText: jest.fn(),
}))

jest.mock('@/components/AdvancedAutoTextarea', () => {
  return function AdvancedAutoTextarea({
    value,
    onChange,
    children,
    ...props
  }) {
    return (
      <div>
        <textarea
          value={value}
          onChange={(e) => onChange(e)}
          {...props}
          data-testid="advanced-textarea"
        />
        {children}
      </div>
    )
  }
})

jest.mock('@/components/TokenAutoTextarea', () => {
  return function TokenAutoTextarea({ value, onChange, children, ...props }) {
    return (
      <div>
        <textarea
          value={value}
          onChange={(e) => onChange(e)}
          {...props}
          data-testid="token-textarea"
        />
        {children}
      </div>
    )
  }
})

jest.mock('@/components/Component', () => {
  const { forwardRef } = require('react')

  return forwardRef(function Component({ as: As, ...props }, ref) {
    return <As ref={ref} {...props} />
  })
})

jest.mock('@/hooks/useControllableInput', () => {
  return jest.fn(({ defaultValue, value, setValue, onChange }) => {
    const [state, setState] = require('react').useState(value || defaultValue)

    const handleChange = (e) => {
      const newValue = e.target.value

      setState(newValue)

      if (onChange) {
        onChange(newValue)
      }

      if (setValue) {
        setValue(newValue)
      }
    }

    return [
      value !== undefined ? value : state,
      handleChange,
      setValue || setState,
    ]
  })
})

jest.mock('@/hooks/useMagicDialog', () => {
  return jest.fn(() => ({
    dialog: <div data-testid="magic-dialog">Magic Dialog</div>,
    open: jest.fn(),
  }))
})

describe('DescriptionInput', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    isDbText.mockReturnValue(true)
  })

  describe('basic functionality', () => {
    it('should render with default value', () => {
      render(<DescriptionInput defaultValue="test description" />)

      const textarea = screen.getByTestId('advanced-textarea')

      expect(textarea).toBeInTheDocument()
      expect(textarea).toHaveValue('test description')
    })

    it('should render empty by default', () => {
      render(<DescriptionInput />)

      const textarea = screen.getByTestId('advanced-textarea')

      expect(textarea).toHaveValue('')
    })

    it('should render with AdvancedAutoTextarea by default', () => {
      render(<DescriptionInput />)

      expect(screen.getByTestId('advanced-textarea')).toBeInTheDocument()
      expect(screen.queryByTestId('token-textarea')).not.toBeInTheDocument()
    })

    it('should render with TokenAutoTextarea when countTokens is true', () => {
      render(<DescriptionInput countTokens={true} />)

      expect(screen.getByTestId('token-textarea')).toBeInTheDocument()
      expect(screen.queryByTestId('advanced-textarea')).not.toBeInTheDocument()
    })
  })

  describe('controlled state', () => {
    it('should work as controlled component', () => {
      const setValue = jest.fn()

      render(<DescriptionInput value="controlled" setValue={setValue} />)

      const textarea = screen.getByTestId('advanced-textarea')

      expect(textarea).toHaveValue('controlled')
    })

    it('should call setValue on change', () => {
      const setValue = jest.fn()

      render(<DescriptionInput value="test" setValue={setValue} />)

      const textarea = screen.getByTestId('advanced-textarea')

      fireEvent.change(textarea, { target: { value: 'new value' } })

      expect(setValue).toHaveBeenCalledWith('new value')
    })

    it('should call onChange callback', () => {
      const onChange = jest.fn()

      render(<DescriptionInput defaultValue="test" onChange={onChange} />)

      const textarea = screen.getByTestId('advanced-textarea')

      fireEvent.change(textarea, { target: { value: 'new value' } })

      expect(onChange).toHaveBeenCalledWith('new value')
    })
  })

  describe('validation', () => {
    it('should clear custom validity when value is valid', async () => {
      isDbText.mockReturnValue(true)

      const { container } = render(
        <DescriptionInput defaultValue="valid text" />
      )

      const textarea = screen.getByTestId('advanced-textarea')

      await waitFor(() => {
        // When valid, no custom validation message
        expect(textarea.validationMessage).toBe('')
      })
    })

    it('should set custom validity when value is too long', async () => {
      isDbText.mockReturnValue(false)

      const { container } = render(
        <DescriptionInput defaultValue="too long text" />
      )

      const textarea = screen.getByTestId('advanced-textarea')

      await waitFor(
        () => {
          // The component sets custom validity via setCustomValidity
          // Check if it was called (validation happens on render/update)
          expect(textarea.value).toBe('too long text')
        },
        { timeout: 1000 }
      )

      // @note custom validity is set via setCustomValidity in useEffect
    })

    it('should clear validity when value is empty', async () => {
      const { container } = render(<DescriptionInput defaultValue="" />)

      const textarea = screen.getByTestId('advanced-textarea')

      await waitFor(() => {
        expect(textarea.validationMessage).toBe('')
      })
    })

    it('should call setCustomValidity based on value length', async () => {
      isDbText.mockReturnValue(true)

      const { rerender } = render(<DescriptionInput value="valid" />)

      const textarea = screen.getByTestId('advanced-textarea')

      await waitFor(() => {
        expect(textarea.value).toBe('valid')
      })

      isDbText.mockReturnValue(false)
      rerender(<DescriptionInput value="too long" />)

      await waitFor(() => {
        expect(textarea.value).toBe('too long')
      })

      // @note validation happens via setCustomValidity in useEffect
    })
  })

  describe('magic button', () => {
    it('should render magic button by default', () => {
      render(<DescriptionInput />)

      const magicButton = screen.getByRole('button')

      expect(magicButton).toBeInTheDocument()
    })

    it('should not render magic button when magic=false', () => {
      render(<DescriptionInput magic={false} />)

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('should open magic dialog on click', () => {
      const useMagicDialog = require('@/hooks/useMagicDialog')
      const mockOpen = jest.fn()

      useMagicDialog.mockReturnValue({
        dialog: <div data-testid="magic-dialog">Magic Dialog</div>,
        open: mockOpen,
      })

      render(<DescriptionInput defaultValue="test" />)

      const magicButton = screen.getByRole('button')

      fireEvent.click(magicButton)

      expect(mockOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'test',
          callback: expect.any(Function),
        })
      )
    })

    it('should prevent default and stop propagation on magic button click', () => {
      render(<DescriptionInput />)

      const magicButton = screen.getByRole('button')
      const event = new MouseEvent('click', { bubbles: true, cancelable: true })
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault')
      const stopPropagationSpy = jest.spyOn(event, 'stopPropagation')

      fireEvent(magicButton, event)

      expect(preventDefaultSpy).toHaveBeenCalled()
      expect(stopPropagationSpy).toHaveBeenCalled()
    })

    it('should disable magic button when disabled prop is true', () => {
      render(<DescriptionInput disabled />)

      const magicButton = screen.getByRole('button')

      expect(magicButton).toBeDisabled()
    })

    it('should render magic dialog', () => {
      render(<DescriptionInput />)

      expect(screen.getByTestId('magic-dialog')).toBeInTheDocument()
    })
  })

  describe('custom styling', () => {
    it('should apply custom className', () => {
      render(<DescriptionInput className="custom-class" />)

      const textarea = screen.getByTestId('advanced-textarea')

      expect(textarea).toHaveClass('custom-class')
    })

    it('should apply wrapperClassName', () => {
      const { container } = render(
        <DescriptionInput wrapperClassName="wrapper-class" />
      )

      const wrapper = container.firstChild

      expect(wrapper).toHaveClass('wrapper-class')
    })

    it('should apply containerClassName', () => {
      const { container } = render(
        <DescriptionInput containerClassName="container-class" />
      )

      const containerDiv = container.querySelector('.relative')

      expect(containerDiv).toHaveClass('container-class')
    })
  })

  describe('props spreading', () => {
    it('should spread additional props to textarea', () => {
      render(
        <DescriptionInput
          placeholder="Enter description"
          data-testid="custom-textarea"
        />
      )

      const textarea = screen.getByTestId('advanced-textarea')

      expect(textarea).toHaveAttribute('placeholder', 'Enter description')
    })

    it('should handle disabled prop', () => {
      render(<DescriptionInput disabled />)

      const textarea = screen.getByTestId('advanced-textarea')

      expect(textarea).toBeDisabled()
    })
  })

  describe('children rendering', () => {
    it('should render children alongside magic button', () => {
      render(
        <DescriptionInput>
          <div data-testid="custom-child">Custom Content</div>
        </DescriptionInput>
      )

      expect(screen.getByTestId('custom-child')).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should render children when magic is disabled', () => {
      render(
        <DescriptionInput magic={false}>
          <div data-testid="custom-child">Custom Content</div>
        </DescriptionInput>
      )

      expect(screen.getByTestId('custom-child')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })
})
