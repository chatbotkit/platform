'use client'

import useConversationMonitor from '@/hooks/useConversationMonitor'

/**
 * Derive a human-readable label, detail and tone for a curated monitor event.
 *
 * @param {import('@/hooks/useConversationMonitor').ConversationMonitorEvent} event
 */
function describeEvent(event) {
  const data = /** @type {any} */ (event.data || {})

  switch (event.type) {
    case 'completeBegin': {
      return { label: 'Completion started', detail: null, tone: 'info' }
    }

    case 'completeEnd': {
      return { label: 'Completion finished', detail: null, tone: 'muted' }
    }

    case 'message': {
      const type = data.type || 'message'
      const text = typeof data.text === 'string' ? data.text : ''

      return {
        label: `${type} message`,
        detail: text,
        tone: type === 'bot' ? 'success' : 'info',
      }
    }

    case 'operationBegin': {
      const action = data.action || {}

      return {
        label: `Tool started: ${action.name || action.id || 'operation'}`,
        detail: action.justification || null,
        tone: 'info',
      }
    }

    case 'operationEnd': {
      const action = data.action || {}

      return {
        label: `Tool finished: ${action.name || action.id || 'operation'}`,
        detail: null,
        tone: 'muted',
      }
    }

    case 'error': {
      return {
        label: 'Error',
        detail: data.message || data.code || null,
        tone: 'error',
      }
    }

    case 'abort': {
      return { label: 'Aborted', detail: null, tone: 'error' }
    }

    default: {
      return { label: event.type, detail: null, tone: 'muted' }
    }
  }
}

const TONE_DOT = {
  info: 'bg-blue-500',
  success: 'bg-green-500',
  error: 'bg-red-500',
  muted: 'bg-gray-400 dark:bg-gray-600',
}

/**
 * Live activity feed for a conversation. Subscribes to the conversation's
 * monitor channel and renders curated lifecycle events as they happen,
 * regardless of how the conversation is being driven (interactive, dispatched,
 * or via an integration such as Slack or WhatsApp). Read-only.
 *
 * @param {{ conversationId: string }} props
 */
export default function ConversationMonitor({ conversationId }) {
  const { events, connected, connecting, error, clear } =
    useConversationMonitor(conversationId, { historyLength: 50 })

  const status = error
    ? { dot: 'bg-red-500', label: 'Disconnected' }
    : connected
      ? { dot: 'bg-green-500', label: 'Live' }
      : connecting
        ? { dot: 'bg-yellow-500 animate-pulse', label: 'Connecting…' }
        : { dot: 'bg-gray-400', label: 'Idle' }

  return (
    <div className="space-y-3">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center space-x-2 text-sm text-gray-500 dark:text-gray-500">
          <span className={`inline-block h-2 w-2 rounded-full ${status.dot}`} />
          <span>{status.label}</span>
        </div>
        {events.length > 0 ? (
          <button
            type="button"
            className="default-button small"
            onClick={clear}
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-900">
        {events.length === 0 ? (
          <div className="text-sm text-gray-400 dark:text-gray-600">
            Waiting for live activity… events appear here as this conversation
            runs.
          </div>
        ) : (
          events.map((event, index) => {
            const { label, detail, tone } = describeEvent(event)

            return (
              <div
                key={`${event.createdAt}-${index}`}
                className="flex flex-row items-start space-x-3"
              >
                <span
                  className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${TONE_DOT[tone]}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-row items-baseline justify-between space-x-3">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {label}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400 dark:text-gray-600">
                      {new Date(event.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  {detail ? (
                    <div className="mt-0.5 line-clamp-2 [word-break:break-word] text-sm text-gray-500 dark:text-gray-500">
                      {detail}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
      </div>

      {error ? (
        <div className="text-xs text-red-500">{error.message}</div>
      ) : null}
    </div>
  )
}
