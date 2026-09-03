import { formatDuration } from '@chatbotkit-dev/time'

import DurationSelect from './DurationSelect'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@chatbotkit-dev/time', () => ({
  formatDuration: jest.fn((ms) => `${ms}ms formatted`),
}))

describe('DurationSelect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic rendering', () => {
    it('should render select element', () => {
      render(<DurationSelect />)

      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('should render default option', () => {
      render(<DurationSelect />)

      expect(
        screen.getByRole('option', { name: 'automatic' })
      ).toBeInTheDocument()
    })

    it('should render with custom defaultCaption', () => {
      render(<DurationSelect defaultCaption="no timeout" />)

      expect(
        screen.getByRole('option', { name: 'no timeout' })
      ).toBeInTheDocument()
    })
  })

  describe('minutes options', () => {
    it('should render default minutes options', () => {
      render(<DurationSelect />)

      expect(
        screen.getByRole('option', { name: '30 minutes' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: '45 minutes' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: '60 minutes' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: '90 minutes' })
      ).toBeInTheDocument()
    })

    it('should render custom minutes options', () => {
      render(<DurationSelect minutesOptions={[15, 30]} />)

      expect(
        screen.getByRole('option', { name: '15 minutes' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: '30 minutes' })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('option', { name: '45 minutes' })
      ).not.toBeInTheDocument()
    })

    it('should convert minutes to milliseconds correctly', () => {
      render(<DurationSelect minutesOptions={[30]} />)

      const option = screen.getByRole('option', { name: '30 minutes' })

      // 30 minutes = 30 * 60 * 1000 = 1800000 ms
      expect(option).toHaveValue('1800000')
    })
  })

  describe('hours options', () => {
    it('should render default hours options', () => {
      render(<DurationSelect />)

      expect(
        screen.getByRole('option', { name: '2 hours' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: '4 hours' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: '6 hours' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: '12 hours' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: '24 hours' })
      ).toBeInTheDocument()
    })

    it('should render custom hours options', () => {
      render(<DurationSelect hoursOptions={[1, 2]} />)

      expect(screen.getByRole('option', { name: '1 hour' })).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: '2 hours' })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('option', { name: '4 hours' })
      ).not.toBeInTheDocument()
    })

    it('should convert hours to milliseconds correctly', () => {
      render(<DurationSelect hoursOptions={[2]} />)

      const option = screen.getByRole('option', { name: '2 hours' })

      // 2 hours = 2 * 60 * 60 * 1000 = 7200000 ms
      expect(option).toHaveValue('7200000')
    })
  })

  describe('days options', () => {
    it('should render default days options', () => {
      render(<DurationSelect />)

      expect(screen.getByRole('option', { name: '2 days' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '3 days' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '4 days' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '5 days' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '6 days' })).toBeInTheDocument()
    })

    it('should render custom days options', () => {
      render(<DurationSelect daysOptions={[1, 2]} />)

      expect(screen.getByRole('option', { name: '1 day' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '2 days' })).toBeInTheDocument()
      expect(
        screen.queryByRole('option', { name: '3 days' })
      ).not.toBeInTheDocument()
    })

    it('should convert days to milliseconds correctly', () => {
      render(<DurationSelect daysOptions={[2]} />)

      const option = screen.getByRole('option', { name: '2 days' })

      // 2 days = 2 * 24 * 60 * 60 * 1000 = 172800000 ms
      expect(option).toHaveValue('172800000')
    })
  })

  describe('weeks options', () => {
    it('should render default weeks options', () => {
      render(<DurationSelect />)

      expect(screen.getByRole('option', { name: '1 week' })).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: '2 weeks' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: '3 weeks' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: '4 weeks' })
      ).toBeInTheDocument()
    })

    it('should render custom weeks options', () => {
      render(<DurationSelect weeksOptions={[2, 4]} />)

      expect(
        screen.getByRole('option', { name: '2 weeks' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: '4 weeks' })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('option', { name: '1 week' })
      ).not.toBeInTheDocument()
    })

    it('should convert weeks to milliseconds correctly', () => {
      render(<DurationSelect weeksOptions={[4]} />)

      const option = screen.getByRole('option', { name: '4 weeks' })

      // 4 weeks = 4 * 7 * 24 * 60 * 60 * 1000 = 2419200000 ms
      expect(option).toHaveValue('2419200000')
    })
  })

  describe('custom value handling', () => {
    it('should render custom value option when value not in predefined options', () => {
      formatDuration.mockReturnValue('5 minutes')
      render(<DurationSelect value={300000} />)

      expect(
        screen.getByRole('option', { name: '5 minutes' })
      ).toBeInTheDocument()
      expect(formatDuration).toHaveBeenCalledWith(300000)
    })

    it('should render custom defaultValue option', () => {
      formatDuration.mockReturnValue('3 seconds')
      render(<DurationSelect defaultValue={3000} />)

      expect(
        screen.getByRole('option', { name: '3 seconds' })
      ).toBeInTheDocument()
      expect(formatDuration).toHaveBeenCalledWith(3000)
    })

    it('should not render custom option when value matches predefined option', () => {
      formatDuration.mockReturnValue('2 days formatted')
      render(<DurationSelect value={172800000} daysOptions={[2]} />)

      expect(screen.getByRole('option', { name: '2 days' })).toBeInTheDocument()
      expect(
        screen.queryByRole('option', { name: '2 days formatted' })
      ).not.toBeInTheDocument()
    })

    it('should handle value of 0', () => {
      render(<DurationSelect value={0} />)

      const select = screen.getByRole('combobox')

      expect(select).toHaveValue('0')
    })

    it('should not render custom option for null value', () => {
      formatDuration.mockReturnValue('null formatted')
      render(<DurationSelect value={null} />)

      expect(
        screen.queryByRole('option', { name: 'null formatted' })
      ).not.toBeInTheDocument()
    })

    it('should not render custom option for undefined value', () => {
      formatDuration.mockReturnValue('undefined formatted')
      render(<DurationSelect value={undefined} />)

      expect(
        screen.queryByRole('option', { name: 'undefined formatted' })
      ).not.toBeInTheDocument()
    })
  })

  describe('controlled and uncontrolled modes', () => {
    it('should work in controlled mode with value prop', () => {
      const { rerender } = render(<DurationSelect value={1800000} />)

      const select = screen.getByRole('combobox')

      expect(select).toHaveValue('1800000')

      rerender(<DurationSelect value={3600000} />)
      expect(select).toHaveValue('3600000')
    })

    it('should prefer value over defaultValue', () => {
      render(<DurationSelect value={1800000} defaultValue={3600000} />)

      const select = screen.getByRole('combobox')

      expect(select).toHaveValue('1800000')
    })
  })

  describe('props forwarding', () => {
    it('should forward className to select', () => {
      render(<DurationSelect className="custom-class" />)

      const select = screen.getByRole('combobox')

      expect(select).toHaveClass('custom-class')
    })

    it('should forward disabled prop', () => {
      render(<DurationSelect disabled />)

      const select = screen.getByRole('combobox')

      expect(select).toBeDisabled()
    })

    it('should forward name prop', () => {
      render(<DurationSelect name="duration-field" />)

      const select = screen.getByRole('combobox')

      expect(select).toHaveAttribute('name', 'duration-field')
    })

    it('should forward id prop', () => {
      render(<DurationSelect id="duration-select" />)

      const select = screen.getByRole('combobox')

      expect(select).toHaveAttribute('id', 'duration-select')
    })

    it('should forward onChange handler', () => {
      const handleChange = jest.fn()

      render(<DurationSelect onChange={handleChange} />)

      const select = screen.getByRole('combobox')

      expect(select).toHaveProperty('onchange')
    })
  })

  describe('nullable mode', () => {
    it('uses data-type="number" and a 0-valued default option by default', () => {
      render(<DurationSelect />)

      const select = screen.getByRole('combobox')

      expect(select).toHaveAttribute('data-type', 'number')
      expect(screen.getByRole('option', { name: 'automatic' })).toHaveValue('0')
    })

    it('uses data-type="number-or-null" and an empty default option when nullable', () => {
      render(<DurationSelect nullable />)

      const select = screen.getByRole('combobox')

      expect(select).toHaveAttribute('data-type', 'number-or-null')
      expect(screen.getByRole('option', { name: 'automatic' })).toHaveValue('')
    })

    it('defaults to the empty automatic option when nullable with no value', () => {
      render(<DurationSelect nullable />)

      expect(screen.getByRole('combobox')).toHaveValue('')
    })

    it('renders a "no session" option with value 0 when nullable', () => {
      render(<DurationSelect nullable />)

      expect(screen.getByRole('option', { name: 'no session' })).toHaveValue(
        '0'
      )
    })

    it('does not render a "no session" option when not nullable', () => {
      render(<DurationSelect />)

      expect(
        screen.queryByRole('option', { name: 'no session' })
      ).not.toBeInTheDocument()
    })

    it('selects the "no session" option for a stored 0 when nullable', () => {
      render(<DurationSelect nullable value={0} />)

      expect(screen.getByRole('combobox')).toHaveValue('0')
    })

    it('shows the full session-duration option list as used on the integration pages', () => {
      // @note mirrors the props passed by the sessionDuration fields:
      // `nullable` + the explicit "1 day (default)" caption, with the default
      // minutes/hours/days/weeks option sets.
      render(<DurationSelect nullable defaultCaption="1 day (default)" />)

      const labels = screen
        .getAllByRole('option')
        .map((option) => option.textContent)

      expect(labels).toEqual([
        '1 day (default)',
        'no session',
        '30 minutes',
        '45 minutes',
        '60 minutes',
        '90 minutes',
        '2 hours',
        '4 hours',
        '6 hours',
        '12 hours',
        '24 hours',
        '2 days',
        '3 days',
        '4 days',
        '5 days',
        '6 days',
        '1 week',
        '2 weeks',
        '3 weeks',
        '4 weeks',
      ])

      // the two special options map to the values the form serializer expects
      expect(
        screen.getByRole('option', { name: '1 day (default)' })
      ).toHaveValue('')
      expect(screen.getByRole('option', { name: 'no session' })).toHaveValue(
        '0'
      )
    })
  })

  describe('edge cases', () => {
    it('filters every duration group at the configured maximum', () => {
      render(<DurationSelect maximum={3600000} />)

      const labels = screen
        .getAllByRole('option')
        .map((option) => option.textContent)

      expect(labels).toEqual([
        'automatic',
        '30 minutes',
        '45 minutes',
        '60 minutes',
      ])
    })

    it('can omit the no-session option for nullable automatic durations', () => {
      render(<DurationSelect nullable allowNoSession={false} />)

      expect(
        screen.queryByRole('option', { name: 'no session' })
      ).not.toBeInTheDocument()
    })

    it('should handle empty minutesOptions array', () => {
      render(<DurationSelect minutesOptions={[]} />)

      expect(
        screen.queryByRole('option', { name: /minutes/ })
      ).not.toBeInTheDocument()
    })

    it('should handle empty hoursOptions array', () => {
      render(<DurationSelect hoursOptions={[]} />)

      expect(
        screen.queryByRole('option', { name: /hours/ })
      ).not.toBeInTheDocument()
    })

    it('should handle empty daysOptions array', () => {
      render(<DurationSelect daysOptions={[]} />)

      expect(
        screen.queryByRole('option', { name: /days/ })
      ).not.toBeInTheDocument()
    })

    it('should handle empty weeksOptions array', () => {
      render(<DurationSelect weeksOptions={[]} />)

      expect(
        screen.queryByRole('option', { name: /weeks/ })
      ).not.toBeInTheDocument()
    })

    it('should handle both empty options arrays', () => {
      render(
        <DurationSelect
          minutesOptions={[]}
          hoursOptions={[]}
          daysOptions={[]}
          weeksOptions={[]}
        />
      )

      // Should only have the default option
      const options = screen.getAllByRole('option')

      expect(options).toHaveLength(1)
      expect(options[0]).toHaveTextContent('automatic')
    })

    it('should handle large duration values', () => {
      formatDuration.mockReturnValue('100 days')
      render(<DurationSelect value={8640000000} />)

      expect(
        screen.getByRole('option', { name: '100 days' })
      ).toBeInTheDocument()
    })

    it('should use correct keys for options', () => {
      const { container } = render(
        <DurationSelect
          minutesOptions={[30, 45]}
          hoursOptions={[1, 2]}
          daysOptions={[2, 3]}
          weeksOptions={[1, 2]}
        />
      )

      const minuteOptions = container.querySelectorAll(
        'option[value="1800000"]'
      )

      expect(minuteOptions).toHaveLength(1)

      const hourOptions = container.querySelectorAll('option[value="3600000"]')

      expect(hourOptions).toHaveLength(1)

      const dayOptions = container.querySelectorAll('option[value="172800000"]')

      expect(dayOptions).toHaveLength(1)

      const weekOptions = container.querySelectorAll(
        'option[value="604800000"]'
      )

      expect(weekOptions).toHaveLength(1)
    })
  })
})
