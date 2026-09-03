'use client'

import { useRef, useState, useTransition } from 'react'

import cuid from '@/lib/cuid'
import { isDevelopment } from '@/lib/env'
import toast from '@/lib/toast'

import { AppScene } from '@/layouts/App'

import List from '@/components/List'
import Skeleton from '@/components/Skeleton'
import Spinner from '@/components/Spinner'

import useCache from '@/hooks/useCache'
import useTrace from '@/hooks/useTrace'

import manifest from './app.manifest'
import { APP_NAME, SUBMIT_PRIORITIES_FUNCTION_NAME } from './const'
import { gatherPriorities, streamChannelEvents } from './server'

import { consume } from '@chatbotkit/react/utils/stream'

import clsx from 'clsx'

// @note cache key for storing channel information
const CHANNEL_CACHE_KEY = `${APP_NAME}-channel`
// @note cache key for storing priorities
const PRIORITIES_CACHE_KEY = `${APP_NAME}-priorities`
// @note cache TTL of 30 minutes
const CACHE_TTL = (isDevelopment ? 1 : 30) * 60 * 1000
// @note maximum retry attempts for channel subscription
const MAX_SUBSCRIPTION_RETRIES = 3
// @note delay between retry attempts in milliseconds
const RETRY_DELAY_MS = 2000

/**
 * Converts a slug to lowercase with hyphens for comparison.
 *
 * @param {string} str
 * @returns {string}
 */
function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Transforms raw priority items into the final Priority format.
 *
 * @param {Array<{ title?: string, description?: string, importance?: string, source?: string }>} rawPriorities
 * @param {Array<{ id: string, name?: string }>} bots
 * @param {number} totalMaxPriorities
 * @returns {Array<{ id: string, title: string, description: string, importance: string, source: { botId: string, botName: string }, createdAt: number }>}
 */
function transformPriorities(rawPriorities, bots, totalMaxPriorities) {
  const priorities = rawPriorities
    .slice(0, totalMaxPriorities)
    .map((item, index) => {
      // Find the bot by source name
      const sourceBot = bots.find(
        (bot) =>
          bot.name?.toLowerCase() === item.source?.toLowerCase() ||
          toSlug(bot.name || '') === toSlug(item.source || '')
      )

      const importance = ['critical', 'high', 'medium', 'low'].includes(
        item.importance
      )
        ? item.importance
        : 'medium'

      return {
        id: `priority-${Date.now()}-${index}`,
        title: item.title || 'Untitled Priority',
        description: item.description || '',
        importance,
        source: {
          botId: sourceBot?.id || 'unknown',
          botName: item.source || sourceBot?.name || 'Unknown Agent',
        },
        createdAt: Date.now(),
      }
    })

  const importanceOrder = { critical: 0, high: 1, medium: 2, low: 3 }

  priorities.sort(
    (a, b) => importanceOrder[a.importance] - importanceOrder[b.importance]
  )

  return priorities
}

const importanceStyles = {
  critical: 'tag-error',
  high: 'tag-warning',
  medium: 'tag-darker',
  low: 'tag-lighter',
}

const importanceLabels = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

function PriorityTag({ importance }) {
  return (
    <span className={clsx('tag', importanceStyles[importance])}>
      {importanceLabels[importance]}
    </span>
  )
}

function SourceTag({ botName }) {
  return <span className="tag">{botName}</span>
}

/**
 * Formats an activity function name into a user-friendly display message.
 *
 * @param {string} name
 * @returns {string}
 */
function formatActivityName(name) {
  if (!name) {
    return 'Working...'
  }

  // @note handle "Call Once Agent: {AgentName}" pattern from orchestrator

  const agentMatch = name.match(/^Call Once Agent:\s*(.+)$/i)

  if (agentMatch) {
    return `Consulting ${agentMatch[1]}...`
  }

  // @note handle "bot" action which indicates calling a sub-agent

  if (name.toLowerCase() === 'bot') {
    return 'Consulting agent...'
  }

  // @note handle submit_priorities which indicates finalizing

  if (name === SUBMIT_PRIORITIES_FUNCTION_NAME) {
    return 'Compiling priorities...'
  }

  // @note convert snake_case or camelCase to readable format

  const formatted = name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()

  return `${formatted.charAt(0).toUpperCase() + formatted.slice(1)}...`
}

/**
 * Fetches priorities from a channel by subscribing and extracting activity messages.
 * Handles retries for connection timeouts when no result has been received yet.
 *
 * @param {string} channelId
 * @param {Array<{ id: string, name?: string }>} bots
 * @param {number} totalMaxPriorities
 * @param {import('@/hooks/useTrace').Trace} trace
 * @param {{ onActivity?: (activity: { name: string, type: 'request' | 'response' }) => void }} options
 * @returns {Promise<Array>}
 */
async function fetchPrioritiesFromChannel(
  channelId,
  bots,
  totalMaxPriorities,
  trace,
  options = {}
) {
  const { onActivity } = options

  let rawPriorities = []
  let hasReceivedResult = false
  let lastMessageIndex = -1
  let retryCount = 0

  while (retryCount <= MAX_SUBSCRIPTION_RETRIES && !hasReceivedResult) {
    try {
      const eventStream = await consume(
        streamChannelEvents({
          channelId: channelId,
          lastMessageIndex:
            lastMessageIndex >= 0 ? lastMessageIndex : undefined,
        })
      )

      for await (const event of eventStream) {
        trace.event(event.type, event.data)

        // @note track message index for resumability

        lastMessageIndex++

        // @note extract activity data for cleaner access
        const isActivityMessage =
          event.type === 'message' &&
          event.data.type === 'message' &&
          event.data.data.type === 'activity'

        const activityData = isActivityMessage
          ? event.data.data.meta?.activity
          : null

        // @note emit activity events for real-time updates

        if (activityData?.function?.name) {
          onActivity?.({
            name: activityData.function.name,
            type: activityData.type,
          })
        }

        // @note look for activity messages with the submit_priorities function

        if (
          activityData?.type === 'response' &&
          activityData?.function?.name === SUBMIT_PRIORITIES_FUNCTION_NAME
        ) {
          const args = activityData.function.arguments

          if (args?.priorities && Array.isArray(args.priorities)) {
            rawPriorities.push(...args.priorities)
          }
        }

        // @note check for result event which indicates completion

        if (event.type === 'message' && event.data.type === 'result') {
          hasReceivedResult = true

          break
        }
      }

      // @note stream completed normally
      break
    } catch (err) {
      // @note retry on network errors only if no result received yet

      const isTimeoutOrNetworkError =
        err.name === 'AbortError' ||
        err.message?.includes('timeout') ||
        err.message?.includes('network') ||
        err.code === 'INVALID_STREAM_RESULT'

      if (
        !hasReceivedResult &&
        retryCount < MAX_SUBSCRIPTION_RETRIES &&
        isTimeoutOrNetworkError
      ) {
        retryCount++

        // @note wait before retrying

        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))

        continue
      }

      // @note if we have partial data, use it; otherwise throw

      if (rawPriorities.length === 0) {
        throw err
      }

      break
    }
  }

  return transformPriorities(rawPriorities, bots, totalMaxPriorities)
}

/**
 * Skeleton loading state showing a list of placeholder items.
 */
function SkeletonPriorityList() {
  return (
    <List>
      {Array.from({ length: 5 }).map((_, index) => (
        <List.Item
          key={`skeleton-${index}`}
          icon={null}
          title={<Skeleton className="h-5 w-3/4 rounded" />}
          body={<Skeleton className="h-4 w-full rounded mt-2" />}
          timestamp={null}
          focusable={false}
        >
          <Skeleton className="h-6 w-16 rounded" />
          <Skeleton className="h-6 w-24 rounded" />
        </List.Item>
      ))}
    </List>
  )
}

export function PriorityList() {
  const [isPending, startTransition] = useTransition()

  // @note track current activity for loading display
  const [currentActivity, setCurrentActivity] = useState(null)
  const activityCallbackRef = useRef(null)

  // @note update the callback ref so it can be used in the async function
  activityCallbackRef.current = (activity) => {
    setCurrentActivity(activity)
  }

  const trace = useTrace()

  const {
    data: channelInfo,
    loading: channelLoading,
    error: channelError,
    refresh: refreshChannel,
    clearCache: clearChannelCache,
  } = useCache(
    CHANNEL_CACHE_KEY,
    async () => {
      const channelId = cuid()

      const result = await gatherPriorities({
        channelId: channelId,
      })

      if (!result || 'error' in result) {
        throw new Error(
          result?.error?.message || 'Failed to dispatch priorities job'
        )
      }

      return result
    },
    { ttl: CACHE_TTL },
    []
  )

  const {
    data: priorities,
    loading: prioritiesLoading,
    error: prioritiesError,
    refresh: refreshPriorities,
    clearCache: clearPrioritiesCache,
  } = useCache(
    PRIORITIES_CACHE_KEY,
    async () => {
      if (!channelInfo?.channelId) {
        return null
      }

      // @note reset current activity when starting to fetch
      setCurrentActivity(null)

      trace.log(`fetch/priorities`)

      return fetchPrioritiesFromChannel(
        channelInfo.channelId,
        channelInfo.bots,
        channelInfo.totalMaxPriorities,
        trace,
        { onActivity: (activity) => activityCallbackRef.current?.(activity) }
      )
    },
    { ttl: CACHE_TTL, staleWhileRevalidate: true },
    [channelInfo?.channelId]
  )

  const loading = channelLoading || prioritiesLoading

  const error = channelError?.message || prioritiesError?.message

  const handleRefresh = () => {
    startTransition(async () => {
      const toastId = toast.loading('Refreshing priorities...', {})

      try {
        clearChannelCache()
        clearPrioritiesCache()

        // @note reset current activity when refreshing
        setCurrentActivity(null)

        await refreshChannel()
        await refreshPriorities()

        toast.success('Priorities refreshed!', { id: toastId })
      } catch (e) {
        toast.error(e.message, { id: toastId })
      }
    })
  }

  // @note show skeleton loading only when there's no previous data
  if (loading && !priorities) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <Spinner className="h-8 w-8" />
          {currentActivity?.name ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 shimmer-subtle max-w-xs text-center truncate">
              {formatActivityName(currentActivity.name)}
            </p>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gathering priorities from your agents...
            </p>
          )}
        </div>
        <SkeletonPriorityList />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-8 text-center dark:border-red-700 dark:bg-red-900/20">
        <div className="mx-auto max-w-sm">
          <h3 className="text-lg font-medium text-red-900 dark:text-red-100">
            Failed to load priorities
          </h3>
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            className="primary-button mt-4"
            type="button"
            onClick={handleRefresh}
            disabled={isPending}
          >
            {isPending ? 'Retrying...' : 'Try Again'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* @note show loading indicator when refreshing with existing priorities */}
      {loading && priorities && (
        <div className="flex flex-col items-center justify-center gap-2 py-4">
          <Spinner className="h-6 w-6" />
          {currentActivity?.name ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 shimmer-subtle max-w-xs text-center truncate">
              {formatActivityName(currentActivity.name)}
            </p>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Updating priorities...
            </p>
          )}
        </div>
      )}
      {priorities && priorities.length > 0 ? (
        <List
          actions={
            <button
              className="primary-button small"
              type="button"
              onClick={handleRefresh}
              disabled={isPending}
            >
              {isPending ? 'Refreshing...' : 'Refresh'}
            </button>
          }
        >
          {priorities.map(({ id, title, description, importance, source }) => (
            <List.Item
              key={id}
              icon={null}
              title={title}
              body={description}
              timestamp={null}
              focusable={false}
            >
              <PriorityTag importance={importance} />
              <SourceTag botName={source.botName} />
            </List.Item>
          ))}
        </List>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
          <div className="mx-auto max-w-sm">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              No priorities found
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Your connected agents haven&apos;t identified any priorities yet.
              Configure bots in the app settings to start seeing priorities.
            </p>
            <button
              className="primary-button mt-4"
              type="button"
              onClick={handleRefresh}
              disabled={isPending}
            >
              {isPending ? 'Checking...' : 'Check Now'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Scene({ className, ...props }) {
  return (
    <AppScene
      {...props}
      className={clsx('scene', className)}
      name={null}
      headline="Your Top Priorities"
      description={manifest.description}
    />
  )
}

export function Main() {
  return (
    <>
      {/* scene */}
      <Scene compact={true} />
      {/* priorities list */}
      <PriorityList />
    </>
  )
}
