'use client'

import { useCallback } from 'react'

import { shortFormat } from '@/lib/number'

import { useInfobarToggle } from '@/layouts/App'

import { LineChart } from '@tremor/react'

import clsx from 'clsx'

export function DailyChart({ title, data }) {
  data = data.map(({ date, total }) => {
    return {
      date: new Date(date).getDate(),
      total: total,
    }
  })

  return data.length ? (
    <div className="flex-1 border border-gray-200 dark:border-gray-800 rounded-xl p-2">
      <h3 className="text-base font-semibold">{title}</h3>
      <LineChart
        className="h-80 text-xs"
        data={data}
        index="date"
        categories={['total']}
        colors={['indigo']}
        valueFormatter={(number) =>
          `${Intl.NumberFormat('us').format(number).toString()}`
        }
        yAxisWidth={60}
      />
    </div>
  ) : null
}

export function MetricCard({
  title,
  description,

  value,
  change,

  dimension,
  period,

  details,

  className,

  ...props
}) {
  const { toggle, toRender } = useInfobarToggle({
    id: `metric-card-${title}`,
    width: '30%',
    render: useCallback(() => {
      if (!details) {
        return null
      }

      return (
        <div className="px-4 space-y-4">
          {details.metric ? (
            <MetricCard
              title={details.metric.title}
              description={details.metric.description}
              value={details.metric.value}
              change={details.metric.change}
              dimension={details.metric.dimension}
              period={details.metric.period}
            />
          ) : null}
          {details.lineChart ? (
            <DailyChart title="Breakdown" data={details.lineChart} />
          ) : null}
        </div>
      )
    }, [details]),
    renderNav: useCallback(() => <h1>{title}</h1>, [title]),
  })

  return (
    <>
      <div
        {...props}
        className={clsx(
          'flex flex-col gap-2',
          'auto-bg-gray-100',
          'border auto-border-gray-200 rounded-xl',
          'p-5',
          {
            'cursor-pointer hover:auto-border-gray-300': !!details,
          },
          className
        )}
        onClick={details ? toggle : undefined}
      >
        <div className="text-md font-semibold">{title}</div>
        <div className="text-sm">{description}</div>
        <div className="flex-1" />
        <div className="text-4xl">
          <span>{shortFormat(value)}</span>
          {change ? (
            <sup className="ml-2">
              <span className="text-xs">
                {change > 0 ? '+' : ''}
                {shortFormat(change)}
              </span>
            </sup>
          ) : null}
        </div>
        {dimension && <div className="text-xs">{dimension}</div>}
        {period && <div className="text-xs">{period}</div>}
      </div>
      {toRender}
    </>
  )
}

export function Main({ metrics, usage }) {
  return (
    <>
      <div className={clsx('main-page main-page-3xl')}>
        <div className="space-y-6">
          {/* Token Metrics Section */}
          {metrics ? (
            <div>
              <h2 className="text-2xl font-bold mb-4">Token Usage Analytics</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <MetricCard
                  title={metrics.tokenMetrics.totalTokens.title}
                  description={metrics.tokenMetrics.totalTokens.description}
                  value={metrics.tokenMetrics.totalTokens.value}
                  change={metrics.tokenMetrics.totalTokens.change}
                  period={metrics.tokenMetrics.totalTokens.period}
                  details={metrics.tokenMetrics.totalTokens.details}
                />
                <MetricCard
                  title={
                    metrics.tokenMetrics.averageTokensPerConversation.title
                  }
                  description={
                    metrics.tokenMetrics.averageTokensPerConversation
                      .description
                  }
                  value={
                    metrics.tokenMetrics.averageTokensPerConversation.value
                  }
                  period={
                    metrics.tokenMetrics.averageTokensPerConversation.period
                  }
                />
                <MetricCard
                  title={metrics.tokenMetrics.averageTokensPerMessage.title}
                  description={
                    metrics.tokenMetrics.averageTokensPerMessage.description
                  }
                  value={metrics.tokenMetrics.averageTokensPerMessage.value}
                  period={metrics.tokenMetrics.averageTokensPerMessage.period}
                />
              </div>
            </div>
          ) : null}
          {/* Usage Trends Section */}
          {usage ? (
            <div>
              <h2 className="text-2xl font-bold mb-4">Usage Trends</h2>
              <div className="grid grid-cols-1 gap-4">
                {/* token usage */}
                <DailyChart title="Tokens" data={usage.tokens} />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* conversation usage */}
                  <DailyChart
                    title="Conversations"
                    data={usage.conversations}
                  />
                  {/* message usage */}
                  <DailyChart title="Messages" data={usage.messages} />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
