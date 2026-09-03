/* eslint-disable @typescript-eslint/no-require-imports */
import { Schedule } from '@/prisma/enums'

import ScheduleSelect from './ScheduleSelect'

import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/prisma/enums', () => ({
  Schedule: {
    never: 'never',
    minutely: 'minutely',
    quarterhourly: 'quarterhourly',
    halfhourly: 'halfhourly',
    hourly: 'hourly',
    daily: 'daily',
    weekly: 'weekly',
    monthly: 'monthly',
  },
}))

jest.mock('@/hooks/usePopup', () => {
  const openPopup = jest.fn()
  const closePopup = jest.fn()

  function MockUsePopup() {
    return {
      popup: null,
      openPopup,
      closePopup,
    }
  }

  MockUsePopup._openPopup = openPopup
  MockUsePopup._closePopup = closePopup

  return MockUsePopup
})

jest.mock('@/hooks/useMagicDialog', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    dialog: null,
    open: jest.fn(),
  })),
}))

jest.mock('react-icons/bi', () => ({
  BiLinkExternal: (props) => <svg data-testid="link-icon" {...props} />,
}))

const useMagicDialog = require('@/hooks/useMagicDialog').default
const usePopup = require('@/hooks/usePopup')

describe('ScheduleSelect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('basic functionality', () => {
    it('should render select with default value', () => {
      render(<ScheduleSelect defaultValue="daily" />)

      const select = screen.getByRole('combobox')

      expect(select).toBeInTheDocument()
      expect(select).toHaveValue('daily')
    })

    it('should render select with never as default when no value provided', () => {
      render(<ScheduleSelect />)

      const select = screen.getByRole('combobox')

      expect(select).toHaveValue('never')
    })

    it('should render all schedule options', () => {
      render(<ScheduleSelect />)

      const options = screen.getAllByRole('option')

      expect(options).toHaveLength(Object.keys(Schedule).length)

      Object.keys(Schedule).forEach((schedule) => {
        expect(
          screen.getByRole('option', { name: schedule.replace(/_/g, ' ') })
        ).toBeInTheDocument()
      })
    })

    it('should format option labels with spaces', () => {
      render(<ScheduleSelect />)

      expect(screen.getByRole('option', { name: 'never' })).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: 'quarterhourly' })
      ).toBeInTheDocument()
    })
  })

  describe('controlled state', () => {
    it('should work as controlled component', () => {
      const setValue = jest.fn()
      const { rerender } = render(
        <ScheduleSelect value="daily" setValue={setValue} />
      )

      const select = screen.getByRole('combobox')

      expect(select).toHaveValue('daily')

      fireEvent.change(select, { target: { value: 'weekly' } })
      expect(setValue).toHaveBeenCalledWith('weekly')

      rerender(<ScheduleSelect value="weekly" setValue={setValue} />)
      expect(select).toHaveValue('weekly')
    })

    it('should work as uncontrolled component', () => {
      render(<ScheduleSelect defaultValue="daily" />)

      const select = screen.getByRole('combobox')

      fireEvent.change(select, { target: { value: 'weekly' } })

      expect(select).toHaveValue('weekly')
    })
  })

  describe('fair mode', () => {
    it('should filter high-frequency schedules when fair=true', () => {
      render(<ScheduleSelect fair={true} />)

      const options = screen.getAllByRole('option')

      const optionValues = options.map((opt) => opt.value)

      expect(optionValues).not.toContain('quarterhourly')
      expect(optionValues).not.toContain('halfhourly')
      expect(optionValues).not.toContain('hourly')

      expect(optionValues).toContain('daily')
      expect(optionValues).toContain('weekly')
      expect(optionValues).toContain('monthly')
    })

    it('should show all schedules when fair=false', () => {
      render(<ScheduleSelect fair={false} />)

      const options = screen.getAllByRole('option')

      expect(options).toHaveLength(Object.keys(Schedule).length)

      const optionValues = options.map((opt) => opt.value)

      expect(optionValues).toContain('quarterhourly')
      expect(optionValues).toContain('halfhourly')
      expect(optionValues).toContain('hourly')
    })

    it('should show all schedules by default', () => {
      render(<ScheduleSelect />)

      const options = screen.getAllByRole('option')

      expect(options).toHaveLength(Object.keys(Schedule).length)
    })

    it('should keep current high-frequency value visible in fair mode', () => {
      render(<ScheduleSelect fair defaultValue="hourly" />)

      const select = screen.getByRole('combobox')

      expect(select).toHaveValue('hourly')

      const optionValues = screen.getAllByRole('option').map((opt) => opt.value)

      expect(optionValues).toContain('hourly')
      expect(optionValues).not.toContain('quarterhourly')
    })
  })

  describe('custom schedule display', () => {
    it('should switch to read-only input when custom cron value provided', () => {
      render(<ScheduleSelect defaultValue="0 0 * * *" />)

      const input = screen.getByRole('textbox')

      expect(input).toBeInTheDocument()
      expect(input).toHaveValue('0 0 * * *')
      expect(input).toHaveAttribute('readOnly')
    })

    it('should stay as select for predefined schedule values', () => {
      render(<ScheduleSelect defaultValue="daily" />)

      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('should not have a custom option in the dropdown', () => {
      render(<ScheduleSelect defaultValue="daily" allowCustom />)

      const options = screen.getAllByRole('option')

      expect(options).toHaveLength(Object.keys(Schedule).length)

      const optionValues = options.map((opt) => opt.value)

      expect(optionValues).not.toContain('__custom__')
    })
  })

  describe('allowCustom button', () => {
    it('should NOT show sparkles icon when allowCustom=false', () => {
      render(<ScheduleSelect defaultValue="daily" />)

      expect(
        screen.queryByRole('button', { name: 'Custom schedule' })
      ).not.toBeInTheDocument()
    })

    it('should show sparkles icon when allowCustom=true', () => {
      render(<ScheduleSelect defaultValue="daily" allowCustom />)

      expect(
        screen.getByRole('button', { name: 'Custom schedule' })
      ).toBeInTheDocument()
    })

    it('should show custom schedule button when custom value with allowCustom', () => {
      render(<ScheduleSelect defaultValue="0 0 * * *" allowCustom />)

      expect(
        screen.getByRole('button', { name: 'Custom schedule' })
      ).toBeInTheDocument()
    })

    it('should NOT show custom schedule button when allowCustom is not set', () => {
      render(<ScheduleSelect defaultValue="0 0 * * *" />)

      expect(
        screen.queryByRole('button', { name: 'Custom schedule' })
      ).not.toBeInTheDocument()
    })
  })

  describe('preset restoration', () => {
    it('should NOT show standalone presets button', () => {
      render(<ScheduleSelect defaultValue="0 0 * * *" allowCustom />)

      // presets action is inside the popup, not a standalone button
      expect(
        screen.queryByRole('button', { name: 'Use preset' })
      ).not.toBeInTheDocument()
    })
  })

  describe('controlled component transitions', () => {
    it('should transition from preset to custom when value changes externally', () => {
      const setValue = jest.fn()
      const { rerender } = render(
        <ScheduleSelect value="daily" setValue={setValue} allowCustom />
      )

      expect(screen.getByRole('combobox')).toBeInTheDocument()

      rerender(
        <ScheduleSelect value="0 0 * * *" setValue={setValue} allowCustom />
      )

      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toHaveValue('0 0 * * *')
    })

    it('should transition from custom to preset when value changes externally', () => {
      const setValue = jest.fn()
      const { rerender } = render(
        <ScheduleSelect value="0 0 * * *" setValue={setValue} allowCustom />
      )

      expect(screen.getByRole('textbox')).toBeInTheDocument()

      rerender(
        <ScheduleSelect value="weekly" setValue={setValue} allowCustom />
      )

      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(screen.getByRole('combobox')).toHaveValue('weekly')
    })
  })

  describe('debouncing', () => {
    it('should debounce value changes', () => {
      render(<ScheduleSelect defaultValue="daily" />)

      const select = screen.getByRole('combobox')

      fireEvent.change(select, { target: { value: 'weekly' } })
      fireEvent.change(select, { target: { value: 'monthly' } })

      expect(screen.getByRole('combobox')).toBeInTheDocument()

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })
  })

  describe('props spreading', () => {
    it('should spread additional props to select', () => {
      render(
        <ScheduleSelect
          defaultValue="daily"
          className="custom-class"
          data-testid="schedule-select"
        />
      )

      const select = screen.getByRole('combobox')

      expect(select).toHaveClass('custom-class')
      expect(select).toHaveAttribute('data-testid', 'schedule-select')
    })

    it('should spread additional props to input when custom', () => {
      render(
        <ScheduleSelect
          defaultValue="0 0 * * *"
          className="custom-class"
          data-testid="schedule-input"
        />
      )

      const input = screen.getByRole('textbox')

      expect(input).toHaveClass('custom-class')
      expect(input).toHaveAttribute('data-testid', 'schedule-input')
    })

    it('should handle disabled prop on select', () => {
      render(<ScheduleSelect defaultValue="daily" disabled />)

      const select = screen.getByRole('combobox')

      expect(select).toBeDisabled()
    })

    it('should handle disabled prop on input in custom mode', () => {
      render(<ScheduleSelect defaultValue="0 0 * * *" disabled />)

      const input = screen.getByRole('textbox')

      expect(input).toBeDisabled()
    })

    it('should handle disabled prop on custom schedule button', () => {
      render(<ScheduleSelect defaultValue="daily" allowCustom disabled />)

      const button = screen.getByRole('button', { name: 'Custom schedule' })

      expect(button).toBeDisabled()
    })
  })

  describe('magic dialog integration', () => {
    it('should initialize useMagicDialog with @schedule promptId', () => {
      render(<ScheduleSelect defaultValue="daily" allowCustom />)

      expect(useMagicDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          promptId: '@schedule',
          title: 'Generate Schedule',
        })
      )
    })
  })

  describe('fair mode with allowCustom', () => {
    it('should show sparkles button alongside filtered schedules', () => {
      render(<ScheduleSelect fair allowCustom />)

      const options = screen.getAllByRole('option')
      const optionValues = options.map((opt) => opt.value)

      expect(optionValues).not.toContain('quarterhourly')
      expect(optionValues).not.toContain('halfhourly')
      expect(optionValues).not.toContain('hourly')

      expect(
        screen.getByRole('button', { name: 'Custom schedule' })
      ).toBeInTheDocument()
    })
  })

  describe('popup interaction', () => {
    it('should call openPopup when clicking the custom schedule button', () => {
      render(<ScheduleSelect defaultValue="daily" allowCustom />)

      fireEvent.click(screen.getByRole('button', { name: 'Custom schedule' }))

      expect(usePopup._openPopup).toHaveBeenCalledTimes(1)
    })

    it('should call openPopup when clicking the read-only custom input', () => {
      render(<ScheduleSelect defaultValue="0 0 * * *" allowCustom />)

      fireEvent.click(screen.getByRole('textbox'))

      expect(usePopup._openPopup).toHaveBeenCalledTimes(1)
    })

    it('should NOT call openPopup when disabled', () => {
      render(<ScheduleSelect defaultValue="daily" allowCustom disabled />)

      fireEvent.click(screen.getByRole('button', { name: 'Custom schedule' }))

      expect(usePopup._openPopup).not.toHaveBeenCalled()
    })

    it('should include Use Presets action when value is custom', () => {
      render(<ScheduleSelect defaultValue="0 0 * * *" allowCustom />)

      fireEvent.click(screen.getByRole('button', { name: 'Custom schedule' }))

      const callArgs = usePopup._openPopup.mock.calls[0][1]

      expect(callArgs.actions).toHaveProperty('Use Presets')
      expect(callArgs.actions).toHaveProperty('Magic')
      expect(callArgs.actions).toHaveProperty('Apply')
    })

    it('should NOT include Use Presets action when value is a preset', () => {
      render(<ScheduleSelect defaultValue="daily" allowCustom />)

      fireEvent.click(screen.getByRole('button', { name: 'Custom schedule' }))

      const callArgs = usePopup._openPopup.mock.calls[0][1]

      expect(callArgs.actions).not.toHaveProperty('Use Presets')
      expect(callArgs.actions).toHaveProperty('Magic')
      expect(callArgs.actions).toHaveProperty('Apply')
    })
  })

  describe('edge cases', () => {
    it('should render select for empty string value', () => {
      render(<ScheduleSelect defaultValue="" />)

      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('should render select for null-like value', () => {
      render(<ScheduleSelect />)

      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(screen.getByRole('combobox')).toHaveValue('never')
    })
  })
})
