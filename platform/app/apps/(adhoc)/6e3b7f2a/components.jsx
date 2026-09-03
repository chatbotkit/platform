'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LuPause,
  LuPlay,
  LuRefreshCcw,
  LuSearch,
  LuSquareX,
  LuWaves,
  LuWorkflow,
} from 'react-icons/lu'

import toast from '@/lib/toast'

import { useConfirm } from '@/components/Confirm'
import TimeAgo from '@/components/TimeAgo'

import { useMintedClient } from '@/hooks/useMintedClient'

import {
  AppToolbar,
  ToolbarButton,
  ToolbarSearch,
  ToolbarStatus,
  ToolbarToggle,
} from '@/app/apps/_components/Toolbar'

import {
  cancelAutomation,
  cancelAutomationExecution,
  mintAutomationToken,
  mintAutomationsListToken,
} from './server'

import {
  EXECUTION_TAKE,
  compareByUpdatedAtDesc,
  normalizeTask,
  pickLatestExecution,
} from './normalize'

import clsx from 'clsx'

// @note new automations are staged in a collapsed buffer rather than injected
// live, so the (fan-out heavy) list refresh can run on a relaxed cadence.
const LIST_REFRESH_INTERVAL_MS = 15000

const kindLabel = {
  task: 'Task',
}

function getStatusClassName(status) {
  return clsx('tag text-[10px]', {
    success: status === 'running',
    error: status === 'canceled',
  })
}

function getOutcomeClassName(outcome) {
  return clsx('tag text-[10px]', {
    success: outcome === 'success',
    warning: outcome === 'pending',
    error: outcome === 'failure',
  })
}

function Stat({ label, value }) {
  return (
    <div className="min-w-0 rounded border border-gray-200 p-3 dark:border-gray-800">
      <div className="truncate text-[10px] uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div
        className="mt-1 truncate font-mono text-xs auto-text-gray-900"
        title={value}
      >
        {value}
      </div>
    </div>
  )
}

function ResourceRow({
  item,
  selected,
  onSelect,
  onCancel,
  onCancelExecution,
  isCanceling,
  isExecutionCanceling,
}) {
  return (
    <div
      className={clsx(
        'border-b border-gray-100 px-4 py-3 transition-colors dark:border-gray-900',
        'hover:auto-bg-gray-100',
        {
          'auto-bg-gray-100': selected,
        }
      )}
    >
      <button type="button" className="w-full text-left" onClick={onSelect}>
        <div className="mb-2 flex items-start gap-3">
          <span className="tag text-[10px]">{kindLabel[item.kind]}</span>
          {item.status ? (
            <span className={getStatusClassName(item.status)}>
              {item.status}
            </span>
          ) : null}
          {item.execution?.status ? (
            <span className={getStatusClassName(item.execution.status)}>
              exec {item.execution.status}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium auto-text-gray-900">
              {item.name}
            </div>
            <div className="mt-0.5 truncate font-mono text-[11px] text-gray-500 dark:text-gray-400">
              {item.id}
            </div>
          </div>
          <div className="shrink-0 text-[10px] text-gray-400">
            {item.updatedAt ? <TimeAgo time={item.updatedAt} tooltip /> : 'n/a'}
          </div>
        </div>

        <div className="truncate text-xs text-gray-600 dark:text-gray-300">
          {item.execution?.summary ||
            item.description ||
            'No summary available'}
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {item.outcome ? (
            <span className={getOutcomeClassName(item.outcome)}>
              {item.outcome}
            </span>
          ) : null}
          {item.botId ? (
            <span
              className="tag inline-block max-w-full truncate text-[10px]"
              title={`bot ${item.botId}`}
            >
              bot {item.botId}
            </span>
          ) : null}
          {item.contactId ? (
            <span
              className="tag inline-block max-w-full truncate text-[10px]"
              title={`contact ${item.contactId}`}
            >
              contact {item.contactId}
            </span>
          ) : null}
          {item.schedule ? (
            <span
              className="tag inline-block max-w-full truncate text-[10px]"
              title={item.schedule}
            >
              {item.schedule}
            </span>
          ) : null}
        </div>
      </button>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="tag hover:tag-darker text-[10px] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={item.status !== 'running' || isCanceling}
          onClick={(event) => {
            event.stopPropagation()
            onCancel()
          }}
        >
          <LuSquareX className="mr-1 inline-block h-3 w-3" />
          {isCanceling ? 'Canceling...' : `Cancel ${kindLabel[item.kind]}`}
        </button>

        <button
          type="button"
          className="tag hover:tag-darker text-[10px] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={
            item.execution?.status !== 'running' || isExecutionCanceling
          }
          onClick={(event) => {
            event.stopPropagation()
            onCancelExecution()
          }}
        >
          <LuSquareX className="mr-1 inline-block h-3 w-3" />
          {isExecutionCanceling ? 'Canceling...' : 'Cancel Execution'}
        </button>
      </div>
    </div>
  )
}

function ResourceList({
  items,
  selectedId,
  setSelectedId,
  onCancel,
  onCancelExecution,
  actionState,
  loading,
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto subtle-scrollbar">
      {items.map((item) => (
        <ResourceRow
          key={`${item.kind}:${item.id}`}
          item={item}
          selected={`${item.kind}:${item.id}` === selectedId}
          onSelect={() => setSelectedId(`${item.kind}:${item.id}`)}
          onCancel={() => onCancel(item)}
          onCancelExecution={() => onCancelExecution(item)}
          isCanceling={actionState === `resource:${item.kind}:${item.id}`}
          isExecutionCanceling={
            actionState ===
            `execution:${item.kind}:${item.id}:${item.execution?.id}`
          }
        />
      ))}

      {items.length === 0 ? (
        <div className="flex h-full items-center justify-center p-8 text-center text-sm text-gray-400">
          {loading
            ? 'Loading automation state...'
            : 'No tasks match the current filters'}
        </div>
      ) : null}
    </div>
  )
}

function DetailPanel({ item, onCancel, onCancelExecution, actionState }) {
  if (!item) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-gray-400">
        Select a task to inspect its state.
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto subtle-scrollbar">
      <div className="border-b border-gray-200 p-4 dark:border-gray-800">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="tag">{kindLabel[item.kind]}</span>
          {item.status ? (
            <span className={getStatusClassName(item.status)}>
              {item.status}
            </span>
          ) : null}
          {item.outcome ? (
            <span className={getOutcomeClassName(item.outcome)}>
              {item.outcome}
            </span>
          ) : null}
        </div>

        <div
          className="truncate text-lg font-semibold auto-text-gray-900"
          title={item.name}
        >
          {item.name}
        </div>
        <div
          className="mt-1 truncate font-mono text-xs text-gray-500"
          title={item.id}
        >
          {item.id}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="tag hover:tag-darker disabled:cursor-not-allowed disabled:opacity-60"
            disabled={
              item.status !== 'running' ||
              actionState === `resource:${item.kind}:${item.id}`
            }
            onClick={() => onCancel(item)}
          >
            <LuSquareX className="mr-1 inline-block h-3.5 w-3.5" />
            {actionState === `resource:${item.kind}:${item.id}`
              ? 'Canceling...'
              : `Cancel ${kindLabel[item.kind]}`}
          </button>

          <button
            type="button"
            className="tag hover:tag-darker disabled:cursor-not-allowed disabled:opacity-60"
            disabled={
              item.execution?.status !== 'running' ||
              actionState ===
                `execution:${item.kind}:${item.id}:${item.execution?.id}`
            }
            onClick={() => onCancelExecution(item)}
          >
            <LuSquareX className="mr-1 inline-block h-3.5 w-3.5" />
            {actionState ===
            `execution:${item.kind}:${item.id}:${item.execution?.id}`
              ? 'Canceling...'
              : 'Cancel Execution'}
          </button>
        </div>
      </div>

      <div className="space-y-6 p-4">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Stat label="Bot" value={item.botId || 'n/a'} />
          <Stat label="Contact" value={item.contactId || 'n/a'} />
          <Stat label="Schedule" value={item.schedule || 'n/a'} />
          <Stat
            label="Last Activity"
            value={item.updatedAt ? `${item.updatedAt}` : 'n/a'}
          />
        </div>

        <div className="rounded border border-gray-200 p-4 dark:border-gray-800">
          <div className="mb-3 text-sm font-semibold auto-text-gray-900">
            Resource State
          </div>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <div>Status: {item.status || 'n/a'}</div>
            <div>Outcome: {item.outcome || 'n/a'}</div>
            <div>
              Updated:{' '}
              {item.updatedAt ? (
                <TimeAgo time={item.updatedAt} tooltip />
              ) : (
                'n/a'
              )}
            </div>
            <div>
              Next run:{' '}
              {item.nextRunAt ? (
                <TimeAgo time={item.nextRunAt} tooltip />
              ) : (
                'n/a'
              )}
            </div>
            <div>
              Last run:{' '}
              {item.lastRunAt ? (
                <TimeAgo time={item.lastRunAt} tooltip />
              ) : (
                'n/a'
              )}
            </div>
          </div>
        </div>

        <div className="rounded border border-gray-200 p-4 dark:border-gray-800">
          <div className="mb-3 text-sm font-semibold auto-text-gray-900">
            Latest Execution
          </div>

          {item.execution ? (
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex flex-wrap gap-2">
                {item.execution.status ? (
                  <span className={getStatusClassName(item.execution.status)}>
                    {item.execution.status}
                  </span>
                ) : null}
                {item.execution.outcome ? (
                  <span className={getOutcomeClassName(item.execution.outcome)}>
                    {item.execution.outcome}
                  </span>
                ) : null}
              </div>
              <div
                className="truncate font-mono text-xs text-gray-500"
                title={item.execution.id}
              >
                {item.execution.id}
              </div>
              <div>
                {item.execution.summary || 'No execution summary available.'}
              </div>
              <div
                className="truncate"
                title={item.execution.conversationId || 'n/a'}
              >
                Conversation: {item.execution.conversationId || 'n/a'}
              </div>
              <div>
                Updated:{' '}
                {item.execution.updatedAt ? (
                  <TimeAgo time={item.execution.updatedAt} tooltip />
                ) : (
                  'n/a'
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-400">
              No execution record is available for this resource yet.
            </div>
          )}
        </div>

        <div className="rounded border border-gray-200 p-4 dark:border-gray-800">
          <div className="mb-3 text-sm font-semibold auto-text-gray-900">
            Description
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {item.description || 'No description available.'}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * @param {object} props
 * @param {{ items: Array<import('./normalize').AutomationItem>, updatedAt?: number } | null | undefined} [props.initialData]
 */
export function Main({ initialData }) {
  const confirm = useConfirm()

  const [items, setItems] = useState(initialData?.items || [])
  const [updatedAt, setUpdatedAt] = useState(initialData?.updatedAt || null)
  const [selectedId, setSelectedId] = useState(
    initialData?.items?.[0]
      ? `${initialData.items[0].kind}:${initialData.items[0].id}`
      : null
  )
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('')
  const [runningOnly, setRunningOnly] = useState(true)
  const [live, setLive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [actionState, setActionState] = useState(null)

  // @note new automations detected on refresh are staged here instead of being
  // injected into the visible list, so high volume never reshuffles the view.
  const [pendingItems, setPendingItems] = useState([])

  // @note mirror items + the active filter in refs so refresh can diff against
  // the current list (and detect a filter change) without re-arming the interval.
  const itemsRef = useRef(items)
  const runningOnlyRef = useRef(runningOnly)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  // @note token-driven, client-direct list: mint a list-scoped token and call
  // the task API straight from the browser instead of a server action.
  const { client: listClient } = useMintedClient(
    () => mintAutomationsListToken({}),
    'automations:list'
  )

  // @note execution detail for the selected task, fetched on-select (not fanned
  // out across the whole list).
  const [detailExecution, setDetailExecution] = useState(null)

  const hasMountedRef = useRef(false)

  const refresh = useCallback(async () => {
    if (!listClient) {
      return
    }

    setLoading(true)

    try {
      const result = await listClient.task.list({ order: 'desc', take: 100 })

      const fetched = (result.items || [])
        .map(normalizeTask)
        .filter((item) => (runningOnly ? item.status === 'running' : true))
        .sort(compareByUpdatedAtDesc)
        .slice(0, 60)

      setUpdatedAt(Date.now())

      const current = itemsRef.current

      // @note a filter change (running-only toggle) yields a different set, so
      // replace rather than buffer; same for the first/empty load.
      const filterChanged = runningOnlyRef.current !== runningOnly

      runningOnlyRef.current = runningOnly

      if (current.length === 0 || filterChanged) {
        setItems(fetched)
        setPendingItems([])

        setSelectedId((currentSelectedId) =>
          currentSelectedId &&
          fetched.some(
            (item) => `${item.kind}:${item.id}` === currentSelectedId
          )
            ? currentSelectedId
            : fetched[0]
              ? `${fetched[0].kind}:${fetched[0].id}`
              : null
        )

        return
      }

      // @note keep the visible list stable: refresh existing rows in place...
      const fetchedById = new Map(fetched.map((item) => [item.id, item]))

      setItems((prev) => prev.map((item) => fetchedById.get(item.id) || item))

      // @note ...and stage genuinely-new automations in the collapsed buffer
      const currentIds = new Set(current.map((item) => item.id))

      setPendingItems((prevPending) => {
        const pendingIds = new Set(prevPending.map((item) => item.id))

        const fresh = fetched.filter(
          (item) => !currentIds.has(item.id) && !pendingIds.has(item.id)
        )

        return fresh.length ? [...fresh, ...prevPending] : prevPending
      })
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [listClient, runningOnly])

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

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true

      return
    }

    refresh()
  }, [refresh])

  useEffect(() => {
    if (!live) {
      return
    }

    const interval = setInterval(refresh, LIST_REFRESH_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [live, refresh])

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return items.filter((item) => {
      if (kind && item.kind !== kind) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      return [
        item.kind,
        item.id,
        item.name,
        item.description,
        item.status,
        item.outcome,
        item.botId,
        item.contactId,
        item.schedule,
        item.execution?.id,
        item.execution?.summary,
        item.execution?.conversationId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    })
  }, [items, kind, query])

  const selectedItem =
    filteredItems.find((item) => `${item.kind}:${item.id}` === selectedId) ||
    filteredItems[0] ||
    null

  const selectedTaskId =
    selectedItem && selectedItem.kind === 'task' ? selectedItem.id : null

  // @note token-driven, client-direct detail: mint a per-task token and fetch
  // this task's latest execution on select (no per-row execution fan-out).
  const { client: taskClient } = useMintedClient(
    () => mintAutomationToken({ taskId: selectedTaskId || '' }),
    selectedTaskId
  )

  useEffect(() => {
    if (!taskClient || !selectedTaskId) {
      setDetailExecution(null)

      return
    }

    let cancelled = false

    const load = async () => {
      try {
        const result = await taskClient.task.execution.list(selectedTaskId, {
          order: 'desc',
          take: EXECUTION_TAKE,
        })

        if (!cancelled) {
          setDetailExecution(pickLatestExecution(result.items || []))
        }
      } catch {
        // @note best-effort - keep the prior execution on a transient failure
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [taskClient, selectedTaskId])

  const selectedItemWithExecution = selectedItem
    ? { ...selectedItem, execution: detailExecution }
    : null

  const runningTaskCount = filteredItems.filter(
    (item) => item.kind === 'task' && item.status === 'running'
  ).length

  const runningExecutionCount = detailExecution?.status === 'running' ? 1 : 0

  const handleCancel = useCallback(
    async (item) => {
      if (
        !(await confirm(
          `Are you sure you want to cancel this ${kindLabel[item.kind].toLowerCase()}?`
        ))
      ) {
        return
      }

      const key = `resource:${item.kind}:${item.id}`

      setActionState(key)

      try {
        const result = await cancelAutomation({
          kind: item.kind,
          id: item.id,
        })

        if (result?.error) {
          toast.error(result.error.message)

          return
        }

        toast.success(`${kindLabel[item.kind]} canceled.`)
        await refresh()
      } catch (e) {
        toast.error(e.message)
      } finally {
        setActionState(null)
      }
    },
    [confirm, refresh]
  )

  const handleCancelExecution = useCallback(
    async (item) => {
      if (!item.execution?.id) {
        return
      }

      if (
        !(await confirm(
          `Are you sure you want to cancel this ${kindLabel[item.kind].toLowerCase()} execution?`
        ))
      ) {
        return
      }

      const key = `execution:${item.kind}:${item.id}:${item.execution.id}`

      setActionState(key)

      try {
        const result = await cancelAutomationExecution({
          kind: item.kind,
          id: item.id,
          executionId: item.execution.id,
        })

        if (result?.error) {
          toast.error(result.error.message)

          return
        }

        toast.success('Execution canceled.')
        await refresh()
      } catch (e) {
        toast.error(e.message)
      } finally {
        setActionState(null)
      }
    },
    [confirm, refresh]
  )

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-white dark:bg-gray-950">
      <AppToolbar>
        <ToolbarButton onClick={refresh} disabled={loading} title="Refresh">
          <LuRefreshCcw
            className={clsx('h-3.5 w-3.5', {
              'animate-spin': loading,
            })}
          />
          Refresh
        </ToolbarButton>

        <ToolbarToggle
          checked={live}
          setChecked={setLive}
          className={clsx('w-20', {
            'text-red-500': live,
          })}
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

        <ToolbarToggle
          checked={runningOnly}
          setChecked={setRunningOnly}
          className="w-24"
          title="Show only running automations"
          icon={<LuWaves className="h-3.5 w-3.5" />}
        >
          {runningOnly ? 'Running' : 'All Recent'}
        </ToolbarToggle>

        <ToolbarSearch
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tasks, executions..."
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

      <div className="grid grid-cols-2 gap-2 border-b border-gray-200 p-3 dark:border-gray-800">
        <Stat label="Running Tasks" value={runningTaskCount} />
        <Stat label="Running Executions" value={runningExecutionCount} />
      </div>

      <div className="min-h-0 flex flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 w-full flex-1 flex-col lg:max-w-[42%] lg:border-r lg:border-gray-200 dark:lg:border-gray-800">
          <div className="flex items-start justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold auto-text-gray-900">
                <LuWorkflow className="h-4 w-4" />
                Automation Monitor
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Live operational view of task activity with SDK-backed cancel
                controls.
              </div>
            </div>
            {pendingItems.length > 0 ? (
              <button
                type="button"
                className="default-button small"
                onClick={showPendingItems}
                title="Show newly arrived automations"
              >
                {pendingItems.length} new ↑
              </button>
            ) : null}
          </div>

          <ResourceList
            items={filteredItems}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            onCancel={handleCancel}
            onCancelExecution={handleCancelExecution}
            actionState={actionState}
            loading={loading}
          />
        </div>

        <div className="min-h-0 w-full flex-1">
          <DetailPanel
            item={selectedItemWithExecution}
            onCancel={handleCancel}
            onCancelExecution={handleCancelExecution}
            actionState={actionState}
          />
        </div>
      </div>
    </div>
  )
}
