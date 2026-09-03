/* eslint-disable @typescript-eslint/no-require-imports */
import RecordInput from './RecordInput'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock(
  '@heroicons/react/24/outline/esm/SparklesIcon',
  () => ({
    __esModule: true,
    default: () => null,
  }),
  { virtual: true }
)

jest.mock('@/hooks/useMagicDialog', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/components/TokenAutoTextarea', () => ({
  __esModule: true,
  default: function MockTokenAutoTextarea({
    value,
    onChange,
    children,
    ...props
  }) {
    return (
      <div>
        <textarea
          value={value}
          onChange={onChange}
          data-testid="textarea"
          {...props}
        />
        {children}
      </div>
    )
  },
}))

const useMagicDialog = require('@/hooks/useMagicDialog').default

describe('RecordInput', () => {
  let mockOpen

  beforeEach(() => {
    jest.clearAllMocks()

    mockOpen = jest.fn()

    useMagicDialog.mockReturnValue({
      dialog: <div data-testid="magic-dialog">Dialog</div>,
      open: mockOpen,
    })
  })

  describe('basic rendering', () => {
    it('renders with default value', () => {
      render(<RecordInput />)
      expect(screen.getByTestId('textarea')).toHaveValue('')
    })

    it('renders with defaultValue prop', () => {
      render(<RecordInput defaultValue="initial text" />)
      expect(screen.getByTestId('textarea')).toHaveValue('initial text')
    })

    it('renders with value prop', () => {
      render(<RecordInput value="controlled value" />)
      expect(screen.getByTestId('textarea')).toHaveValue('controlled value')
    })

    it('applies custom className', () => {
      render(<RecordInput className="custom-class" />)
      expect(screen.getByTestId('textarea')).toHaveClass('custom-class')
    })

    it('renders magic button', () => {
      render(<RecordInput />)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('renders magic dialog', () => {
      render(<RecordInput />)
      expect(screen.getByTestId('magic-dialog')).toBeInTheDocument()
    })
  })

  describe('controlled mode', () => {
    it('updates when value prop changes', () => {
      const { rerender } = render(<RecordInput value="first" />)

      expect(screen.getByTestId('textarea')).toHaveValue('first')

      rerender(<RecordInput value="second" />)
      expect(screen.getByTestId('textarea')).toHaveValue('second')
    })

    it('does not update when value is undefined', () => {
      const { rerender } = render(<RecordInput value="first" />)

      expect(screen.getByTestId('textarea')).toHaveValue('first')

      rerender(<RecordInput value={undefined} />)
      expect(screen.getByTestId('textarea')).toHaveValue('first')
    })

    it('handles value changing from defined to undefined', () => {
      const { rerender } = render(<RecordInput value="text" />)

      rerender(<RecordInput />)
      expect(screen.getByTestId('textarea')).toHaveValue('text')
    })
  })

  describe('onChange handler', () => {
    it('updates internal state on change', () => {
      render(<RecordInput />)

      const textarea = screen.getByTestId('textarea')

      fireEvent.change(textarea, { target: { value: 'new text' } })

      expect(textarea).toHaveValue('new text')
    })

    it('calls onChange callback when provided', () => {
      const onChange = jest.fn()

      render(<RecordInput onChange={onChange} />)

      const textarea = screen.getByTestId('textarea')
      const event = { target: { value: 'test' } }

      fireEvent.change(textarea, event)

      expect(onChange).toHaveBeenCalledTimes(1)
    })

    it('does not crash when onChange is not provided', () => {
      render(<RecordInput />)

      const textarea = screen.getByTestId('textarea')

      expect(() => {
        fireEvent.change(textarea, { target: { value: 'test' } })
      }).not.toThrow()
    })
  })

  describe('magic button functionality', () => {
    it('opens magic dialog on button click', () => {
      render(<RecordInput value="initial text" />)

      const button = screen.getByRole('button')

      fireEvent.click(button)

      expect(mockOpen).toHaveBeenCalledWith({
        input: 'initial text',
        callback: expect.any(Function),
      })
    })

    it('prevents default and stops propagation on button click', () => {
      render(<RecordInput />)

      const button = screen.getByRole('button')

      const mockEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
      const preventDefaultSpy = jest.spyOn(mockEvent, 'preventDefault')
      const stopPropagationSpy = jest.spyOn(mockEvent, 'stopPropagation')

      button.dispatchEvent(mockEvent)

      expect(preventDefaultSpy).toHaveBeenCalled()
      expect(stopPropagationSpy).toHaveBeenCalled()
    })

    it('updates value via callback from magic dialog', () => {
      render(<RecordInput value="original" />)

      const button = screen.getByRole('button')

      fireEvent.click(button)

      const callbackArg = mockOpen.mock.calls[0][0].callback

      callbackArg('improved text')

      waitFor(() => {
        expect(screen.getByTestId('textarea')).toHaveValue('improved text')
      })
    })

    it('disables button when disabled prop is true', () => {
      render(<RecordInput disabled />)

      const button = screen.getByRole('button')

      expect(button).toBeDisabled()
    })

    it('does not disable button when disabled is false', () => {
      render(<RecordInput disabled={false} />)

      const button = screen.getByRole('button')

      expect(button).not.toBeDisabled()
    })
  })

  describe('useMagicDialog configuration', () => {
    it('configures magic dialog with correct props', () => {
      render(<RecordInput />)

      expect(useMagicDialog).toHaveBeenCalledWith({
        promptId: '@record',
        title: 'Record',
        children: expect.anything(),
        placeholder:
          'your initial record you want to improve goes here, i.e. there are...',
      })
    })
  })

  describe('props forwarding', () => {
    it('forwards additional props to TokenAutoTextarea', () => {
      render(<RecordInput placeholder="Enter record" maxLength={100} />)

      const textarea = screen.getByTestId('textarea')

      expect(textarea).toHaveAttribute('placeholder', 'Enter record')
      expect(textarea).toHaveAttribute('maxLength', '100')
    })

    it('forwards data attributes', () => {
      render(<RecordInput data-testid="custom-id" />)
      expect(screen.getByTestId('custom-id')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('handles empty value', () => {
      render(<RecordInput value="" />)
      expect(screen.getByTestId('textarea')).toHaveValue('')
    })

    it('handles null value', () => {
      render(<RecordInput value={null} />)
      expect(screen.getByTestId('textarea')).toHaveValue('')
    })

    it('handles undefined value', () => {
      render(<RecordInput value={undefined} />)
      expect(screen.getByTestId('textarea')).toHaveValue('')
    })

    it('opens dialog with empty string when value is empty', () => {
      render(<RecordInput value="" />)

      const button = screen.getByRole('button')

      fireEvent.click(button)

      expect(mockOpen).toHaveBeenCalledWith({
        input: '',
        callback: expect.any(Function),
      })
    })
  })

  describe('button type attribute', () => {
    it('renders button with type="button"', () => {
      render(<RecordInput />)
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
    })
  })

  describe('state synchronization', () => {
    it('synchronizes internal state with controlled value', () => {
      const { rerender } = render(<RecordInput value="first" />)

      fireEvent.change(screen.getByTestId('textarea'), {
        target: { value: 'manual edit' },
      })

      rerender(<RecordInput value="second" />)

      expect(screen.getByTestId('textarea')).toHaveValue('second')
    })

    it('preserves user input in uncontrolled mode', () => {
      render(<RecordInput defaultValue="initial" />)

      const textarea = screen.getByTestId('textarea')

      fireEvent.change(textarea, { target: { value: 'user typed' } })

      expect(textarea).toHaveValue('user typed')
    })
  })
})
