import type { JSX } from 'react'
import { useMemo } from 'react'

import { LineChart } from '@tremor/react'
import type { CustomTooltipProps } from '@tremor/react'

import { getDisplayFormatter } from '@/lib/number'

/**
 * Renders the tremor tooltip with a per-series formatter so each line can use
 * its own `display` format (e.g. one series in currency, another as a percent),
 * which the shared y-axis `valueFormatter` cannot express.
 */
function DailyChartTooltip({
  payload,
  active,
  formatters,
}: CustomTooltipProps & {
  formatters: Record<string, (value: number) => string>
}): JSX.Element | null {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white text-xs shadow-md dark:border-gray-800 dark:bg-gray-950">
      {payload.map((item, index) => {
        const category = String(item.dataKey ?? item.name ?? '')
        const format = formatters[category] ?? ((value: number) => String(value))

        return (
          <div
            key={`${category}-${index}`}
            className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 last:border-b-0 dark:border-gray-800"
          >
            <span className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-gray-500 dark:text-gray-400">
                {category}
              </span>
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-50">
              {format(Number(item.value))}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function DailyChart({
  title,
  data,
  formats,
}: {
  title?: string
  data: { date: string | Date; total: number }[]
  /** maps a series/category name to its `display` format token */
  formats?: Record<string, string>
}): JSX.Element | null {
  const extractedCategories = useMemo(() => {
    if (!data.length) {
      return []
    }

    const { date: _date, ...rest } = data[0]

    return Object.keys(rest)
  }, [data])

  // @note only opt into per-series formatting (and the custom tooltip) when a
  // caller actually provides formats, so existing callers keep tremor's default
  // tooltip and formatting untouched
  const hasFormats = !!formats && Object.keys(formats).length > 0

  const formattersByCategory = useMemo(() => {
    return Object.fromEntries(
      extractedCategories.map((category) => [
        category,
        getDisplayFormatter(formats?.[category]),
      ])
    )
  }, [extractedCategories, formats])

  // @note the y-axis has a single shared formatter, so only apply a specific
  // format when every series agrees on it; otherwise fall back to plain numbers
  const axisFormatter = useMemo(() => {
    if (!hasFormats) {
      return getDisplayFormatter('number')
    }

    const tokens = new Set(
      extractedCategories.map((category) => formats?.[category] ?? 'number')
    )

    return getDisplayFormatter(tokens.size === 1 ? [...tokens][0] : 'number')
  }, [hasFormats, extractedCategories, formats])

  const formattedData = useMemo(() => {
    return data.map(({ date, ...rest }) => {
      return {
        ...rest,

        date: new Date(date).getDate(),
      }
    })
  }, [data])

  return (
    <div className="flex-1 border border-gray-200 dark:border-gray-800 rounded-xl p-2">
      {title ? <h3 className="text-base font-semibold">{title}</h3> : null}
      <LineChart
        className="h-80 text-xs"
        data={formattedData}
        index="date"
        categories={extractedCategories}
        colors={['indigo', 'cyan', 'blue']}
        valueFormatter={(number) => axisFormatter(number)}
        customTooltip={
          hasFormats
            ? (props) => (
                <DailyChartTooltip
                  {...props}
                  formatters={formattersByCategory}
                />
              )
            : undefined
        }
        yAxisWidth={60}
      />
    </div>
  )
}
