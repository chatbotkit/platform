'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LuActivity,
  LuBot,
  LuCircleAlert,
  LuClock3,
  LuDatabase,
  LuMessageSquare,
  LuPause,
  LuPlay,
  LuRefreshCcw,
  LuSearch,
  LuWrench,
} from 'react-icons/lu'

import dynamic from 'next/dynamic'

import fetch, { jsonl } from '@/lib/fetch'
import toast from '@/lib/toast'

import TimeAgo from '@/components/TimeAgo'

import {
  AppToolbar,
  ToolbarButton,
  ToolbarSearch,
  ToolbarStatus,
  ToolbarToggle,
} from '@/app/apps/_components/Toolbar'

import {
  fetchConversationDetail,
  listAll,
  mintConversationToken,
  subscribeTaskWorkflowEvents,
} from './server'

import { consume } from '@chatbotkit/react/utils/stream'

import clsx from 'clsx'

const ObjectView = dynamic(() => import('@/components/ObjectView'), {
  ssr: false,
})

const WORKFLOW_RECONNECT_DELAY_MS = 1500
// @note the selected conversation gets live updates from the monitor stream, so
// the full re-fetch only needs to run slowly to reconcile any best-effort gaps.
const DETAIL_REFRESH_INTERVAL_MS = 30000
// @note new conversations are staged in a collapsed buffer rather than injected
// live, so the list can refresh on a relaxed cadence without churning under load.
const LIST_REFRESH_INTERVAL_MS = 15000

const statusLabels = {
  responding: 'Responding',
  waiting: 'Waiting',
  error: 'Error',
  completed: 'Completed',
}

const eventIcons = {
  context: LuActivity,
  error: LuCircleAlert,
  event: LuActivity,
  message: LuMessageSquare,
  model: LuBot,
  operationBegin: LuPlay,
  operationEnd: LuClock3,
  retrieval: LuDatabase,
  tool: LuWrench,
}

const timelineEventSortRank = {
  error: 0,
  operationBegin: 10,
  operationEnd: 11,
  tool: 20,
  message: 30,
  model: 40,
  retrieval: 50,
  context: 60,
  event: 70,
}

function statusClassName(status) {
  return clsx('tag text-[10px]', {
    success: status === 'responding' || status === 'completed',
    warning: status === 'waiting',
    error: status === 'error',
  })
}

function formatOptionalValue(value, fallback = 'n/a') {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  return value
}

function Toolbar({
  filter,
  setFilter,
  live,
  setLive,
  loading,
  updatedAt,
  onRefresh,
}) {
  return (
    <AppToolbar>
      <ToolbarButton onClick={onRefresh} title="Refresh" disabled={loading}>
        <LuRefreshCcw
          className={clsx('h-3.5 w-3.5', {
            'animate-spin': loading,
          })}
        />
        <span className="inline-block text-left">Refresh</span>
      </ToolbarButton>

      <ToolbarToggle
        className={clsx('w-20', {
          'text-red-500': live,
        })}
        checked={live}
        setChecked={setLive}
        aria-pressed={live}
        title={live ? 'Pause polling' : 'Start polling'}
        icon={
          live ? (
            <LuPause className="h-3.5 w-3.5" />
          ) : (
            <LuPlay className="h-3.5 w-3.5" />
          )
        }
      >
        {live ? 'Pause' : 'Start'}
      </ToolbarToggle>

      <ToolbarSearch
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search conversations, contacts, agents..."
        icon={<LuSearch className="h-3.5 w-3.5" />}
        className="min-w-[16rem] flex-1"
      />

      <ToolbarStatus className="w-44 truncate text-right">
        {updatedAt ? (
          <>
            Updated <TimeAgo time={updatedAt} tooltip />
          </>
        ) : (
          'Not Updated'
        )}
      </ToolbarStatus>
    </AppToolbar>
  )
}

function ConversationRow({ item, selected, onClick }) {
  return (
    <button
      type="button"
      className={clsx(
        'w-full border-b border-gray-100 px-4 py-3 text-left transition-colors dark:border-gray-900',
        'hover:auto-bg-gray-100',
        {
          'auto-bg-gray-100': selected,
        }
      )}
      onClick={() => onClick(item.id)}
    >
      <div className="mb-2 flex flex-row items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium auto-text-gray-900">
            {item.summary}
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-gray-500 dark:text-gray-400">
            {item.id}
          </div>
        </div>
        <div className="shrink-0 text-[10px] text-gray-400">
          <TimeAgo time={item.updatedAt} tooltip />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <span className="tag text-[10px]">{item.channel}</span>
        <span className="tag text-[10px]">{item.bot}</span>
        <span className="tag text-[10px]">{item.model}</span>
      </div>
    </button>
  )
}

const ConversationRowMemo = memo(ConversationRow)

function ConversationList({ items, selectedId, setSelectedId, loading }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto subtle-scrollbar">
      {items.map((item) => (
        <ConversationRowMemo
          key={item.id}
          item={item}
          selected={item.id === selectedId}
          onClick={setSelectedId}
        />
      ))}

      {items.length === 0 ? (
        <div className="flex h-full items-center justify-center p-8 text-center text-sm text-gray-400">
          {loading
            ? 'Loading conversations...'
            : 'No conversations match the current filters'}
        </div>
      ) : null}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded border border-gray-200 p-3 dark:border-gray-800">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div className="mt-1 truncate font-mono text-xs auto-text-gray-900">
        {formatOptionalValue(value)}
      </div>
    </div>
  )
}

function TimelineEvent({ item, isLast }) {
  const Icon = eventIcons[item.type] || LuActivity

  return (
    <div className="relative flex flex-row gap-3">
      <div className="flex flex-col items-center">
        <span
          className={clsx(
            'flex h-7 w-7 items-center justify-center rounded-full border bg-white dark:bg-gray-950',
            {
              'border-red-200 text-red-600 dark:border-red-900':
                item.type === 'error',
              'border-blue-200 text-blue-600 dark:border-blue-900':
                item.type === 'operationBegin',
              'border-emerald-200 text-emerald-600 dark:border-emerald-900':
                item.type === 'operationEnd',
              'border-gray-200 text-gray-500 dark:border-gray-800':
                item.type !== 'error' &&
                item.type !== 'operationBegin' &&
                item.type !== 'operationEnd',
            }
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        {!isLast ? (
          <span className="h-full w-px flex-1 bg-gray-200 dark:bg-gray-800" />
        ) : null}
      </div>

      <div className="min-w-0 flex-1 pb-5">
        <div className="flex flex-row flex-wrap items-center gap-2">
          <div className="text-sm font-medium auto-text-gray-900">
            {item.title}
          </div>
          <span className="tag text-[10px]">{item.type}</span>
          <span className="flex items-center gap-1 text-[10px] text-gray-400">
            <LuClock3 className="h-3 w-3" />
            <TimeAgo time={item.at} tooltip />
          </span>
        </div>
        <div className="mt-1 rounded border border-gray-100 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
          {item.description}
          {item.object ? (
            <ObjectView
              className="mt-2 max-h-72 overflow-auto text-xs"
              object={item.object}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

const executionOutcomeClass = {
  success: 'success',
  failure: 'error',
  pending: 'warning',
}

const executionStatusClass = {
  running: 'success',
  idle: '',
}

function ExecutionPanel({ execution }) {
  if (!execution) {
    return null
  }

  const kindLabel = execution.kind === 'task' ? 'Task' : 'Trigger Integration'

  return (
    <div className="border-b border-gray-200 p-4 dark:border-gray-800">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-500">{kindLabel}</span>
        <span className="tag text-[10px] font-mono">{execution.name}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {execution.resourceStatus != null && (
          <div className="rounded border border-gray-200 p-3 dark:border-gray-800">
            <div className="text-[10px] uppercase tracking-wide text-gray-400">
              Status
            </div>
            <div className="mt-1">
              <span
                className={clsx(
                  'tag text-[10px]',
                  executionStatusClass[execution.resourceStatus]
                )}
              >
                {execution.resourceStatus}
              </span>
            </div>
          </div>
        )}

        {execution.resourceOutcome != null && (
          <div className="rounded border border-gray-200 p-3 dark:border-gray-800">
            <div className="text-[10px] uppercase tracking-wide text-gray-400">
              Outcome
            </div>
            <div className="mt-1">
              <span
                className={clsx(
                  'tag text-[10px]',
                  executionOutcomeClass[execution.resourceOutcome]
                )}
              >
                {execution.resourceOutcome}
              </span>
            </div>
          </div>
        )}

        <div className="rounded border border-gray-200 p-3 dark:border-gray-800">
          <div className="text-[10px] uppercase tracking-wide text-gray-400">
            Run Status
          </div>
          <div className="mt-1">
            {execution.executionStatus ? (
              <span
                className={clsx(
                  'tag text-[10px]',
                  executionStatusClass[execution.executionStatus]
                )}
              >
                {execution.executionStatus}
              </span>
            ) : (
              <span className="font-mono text-xs text-gray-400">n/a</span>
            )}
          </div>
        </div>

        <div className="rounded border border-gray-200 p-3 dark:border-gray-800">
          <div className="text-[10px] uppercase tracking-wide text-gray-400">
            Run Outcome
          </div>
          <div className="mt-1">
            {execution.executionOutcome ? (
              <span
                className={clsx(
                  'tag text-[10px]',
                  executionOutcomeClass[execution.executionOutcome]
                )}
              >
                {execution.executionOutcome}
              </span>
            ) : (
              <span className="font-mono text-xs text-gray-400">n/a</span>
            )}
          </div>
        </div>
      </div>

      {execution.executionSummary && (
        <div className="mt-2 rounded border border-gray-100 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 max-h-40 overflow-auto">
          {execution.executionSummary}
        </div>
      )}
    </div>
  )
}

function Inspector({ conversation, events }) {
  if (!conversation) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center p-8 text-center text-sm text-gray-400">
        Select a conversation to inspect its messages and operational events.
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <ExecutionPanel execution={conversation.execution} />

      <div className="border-b border-gray-200 p-4 dark:border-gray-800">
        <div className="flex flex-row flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-row flex-wrap items-center gap-2">
              <span className={statusClassName(conversation.status)}>
                {statusLabels[conversation.status] || conversation.status}
              </span>
              <span className="tag text-[10px]">{conversation.channel}</span>
            </div>
            <h1 className="mt-2 truncate text-lg font-semibold auto-text-gray-900">
              {conversation.summary}
            </h1>
            <div className="mt-1 truncate font-mono text-xs text-gray-500">
              {conversation.id}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="Model" value={conversation.model} />
          <Stat label="Active Step" value={conversation.activeStep} />
          <Stat label="Tokens" value={conversation.tokens} />
          <Stat label="Latency" value={conversation.latency} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="mb-4 rounded border border-gray-200 p-3 dark:border-gray-800">
          <div className="mb-1 text-xs font-semibold text-gray-500">
            Latest Message
          </div>
          <div className="text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words max-h-40 overflow-auto px-1 py-1 font-mono">
            {conversation.latest}
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold auto-text-gray-900">
              Execution Stream
            </div>
            <div className="text-xs text-gray-500">
              Poll-based view of recent messages and event logs for this
              conversation.
            </div>
          </div>
        </div>

        {events.length > 0 ? (
          <div>
            {events.map((event, index) => (
              <TimelineEvent
                key={`${event.type}-${event.id}`}
                item={event}
                isLast={index === events.length - 1}
              />
            ))}
          </div>
        ) : (
          <div className="rounded border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400 dark:border-gray-800">
            No messages or events found for this conversation yet.
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * @param {object} props
 * @param {{ items: Array<object>, updatedAt?: number } | null | undefined} [props.initialData]
 * @param {string | undefined} [props.blueprintId]
 * @param {string | undefined} [props.inspect]
 */
function compareTimelineEvents(a, b) {
  return (
    (a?.at || 0) - (b?.at || 0) ||
    (timelineEventSortRank[a?.type] ?? 100) -
      (timelineEventSortRank[b?.type] ?? 100) ||
    String(a?.type || '').localeCompare(String(b?.type || '')) ||
    String(a?.id || '').localeCompare(String(b?.id || ''))
  )
}

function getTimelineTimestamp(value, fallback = 0) {
  return typeof value === 'number' ? value : fallback
}

function mergeTimelineEvents(existing, incoming) {
  if (!incoming.length) {
    return existing
  }

  const mergedById = new Map(existing.map((event) => [event.id, event]))

  for (const event of incoming) {
    const current = mergedById.get(event.id)

    if (!current) {
      mergedById.set(event.id, event)

      continue
    }

    const currentAt = getTimelineTimestamp(current.at)
    const eventAt = getTimelineTimestamp(event.at)

    mergedById.set(event.id, eventAt >= currentAt ? event : current)
  }

  return [...mergedById.values()].sort(compareTimelineEvents)
}

function getWorkflowActionLabel(event) {
  const action = event?.data?.action

  return action?.name || action?.id || 'operation'
}

function getWorkflowErrorMessage(event) {
  return event?.data?.message || 'Task workflow error'
}

function toWorkflowTimelineEvent(event) {
  const createdAt = getTimelineTimestamp(event?.createdAt, Date.now())

  if (event?.type === 'error') {
    const message = getWorkflowErrorMessage(event)

    return {
      id: `workflow:error:${createdAt}:${message}`,
      type: 'error',
      title: 'Task workflow error',
      description: message,
      at: createdAt,
      object: event.data,
      raw: event,
    }
  }

  const action = event?.data?.action || {}
  const label = getWorkflowActionLabel(event)
  const isBegin = event?.type === 'operationBegin'
  const operationId = event?.data?.id || action.id || label

  return {
    id: `workflow:${operationId}:${event.type}`,
    type: isBegin ? 'operationBegin' : 'operationEnd',
    title: `${isBegin ? 'Started' : 'Finished'} ${label}`,
    description:
      action.justification ||
      `${isBegin ? 'Running' : 'Completed'} ${action.kind || 'workflow'} operation`,
    at: createdAt,
    object: event.data,
    raw: event,
  }
}

/**
 * Map a curated conversation monitor event into a timeline event, or null when
 * it is a lifecycle event (completeBegin/End, abort) used only for status.
 */
function toMonitorTimelineEvent(event) {
  const type = event?.type

  if (type === 'message') {
    const createdAt = getTimelineTimestamp(event?.createdAt, Date.now())
    const data = event?.data || {}

    return {
      id: data.id || `monitor:message:${createdAt}`,
      type: 'message',
      title: `${data.type || 'message'} message`,
      description: data.text || data.description || 'No message text',
      at: createdAt,
      object: data,
      raw: event,
    }
  }

  // @note operationBegin / operationEnd / error share the workflow event shape
  if (type === 'operationBegin' || type === 'operationEnd' || type === 'error') {
    return toWorkflowTimelineEvent(event)
  }

  return null
}

/**
 * Stream a conversation's live monitor events directly from the API. Mints a
 * short-lived, route-scoped bearer token via the app facade (authorize), then
 * reads the JSONL stream client-side - no per-tick server-side polling.
 */
async function* streamConversationMonitor({ conversationId, signal }) {
  const result = await mintConversationToken({ conversationId })

  if (!result || 'error' in result || !result.token) {
    throw new Error(
      result?.error?.message || 'Failed to authorize conversation stream'
    )
  }

  const response = await fetch(
    `/api/v1/conversation/${conversationId}/channel/subscribe`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/jsonl',
        'X-Requested-With': 'XMLHttpRequest',
        Authorization: `Bearer ${result.token}`,
      },
      body: JSON.stringify({ historyLength: 50 }),
      signal,
    }
  )

  if (!response.ok || !response.body) {
    throw new Error(
      `Conversation monitor subscription failed with status ${response.status}`
    )
  }

  for await (const item of jsonl(response.body)) {
    if (item?.type === 'message' && item.data) {
      yield item.data
    }
  }
}

export function Main({ initialData, blueprintId, inspect }) {
  const [items, setItems] = useState(initialData?.items || [])

  const [updatedAt, setUpdatedAt] = useState(initialData?.updatedAt || null)

  const [selectedId, setSelectedId] = useState(initialData?.items?.[0]?.id)

  const [detail, setDetail] = useState(null)

  const [filter, setFilter] = useState('')

  const [live, setLive] = useState(false)

  const [loading, setLoading] = useState(false)

  // @note new conversations detected on refresh are staged here instead of being
  // injected into the visible list, so high volume never reshuffles what you are
  // looking at. The user merges them in explicitly via the "N new" control.
  const [pendingItems, setPendingItems] = useState([])

  // @note mirror items in a ref so refresh can diff against the current list
  // without taking items as a dependency (which would re-arm the interval).
  const itemsRef = useRef(items)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const cursorsRef = useRef({
    id: null,
    lastMessageId: null,
    lastEventId: null,
  })

  const workflowStreamAbortRef = useRef(null)

  const refresh = useCallback(async () => {
    setLoading(true)

    try {
      const result = await listAll({
        blueprintId,
        take: 20,
      })

      if (result && !('error' in result)) {
        const fetched = result.items || []

        setUpdatedAt(result.updatedAt || Date.now())

        const current = itemsRef.current

        // @note first load (or empty list) - populate directly and select one
        if (current.length === 0) {
          setItems(fetched)

          setSelectedId((selectedId) =>
            selectedId && fetched.some((item) => item.id === selectedId)
              ? selectedId
              : fetched[0]?.id
          )

          return
        }

        // @note keep the visible list stable: refresh existing rows in place
        // (status/summary updates, no reordering)...
        const fetchedById = new Map(fetched.map((item) => [item.id, item]))

        setItems((prev) => prev.map((item) => fetchedById.get(item.id) || item))

        // @note ...and stage genuinely-new conversations in the collapsed buffer
        const currentIds = new Set(current.map((item) => item.id))

        setPendingItems((prevPending) => {
          const pendingIds = new Set(prevPending.map((item) => item.id))

          const fresh = fetched.filter(
            (item) => !currentIds.has(item.id) && !pendingIds.has(item.id)
          )

          return fresh.length ? [...fresh, ...prevPending] : prevPending
        })
      } else if (result?.error) {
        toast.error(result.error.message)
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [blueprintId])

  const showPendingItems = useCallback(() => {
    setItems((prev) => {
      const existingIds = new Set(prev.map((item) => item.id))

      return [
        ...pendingItems.filter((item) => !existingIds.has(item.id)),
        ...prev,
      ].sort(
        (a, b) =>
          (b.updatedAt || 0) - (a.updatedAt || 0) ||
          (b.createdAt || 0) - (a.createdAt || 0)
      )
    })

    setPendingItems([])
  }, [pendingItems])

  const loadDetail = useCallback(async (conversationId) => {
    if (!conversationId) {
      setDetail(null)
      cursorsRef.current = {
        id: null,
        lastMessageId: null,
        lastEventId: null,
      }

      return
    }

    setLoading(true)

    try {
      const result = await fetchConversationDetail({ conversationId })

      if (result && !('error' in result)) {
        setDetail(result)
        cursorsRef.current = {
          id: result.id,
          lastMessageId: result.lastMessageId,
          lastEventId: result.lastEventId,
        }
      } else if (result?.error) {
        toast.error(result.error.message)
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDetail(selectedId)
  }, [selectedId, loadDetail])

  // @note authoritative reconciliation - the monitor stream below is best-effort
  // (fire-and-forget publishes can drop), so re-pull the full detail slowly while
  // live instead of the previous 5s delta polling.
  useEffect(() => {
    if (!live || !selectedId) {
      return
    }

    const interval = setInterval(() => {
      loadDetail(selectedId)
    }, DETAIL_REFRESH_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [live, selectedId, loadDetail])

  // @note live detail updates via the conversation monitor channel - streamed
  // client-side with a short-lived, route-scoped token. Replaces per-tick delta
  // polling; reconnects while the conversation stays selected and live.
  useEffect(() => {
    if (!live || !selectedId) {
      return
    }

    let cancelled = false
    let controller = null
    let reconnectTimer = null

    const mergeEvent = (event) => {
      if (event?.type === 'completeBegin') {
        setDetail((prev) =>
          prev && prev.id === selectedId
            ? { ...prev, status: 'responding' }
            : prev
        )

        return
      }

      if (event?.type === 'completeEnd') {
        setDetail((prev) =>
          prev && prev.id === selectedId && prev.status === 'responding'
            ? { ...prev, status: 'idle' }
            : prev
        )

        return
      }

      const timelineEvent = toMonitorTimelineEvent(event)

      if (!timelineEvent) {
        return
      }

      setDetail((prev) => {
        if (!prev || prev.id !== selectedId) {
          return prev
        }

        return {
          ...prev,
          updatedAt: Math.max(
            getTimelineTimestamp(prev.updatedAt),
            getTimelineTimestamp(timelineEvent.at)
          ),
          events: mergeTimelineEvents(prev.events, [timelineEvent]),
        }
      })
    }

    const run = async () => {
      while (!cancelled) {
        controller = new AbortController()

        try {
          for await (const event of streamConversationMonitor({
            conversationId: selectedId,
            signal: controller.signal,
          })) {
            if (cancelled) {
              break
            }

            mergeEvent(event)
          }
        } catch {
          // @note reconnect below while the conversation stays selected + live
        }

        if (cancelled) {
          break
        }

        await new Promise((resolve) => {
          reconnectTimer = setTimeout(resolve, WORKFLOW_RECONNECT_DELAY_MS)
        })
      }
    }

    run()

    return () => {
      cancelled = true

      if (controller) {
        controller.abort()
      }

      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }
    }
  }, [live, selectedId])

  const selectedTaskId = useMemo(
    () =>
      detail?.id === selectedId && detail?.execution?.kind === 'task'
        ? detail.taskId || detail.execution.id
        : null,
    [detail, selectedId]
  )

  useEffect(() => {
    if (!live || !selectedTaskId || !selectedId) {
      workflowStreamAbortRef.current?.()
      workflowStreamAbortRef.current = null

      return
    }

    workflowStreamAbortRef.current?.()

    let aborted = false
    let reconnectTimer = null

    workflowStreamAbortRef.current = () => {
      aborted = true

      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    const waitForReconnect = () =>
      new Promise((resolve) => {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          resolve()
        }, WORKFLOW_RECONNECT_DELAY_MS)
      })

    const handleWorkflowEvent = (event) => {
      if (
        event?.type !== 'operationBegin' &&
        event?.type !== 'operationEnd' &&
        event?.type !== 'error'
      ) {
        return
      }

      setDetail((prev) => {
        if (!prev || prev.id !== selectedId) {
          return prev
        }

        if (event.type === 'error') {
          return {
            ...prev,
            status: 'error',
            activeStep: getWorkflowErrorMessage(event),
            updatedAt: Math.max(
              getTimelineTimestamp(prev.updatedAt),
              getTimelineTimestamp(event.createdAt)
            ),
            events: mergeTimelineEvents(prev.events, [
              toWorkflowTimelineEvent(event),
            ]),
          }
        }

        const label = getWorkflowActionLabel(event)
        const isBegin = event.type === 'operationBegin'

        return {
          ...prev,
          status: isBegin ? 'responding' : prev.status,
          activeStep: `${isBegin ? 'Running' : 'Finished'} ${label}`,
          updatedAt: Math.max(
            getTimelineTimestamp(prev.updatedAt),
            getTimelineTimestamp(event.createdAt)
          ),
          events: mergeTimelineEvents(prev.events, [
            toWorkflowTimelineEvent(event),
          ]),
        }
      })
    }

    const startStream = async () => {
      while (!aborted) {
        try {
          const eventStream = await consume(
            subscribeTaskWorkflowEvents({
              taskId: selectedTaskId,
              historyLength: 50,
            })
          )

          for await (const event of eventStream) {
            if (aborted) {
              break
            }

            handleWorkflowEvent(event)
          }
        } catch {
          // @note reconnect below while the selected task remains live
        }

        if (!aborted) {
          await waitForReconnect()
        }
      }
    }

    startStream()

    return () => {
      workflowStreamAbortRef.current?.()
    }
  }, [live, selectedId, selectedTaskId])

  useEffect(() => {
    if (!live) {
      return
    }

    const interval = setInterval(refresh, LIST_REFRESH_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [live, refresh])

  const filteredItems = useMemo(() => {
    const query = filter.trim().toLowerCase()

    if (!query) {
      return items
    }

    return items.filter((item) =>
      [item.id, item.contact, item.channel, item.bot, item.summary]
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [items, filter])

  const selectedConversation =
    detail && detail.id === selectedId
      ? detail
      : items.find((item) => item.id === selectedId) || null

  return (
    <div className="flex h-screen w-full flex-col bg-white dark:bg-gray-950">
      <Toolbar
        filter={filter}
        setFilter={setFilter}
        live={live}
        setLive={setLive}
        loading={loading}
        updatedAt={updatedAt}
        onRefresh={refresh}
      />

      {(blueprintId || inspect) && (
        <div className="border-b border-gray-200 px-3 py-2 font-mono text-[11px] text-gray-500 dark:border-gray-800">
          {blueprintId ? <span>blueprintId={blueprintId}</span> : null}
          {blueprintId && inspect ? <span className="px-2">/</span> : null}
          {inspect ? <span>inspect={inspect}</span> : null}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-h-0 w-full flex-col border-r border-gray-200 dark:border-gray-800 md:w-[420px]">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-gray-800">
            <div>
              <div className="text-sm font-semibold auto-text-gray-900">
                Conversations
              </div>
              <div className="text-xs text-gray-500">
                {filteredItems.length} active or recent sessions
              </div>
            </div>
            {pendingItems.length > 0 ? (
              <button
                type="button"
                className="default-button small"
                onClick={showPendingItems}
                title="Show newly arrived conversations"
              >
                {pendingItems.length} new ↑
              </button>
            ) : null}
          </div>

          <ConversationList
            items={filteredItems}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            loading={loading}
          />
        </div>

        <Inspector
          conversation={selectedConversation}
          events={selectedConversation?.events || []}
        />
      </div>
    </div>
  )
}
