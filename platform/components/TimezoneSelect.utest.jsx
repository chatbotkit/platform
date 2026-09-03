/* eslint-disable @typescript-eslint/no-require-imports */
import TimezoneSelect from './TimezoneSelect'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/hooks/useDebounce', () => ({
  __esModule: true,
  default: (value) => value,
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

const usePopup = require('@/hooks/usePopup')

describe('TimezoneSelect', () => {
  const originalSupportedValuesOf = Intl.supportedValuesOf
  const originalDateTimeFormat = Intl.DateTimeFormat
  const originalToLocaleTimeString = Date.prototype.toLocaleTimeString

  beforeEach(() => {
    jest.clearAllMocks()

    Object.defineProperty(Intl, 'supportedValuesOf', {
      configurable: true,
      value: jest.fn(() => ['UTC', 'America/New_York', 'Asia/Tokyo']),
    })

    Object.defineProperty(Intl, 'DateTimeFormat', {
      configurable: true,
      value: jest.fn(() => ({
        resolvedOptions: () => ({ timeZone: 'America/New_York' }),
      })),
    })

    Date.prototype.toLocaleTimeString = jest.fn((locale, options) => {
      switch (options?.timeZone) {
        case 'America/New_York':
          return '9:30 AM GMT-4'
        case 'Asia/Tokyo':
          return '10:30 PM GMT+9'
        case 'UTC':
          return '1:30 PM GMT'
        case 'Africa/Abidjan':
          return '1:30 PM GMT'
        default:
          return '1:30 PM GMT+1'
      }
    })
  })

  afterAll(() => {
    Object.defineProperty(Intl, 'supportedValuesOf', {
      configurable: true,
      value: originalSupportedValuesOf,
    })

    Object.defineProperty(Intl, 'DateTimeFormat', {
      configurable: true,
      value: originalDateTimeFormat,
    })

    Date.prototype.toLocaleTimeString = originalToLocaleTimeString
  })

  it('renders a read-only input backed by a hidden form field', () => {
    const { container } = render(
      <TimezoneSelect defaultValue="UTC" name="timezone" />
    )

    const input = screen.getByRole('textbox')
    const hiddenInput = container.querySelector('input[type="hidden"]')

    expect(input).toHaveValue('UTC')
    expect(input).toHaveAttribute('readOnly')
    expect(hiddenInput).toHaveAttribute('name', 'timezone')
    expect(hiddenInput).toHaveValue('UTC')
  })

  it('opens a searchable popup and updates the timezone when selected', () => {
    render(<TimezoneSelect defaultValue="UTC" />)

    fireEvent.click(screen.getByRole('textbox'))

    expect(usePopup._openPopup).toHaveBeenCalledTimes(1)

    const popup = usePopup._openPopup.mock.calls[0][0]

    render(popup)

    expect(
      screen.getByText('Recommended', { selector: '.actions' })
    ).toBeInTheDocument()
    expect(screen.getByText('Current region')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'tokyo' },
    })

    expect(screen.getByText('Tokyo')).toBeInTheDocument()
    expect(screen.getByText('Asia')).toBeInTheDocument()
    expect(screen.queryByText('New York')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Tokyo'))

    expect(screen.getByRole('textbox')).toHaveValue('Asia/Tokyo')
    expect(usePopup._closePopup).toHaveBeenCalledTimes(1)
  })

  it('shows GMT+0 for zero-offset timezones returned without a sign', () => {
    Object.defineProperty(Intl, 'supportedValuesOf', {
      configurable: true,
      value: jest.fn(() => ['UTC', 'Africa/Abidjan']),
    })

    render(<TimezoneSelect defaultValue="UTC" />)

    fireEvent.click(screen.getByRole('textbox'))

    const popup = usePopup._openPopup.mock.calls[0][0]

    render(popup)

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'abidjan' },
    })

    expect(screen.getByText('Abidjan')).toBeInTheDocument()
    expect(screen.getByText('Africa')).toBeInTheDocument()
    expect(screen.getByText('GMT+0')).toBeInTheDocument()
  })
})
