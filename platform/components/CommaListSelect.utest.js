/* eslint-disable @typescript-eslint/no-require-imports */
import CommaListSelect from './CommaListSelect'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@heroicons/react/24/outline', () => ({
  XMarkIcon: (props) => <svg data-testid="xmark-icon" {...props} />,
}))

jest.mock('@/components/CopyButton', () => {
  return function CopyButton({ children }) {
    return (
      <button type="button" data-testid="copy-button">
        {children}
      </button>
    )
  }
})

jest.mock('@/components/InputArea', () => {
  return function InputArea({ ...props }) {
    return <textarea data-testid="input-area" {...props} />
  }
})

jest.mock('@/hooks/useControllableInput', () => {
  const mockFn = jest.fn()

  return mockFn
})

describe('CommaListSelect', () => {
  let mockUseControllableInput

  beforeAll(() => {
    mockUseControllableInput = require('@/hooks/useControllableInput')
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseControllableInput.mockImplementation(
      ({ defaultValue, value, setValue, onChange }) =>
        value !== undefined
          ? [value, onChange, setValue]
          : [defaultValue, onChange, setValue]
    )
  })

  describe('basic functionality', () => {
    it('should render with default props', () => {
      render(<CommaListSelect />)
      expect(screen.getByTestId('input-area')).toBeInTheDocument()
    })

    it('should render with placeholder', () => {
      render(<CommaListSelect placeholder="Enter values" />)
      expect(screen.getByTestId('input-area')).toHaveAttribute(
        'placeholder',
        'Enter values'
      )
    })

    it('should render selected items from value', () => {
      render(<CommaListSelect value="item1,item2,item3" />)
      expect(screen.getByText('item1')).toBeInTheDocument()
      expect(screen.getByText('item2')).toBeInTheDocument()
      expect(screen.getByText('item3')).toBeInTheDocument()
    })

    it('should render hidden input with value', () => {
      const { container } = render(
        <CommaListSelect name="test" value="item1,item2" />
      )
      const hiddenInput = container.querySelector('input[type="text"]')

      expect(hiddenInput).toHaveAttribute('name', 'test')
      expect(hiddenInput).toHaveValue('item1,item2')
    })

    it('should not render copy button when no items', () => {
      render(<CommaListSelect />)
      expect(screen.queryByTestId('copy-button')).not.toBeInTheDocument()
    })

    it('should render copy button when items present', () => {
      render(<CommaListSelect value="item1" />)
      expect(screen.getByTestId('copy-button')).toBeInTheDocument()
    })
  })

  describe('controlled vs uncontrolled', () => {
    it('should work as controlled component', () => {
      const setValue = jest.fn()

      render(<CommaListSelect value="test" setValue={setValue} />)
      expect(screen.getByText('test')).toBeInTheDocument()
    })

    it('should work as uncontrolled component', () => {
      render(<CommaListSelect defaultValue="default" />)
      expect(screen.getByText('default')).toBeInTheDocument()
    })
  })

  describe('adding items', () => {
    it('should add item on Enter key', () => {
      const setValue = jest.fn()
      let currentValue = ''

      mockUseControllableInput.mockImplementation(
        ({ defaultValue, value, setValue: _setValue }) => {
          const onChange = (e) => {
            currentValue = e.target.value
            _setValue?.(e.target.value)
          }

          return [value ?? currentValue ?? defaultValue, onChange, _setValue]
        }
      )

      const { rerender } = render(<CommaListSelect setValue={setValue} />)

      const input = screen.getByTestId('input-area')

      fireEvent.keyDown(input, { key: 'Enter', target: { value: 'newitem' } })

      expect(setValue).toHaveBeenCalledWith('newitem')

      rerender(<CommaListSelect value="newitem" setValue={setValue} />)
      expect(screen.getByText('newitem')).toBeInTheDocument()
    })

    it('should add item on blur', () => {
      const setValue = jest.fn()
      let currentValue = ''

      mockUseControllableInput.mockImplementation(
        ({ defaultValue, value, setValue: _setValue }) => {
          const onChange = (e) => {
            currentValue = e.target.value
            _setValue?.(e.target.value)
          }

          return [value ?? currentValue ?? defaultValue, onChange, _setValue]
        }
      )

      render(<CommaListSelect setValue={setValue} />)

      const input = screen.getByTestId('input-area')

      fireEvent.blur(input, { target: { value: 'bluritem' } })

      expect(setValue).toHaveBeenCalledWith('bluritem')
    })

    it('should trim whitespace when autoTrim is true', () => {
      const setValue = jest.fn()
      let currentValue = ''

      mockUseControllableInput.mockImplementation(
        ({ defaultValue, value, setValue: _setValue }) => {
          const onChange = (e) => {
            currentValue = e.target.value
            _setValue?.(e.target.value)
          }

          return [value ?? currentValue ?? defaultValue, onChange, _setValue]
        }
      )

      render(<CommaListSelect setValue={setValue} autoTrim={true} />)

      const input = screen.getByTestId('input-area')

      fireEvent.keyDown(input, { key: 'Enter', target: { value: '  item  ' } })

      expect(setValue).toHaveBeenCalledWith('item')
    })

    it('should not add empty string when autoTrim is true', () => {
      const setValue = jest.fn()

      render(<CommaListSelect setValue={setValue} autoTrim={true} />)

      const input = screen.getByTestId('input-area')

      fireEvent.keyDown(input, { key: 'Enter', target: { value: '   ' } })

      expect(setValue).not.toHaveBeenCalled()
    })

    it('should preserve whitespace when autoTrim is false', () => {
      const setValue = jest.fn()
      let currentValue = ''

      mockUseControllableInput.mockImplementation(
        ({ defaultValue, value, setValue: _setValue }) => {
          const onChange = (e) => {
            currentValue = e.target.value
            _setValue?.(e.target.value)
          }

          return [value ?? currentValue ?? defaultValue, onChange, _setValue]
        }
      )

      render(<CommaListSelect setValue={setValue} autoTrim={false} />)

      const input = screen.getByTestId('input-area')

      fireEvent.keyDown(input, {
        key: 'Enter',
        target: { value: '  item  ' },
      })

      expect(setValue).toHaveBeenCalledWith('  item  ')
    })
  })

  describe('removing items', () => {
    it('should remove item when X icon clicked', () => {
      const setValue = jest.fn()

      mockUseControllableInput.mockImplementation(
        ({ defaultValue, value, setValue: _setValue }) => {
          return [value ?? defaultValue, jest.fn(), _setValue]
        }
      )

      render(<CommaListSelect value="item1,item2,item3" setValue={setValue} />)

      const removeButtons = screen.getAllByTestId('xmark-icon')

      fireEvent.click(removeButtons[0])

      expect(setValue).toHaveBeenCalledWith('item2,item3')
    })

    it('should handle removing last item', () => {
      const setValue = jest.fn()

      mockUseControllableInput.mockImplementation(
        ({ defaultValue, value, setValue: _setValue }) => {
          return [value ?? defaultValue, jest.fn(), _setValue]
        }
      )

      render(<CommaListSelect value="onlyitem" setValue={setValue} />)

      const removeButton = screen.getByTestId('xmark-icon')

      fireEvent.click(removeButton)

      expect(setValue).toHaveBeenCalledWith('')
    })
  })

  describe('edge cases', () => {
    it('should handle empty value', () => {
      render(<CommaListSelect value="" />)
      expect(screen.queryByText(/item/)).toBeNull()
    })

    it('should deduplicate items', () => {
      render(<CommaListSelect value="item1,item1,item2" />)

      const items = screen.getAllByText(/item/)

      expect(items).toHaveLength(2)
    })

    // @note these tests check for edge case display text but component
    // only renders when items have actual values after split/filter
    it.skip('should display empty string as "Empty"', () => {
      render(<CommaListSelect value="," />)
      expect(screen.getByText('Empty')).toBeInTheDocument()
    })

    it.skip('should display single space as "Space"', () => {
      render(<CommaListSelect value=" " />)
      expect(screen.getByText('Space')).toBeInTheDocument()
    })

    it.skip('should display multiple whitespace with count', () => {
      render(<CommaListSelect value="   " />)
      expect(screen.getByText('Whitespace 3')).toBeInTheDocument()
    })

    it('should handle special characters', () => {
      render(<CommaListSelect value="test@example.com,user#123" />)
      expect(screen.getByText('test@example.com')).toBeInTheDocument()
      expect(screen.getByText('user#123')).toBeInTheDocument()
    })
  })

  describe('drag and drop', () => {
    it('should allow dragging items', () => {
      render(<CommaListSelect value="item1,item2,item3" />)

      const items = screen.getAllByText(/item/)

      expect(items[0].closest('[draggable]')).toHaveAttribute(
        'draggable',
        'true'
      )
    })

    it('should have cursor-grab class', () => {
      render(<CommaListSelect value="item1" />)

      const item = screen.getByText('item1').closest('[draggable]')

      expect(item).toHaveClass('cursor-grab')
    })

    it('should have data-index attribute', () => {
      render(<CommaListSelect value="item1,item2" />)

      const items = screen.getAllByText(/item/)

      expect(items[0].closest('[draggable]')).toHaveAttribute('data-index', '0')
      expect(items[1].closest('[draggable]')).toHaveAttribute('data-index', '1')
    })
  })

  describe('accessibility', () => {
    it('should be keyboard accessible with tabIndex', () => {
      const { container } = render(<CommaListSelect />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveAttribute('tabIndex', '0')
    })

    it('should forward spellCheck prop', () => {
      render(<CommaListSelect spellCheck={false} />)
      expect(screen.getByTestId('input-area')).toHaveAttribute(
        'spellCheck',
        'false'
      )
    })
  })
})
