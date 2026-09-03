import { useCallback, useEffect, useState } from 'react'

import { shortFormat } from '@/lib/number'

import useFetch from '@/hooks/useFetch'

import clsx from 'clsx'

const CONVERSATION_USAGE_REPORT_ID = 'cru3m5n8k001008jq7h9e5b2c'

function MetricCard({ title, value, detail }) {
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
      <div className="text-2xl font-semibold">{shortFormat(value)}</div>
      {detail ? (
        <div className="text-xs auto-text-gray-500">{detail}</div>
      ) : null}
    </div>
  )
}

export default function ConversationInsights({ conversationId }) {
  const [usage, setUsage] = useState(null)

  const { fetch, loading } = useFetch({
    trackLoading: true,
  })

  const loadInsights = useCallback(async () => {
    const { data, error } = await fetch('/api/v1/platform/report/generate', {
      data: {
        [CONVERSATION_USAGE_REPORT_ID]: {
          conversationIds: [conversationId],
          periodDays: 90,
        },
      },
      trackLoading: true,
    })

    if (error) {
      return
    }

    if (data?.[CONVERSATION_USAGE_REPORT_ID]) {
      setUsage(data[CONVERSATION_USAGE_REPORT_ID])
    }
  }, [fetch, conversationId])

  useEffect(() => {
    loadInsights()
  }, [loadInsights])

  if (loading && !usage) {
    return (
      <div className="text-sm auto-text-gray-400 py-8 text-center">
        Loading insights...
      </div>
    )
  }

  if (!usage) {
    return (
      <div className="text-sm auto-text-gray-400 py-8 text-center">
        No insights data available yet. Continue the conversation to see usage.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard
          title="Conversations"
          value={usage.totalConversations}
          detail="Selected conversation"
        />
        <MetricCard title="Messages" value={usage.totalMessages} />
        <MetricCard title="Tokens" value={usage.totalTokens} />
      </div>
      <div className="text-xs auto-text-gray-500">
        Usage calculated for {usage.period}.
      </div>
    </div>
  )
}
