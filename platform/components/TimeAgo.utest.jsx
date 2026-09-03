import { getShortDateTime, timeAgo } from '@chatbotkit-dev/time'

import TimeAgo from './TimeAgo'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@chatbotkit-dev/time', () => ({
  getShortDateTime: jest.fn((time) => `2024-01-15 10:30 AM`),
  timeAgo: jest.fn((time) => '2 hours ago'),
}))

jest.mock('@/components/TooltipButton', () => {
  return function TooltipButton({
    children,
    tooltip,
    as: Component = 'div',
    _transitionStyles,
    ...props
  }) {
    return (
      <Component {...props} data-tooltip={tooltip ? 'has-tooltip' : undefined}>
        {children}
      </Component>
    )
  }
})

describe('TimeAgo', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render time element', () => {
      render(<TimeAgo time="2024-01-15T10:30:00Z" />)

      const timeElement = screen.getByText('2 hours ago')

      expect(timeElement.tagName).toBe('TIME')
    })

    it('should call timeAgo with provided time', () => {
      const testTime = '2024-01-15T10:30:00Z'

      render(<TimeAgo time={testTime} />)
      expect(timeAgo).toHaveBeenCalledWith(testTime)
    })

    it('should display formatted time from timeAgo function', () => {
      render(<TimeAgo time="2024-01-15T10:30:00Z" />)
      expect(screen.getByText('2 hours ago')).toBeInTheDocument()
    })

    it('should have dateTime attribute in ISO format', () => {
      const testTime = '2024-01-15T10:30:00Z'

      render(<TimeAgo time={testTime} />)

      const timeElement = screen.getByText('2 hours ago')

      expect(timeElement).toHaveAttribute(
        'dateTime',
        new Date(testTime).toISOString()
      )
    })
  })

  describe('tooltip functionality', () => {
    it('should show tooltip by default', () => {
      const { container } = render(<TimeAgo time="2024-01-15T10:30:00Z" />)
      const wrapper = container.querySelector('[data-tooltip="has-tooltip"]')

      expect(wrapper).toBeInTheDocument()
    })

    it('should call getShortDateTime for tooltip content', () => {
      const testTime = '2024-01-15T10:30:00Z'

      render(<TimeAgo time={testTime} />)
      expect(getShortDateTime).toHaveBeenCalledWith(testTime)
    })

    it('should not show tooltip when tooltip prop is false', () => {
      const { container } = render(
        <TimeAgo time="2024-01-15T10:30:00Z" tooltip={false} />
      )
      const wrapper = container.querySelector('[data-tooltip="has-tooltip"]')

      expect(wrapper).not.toBeInTheDocument()
    })

    it('should show tooltip when tooltip prop is explicitly true', () => {
      const { container } = render(
        <TimeAgo time="2024-01-15T10:30:00Z" tooltip={true} />
      )
      const wrapper = container.querySelector('[data-tooltip="has-tooltip"]')

      expect(wrapper).toBeInTheDocument()
    })
  })

  describe('props forwarding', () => {
    it('should forward additional props to TooltipButton', () => {
      const { container } = render(
        <TimeAgo
          time="2024-01-15T10:30:00Z"
          data-testid="time-ago-test"
          className="custom-time"
        />
      )
      const wrapper = container.firstChild

      expect(wrapper).toHaveAttribute('data-testid', 'time-ago-test')
      expect(wrapper).toHaveClass('custom-time')
    })
  })

  describe('different time formats', () => {
    it('should handle ISO date string', () => {
      const isoDate = '2024-01-15T10:30:00.000Z'

      render(<TimeAgo time={isoDate} />)
      expect(timeAgo).toHaveBeenCalledWith(isoDate)
      expect(screen.getByText('2 hours ago')).toBeInTheDocument()
    })

    it('should handle timestamp number', () => {
      const timestamp = 1705318200000

      render(<TimeAgo time={timestamp} />)
      expect(timeAgo).toHaveBeenCalledWith(timestamp)
      expect(screen.getByText('2 hours ago')).toBeInTheDocument()
    })

    it('should handle date object', () => {
      const dateObj = new Date('2024-01-15T10:30:00Z')

      render(<TimeAgo time={dateObj} />)
      expect(timeAgo).toHaveBeenCalledWith(dateObj)
      expect(screen.getByText('2 hours ago')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle very old dates', () => {
      timeAgo.mockReturnValueOnce('2 years ago')
      render(<TimeAgo time="2022-01-15T10:30:00Z" />)
      expect(screen.getByText('2 years ago')).toBeInTheDocument()
    })

    it('should handle recent times', () => {
      timeAgo.mockReturnValueOnce('just now')
      render(<TimeAgo time={new Date().toISOString()} />)
      expect(screen.getByText('just now')).toBeInTheDocument()
    })

    it('should handle future dates', () => {
      timeAgo.mockReturnValueOnce('in 5 minutes')

      const futureDate = new Date(Date.now() + 5 * 60 * 1000).toISOString()

      render(<TimeAgo time={futureDate} />)
      expect(screen.getByText('in 5 minutes')).toBeInTheDocument()
    })
  })
})
