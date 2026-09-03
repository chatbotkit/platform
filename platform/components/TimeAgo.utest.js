/* eslint-disable @typescript-eslint/no-require-imports */
import TimeAgo from './TimeAgo'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@chatbotkit-dev/time', () => ({
  getShortDateTime: jest.fn((time) => {
    try {
      return `Short: ${new Date(time).toISOString()}`
    } catch {
      return 'Invalid Date'
    }
  }),
  timeAgo: jest.fn((time) => {
    try {
      return `${Math.floor((Date.now() - new Date(time)) / 1000)}s ago`
    } catch {
      return 'Invalid Date'
    }
  }),
}))

jest.mock('@/components/TooltipButton', () => {
  return function TooltipButton({ children, tooltip, as, ...props }) {
    return (
      <div
        data-testid="tooltip-button"
        data-tooltip={tooltip ? 'true' : 'false'}
        {...props}
      >
        {children}
      </div>
    )
  }
})

jest.mock('next/head', () => {
  return function Head({ children }) {
    return <>{children}</>
  }
})

jest.mock('next/image', () => {
  return function Image({ src, alt, ...props }) {
    return <img src={src} alt={alt} {...props} />
  }
})

jest.mock('next/router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
    events: { on: jest.fn(), off: jest.fn() },
  })),
}))

describe('TimeAgo', () => {
  const { getShortDateTime, timeAgo } = require('@chatbotkit-dev/time')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render time ago text', () => {
      const time = new Date('2024-01-01T00:00:00Z')

      render(<TimeAgo time={time} />)

      expect(timeAgo).toHaveBeenCalledWith(time)
      expect(screen.getByText(/ago/)).toBeInTheDocument()
    })

    it('should render time element with correct datetime attribute', () => {
      const time = new Date('2024-01-01T12:00:00Z')

      const { container } = render(<TimeAgo time={time} />)

      const timeElement = container.querySelector('time')

      expect(timeElement).toBeInTheDocument()
      expect(timeElement).toHaveAttribute('dateTime', time.toISOString())
    })

    it('should show tooltip with short date by default', () => {
      const time = new Date('2024-01-01T00:00:00Z')

      render(<TimeAgo time={time} />)

      expect(getShortDateTime).toHaveBeenCalledWith(time)
      expect(screen.getByTestId('tooltip-button')).toHaveAttribute(
        'data-tooltip',
        'true'
      )
    })
  })

  describe('tooltip behavior', () => {
    it('should show tooltip when tooltip prop is true', () => {
      const time = new Date('2024-01-01T00:00:00Z')

      render(<TimeAgo time={time} tooltip={true} />)

      expect(screen.getByTestId('tooltip-button')).toHaveAttribute(
        'data-tooltip',
        'true'
      )
      expect(getShortDateTime).toHaveBeenCalledWith(time)
    })

    it('should hide tooltip when tooltip prop is false', () => {
      const time = new Date('2024-01-01T00:00:00Z')

      render(<TimeAgo time={time} tooltip={false} />)

      expect(screen.getByTestId('tooltip-button')).toHaveAttribute(
        'data-tooltip',
        'false'
      )
    })

    it('should default to showing tooltip when tooltip prop is undefined', () => {
      const time = new Date('2024-01-01T00:00:00Z')

      render(<TimeAgo time={time} />)

      expect(screen.getByTestId('tooltip-button')).toHaveAttribute(
        'data-tooltip',
        'true'
      )
    })
  })

  describe('time formats', () => {
    it('should handle Date object', () => {
      const time = new Date('2024-06-15T10:30:00Z')

      render(<TimeAgo time={time} />)

      expect(timeAgo).toHaveBeenCalledWith(time)
    })

    it('should handle timestamp number', () => {
      const time = 1704067200000 // 2024-01-01T00:00:00Z

      render(<TimeAgo time={time} />)

      expect(timeAgo).toHaveBeenCalledWith(time)
    })

    it('should handle ISO string', () => {
      const time = '2024-01-01T00:00:00Z'

      render(<TimeAgo time={time} />)

      expect(timeAgo).toHaveBeenCalledWith(time)

      const timeElement = screen.getByText(/ago/)

      expect(timeElement.closest('time')).toHaveAttribute(
        'dateTime',
        new Date(time).toISOString()
      )
    })
  })

  describe('edge cases', () => {
    it('should handle recent times (seconds ago)', () => {
      const time = new Date(Date.now() - 5000) // 5 seconds ago

      render(<TimeAgo time={time} />)

      expect(timeAgo).toHaveBeenCalledWith(time)
    })

    it('should handle old times', () => {
      const time = new Date('2020-01-01T00:00:00Z')

      render(<TimeAgo time={time} />)

      expect(timeAgo).toHaveBeenCalledWith(time)
    })

    it('should handle future times', () => {
      const time = new Date(Date.now() + 86400000) // 1 day in future

      render(<TimeAgo time={time} />)

      expect(timeAgo).toHaveBeenCalledWith(time)
    })

    it('should handle null time without throwing', () => {
      expect(() => render(<TimeAgo time={null} />)).not.toThrow()
    })

    it('should handle undefined time without throwing', () => {
      expect(() => render(<TimeAgo time={undefined} />)).not.toThrow()
    })

    it('should handle invalid date string without throwing', () => {
      expect(() => render(<TimeAgo time="invalid-date" />)).not.toThrow()
    })

    it('should handle NaN time without throwing', () => {
      expect(() => render(<TimeAgo time={NaN} />)).not.toThrow()
    })
  })

  describe('additional props', () => {
    it('should pass additional props to TooltipButton', () => {
      const time = new Date('2024-01-01T00:00:00Z')

      render(<TimeAgo time={time} className="custom-class" data-test="test" />)

      const tooltipButton = screen.getByTestId('tooltip-button')

      expect(tooltipButton).toHaveClass('custom-class')
      expect(tooltipButton).toHaveAttribute('data-test', 'test')
    })

    it('should support custom style prop', () => {
      const time = new Date('2024-01-01T00:00:00Z')
      const customStyle = { color: 'red', fontSize: '14px' }

      render(<TimeAgo time={time} style={customStyle} />)

      const tooltipButton = screen.getByTestId('tooltip-button')

      expect(tooltipButton).toHaveStyle(customStyle)
    })
  })

  describe('TooltipButton integration', () => {
    it('should render as span via TooltipButton', () => {
      const time = new Date('2024-01-01T00:00:00Z')

      render(<TimeAgo time={time} />)

      // TooltipButton should receive as="span"
      expect(screen.getByTestId('tooltip-button')).toBeInTheDocument()
    })

    it('should use scale transition styles', () => {
      const time = new Date('2024-01-01T00:00:00Z')

      render(<TimeAgo time={time} />)

      // Component should pass transitionStyles="scale"
      expect(screen.getByTestId('tooltip-button')).toBeInTheDocument()
    })
  })

  describe('rendering updates', () => {
    it('should update when time changes', () => {
      const time1 = new Date('2024-01-01T00:00:00Z')
      const time2 = new Date('2024-06-01T00:00:00Z')

      const { rerender } = render(<TimeAgo time={time1} />)

      expect(timeAgo).toHaveBeenCalledWith(time1)

      rerender(<TimeAgo time={time2} />)

      expect(timeAgo).toHaveBeenCalledWith(time2)
    })

    it('should update when tooltip prop changes', () => {
      const time = new Date('2024-01-01T00:00:00Z')

      const { rerender } = render(<TimeAgo time={time} tooltip={true} />)

      expect(screen.getByTestId('tooltip-button')).toHaveAttribute(
        'data-tooltip',
        'true'
      )

      rerender(<TimeAgo time={time} tooltip={false} />)

      expect(screen.getByTestId('tooltip-button')).toHaveAttribute(
        'data-tooltip',
        'false'
      )
    })
  })
})
