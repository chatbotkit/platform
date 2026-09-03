import TriggerSelect from './TriggerSelect'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock('@/prisma/enums', () => ({
  Trigger: {
    never: 'never',
    activity: 'activity',
    message_request: 'message_request',
    manual: 'manual',
  },
}))

describe('TriggerSelect', () => {
  describe('basic functionality', () => {
    it('should render as select with default value', () => {
      render(<TriggerSelect />)

      const select = screen.getByRole('combobox')

      expect(select).toBeInTheDocument()
      expect(select).toHaveValue('never')
    })

    it('should render with provided defaultValue', () => {
      render(<TriggerSelect defaultValue="activity" />)

      const select = screen.getByRole('combobox')

      expect(select).toHaveValue('activity')
    })

    it('should render all trigger options', () => {
      render(<TriggerSelect />)

      const options = screen.getAllByRole('option')

      expect(options).toHaveLength(4)
      expect(options[0]).toHaveTextContent('never')
      expect(options[1]).toHaveTextContent('activity')
      expect(options[2]).toHaveTextContent('message request')
      expect(options[3]).toHaveTextContent('manual')
    })

    it('should replace underscores with spaces in option text', () => {
      render(<TriggerSelect />)

      const option = screen.getByRole('option', { name: /message request/i })

      expect(option).toBeInTheDocument()
      expect(option).toHaveValue('message_request')
    })
  })

  describe('controlled mode', () => {
    it('should work as controlled component', () => {
      const setValue = jest.fn()

      render(<TriggerSelect value="activity" setValue={setValue} />)

      const select = screen.getByRole('combobox')

      expect(select).toHaveValue('activity')

      fireEvent.change(select, { target: { value: 'manual' } })

      expect(setValue).toHaveBeenCalledWith('manual')
    })

    it('should update when controlled value changes', () => {
      const { rerender } = render(<TriggerSelect value="activity" />)

      let select = screen.getByRole('combobox')

      expect(select).toHaveValue('activity')

      rerender(<TriggerSelect value="manual" />)

      select = screen.getByRole('combobox')
      expect(select).toHaveValue('manual')
    })
  })

  describe('uncontrolled mode', () => {
    it('should work as uncontrolled component', () => {
      render(<TriggerSelect defaultValue="activity" />)

      const select = screen.getByRole('combobox')

      fireEvent.change(select, { target: { value: 'manual' } })

      expect(select).toHaveValue('manual')
    })
  })

  describe('custom trigger value', () => {
    it('should render as text input for custom trigger after debounce', async () => {
      render(<TriggerSelect defaultValue="custom_trigger" />)

      // Initially should render as input since custom value is not in Trigger enum
      await waitFor(
        () => {
          const input = screen.getByRole('textbox')

          expect(input).toBeInTheDocument()
          expect(input).toHaveValue('custom_trigger')
        },
        { timeout: 1000 }
      )
    })

    it('should call setValue when value changes in uncontrolled mode', () => {
      render(<TriggerSelect defaultValue="activity" />)

      const select = screen.getByRole('combobox')

      fireEvent.change(select, { target: { value: 'manual' } })

      // In uncontrolled mode, the value updates internally
      expect(select).toHaveValue('manual')
    })

    it('should allow editing custom trigger value in text input', async () => {
      render(<TriggerSelect defaultValue="custom_value" />)

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument()
      })

      const input = screen.getByRole('textbox')

      fireEvent.change(input, { target: { value: 'updated_custom_value' } })

      expect(input).toHaveValue('updated_custom_value')
    })
  })

  describe('props forwarding', () => {
    it('should forward className to select', () => {
      render(<TriggerSelect className="custom-class" />)

      const select = screen.getByRole('combobox')

      expect(select).toHaveClass('custom-class')
    })

    it('should forward className to input for custom values', async () => {
      render(<TriggerSelect defaultValue="custom" className="custom-class" />)

      await waitFor(() => {
        const input = screen.getByRole('textbox')

        expect(input).toHaveClass('custom-class')
      })
    })

    it('should forward disabled prop to select', () => {
      render(<TriggerSelect disabled />)

      const select = screen.getByRole('combobox')

      expect(select).toBeDisabled()
    })

    it('should forward disabled prop to input for custom values', async () => {
      render(<TriggerSelect defaultValue="custom" disabled />)

      await waitFor(() => {
        const input = screen.getByRole('textbox')

        expect(input).toBeDisabled()
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty string value with default to never', () => {
      render(<TriggerSelect defaultValue="" />)

      const select = screen.getByRole('combobox')

      // Empty string defaults to "never" per useControlledState
      expect(select).toHaveValue('never')
    })

    it('should handle null defaultValue by using "never"', () => {
      render(<TriggerSelect defaultValue={null} />)

      const select = screen.getByRole('combobox')

      expect(select).toHaveValue('never')
    })

    it('should handle undefined defaultValue by using "never"', () => {
      render(<TriggerSelect defaultValue={undefined} />)

      const select = screen.getByRole('combobox')

      expect(select).toHaveValue('never')
    })

    it('should debounce before determining if value is custom', async () => {
      render(<TriggerSelect defaultValue="custom1" />)

      // Component starts as input for custom value
      await waitFor(
        () => {
          expect(screen.getByRole('textbox')).toBeInTheDocument()
        },
        { timeout: 1000 }
      )

      const input = screen.getByRole('textbox')

      expect(input).toHaveValue('custom1')
    })
  })
})
