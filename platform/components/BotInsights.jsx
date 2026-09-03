import { useCallback, useEffect, useState } from 'react'

import { shortFormat } from '@/lib/number'

import ForwardLink from '@/components/ForwardLink'
import Link from '@/components/Link'

import useFetch from '@/hooks/useFetch'

import {
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  HandThumbDownIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'

import clsx from 'clsx'

const BOT_PERFORMANCE_REPORT_ID = 'clr3m5n8k000g08jqdt1u2v7q'
const BOT_QUALITY_REPORT_ID = 'clr3m5n8k000h08jqeu2v3w8r'
const BOT_ALERTS_REPORT_ID = 'clr3m5n8k000i08jqfv3w4x9s'
const BOT_FEEDBACK_REPORT_ID = 'clr3m5n8k000j08jqgw4x5y0t'

function Sparkline({ data, className }) {
  if (!data || data.length < 2) {
    return null
  }

  const values = data.map((d) => d.total)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1

  const width = 80
  const height = 24

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - ((v - min) / range) * height

      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg
      className={clsx('inline-block', className)}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  )
}

function MetricCard({ title, value, change, sparklineData, sentiment }) {
  const changeLabel =
    change !== undefined && change !== 0
      ? `${change > 0 ? '+' : ''}${shortFormat(change)}`
      : null

  return (
    <div
      className={clsx(
        'flex flex-col gap-1',
        'auto-bg-gray-100',
        'border auto-border-gray-200 rounded-xl',
        'p-4'
      )}
    >
      <div className="text-xs font-medium auto-text-gray-500 uppercase tracking-wide">
        {title}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-semibold">
          {sentiment || shortFormat(value)}
        </span>
        {changeLabel ? (
          <span
            className={clsx(
              'text-xs font-medium',
              change > 0 ? 'text-green-600' : 'text-red-600'
            )}
          >
            {changeLabel}
          </span>
        ) : null}
      </div>
      {sparklineData ? (
        <Sparkline
          data={sparklineData}
          className="mt-1 auto-text-gray-400 h-6"
        />
      ) : null}
    </div>
  )
}

function SeverityIcon({ severity }) {
  switch (severity) {
    case 'critical':
      return <ExclamationCircleIcon className="h-4 w-4 text-red-500 shrink-0" />
    case 'warning':
      return (
        <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500 shrink-0" />
      )
    default:
      return (
        <InformationCircleIcon className="h-4 w-4 text-blue-500 shrink-0" />
      )
  }
}

function severityTag(severity) {
  switch (severity) {
    case 'critical':
      return 'error'
    case 'warning':
      return 'warning'
    default:
      return 'info'
  }
}

function AlertsList({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium auto-text-gray-500 uppercase tracking-wide">
        Alerts
      </div>
      <ul className="space-y-2">
        {alerts.map((alert, index) => (
          <li
            key={`alert-${index}`}
            className={clsx(
              'flex items-start gap-2 p-3 rounded-lg',
              'border auto-border-gray-200',
              'auto-bg-gray-50'
            )}
          >
            <SeverityIcon severity={alert.severity} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={clsx('tag text-xs', severityTag(alert.severity))}
                >
                  {alert.severity}
                </span>
                <span className="text-sm font-medium truncate">
                  {alert.title}
                </span>
              </div>
              <p className="text-xs auto-text-gray-500 mt-1">{alert.message}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function QualityMetrics({ quality }) {
  if (!quality) {
    return null
  }

  const { conversationDepth, abandonmentRate, avgTokensPerConversation } =
    quality

  const totalConvs =
    conversationDepth.singleTurn +
    conversationDepth.short +
    conversationDepth.medium +
    conversationDepth.long

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium auto-text-gray-500 uppercase tracking-wide">
        Conversation Quality
      </div>
      <div
        className={clsx(
          'p-4 rounded-xl border auto-border-gray-200 auto-bg-gray-50',
          'grid grid-cols-2 md:grid-cols-4 gap-4'
        )}
      >
        <div>
          <div className="text-xs auto-text-gray-500">Abandonment</div>
          <div
            className={clsx(
              'text-lg font-semibold',
              abandonmentRate > 50
                ? 'text-red-600'
                : abandonmentRate > 30
                  ? 'text-yellow-600'
                  : ''
            )}
          >
            {abandonmentRate.toFixed(0)}%
          </div>
        </div>
        <div>
          <div className="text-xs auto-text-gray-500">
            Tokens / Conversation
          </div>
          <div className="text-lg font-semibold">
            {shortFormat(avgTokensPerConversation)}
          </div>
        </div>
        <div>
          <div className="text-xs auto-text-gray-500">
            Avg Depth (user msgs)
          </div>
          <div className="text-lg font-semibold">
            {quality.avgMessagesPerConversation.user.toFixed(1)}
          </div>
        </div>
        <div>
          <div className="text-xs auto-text-gray-500">
            Avg Actions / Conversation
          </div>
          <div className="text-lg font-semibold">
            {quality.avgMessagesPerConversation.activity.toFixed(1)}
          </div>
        </div>
      </div>
      {totalConvs > 0 ? (
        <div className="p-4 rounded-xl border auto-border-gray-200 auto-bg-gray-50">
          <div className="text-xs auto-text-gray-500 mb-2">
            Conversation Depth Distribution
          </div>
          <div className="flex items-end gap-1 h-10">
            {[
              {
                label: '1 msg',
                value: conversationDepth.singleTurn,
                color: 'bg-red-400',
              },
              {
                label: '2-3',
                value: conversationDepth.short,
                color: 'bg-yellow-400',
              },
              {
                label: '4-10',
                value: conversationDepth.medium,
                color: 'bg-green-400',
              },
              {
                label: '10+',
                value: conversationDepth.long,
                color: 'bg-blue-400',
              },
            ].map(({ label, value, color }) => {
              const pct = totalConvs > 0 ? (value / totalConvs) * 100 : 0

              return (
                <div
                  key={label}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <div
                    className={clsx('w-full rounded-sm', color)}
                    style={{ height: `${Math.max(pct, 4)}%` }}
                    title={`${label}: ${value} (${pct.toFixed(0)}%)`}
                  />
                  <div className="text-[10px] auto-text-gray-400">{label}</div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
      {quality.topActions && quality.topActions.length > 0 ? (
        <div className="p-4 rounded-xl border auto-border-gray-200 auto-bg-gray-50">
          <div className="text-xs auto-text-gray-500 mb-2">Top Actions</div>
          <div className="flex flex-wrap gap-2">
            {quality.topActions.slice(0, 5).map(({ type, name, count }) => (
              <span key={type} className="tag text-xs">
                {name || type}{' '}
                <span className="ml-1 font-semibold">{count}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function NegativeFeedbackList({ items }) {
  if (!items || items.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium auto-text-gray-500 uppercase tracking-wide">
        Recent Negative Feedback
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={clsx(
              'flex items-start gap-3 p-3 rounded-lg',
              'border auto-border-gray-200',
              'auto-bg-gray-50'
            )}
          >
            <HandThumbDownIcon className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                {item.reason || (
                  <span className="italic auto-text-gray-400">
                    No reason provided
                  </span>
                )}
              </p>
              <div className="flex items-center gap-3 mt-1">
                {item.contactName ? (
                  <span className="text-xs auto-text-gray-400">
                    {item.contactName}
                  </span>
                ) : null}
                <span className="text-xs auto-text-gray-400">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
                {item.conversationId ? (
                  <Link
                    className="text-xs default-link"
                    href={`/conversations/${item.conversationId}`}
                  >
                    View conversation
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function sentimentEmoji(signal) {
  switch (signal) {
    case 'positive':
      return '😊'
    case 'negative':
      return '😟'
    case 'neutral':
      return '😐'
    default:
      return '-'
  }
}

function sentimentLabel(signal) {
  switch (signal) {
    case 'positive':
      return 'Positive'
    case 'negative':
      return 'Negative'
    case 'neutral':
      return 'Neutral'
    default:
      return 'No data'
  }
}

/**
 * Bot Insights panel that shows performance metrics, conversation quality,
 * alerts, and recent negative feedback for a specific bot. Uses the batch
 * report endpoint to fetch all data in a single request.
 */
export default function BotInsights({ botId }) {
  const [performance, setPerformance] = useState(null)
  const [quality, setQuality] = useState(null)
  const [alerts, setAlerts] = useState(null)
  const [feedback, setFeedback] = useState(null)

  const { fetch, loading } = useFetch({
    trackLoading: true,
  })

  const loadInsights = useCallback(async () => {
    // @note fetch all four reports in a single batch request

    const { data, error } = await fetch('/api/v1/platform/report/generate', {
      data: {
        [BOT_PERFORMANCE_REPORT_ID]: { botId, periodDays: 30 },
        [BOT_QUALITY_REPORT_ID]: { botId, periodDays: 30 },
        [BOT_ALERTS_REPORT_ID]: { botId, periodDays: 7 },
        [BOT_FEEDBACK_REPORT_ID]: { botId, periodDays: 30, limit: 5 },
      },
      trackLoading: true,
    })

    if (error) {
      return
    }

    if (data?.[BOT_PERFORMANCE_REPORT_ID]) {
      setPerformance(data[BOT_PERFORMANCE_REPORT_ID])
    }

    if (data?.[BOT_QUALITY_REPORT_ID]) {
      setQuality(data[BOT_QUALITY_REPORT_ID])
    }

    if (data?.[BOT_ALERTS_REPORT_ID]) {
      setAlerts(data[BOT_ALERTS_REPORT_ID])
    }

    if (data?.[BOT_FEEDBACK_REPORT_ID]) {
      setFeedback(data[BOT_FEEDBACK_REPORT_ID])
    }
  }, [fetch, botId])

  useEffect(() => {
    loadInsights()
  }, [loadInsights])

  // @note show nothing while loading the first time

  if (loading && !performance) {
    return (
      <div className="text-sm auto-text-gray-400 py-8 text-center">
        Loading insights...
      </div>
    )
  }

  // @note if no data came back at all, show empty state

  if (!performance && !quality && !alerts && !feedback) {
    return (
      <div className="text-sm auto-text-gray-400 py-8 text-center">
        No insights data available yet. Start conversations to see metrics.
      </div>
    )
  }

  const hasAlerts = alerts?.alerts?.length > 0
  const hasNegativeFeedback = feedback?.items?.length > 0

  return (
    <div className="space-y-6">
      {/* alerts at the top when present */}
      {hasAlerts ? <AlertsList alerts={alerts.alerts} /> : null}

      {/* metric cards */}
      {performance ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            title="Conversations"
            value={performance.conversations.current}
            change={performance.conversations.change}
            sparklineData={performance.conversations.breakdown}
          />
          <MetricCard
            title="Messages"
            value={performance.messages.current}
            change={performance.messages.change}
            sparklineData={performance.messages.breakdown}
          />
          <MetricCard
            title="Tokens"
            value={performance.tokens.current}
            change={performance.tokens.change}
            sparklineData={performance.tokens.breakdown}
          />
          <MetricCard
            title="Sentiment"
            value={performance.ratings.total}
            sentiment={`${sentimentEmoji(performance.ratings.sentimentSignal)} ${sentimentLabel(performance.ratings.sentimentSignal)}`}
            change={performance.ratings.change}
          />
        </div>
      ) : null}

      {/* rating summary below metric cards */}
      {performance && performance.ratings.total > 0 ? (
        <div className="flex items-center gap-4 text-sm auto-text-gray-500">
          <span>
            👍 {performance.ratings.thumbsUp} 👎{' '}
            {performance.ratings.thumbsDown}
          </span>
          <span>·</span>
          <span>{performance.ratings.total} total ratings</span>
          <span>·</span>
          <ForwardLink
            className="text-sm default-link"
            href={`/ratings?botId=${botId}`}
          >
            All ratings
          </ForwardLink>
        </div>
      ) : null}

      {/* conversation quality */}
      <QualityMetrics quality={quality} />

      {/* negative feedback drill-down */}
      {hasNegativeFeedback ? (
        <NegativeFeedbackList items={feedback.items} />
      ) : null}
    </div>
  )
}
