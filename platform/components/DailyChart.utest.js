import DailyChart from './DailyChart'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@tremor/react', () => ({
  LineChart: jest.fn(({ data, index, categories, colors, valueFormatter }) => (
    <div data-testid="line-chart">
      <div data-testid="chart-data">{JSON.stringify(data)}</div>
      <div data-testid="chart-index">{index}</div>
      <div data-testid="chart-categories">{JSON.stringify(categories)}</div>
      <div data-testid="chart-colors">{JSON.stringify(colors)}</div>
      <div data-testid="chart-formatter">{valueFormatter(1000)}</div>
    </div>
  )),
}))

describe('DailyChart', () => {
  describe('basic rendering', () => {
    it('should render with title', () => {
      const data = [{ date: '2024-01-01', total: 100 }]

      render(<DailyChart title="Test Chart" data={data} />)

      expect(screen.getByText('Test Chart')).toBeInTheDocument()
    })

    it('should render without title', () => {
      const data = [{ date: '2024-01-01', total: 100 }]

      render(<DailyChart title="" data={data} />)

      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    })

    it('should render LineChart component', () => {
      const data = [{ date: '2024-01-01', total: 100 }]

      render(<DailyChart title="Test Chart" data={data} />)

      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    })

    it('should apply correct CSS classes', () => {
      const data = [{ date: '2024-01-01', total: 100 }]

      const { container } = render(
        <DailyChart title="Test Chart" data={data} />
      )

      const wrapper = container.firstChild

      expect(wrapper).toHaveClass('flex-1')
      expect(wrapper).toHaveClass('border')
      expect(wrapper).toHaveClass('rounded-xl')
    })
  })

  describe('data formatting', () => {
    it('should convert date strings to date numbers', () => {
      const data = [
        { date: '2024-01-15', total: 100 },
        { date: '2024-01-20', total: 200 },
      ]

      render(<DailyChart title="Test" data={data} />)

      const chartData = JSON.parse(screen.getByTestId('chart-data').textContent)

      expect(chartData[0].date).toBe(15)
      expect(chartData[1].date).toBe(20)
    })

    it('should convert Date objects to date numbers', () => {
      const data = [
        { date: new Date('2024-01-15'), total: 100 },
        { date: new Date('2024-01-20'), total: 200 },
      ]

      render(<DailyChart title="Test" data={data} />)

      const chartData = JSON.parse(screen.getByTestId('chart-data').textContent)

      expect(chartData[0].date).toBe(15)
      expect(chartData[1].date).toBe(20)
    })

    it('should preserve other data fields', () => {
      const data = [{ date: '2024-01-15', total: 100, views: 50 }]

      render(<DailyChart title="Test" data={data} />)

      const chartData = JSON.parse(screen.getByTestId('chart-data').textContent)

      expect(chartData[0].total).toBe(100)
      expect(chartData[0].views).toBe(50)
    })

    it('should handle multiple data fields', () => {
      const data = [{ date: '2024-01-15', total: 100, views: 50, clicks: 25 }]

      render(<DailyChart title="Test" data={data} />)

      const chartData = JSON.parse(screen.getByTestId('chart-data').textContent)

      expect(chartData[0]).toEqual({
        date: 15,
        total: 100,
        views: 50,
        clicks: 25,
      })
    })
  })

  describe('category extraction', () => {
    it('should extract categories from first data item', () => {
      const data = [{ date: '2024-01-15', total: 100, views: 50 }]

      render(<DailyChart title="Test" data={data} />)

      const categories = JSON.parse(
        screen.getByTestId('chart-categories').textContent
      )

      expect(categories).toEqual(['total', 'views'])
    })

    it('should exclude date field from categories', () => {
      const data = [{ date: '2024-01-15', total: 100 }]

      render(<DailyChart title="Test" data={data} />)

      const categories = JSON.parse(
        screen.getByTestId('chart-categories').textContent
      )

      expect(categories).not.toContain('date')
    })

    it('should handle single category', () => {
      const data = [{ date: '2024-01-15', total: 100 }]

      render(<DailyChart title="Test" data={data} />)

      const categories = JSON.parse(
        screen.getByTestId('chart-categories').textContent
      )

      expect(categories).toEqual(['total'])
    })

    it('should handle multiple categories', () => {
      const data = [
        {
          date: '2024-01-15',
          total: 100,
          views: 50,
          clicks: 25,
          conversions: 10,
        },
      ]

      render(<DailyChart title="Test" data={data} />)

      const categories = JSON.parse(
        screen.getByTestId('chart-categories').textContent
      )

      expect(categories).toEqual(['total', 'views', 'clicks', 'conversions'])
    })
  })

  describe('chart configuration', () => {
    it('should set date as index', () => {
      const data = [{ date: '2024-01-15', total: 100 }]

      render(<DailyChart title="Test" data={data} />)

      expect(screen.getByTestId('chart-index')).toHaveTextContent('date')
    })

    it('should use predefined colors', () => {
      const data = [{ date: '2024-01-15', total: 100 }]

      render(<DailyChart title="Test" data={data} />)

      const colors = JSON.parse(screen.getByTestId('chart-colors').textContent)

      expect(colors).toEqual(['indigo', 'cyan', 'blue'])
    })

    it('should format numbers with comma separators', () => {
      const data = [{ date: '2024-01-15', total: 100 }]

      render(<DailyChart title="Test" data={data} />)

      const formatted = screen.getByTestId('chart-formatter').textContent

      expect(formatted).toBe('1,000')
    })
  })

  describe('edge cases', () => {
    it('should handle empty data array', () => {
      const { container } = render(<DailyChart title="Test" data={[]} />)

      expect(container.firstChild).toBeInTheDocument()
    })

    it('should return empty categories for empty data', () => {
      render(<DailyChart title="Test" data={[]} />)

      const categories = JSON.parse(
        screen.getByTestId('chart-categories').textContent
      )

      expect(categories).toEqual([])
    })

    it('should handle data with only date field', () => {
      const data = [{ date: '2024-01-15' }]

      render(<DailyChart title="Test" data={data} />)

      const categories = JSON.parse(
        screen.getByTestId('chart-categories').textContent
      )

      expect(categories).toEqual([])
    })

    it('should handle zero values', () => {
      const data = [{ date: '2024-01-15', total: 0 }]

      render(<DailyChart title="Test" data={data} />)

      const chartData = JSON.parse(screen.getByTestId('chart-data').textContent)

      expect(chartData[0].total).toBe(0)
    })

    it('should handle negative values', () => {
      const data = [{ date: '2024-01-15', total: -100 }]

      render(<DailyChart title="Test" data={data} />)

      const chartData = JSON.parse(screen.getByTestId('chart-data').textContent)

      expect(chartData[0].total).toBe(-100)
    })

    it('should handle null title', () => {
      const data = [{ date: '2024-01-15', total: 100 }]

      render(<DailyChart title={null} data={data} />)

      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    })

    it('should handle undefined title', () => {
      const data = [{ date: '2024-01-15', total: 100 }]

      render(<DailyChart title={undefined} data={data} />)

      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    })
  })

  describe('multiple data points', () => {
    it('should handle multiple data points', () => {
      const data = [
        { date: '2024-01-15', total: 100 },
        { date: '2024-01-16', total: 200 },
        { date: '2024-01-17', total: 150 },
      ]

      render(<DailyChart title="Test" data={data} />)

      const chartData = JSON.parse(screen.getByTestId('chart-data').textContent)

      expect(chartData).toHaveLength(3)
      expect(chartData[0].date).toBe(15)
      expect(chartData[1].date).toBe(16)
      expect(chartData[2].date).toBe(17)
    })

    it('should handle data from different months', () => {
      const data = [
        { date: '2024-01-31', total: 100 },
        { date: '2024-02-01', total: 200 },
      ]

      render(<DailyChart title="Test" data={data} />)

      const chartData = JSON.parse(screen.getByTestId('chart-data').textContent)

      expect(chartData[0].date).toBe(31)
      expect(chartData[1].date).toBe(1)
    })
  })

  describe('type safety', () => {
    it('should accept string dates', () => {
      const data = [{ date: '2024-01-15', total: 100 }]

      expect(() => {
        render(<DailyChart title="Test" data={data} />)
      }).not.toThrow()
    })

    it('should accept Date object dates', () => {
      const data = [{ date: new Date('2024-01-15'), total: 100 }]

      expect(() => {
        render(<DailyChart title="Test" data={data} />)
      }).not.toThrow()
    })
  })
})
