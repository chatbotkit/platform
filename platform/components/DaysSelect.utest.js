import DaysSelect from './DaysSelect'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

describe('DaysSelect', () => {
  describe('basic functionality', () => {
    it('should render select element', () => {
      render(<DaysSelect />)

      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('should render default option with automatic caption', () => {
      render(<DaysSelect />)

      expect(
        screen.getByRole('option', { name: 'automatic' })
      ).toBeInTheDocument()
    })

    it('should render all day options', () => {
      render(<DaysSelect />)

      expect(screen.getByRole('option', { name: '1 day' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '3 days' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '7 days' })).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: '14 days' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: '30 days' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: '60 days' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: '90 days' })
      ).toBeInTheDocument()
    })

    it('should have correct number of options', () => {
      render(<DaysSelect />)

      const options = screen.getAllByRole('option')

      expect(options).toHaveLength(8)
    })
  })

  describe('option values', () => {
    it('should have value 0 for default option', () => {
      render(<DaysSelect />)

      const defaultOption = screen.getByRole('option', { name: 'automatic' })

      expect(defaultOption).toHaveValue('0')
    })

    it('should have correct millisecond values for day options', () => {
      render(<DaysSelect />)

      expect(screen.getByRole('option', { name: '1 day' })).toHaveValue(
        String(1 * 24 * 60 * 60 * 1000)
      )
      expect(screen.getByRole('option', { name: '3 days' })).toHaveValue(
        String(3 * 24 * 60 * 60 * 1000)
      )
      expect(screen.getByRole('option', { name: '7 days' })).toHaveValue(
        String(7 * 24 * 60 * 60 * 1000)
      )
      expect(screen.getByRole('option', { name: '14 days' })).toHaveValue(
        String(14 * 24 * 60 * 60 * 1000)
      )
      expect(screen.getByRole('option', { name: '30 days' })).toHaveValue(
        String(30 * 24 * 60 * 60 * 1000)
      )
      expect(screen.getByRole('option', { name: '60 days' })).toHaveValue(
        String(60 * 24 * 60 * 60 * 1000)
      )
      expect(screen.getByRole('option', { name: '90 days' })).toHaveValue(
        String(90 * 24 * 60 * 60 * 1000)
      )
    })
  })

  describe('custom default caption', () => {
    it('should use custom default caption when provided', () => {
      render(<DaysSelect defaultCaption="custom default" />)

      expect(
        screen.getByRole('option', { name: 'custom default' })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('option', { name: 'automatic' })
      ).not.toBeInTheDocument()
    })

    it('should handle empty string as default caption', () => {
      render(<DaysSelect defaultCaption="" />)

      const options = screen.getAllByRole('option')

      expect(options[0]).toHaveTextContent('')
      expect(options[0]).toHaveValue('0')
    })

    it('should handle numeric default caption', () => {
      render(<DaysSelect defaultCaption="0" />)

      expect(screen.getByRole('option', { name: '0' })).toBeInTheDocument()
    })
  })

  describe('props spreading', () => {
    it('should spread additional props to select', () => {
      render(<DaysSelect data-testid="days-select" name="days" />)

      const select = screen.getByTestId('days-select')

      expect(select).toBeInTheDocument()
      expect(select).toHaveAttribute('name', 'days')
    })

    it('should accept className', () => {
      render(<DaysSelect className="custom-select" />)

      const select = screen.getByRole('combobox')

      expect(select).toHaveClass('custom-select')
    })

    it('should accept disabled prop', () => {
      render(<DaysSelect disabled />)

      expect(screen.getByRole('combobox')).toBeDisabled()
    })

    it('should accept required prop', () => {
      render(<DaysSelect required />)

      expect(screen.getByRole('combobox')).toBeRequired()
    })

    it('should accept aria attributes', () => {
      render(<DaysSelect aria-label="Select retention period" />)

      expect(screen.getByRole('combobox')).toHaveAttribute(
        'aria-label',
        'Select retention period'
      )
    })
  })

  describe('event handling', () => {
    it('should handle onChange events', () => {
      const handleChange = jest.fn()

      render(<DaysSelect onChange={handleChange} />)

      const select = screen.getByRole('combobox')

      fireEvent.change(select, {
        target: { value: String(7 * 24 * 60 * 60 * 1000) },
      })

      expect(handleChange).toHaveBeenCalledTimes(1)
    })

    it('should not throw without onChange handler', () => {
      render(<DaysSelect />)

      const select = screen.getByRole('combobox')

      expect(() => {
        fireEvent.change(select, {
          target: { value: String(1 * 24 * 60 * 60 * 1000) },
        })
      }).not.toThrow()
    })

    it('should trigger onChange with correct value', () => {
      const handleChange = jest.fn()

      render(<DaysSelect onChange={handleChange} />)

      const select = screen.getByRole('combobox')

      fireEvent.change(select, {
        target: { value: String(30 * 24 * 60 * 60 * 1000) },
      })

      expect(handleChange.mock.calls[0][0].target.value).toBe(
        String(30 * 24 * 60 * 60 * 1000)
      )
    })
  })

  describe('controlled component', () => {
    it('should work as controlled component with value prop', () => {
      render(
        <DaysSelect
          value={String(7 * 24 * 60 * 60 * 1000)}
          onChange={jest.fn()}
        />
      )

      const select = screen.getByRole('combobox')

      expect(select).toHaveValue(String(7 * 24 * 60 * 60 * 1000))
    })

    it('should update when value prop changes', () => {
      const { rerender } = render(
        <DaysSelect
          value={String(7 * 24 * 60 * 60 * 1000)}
          onChange={jest.fn()}
        />
      )

      let select = screen.getByRole('combobox')

      expect(select).toHaveValue(String(7 * 24 * 60 * 60 * 1000))

      rerender(
        <DaysSelect
          value={String(30 * 24 * 60 * 60 * 1000)}
          onChange={jest.fn()}
        />
      )

      select = screen.getByRole('combobox')

      expect(select).toHaveValue(String(30 * 24 * 60 * 60 * 1000))
    })
  })

  describe('uncontrolled component', () => {
    it('should work as uncontrolled with defaultValue', () => {
      render(<DaysSelect defaultValue={String(14 * 24 * 60 * 60 * 1000)} />)

      const select = screen.getByRole('combobox')

      expect(select).toHaveValue(String(14 * 24 * 60 * 60 * 1000))
    })

    it('should allow user to change value when uncontrolled', () => {
      render(<DaysSelect defaultValue="0" />)

      const select = screen.getByRole('combobox')

      fireEvent.change(select, {
        target: { value: String(60 * 24 * 60 * 60 * 1000) },
      })

      expect(select).toHaveValue(String(60 * 24 * 60 * 60 * 1000))
    })
  })

  describe('pluralization', () => {
    it('should use singular day for 1 day', () => {
      render(<DaysSelect />)

      expect(screen.getByRole('option', { name: '1 day' })).toBeInTheDocument()
      expect(
        screen.queryByRole('option', { name: '1 days' })
      ).not.toBeInTheDocument()
    })

    it('should use plural days for multiple days', () => {
      render(<DaysSelect />)

      expect(screen.getByRole('option', { name: '3 days' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '7 days' })).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: '90 days' })
      ).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have proper select role', () => {
      render(<DaysSelect />)

      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('should be keyboard accessible', () => {
      render(<DaysSelect />)

      const select = screen.getByRole('combobox')

      select.focus()

      expect(select).toHaveFocus()
    })

    it('should support aria-labelledby', () => {
      render(
        <>
          <label id="days-label">Retention Period</label>
          <DaysSelect aria-labelledby="days-label" />
        </>
      )

      expect(screen.getByRole('combobox')).toHaveAttribute(
        'aria-labelledby',
        'days-label'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle defaultCaption with special characters', () => {
      render(<DaysSelect defaultCaption="<auto>" />)

      expect(screen.getByRole('option', { name: '<auto>' })).toBeInTheDocument()
    })

    it('should handle form integration', () => {
      render(
        <form data-testid="form">
          <DaysSelect name="retention" />
        </form>
      )

      const form = screen.getByTestId('form')
      const select = screen.getByRole('combobox')

      expect(select).toHaveAttribute('name', 'retention')
      expect(form).toContainElement(select)
    })
  })
})
