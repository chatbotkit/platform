import UsageView, {
  LAST_90_DAYS_CAPTION,
  THIS_PERIOD_CAPTION,
  UsageCharts,
  UsageMetrics,
  UsagePeriod,
} from './UsageView'

import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/lib/number', () => ({
  shortFormat: (value) => `short:${value}`,
}))

jest.mock('@/lib/string', () => ({
  toPascalCase: (value) =>
    value.replace(/(^|[_/])([a-z])/g, (_, p1, p2) => p2.toUpperCase()),
}))

jest.mock('@/components/DailyChart', () => {
  return function DailyChart({ title }) {
    return <div data-testid={`chart-${title.toLowerCase()}`}>{title}</div>
  }
})

jest.mock('@/components/Expando', () => {
  return function Expando({ children, title }) {
    return (
      <section data-testid="expando">
        <h4>{title}</h4>
        {children}
      </section>
    )
  }
})

jest.mock('@/components/ProgressBar', () => {
  return function ProgressBar({ used, total }) {
    return (
      <div data-testid="progress-bar">
        {String(used)}:{String(total)}
      </div>
    )
  }
})

jest.mock('@/components/TimeAgo', () => {
  return function TimeAgo() {
    return <span data-testid="time-ago" />
  }
})

describe('UsageMetrics', () => {
  it('renders usage and other usage metrics with progress bars', () => {
    render(
      <UsageMetrics
        usage={{ tokens: { value: 12, ttl: 1_000 } }}
        otherUsage={{ 'models/gpt': 4 }}
        limits={{ tokens: 100, models: { gpt: 10 } }}
      />
    )

    expect(screen.getAllByTestId('progress-bar')).toHaveLength(2)
    expect(screen.getByTestId('expando')).toBeTruthy()
  })
})

describe('UsagePeriod', () => {
  it('renders the period range and reset time when a period is present', () => {
    render(
      <UsagePeriod
        usagePeriod={{
          start: Date.UTC(2026, 5, 8),
          end: Date.UTC(2026, 6, 9),
        }}
      />
    )

    expect(screen.getByText('Jun 8 – Jul 9')).toBeTruthy()
    expect(screen.getByTestId('time-ago')).toBeTruthy()
  })

  it('includes years when the period spans two years', () => {
    render(
      <UsagePeriod
        usagePeriod={{
          start: Date.UTC(2025, 11, 20),
          end: Date.UTC(2026, 0, 20),
        }}
      />
    )

    expect(screen.getByText('Dec 20, 2025 – Jan 20, 2026')).toBeTruthy()
  })

  it('explains the period when no usage has been recorded', () => {
    render(<UsagePeriod usagePeriod={null} />)

    expect(
      screen.getByText(/No usage recorded in the current period/)
    ).toBeTruthy()
  })
})

describe('UsageCharts', () => {
  it('defaults to last 90 days and renders available charts', () => {
    render(
      <UsageCharts
        usageSeries={{
          tokens: [{ x: 1, y: 1 }],
          conversations: [{ x: 1, y: 1 }],
          messages: [],
        }}
      />
    )

    expect(
      screen.getByRole('button', { name: LAST_90_DAYS_CAPTION })
    ).toBeTruthy()
    expect(screen.getByTestId('chart-tokens')).toBeTruthy()
    expect(screen.getByTestId('chart-conversations')).toBeTruthy()
    expect(screen.queryByTestId('chart-messages')).toBeNull()
  })

  it('switches period when this period is available', () => {
    render(
      <UsageCharts
        usageSeries={{
          tokens: [{ x: 1, y: 1 }],
          conversations: [],
          messages: [],
        }}
        usageSeriesThisPeriod={{
          tokens: [],
          conversations: [],
          messages: [{ x: 1, y: 2 }],
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: THIS_PERIOD_CAPTION }))
    expect(screen.getByTestId('chart-messages')).toBeTruthy()
    expect(screen.queryByTestId('chart-tokens')).toBeNull()
  })

  it('labels the period toggle with dates when a period is present', () => {
    render(
      <UsageCharts
        usageSeries={{
          tokens: [{ x: 1, y: 1 }],
          conversations: [],
          messages: [],
        }}
        usageSeriesThisPeriod={{
          tokens: [],
          conversations: [],
          messages: [{ x: 1, y: 2 }],
        }}
        usagePeriod={{
          start: Date.UTC(2026, 5, 8),
          end: Date.UTC(2026, 6, 9),
        }}
      />
    )

    expect(
      screen.queryByRole('button', { name: THIS_PERIOD_CAPTION })
    ).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Jun 8 – Jul 9' }))
    expect(screen.getByTestId('chart-messages')).toBeTruthy()
  })
})

describe('UsageView', () => {
  it('renders charts only when at least one usage series has data', () => {
    const { rerender } = render(
      <UsageView
        usageSeries={{ tokens: [], conversations: [], messages: [] }}
      />
    )

    expect(
      screen.queryByRole('button', { name: LAST_90_DAYS_CAPTION })
    ).toBeNull()

    rerender(
      <UsageView
        usageSeries={{
          tokens: [{ x: 1, y: 1 }],
          conversations: [],
          messages: [],
        }}
      />
    )

    expect(
      screen.getByRole('button', { name: LAST_90_DAYS_CAPTION })
    ).toBeTruthy()
  })

  it('renders the usage period line only when the prop is provided', () => {
    const { rerender } = render(
      <UsageView
        usageSeries={{ tokens: [], conversations: [], messages: [] }}
      />
    )

    expect(
      screen.queryByText(/No usage recorded in the current period/)
    ).toBeNull()

    rerender(
      <UsageView
        usageSeries={{ tokens: [], conversations: [], messages: [] }}
        usagePeriod={null}
      />
    )

    expect(
      screen.getByText(/No usage recorded in the current period/)
    ).toBeTruthy()
  })
})
