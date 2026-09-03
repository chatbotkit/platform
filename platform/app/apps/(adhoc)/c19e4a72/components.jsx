'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import {
  LuArchive,
  LuBell,
  LuCircleCheck,
  LuClock3,
  LuExternalLink,
  LuFilter,
  LuInbox,
  LuMessageSquare,
  LuRefreshCcw,
  LuSearch,
  LuShieldAlert,
  LuSparkles,
  LuTrash2,
  LuTriangleAlert,
} from 'react-icons/lu'

import Link from '@/components/Link'
import TimeAgo from '@/components/TimeAgo'

import {
  AppToolbar,
  ToolbarButton,
  ToolbarSearch,
  ToolbarSelect,
  ToolbarSpacer,
  ToolbarStatus,
  ToolbarToggle,
} from '@/app/apps/_components/Toolbar'

import toast from '@/lib/toast'

import { deleteConversation, getConversations } from './server'

import clsx from 'clsx'

const CHANNELS = [
  { key: 'latest', label: 'All', meta: null, accent: 'bg-gray-500' },
  {
    key: 'widget',
    label: 'Widget',
    meta: { app: 'widget' },
    accent: 'bg-blue-500',
  },
  {
    key: 'slack',
    label: 'Slack',
    meta: { app: 'slack' },
    accent: 'bg-violet-500',
  },
  {
    key: 'discord',
    label: 'Discord',
    meta: { app: 'discord' },
    accent: 'bg-indigo-500',
  },
  {
    key: 'email',
    label: 'Email',
    meta: { app: 'email' },
    accent: 'bg-emerald-500',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    meta: { app: 'whatsapp' },
    accent: 'bg-green-500',
  },
  {
    key: 'telegram',
    label: 'Telegram',
    meta: { app: 'telegram' },
    accent: 'bg-sky-500',
  },
  {
    key: 'moderation',
    label: 'Moderation',
    meta: { 'abuse.flagged': 'true' },
    accent: 'bg-rose-500',
  },
  { key: 'console', label: 'Console', meta: { app: 'console' }, accent: 'bg-zinc-500' },
]

const QUEUES = [
  { key: 'all', label: 'All' },
  { key: 'attention', label: 'Needs Attention' },
  { key: 'followup', label: 'Follow Up' },
  { key: 'healthy', label: 'Healthy' },
]

const URGENT_TERMS = [
  'urgent',
  'refund',
  'cancel',
  'broken',
  'error',
  'issue',
  'angry',
  'help',
  'billing',
  'failed',
]

function normalizeText(value) {
  return String(value || '').toLowerCase()
}

function getConversationApp(conversation) {
  return conversation?.meta?.app || conversation?.meta?.source || 'unknown'
}

function isFlagged(conversation) {
  const meta = conversation?.meta || {}

  return (
    meta['abuse.flagged'] === true ||
    meta['abuse.flagged'] === 'true' ||
    meta.flagged === true ||
    meta.flagged === 'true'
  )
}

function getContactLabel(conversation) {
  const contact = conversation?.contact || {}

  return (
    contact.name ||
    contact.email ||
    contact.phone ||
    contact.nick ||
    conversation?.name ||
    'Anonymous visitor'
  )
}

function getSummary(conversation) {
  return (
    conversation?.description ||
    conversation?.name ||
    'No summary has been captured for this conversation yet.'
  )
}

function getConversationText(conversation) {
  return [
    conversation?.id,
    conversation?.name,
    conversation?.description,
    getContactLabel(conversation),
    getConversationApp(conversation),
    ...Object.values(conversation?.meta || {}),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function getAgeHours(conversation) {
  const date = new Date(conversation?.updatedAt || conversation?.createdAt || 0)
  const time = date.getTime()

  if (!time) {
    return 0
  }

  return Math.max(0, (Date.now() - time) / 36e5)
}

function getPriority(conversation) {
  const text = normalizeText(
    `${conversation?.name || ''} ${conversation?.description || ''}`
  )
  const urgentHits = URGENT_TERMS.filter((term) => text.includes(term)).length
  const flaggedBoost = isFlagged(conversation) ? 55 : 0
  const channelBoost = ['email', 'slack', 'whatsapp'].includes(
    getConversationApp(conversation)
  )
    ? 8
    : 0
  const freshnessBoost = getAgeHours(conversation) < 12 ? 10 : 0

  return Math.min(
    99,
    22 + flaggedBoost + urgentHits * 12 + channelBoost + freshnessBoost
  )
}

function getQueue(conversation) {
  const score = getPriority(conversation)

  if (score >= 70 || isFlagged(conversation)) {
    return 'attention'
  }

  if (score >= 45) {
    return 'followup'
  }

  return 'healthy'
}

function getChannel(key) {
  return CHANNELS.find((channel) => channel.key === key) || CHANNELS[0]
}

function StatTile({ icon, label, value, tone }) {
  return (
    <div className="min-h-20 rounded border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-medium uppercase text-gray-500">
          {label}
        </div>
        <div
          className={clsx(
            'flex h-7 w-7 items-center justify-center rounded',
            tone
          )}
        >
          {icon}
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold auto-text-gray-900">
        {value}
      </div>
    </div>
  )
}

function QueueButton({ active, label, count, onClick }) {
  return (
    <button
      className={clsx(
        'flex h-9 shrink-0 items-center gap-2 rounded border px-3 text-xs transition-colors',
        active
          ? 'border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-950'
          : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-900'
      )}
      type="button"
      onClick={onClick}
    >
      <span>{label}</span>
      <span
        className={clsx(
          'rounded px-1.5 py-0.5 font-mono text-[10px]',
          active
            ? 'bg-white/20 text-current'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-900'
        )}
      >
        {count}
      </span>
    </button>
  )
}

function ConversationRow({ conversation, selected, onSelect }) {
  const app = getConversationApp(conversation)
  const channel = CHANNELS.find((item) => item.key === app)
  const priority = getPriority(conversation)
  const queue = getQueue(conversation)

  return (
    <button
      className={clsx(
        'w-full border-b border-gray-100 px-4 py-3 text-left transition-colors dark:border-gray-900',
        selected
          ? 'bg-gray-50 dark:bg-gray-900'
          : 'bg-white hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-900'
      )}
      type="button"
      onClick={() => onSelect(conversation)}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded bg-gray-100 dark:bg-gray-900">
          {isFlagged(conversation) ? (
            <LuShieldAlert className="h-4 w-4 text-rose-500" />
          ) : (
            <LuMessageSquare className="h-4 w-4 text-gray-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold auto-text-gray-900">
                {getContactLabel(conversation)}
              </div>
              <div className="mt-0.5 truncate text-xs text-gray-500">
                {getSummary(conversation)}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono text-[11px] text-gray-500">
                <TimeAgo time={conversation.updatedAt || conversation.createdAt} />
              </div>
              <div className="mt-1 font-mono text-[10px] text-gray-400">
                P{priority}
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="tag text-[10px]">
              <span
                className={clsx(
                  'mr-1 inline-block h-1.5 w-1.5 rounded-full',
                  channel?.accent || 'bg-gray-400'
                )}
              />
              {app}
            </span>
            <span className="tag text-[10px]">{queue.replace('-', ' ')}</span>
            {isFlagged(conversation) ? (
              <span className="tag text-[10px] text-rose-600 dark:text-rose-300">
                flagged
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  )
}

function SelectedConversation({ conversation, onDelete }) {
  if (!conversation) {
    return (
      <div className="flex h-full min-h-80 flex-col items-center justify-center px-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-100 dark:bg-gray-900">
          <LuInbox className="h-5 w-5 text-gray-500" />
        </div>
        <h2 className="mt-4 text-base font-semibold auto-text-gray-900">
          Pick a conversation
        </h2>
        <p className="mt-2 max-w-sm text-sm text-gray-500">
          Select any row to inspect why it is being prioritized and jump into
          the full Inbox record.
        </p>
      </div>
    )
  }

  const app = getConversationApp(conversation)
  const priority = getPriority(conversation)
  const queue = getQueue(conversation)
  const metaEntries = Object.entries(conversation.meta || {}).slice(0, 8)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-gray-200 p-5 dark:border-gray-800">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tag text-[10px]">{app}</span>
              <span className="tag text-[10px]">{queue}</span>
              {isFlagged(conversation) ? (
                <span className="tag text-[10px] text-rose-600 dark:text-rose-300">
                  safety review
                </span>
              ) : null}
            </div>
            <h1 className="mt-3 truncate text-xl font-semibold auto-text-gray-900">
              {getContactLabel(conversation)}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-500">
              {getSummary(conversation)}
            </p>
          </div>
          <div className="shrink-0 rounded border border-gray-200 px-3 py-2 text-center dark:border-gray-800">
            <div className="text-[10px] uppercase text-gray-400">Priority</div>
            <div className="mt-1 font-mono text-2xl font-semibold">
              {priority}
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-5">
        <div className="grid gap-4 xl:grid-cols-[1fr_18rem]">
          <section className="rounded border border-gray-200 dark:border-gray-800">
            <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
              <LuSparkles className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold auto-text-gray-900">
                Suggested Next Move
              </h2>
            </header>
            <div className="space-y-3 p-4 text-sm text-gray-600 dark:text-gray-300">
              {isFlagged(conversation) ? (
                <p>
                  Review this conversation before any automated follow-up. It
                  contains safety metadata and should stay in the attention
                  queue until cleared.
                </p>
              ) : priority >= 70 ? (
                <p>
                  Treat this as high priority. Open the full thread, confirm the
                  customer goal, and resolve or route it while context is fresh.
                </p>
              ) : priority >= 45 ? (
                <p>
                  Good candidate for follow-up. Check whether the request is
                  waiting on a person, a system answer, or a handoff.
                </p>
              ) : (
                <p>
                  This looks stable. Keep it visible for sampling, quality
                  review, or trend discovery.
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  className="primary-button small inline-flex items-center gap-1.5"
                  href={`/apps/inbox/${conversation.id}`}
                >
                  Open Thread
                  <LuExternalLink className="h-3.5 w-3.5" />
                </Link>
                <button
                  className="default-button small inline-flex items-center gap-1.5"
                  type="button"
                  onClick={() => onDelete(conversation)}
                >
                  <LuTrash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          </section>

          <section className="rounded border border-gray-200 dark:border-gray-800">
            <header className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
              <h2 className="text-sm font-semibold auto-text-gray-900">
                Conversation Facts
              </h2>
            </header>
            <dl className="divide-y divide-gray-100 text-sm dark:divide-gray-900">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="text-gray-500">Created</dt>
                <dd className="font-mono text-xs">
                  <TimeAgo time={conversation.createdAt} tooltip />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="text-gray-500">Channel</dt>
                <dd className="font-mono text-xs">{app}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="text-gray-500">ID</dt>
                <dd className="max-w-36 truncate font-mono text-xs">
                  {conversation.id}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <section className="mt-4 rounded border border-gray-200 dark:border-gray-800">
          <header className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
            <h2 className="text-sm font-semibold auto-text-gray-900">
              Metadata
            </h2>
          </header>
          {metaEntries.length > 0 ? (
            <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-4">
              {metaEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="rounded border border-gray-200 p-3 dark:border-gray-800"
                >
                  <div className="truncate font-mono text-[10px] uppercase text-gray-400">
                    {key}
                  </div>
                  <div className="mt-1 truncate text-xs auto-text-gray-900">
                    {String(value)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-sm text-gray-500">
              No metadata is attached to this conversation.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export function Main({ initialData }) {
  const [items, setItems] = useState(initialData?.items || [])
  const [cursor, setCursor] = useState(initialData?.cursor || null)
  const [selectedId, setSelectedId] = useState(initialData?.items?.[0]?.id)
  const [channel, setChannel] = useState('latest')
  const [queue, setQueue] = useState('all')
  const [query, setQuery] = useState('')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(new Date())
  const [isPending, startTransition] = useTransition()

  const selected = items.find((item) => item.id === selectedId) || null

  const queueCounts = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.all += 1
        acc[getQueue(item)] += 1

        return acc
      },
      { all: 0, attention: 0, followup: 0, healthy: 0 }
    )
  }, [items])

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return items
      .filter((item) => {
        if (queue !== 'all' && getQueue(item) !== queue) {
          return false
        }

        if (flaggedOnly && !isFlagged(item)) {
          return false
        }

        if (
          normalizedQuery &&
          !getConversationText(item).includes(normalizedQuery)
        ) {
          return false
        }

        return true
      })
      .sort((a, b) => getPriority(b) - getPriority(a))
  }, [flaggedOnly, items, query, queue])

  const fetchItems = useCallback(
    ({ append = false } = {}) => {
      startTransition(async () => {
        const nextChannel = getChannel(channel)
        const result = await getConversations({
          cursor: append ? cursor || undefined : undefined,
          take: 24,
          order: 'desc',
          meta: nextChannel.meta || undefined,
        })

        if (!result || 'error' in result) {
          toast.error('Unable to load conversations')

          return
        }

        setItems((current) =>
          append ? [...current, ...result.items] : result.items
        )
        setCursor(result.cursor || null)
        setSelectedId((current) => {
          if (append && current) {
            return current
          }

          return result.items?.[0]?.id
        })
        setUpdatedAt(new Date())
      })
    },
    [channel, cursor]
  )

  const handleChannelChange = useCallback((nextChannel) => {
    setChannel(nextChannel)
    setQueue('all')
    setFlaggedOnly(false)
    startTransition(async () => {
      const channelConfig = getChannel(nextChannel)
      const result = await getConversations({
        take: 24,
        order: 'desc',
        meta: channelConfig.meta || undefined,
      })

      if (!result || 'error' in result) {
        toast.error('Unable to switch inbox view')

        return
      }

      setItems(result.items || [])
      setCursor(result.cursor || null)
      setSelectedId(result.items?.[0]?.id)
      setUpdatedAt(new Date())
    })
  }, [])

  const handleDelete = useCallback(
    async (conversation) => {
      if (!window.confirm('Delete this conversation? This cannot be undone.')) {
        return
      }

      const toastId = toast.loading('Deleting conversation...')
      const previousItems = items

      setItems((current) =>
        current.filter((item) => item.id !== conversation.id)
      )
      setSelectedId((current) =>
        current === conversation.id
          ? items.find((item) => item.id !== conversation.id)?.id
          : current
      )

      const result = await deleteConversation({ id: conversation.id })

      if (!result || 'error' in result) {
        setItems(previousItems)
        setSelectedId(conversation.id)
        toast.error('Unable to delete conversation', { id: toastId })

        return
      }

      toast.success('Conversation deleted', { id: toastId })
    },
    [items]
  )

  return (
    <div className="flex h-screen min-h-0 flex-col bg-gray-50 text-gray-900 dark:bg-black dark:text-gray-100">
      <AppToolbar className="bg-white dark:bg-gray-950">
        <ToolbarButton
          disabled={isPending}
          onClick={() => fetchItems()}
          title="Refresh conversations"
        >
          <LuRefreshCcw
            className={clsx('h-3.5 w-3.5', { 'animate-spin': isPending })}
          />
          Refresh
        </ToolbarButton>
        <ToolbarSearch
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people, summaries, channels, metadata..."
          icon={<LuSearch className="h-3.5 w-3.5" />}
        />
        <ToolbarSelect
          value={channel}
          onChange={(event) => handleChannelChange(event.target.value)}
          title="Channel"
        >
          {CHANNELS.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </ToolbarSelect>
        <ToolbarToggle
          checked={flaggedOnly}
          setChecked={setFlaggedOnly}
          icon={<LuFilter className="h-3.5 w-3.5" />}
        >
          Flagged
        </ToolbarToggle>
        <ToolbarSpacer />
        <ToolbarStatus>
          Updated <TimeAgo time={updatedAt} tooltip />
        </ToolbarStatus>
      </AppToolbar>

      <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] lg:grid-cols-[24rem_1fr] lg:grid-rows-1">
        <aside className="flex min-h-0 flex-col border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 lg:border-b-0 lg:border-r">
          <div className="border-b border-gray-200 p-4 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded bg-gray-100 dark:bg-gray-900">
                <LuInbox className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold auto-text-gray-900">
                  Triage Inbox
                </h1>
                <p className="truncate text-xs text-gray-500">
                  Prioritized conversations from {getChannel(channel).label}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <StatTile
                icon={<LuBell className="h-4 w-4 text-rose-600" />}
                label="Attention"
                value={queueCounts.attention}
                tone="bg-rose-50 dark:bg-rose-500/10"
              />
              <StatTile
                icon={<LuClock3 className="h-4 w-4 text-amber-600" />}
                label="Follow Up"
                value={queueCounts.followup}
                tone="bg-amber-50 dark:bg-amber-500/10"
              />
              <StatTile
                icon={<LuCircleCheck className="h-4 w-4 text-emerald-600" />}
                label="Healthy"
                value={queueCounts.healthy}
                tone="bg-emerald-50 dark:bg-emerald-500/10"
              />
              <StatTile
                icon={<LuTriangleAlert className="h-4 w-4 text-fuchsia-600" />}
                label="Flagged"
                value={items.filter(isFlagged).length}
                tone="bg-fuchsia-50 dark:bg-fuchsia-500/10"
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto border-b border-gray-200 p-3 dark:border-gray-800">
            {QUEUES.map((item) => (
              <QueueButton
                key={item.key}
                active={queue === item.key}
                label={item.label}
                count={queueCounts[item.key]}
                onClick={() => setQueue(item.key)}
              />
            ))}
          </div>

          <div className="h-[22rem] overflow-auto lg:h-auto lg:min-h-0 lg:flex-1">
            {filteredItems.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                selected={conversation.id === selectedId}
                onSelect={(item) => setSelectedId(item.id)}
              />
            ))}

            {filteredItems.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center px-6 text-center text-sm text-gray-500">
                <LuArchive className="mb-3 h-5 w-5" />
                No conversations match this view.
              </div>
            ) : null}
          </div>

          {cursor ? (
            <div className="border-t border-gray-200 p-3 dark:border-gray-800">
              <button
                className="default-button small w-full"
                disabled={isPending}
                type="button"
                onClick={() => fetchItems({ append: true })}
              >
                Load More
              </button>
            </div>
          ) : null}
        </aside>

        <main className="min-h-0 bg-gray-50 dark:bg-black">
          <SelectedConversation
            conversation={selected}
            onDelete={handleDelete}
          />
        </main>
      </div>
    </div>
  )
}
