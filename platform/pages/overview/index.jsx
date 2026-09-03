import { useEffect, useState } from 'react'

import fetch from '@/lib/fetch'
import { icons as integrationIcons } from '@/lib/integration.items'
import { INTEGRATION_CREDENTIALS } from '@/lib/integration.verification'
import { shortFormat } from '@/lib/number'
import { getUserDisplayLimits } from '@/lib/limit.core'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'
import { getUsage } from '@/lib/usage.get'

import Dashboard from '@/layouts/Dashboard'

import DocsLink, { getDocsHref } from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import FadeInIframe from '@/components/FadeInIframe'
import Hero from '@/components/Hero'
import IPhoneFrame from '@/components/IPhoneFrame'
import Initials from '@/components/Initials'
import Link from '@/components/Link'
import ProgressBar from '@/components/ProgressBar'
import {
  TeamSwitchButton,
  useSessionContext,
} from '@/components/SessionContext'
import SimpleTabs from '@/components/SimpleTabs'
import TimeAgo from '@/components/TimeAgo'

import useFetch from '@/hooks/useFetch'
import usePartner from '@/hooks/usePartner'
import usePlatformExperience from '@/hooks/usePlatformExperience'
import usePopup from '@/hooks/usePopup'
import useProjectScope from '@/hooks/useProjectScope'
import useRouter from '@/hooks/useRouter'

import faq from '@/content/faqs/platform-overview.yaml'

import clsx from 'clsx'
import {
  ArrowUpRight,
  Circle,
  CircleCheck,
  Code,
  FileText,
  KeyRound,
  LayoutGrid,
  LifeBuoy,
  MessagesSquare,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'

const docs = [
  {
    title: 'Blueprints',
    description: 'Understand how blueprints organize and connect resources.',
    href: getDocsHref('blueprints'),
  },
  {
    title: 'Bots',
    description: 'Configure the core assistant behavior and capabilities.',
    href: getDocsHref('bots'),
  },
  {
    title: 'Widgets',
    description: 'Embed conversational assistants into websites and apps.',
    href: getDocsHref('widget'),
  },
  {
    title: 'Datasets',
    description: 'Connect knowledge sources for retrieval and context.',
    href: getDocsHref('datasets'),
  },
  {
    title: 'Skillsets',
    description: 'Add reusable abilities and actions to assistants.',
    href: getDocsHref('skillsets'),
  },
  {
    title: 'Integrations',
    description: 'Connect assistants to channels and external systems.',
    href: getDocsHref('integrations'),
  },
]

export function SummaryItem({ title, value, description, link }) {
  return (
    <div
      className={clsx(
        'h-48',
        'flex flex-col',
        'border auto-border-gray-200 hover:auto-border-gray-300',
        'transition-all duration-200',
        'rounded-xl',
        'auto-bg-gray-50'
      )}
    >
      <Link
        className={clsx(
          'flex-1',
          'flex flex-col',
          'p-4',
          'rounded-xl',
          'auto-bg-white'
        )}
        href={link}
      >
        <div className="text-2xl font-medium auto-text-gray-900">{value}</div>
        <div className="mt-3 text-sm font-medium auto-text-gray-900">
          {title}
        </div>
        <div className="mt-1 text-xs leading-relaxed auto-text-gray-500">
          {description}
        </div>
      </Link>
    </div>
  )
}

export function UsageSummaryItem({ usage, limits }) {
  const metrics = [
    {
      key: 'tokens',
      title: 'Tokens',
      used: usage?.tokens?.value ?? 0,
      total: limits?.tokens ?? Infinity,
    },
    {
      key: 'conversations',
      title: 'Conversations',
      used: usage?.conversations?.value ?? 0,
      total: limits?.conversations ?? Infinity,
    },
    {
      key: 'messages',
      title: 'Messages',
      used: usage?.messages?.value ?? 0,
      total: limits?.messages ?? Infinity,
    },
  ].map((metric) => {
    const percentage =
      Number.isFinite(metric.total) && metric.total > 0
        ? Math.max(
            0,
            Math.min(100, Math.round((metric.used / metric.total) * 100))
          )
        : 0

    return {
      ...metric,
      percentage,
    }
  })

  const metric = metrics.sort((a, b) => b.percentage - a.percentage)[0]
  const unlimited = !Number.isFinite(metric.total)

  return (
    <div
      className={clsx(
        'h-48',
        'flex flex-col',
        'border auto-border-gray-200 hover:auto-border-gray-300',
        'transition-all duration-200',
        'rounded-xl',
        'auto-bg-gray-50'
      )}
    >
      <Link
        className={clsx(
          'flex-1',
          'flex flex-col',
          'p-4',
          'rounded-xl',
          'auto-bg-white'
        )}
        href="/usage"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-medium auto-text-gray-900">
              {unlimited ? '∞' : `${metric.percentage}%`}
            </div>
            <div className="mt-3 text-sm font-medium auto-text-gray-900">
              Usage
            </div>
            <div className="mt-1 text-xs leading-relaxed auto-text-gray-500">
              {metric.title} has the highest usage: {shortFormat(metric.used)} /{' '}
              {Number.isFinite(metric.total) ? shortFormat(metric.total) : '∞'}.
            </div>
          </div>
        </div>
        <ProgressBar
          className="mt-auto"
          used={metric.used}
          total={metric.total}
          useThresholdColors={true}
        />
      </Link>
    </div>
  )
}

export function NextStepItem({
  title,
  description,
  link,
  caption = 'Open',
  ...props
}) {
  return (
    <div
      className={clsx(
        'h-48',
        'flex flex-col',
        'border auto-border-gray-200 hover:auto-border-gray-300',
        'transition-all duration-200',
        'rounded-xl',
        'auto-bg-gray-50'
      )}
    >
      <Link
        {...props}
        className={clsx(
          'flex-1',
          'flex flex-col',
          'p-4',
          'rounded-xl',
          'auto-bg-white'
        )}
        href={link}
      >
        <h3 className="text-sm font-medium auto-text-gray-900">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed auto-text-gray-500">
          {description}
        </p>
      </Link>
      <div className="text-xs px-4 py-2 font-medium auto-text-gray-500">
        {caption}
      </div>
    </div>
  )
}

export function InstanceItem({
  className,

  background,

  name,
  description,

  tags,

  createdAt,

  link,

  onDelete,

  onClick,

  ...props
}) {
  name = name || 'No name'
  description = description || 'No description available for this item.'

  const initials = name
    .split(/\s+/g)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div
      {...props}
      className={clsx(
        'group',
        'h-48',
        'flex flex-col',
        'border auto-border-gray-200 hover:auto-border-gray-300',
        'transition-all duration-200',
        'rounded-xl',
        'auto-bg-gray-50',
        className
      )}
    >
      <Link
        className={clsx(
          'flex-1',
          'flex flex-col gap-8',
          'p-4',
          'rounded-xl',
          'auto-bg-white',
          {
            'auto-bg-gray-600 bg-cover bg-center bg-blend-screen dark:bg-blend-multiply':
              !!background,
          }
        )}
        href={link}
        onClick={onClick}
        style={
          background
            ? {
                backgroundImage: `url(${background})`,
              }
            : undefined
        }
      >
        <h2 className="text-sm flex flex-row items-center gap-5 auto-text-gray-800 relative z-10">
          <Initials
            className="auto-bg-gray-100 rounded-full w-5 h-5"
            initials={initials}
          />
          <span className="flex-1 w-full truncate">{name}</span>
        </h2>
        <p className="text-sm line-clamp-2 min-h-[2em] auto-text-gray-500 relative z-10">
          {description}
        </p>
      </Link>
      <div className="text-xs px-4 py-2 flex flex-row gap-2">
        {tags?.slice(0, 3).map((tag) => {
          return (
            <div key={tag} className="tag text-xs truncate">
              {tag}
            </div>
          )
        })}
        {createdAt ? <TimeAgo time={createdAt} /> : null}
        {onDelete ? (
          <>
            <div className="flex-1" />
            <button
              className="danger-link opacity-0 group-hover:opacity-100 transition-all duration-200"
              type="button"
              onClick={onDelete}
            >
              Delete
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}

export function DocumentationItem({ topic, openPopup, router }) {
  return (
    <InstanceItem
      link={topic.href}
      name={topic.title}
      description={topic.description}
      tags={['docs']}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()

        openPopup(
          <>
            <FadeInIframe
              className="w-full h-full rounded-lg border auto-border-gray-100"
              src={`${topic.href}?mode=preview`}
            />
          </>,
          {
            animateContentHeight: false,
            contentClassName: 'h-full',
            cancelButtonCaption: 'Close',
            dialogClassName:
              'w-screen h-screen lg:max-w-[calc(100vw*0.8)] lg:max-h-[calc(100vh*0.8)]',
            actions: {
              'Go to Documentation': {
                default: true,
                fn: () => {
                  window.open(topic.href, '_self')
                },
              },
            },
          }
        )
      }}
    />
  )
}

function Delta({ value }) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className="auto-text-gray-400">-</span>
  }

  const positive = value > 0
  const negative = value < 0

  const Icon = negative ? TrendingDown : TrendingUp

  const cls = positive
    ? 'text-emerald-600 dark:text-white'
    : negative
    ? 'text-rose-600 dark:text-white'
    : 'text-gray-500 dark:text-white'

  return (
    <span className={clsx('inline-flex items-center gap-0.5', cls)}>
      <Icon className="w-3.5 h-3.5" />
      {Math.abs(value)}%
    </span>
  )
}

export function MetricCard({ title, value, delta, rangeLabel, link }) {
  const className = clsx(
    'flex flex-col gap-3',
    'p-5',
    'border auto-border-gray-200',
    'rounded-xl',
    'auto-bg-white',
    link && 'hover:auto-border-gray-300 transition-all duration-200'
  )

  const content = (
    <>
      <h3 className="text-sm font-medium auto-text-gray-600">{title}</h3>
      <div className="text-3xl font-semibold auto-text-gray-900 leading-none">
        {value}
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="text-xs font-medium">
          <Delta value={delta} />
        </div>
        <div className="text-xs auto-text-gray-500">vs {rangeLabel}</div>
      </div>
    </>
  )

  if (link) {
    return (
      <Link className={className} href={link}>
        {content}
      </Link>
    )
  }

  return <div className={className}>{content}</div>
}

export function TokenUsageCard({ usage, limits }) {
  const used = usage?.tokens?.value ?? 0
  const total = limits?.tokens
  const unlimited = !Number.isFinite(total) || !total

  return (
    <Link
      className={clsx(
        'flex flex-col gap-3',
        'p-5',
        'border auto-border-gray-200 hover:auto-border-gray-300',
        'transition-all duration-200',
        'rounded-xl',
        'auto-bg-white'
      )}
      href="/usage"
    >
      <h3 className="text-sm font-medium auto-text-gray-600">Token Usage</h3>
      <div className="text-3xl font-semibold auto-text-gray-900 leading-none">
        {unlimited ? '∞' : shortFormat(used)}
      </div>
      <ProgressBar used={used} total={total} useThresholdColors={true} />
      <div className="text-xs auto-text-gray-500">
        {shortFormat(used)} / {unlimited ? '∞' : shortFormat(total)} tokens used
      </div>
    </Link>
  )
}

function pctChange(current, previous) {
  if (!previous) {
    return current > 0 ? 100 : 0
  }

  return Math.round(((current - previous) / previous) * 100)
}

export function LineChart({ series, xLabels, height = 220 }) {
  const width = 720
  const padX = 36
  const padY = 18

  const allValues = series.flatMap((s) => s.data)
  const max = Math.max(...allValues, 1)
  const min = 0

  const xStep =
    (width - padX * 2) /
    Math.max(1, (xLabels?.length || series[0].data.length) - 1)

  const yFor = (v) => padY + (1 - (v - min) / (max - min)) * (height - padY * 2)

  const yTicks = 4
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((max / yTicks) * (yTicks - i))
  )

  return (
    <div className="overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        preserveAspectRatio="none"
      >
        {tickValues.map((t, i) => {
          const y = padY + (i * (height - padY * 2)) / yTicks

          return (
            <g key={i}>
              <line
                x1={padX}
                x2={width - padX}
                y1={y}
                y2={y}
                className="stroke-gray-100 dark:stroke-gray-800"
                strokeWidth="1"
              />
              <text
                x={padX - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-gray-400 dark:fill-gray-500"
                style={{ fontSize: 10 }}
              >
                {shortFormat(t)}
              </text>
            </g>
          )
        })}
        {series.map((s, idx) => {
          const path = s.data
            .map(
              (v, i) => `${i === 0 ? 'M' : 'L'} ${padX + i * xStep} ${yFor(v)}`
            )
            .join(' ')

          return (
            <path
              key={idx}
              d={path}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        })}
        {xLabels?.map((label, i) => (
          <text
            key={i}
            x={padX + i * xStep}
            y={height - 2}
            textAnchor="middle"
            className="fill-gray-400 dark:fill-gray-500"
            style={{ fontSize: 10 }}
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  )
}

export function Sparkline({
  data,
  color = '#10b981',
  width = 80,
  height = 28,
}) {
  if (!data?.length) {
    return null
  }

  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const span = max - min || 1
  const step = width / Math.max(1, data.length - 1)

  const path = data
    .map((v, i) => {
      const x = i * step
      const y = height - ((v - min) / span) * height

      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="inline-block align-middle"
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function UsageChartCard({ report, periodDays = 7 }) {
  const tokensSeries = report?.tokens?.breakdown ?? []
  const conversationsSeries = report?.conversations?.breakdown ?? []
  const negativeSeries = report?.negativeRatings?.breakdown ?? []

  const xLabels =
    tokensSeries.length > 0
      ? tokensSeries.map(({ date }) =>
          new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
        )
      : Array.from({ length: periodDays }, (_, i) => {
          const d = new Date()

          d.setDate(d.getDate() - (periodDays - 1 - i))

          return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
        })

  const tokens = tokensSeries.map((p) => p.total)
  const conversations = conversationsSeries.map((p) => p.total)
  const errors = negativeSeries.map((p) => p.total)

  const tokenTotal = report?.tokens?.value ?? 0
  const convTotal = report?.conversations?.value ?? 0
  const errTotal = report?.negativeRatings?.value ?? 0

  const tokenDelta = pctChange(
    tokenTotal,
    tokenTotal - (report?.tokens?.change ?? 0)
  )
  const convDelta = pctChange(
    convTotal,
    convTotal - (report?.conversations?.change ?? 0)
  )
  const errDelta = pctChange(
    errTotal,
    errTotal - (report?.negativeRatings?.change ?? 0)
  )

  return (
    <div
      className={clsx(
        'flex flex-col gap-4',
        'p-5',
        'border auto-border-gray-200',
        'rounded-xl',
        'auto-bg-white'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-base font-semibold auto-text-gray-900">Usage</h2>
        <span className="text-xs auto-text-gray-500">Last 7 days</span>
      </div>

      <div className="flex flex-wrap gap-4 text-xs auto-text-gray-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          Tokens
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-sky-500" />
          Conversations
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          Negative ratings
        </span>
      </div>

      <LineChart
        series={[
          { name: 'Tokens', data: tokens, color: '#6366f1' },
          { name: 'Conversations', data: conversations, color: '#0ea5e9' },
          { name: 'Errors', data: errors, color: '#f43f5e' },
        ]}
        xLabels={xLabels}
      />

      <div className="grid grid-cols-3 gap-4 pt-2 border-t auto-border-gray-100">
        <div>
          <div className="text-xl font-semibold auto-text-gray-900">
            {shortFormat(tokenTotal)}
          </div>
          <div className="text-xs auto-text-gray-500 flex items-center gap-1.5">
            Tokens <Delta value={tokenDelta} />
          </div>
        </div>
        <div>
          <div className="text-xl font-semibold auto-text-gray-900">
            {shortFormat(convTotal)}
          </div>
          <div className="text-xs auto-text-gray-500 flex items-center gap-1.5">
            Conversations <Delta value={convDelta} />
          </div>
        </div>
        <div>
          <div className="text-xl font-semibold auto-text-gray-900">
            {shortFormat(errTotal)}
          </div>
          <div className="text-xs auto-text-gray-500 flex items-center gap-1.5">
            Negative <Delta value={errDelta} />
          </div>
        </div>
      </div>

      <Link
        href="/usage"
        className="default-link mt-auto pt-3 text-sm inline-flex items-center gap-1 self-start"
      >
        View usage analytics
        <ArrowUpRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}

export function RecentWorkCard({ items, loading = false }) {
  const placeholders = Array.from({ length: 4 })

  return (
    <div
      className={clsx(
        'flex flex-col',
        'p-5',
        'border auto-border-gray-200',
        'rounded-xl',
        'auto-bg-white'
      )}
    >
      <h2 className="text-base font-semibold auto-text-gray-900 mb-4">
        Recent work
      </h2>
      {loading ? (
        <ul className="flex flex-col divide-y auto-divide-gray-100">
          {placeholders.map((_, i) => (
            <li key={i} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full auto-bg-gray-100" />
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <div className="h-3 w-28 rounded auto-bg-gray-100" />
                  <div className="h-2.5 w-16 rounded auto-bg-gray-100" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col divide-y auto-divide-gray-100">
          {items.length === 0 ? (
            <li className="text-sm auto-text-gray-500 py-2">
              No recent activity yet.
            </li>
          ) : null}
          {items.map(({ id, kind, name, link, createdAt }) => {
            const initials = (name || kind)
              .split(/\s+/g)
              .map((w) => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()

            return (
              <li key={`${kind}:${id}`} className="py-3 first:pt-0 last:pb-0">
                <Link href={link} className="flex items-center gap-3 group">
                  <Initials
                    className="auto-bg-gray-100 auto-text-gray-700 rounded-full w-7 h-7 text-xs"
                    initials={initials}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium auto-text-gray-900 truncate group-hover:underline">
                      {name || `Untitled ${kind}`}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs auto-text-gray-500">
                      <span>{kind}</span>
                      <span className="whitespace-nowrap">
                        <TimeAgo time={createdAt} />
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <Link
        href="/blueprints"
        className="default-link mt-auto pt-4 text-sm inline-flex items-center gap-1 self-start"
      >
        View all resources
        <ArrowUpRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}

export function SystemStatusCard() {
  return (
    <div
      className={clsx(
        'flex flex-col gap-3',
        'p-5',
        'border auto-border-gray-200',
        'rounded-xl',
        'auto-bg-white'
      )}
    >
      <h2 className="text-base font-semibold auto-text-gray-900">
        System status
      </h2>
      <div className="flex items-start gap-2">
        <CircleCheck className="w-5 h-5 text-emerald-500 dark:text-white shrink-0 mt-0.5" />
        <div className="flex flex-col">
          <span className="text-sm font-medium auto-text-gray-900">
            All systems operational
          </span>
          <span className="text-xs auto-text-gray-500">Updated 2m ago</span>
        </div>
      </div>
      {/* <Link
        href="https://status.chatbotkit.com"
        className="default-link mt-auto pt-3 text-sm inline-flex items-center gap-1 self-start"
      >
        View status page
        <ArrowUpRight className="w-3.5 h-3.5" />
      </Link> */}
    </div>
  )
}

export function QuickActionsCard() {
  const actions = [
    {
      label: 'Create blueprint',
      href: '/blueprints/new',
      icon: LayoutGrid,
    },
    { label: 'Create bot', href: '/bots/new', icon: MessagesSquare },
    { label: 'Create token', href: '/tokens/new', icon: KeyRound },
    { label: 'Invite team member', href: '/teams', icon: UserPlus },
  ]

  return (
    <div
      className={clsx(
        'flex flex-col gap-3',
        'flex-1',
        'p-5',
        'border auto-border-gray-200',
        'rounded-xl',
        'auto-bg-white'
      )}
    >
      <h2 className="text-base font-semibold auto-text-gray-900">
        Quick actions
      </h2>
      <ul className="flex flex-col gap-2">
        {actions.map(({ label, href, icon: Icon }) => (
          <li key={label}>
            <Link
              href={href}
              className="flex items-center gap-2.5 text-sm auto-text-gray-700 hover:auto-text-gray-900 hover:underline"
            >
              <Icon className="w-4 h-4 auto-text-gray-900" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function TopBotsCard({ topBots, loading = false }) {
  const placeholders = Array.from({ length: 5 })

  return (
    <div
      className={clsx(
        'flex flex-col',
        // @note min-w-0 stops the table's intrinsic width from growing the
        // grid track the card sits in
        'min-w-0',
        'p-5',
        'border auto-border-gray-200',
        'rounded-xl',
        'auto-bg-white'
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-base font-semibold auto-text-gray-900">
          Top performing bots
        </h2>
        <span className="text-xs auto-text-gray-500">By tokens</span>
      </div>
      {loading ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs auto-text-gray-500 text-left">
              <th className="font-normal pb-2">Bot</th>
              <th className="font-normal pb-2">Conversations</th>
              <th className="font-normal pb-2">Tokens</th>
              <th className="font-normal pb-2">Thumbs up</th>
            </tr>
          </thead>
          <tbody className="divide-y auto-divide-gray-100">
            {placeholders.map((_, i) => (
              <tr key={i}>
                <td className="py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full auto-bg-gray-100" />
                    <div className="h-3 w-24 rounded auto-bg-gray-100" />
                  </div>
                </td>
                <td className="py-3">
                  <div className="h-3 w-10 rounded auto-bg-gray-100" />
                </td>
                <td className="py-3">
                  <div className="h-3 w-12 rounded auto-bg-gray-100" />
                </td>
                <td className="py-3">
                  <div className="h-3 w-8 rounded auto-bg-gray-100" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : !topBots || topBots.length === 0 ? (
        <p className="text-sm auto-text-gray-500">No bot activity yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs auto-text-gray-500 text-left">
              <th className="font-normal pb-2">Bot</th>
              <th className="font-normal pb-2">Conversations</th>
              <th className="font-normal pb-2">Tokens</th>
              <th className="font-normal pb-2">Thumbs up</th>
            </tr>
          </thead>
          <tbody className="divide-y auto-divide-gray-100">
            {topBots.map((b) => {
              const initials = (b.name || 'Bot')
                .split(/\s+/g)
                .map((w) => w[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()

              return (
                <tr key={b.id}>
                  <td className="py-3">
                    <Link
                      href={`/bots/${b.id}`}
                      className="flex items-center gap-2.5 hover:underline"
                    >
                      <Initials
                        className="auto-bg-gray-100 auto-text-gray-700 rounded-full w-6 h-6 text-[10px]"
                        initials={initials}
                      />
                      <span className="min-w-0 auto-text-gray-900 truncate">
                        {b.name || 'Untitled bot'}
                      </span>
                    </Link>
                  </td>
                  <td className="py-3 auto-text-gray-700">
                    {shortFormat(b.conversations)}
                  </td>
                  <td className="py-3 auto-text-gray-700">
                    {shortFormat(b.tokens)}
                  </td>
                  <td className="py-3 auto-text-gray-700">
                    {b.thumbsUpRate === null
                      ? '-'
                      : `${Math.round(b.thumbsUpRate * 100)}%`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <Link
        href="/bots"
        className="default-link mt-auto pt-4 text-sm inline-flex items-center gap-1 self-start"
      >
        View all bots
        <ArrowUpRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}

export function UsefulResourcesCard() {
  const resources = [
    {
      title: 'Blueprints guide',
      description: 'Learn how to build effective blueprints',
      slug: 'blueprints',
      icon: FileText,
    },
    {
      title: 'Bot best practices',
      description: 'Design bots that users love',
      slug: 'bots',
      icon: MessagesSquare,
    },
    {
      title: 'API reference',
      description: 'Integrate with the CBK platform',
      slug: 'api',
      icon: Code,
    },
  ]

  return (
    <div
      className={clsx(
        'flex flex-col gap-3',
        'p-5',
        'border auto-border-gray-200',
        'rounded-xl',
        'auto-bg-gray-50'
      )}
    >
      <h2 className="text-base font-semibold auto-text-gray-900">
        Useful resources
      </h2>
      <ul className="flex flex-col gap-3">
        {resources.map(({ title, description, slug, icon: Icon }) => (
          <li key={slug}>
            <DocsLink slug={slug} className="flex items-start gap-3 group">
              <div className="w-7 h-7 rounded-full auto-bg-gray-100 auto-text-gray-700 dark:text-white flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium auto-text-gray-900 group-hover:underline">
                  {title}
                </span>
                <span className="text-xs auto-text-gray-500">
                  {description}
                </span>
              </div>
            </DocsLink>
          </li>
        ))}
      </ul>
      <DocsLink className="default-link mt-auto pt-1 text-sm inline-flex items-center gap-1 self-start">
        View all docs
        <ArrowUpRight className="w-3.5 h-3.5" />
      </DocsLink>
    </div>
  )
}

export function NeedHelpCard() {
  const partner = usePartner()

  const items = [
    { label: 'Explore docs', docs: true, icon: FileText },
    { label: 'Get support', href: '/support', icon: LifeBuoy },
    ...(partner?.whitelabel
      ? []
      : [
          {
            label: 'Join community',
            href: 'https://go.cbk.ai/discord',
            icon: Users,
          },
        ]),
  ]

  return (
    <div
      className={clsx(
        'flex flex-col gap-3',
        'p-5',
        'border auto-border-gray-200',
        'rounded-xl',
        'auto-bg-gray-50'
      )}
    >
      <h2 className="text-base font-semibold auto-text-gray-900">Need help?</h2>
      <ul className="flex flex-col gap-2.5">
        {items.map(({ label, href, docs, icon: Icon }) => (
          <li key={label}>
            {docs ? (
              <DocsLink className="flex items-center gap-2.5 text-sm auto-text-gray-700 hover:auto-text-gray-900 hover:underline">
                <Icon className="w-4 h-4 auto-text-gray-900" />
                {label}
              </DocsLink>
            ) : (
              <Link
                href={href}
                className="flex items-center gap-2.5 text-sm auto-text-gray-700 hover:auto-text-gray-900 hover:underline"
              >
                <Icon className="w-4 h-4 auto-text-gray-900" />
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Issues a GraphQL query against the platform API and returns the data
 * payload, throwing on transport or query errors.
 */
async function fetchGraphQL(query) {
  const response = await fetch('/api/v1/graphql', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ query }),
  })

  const data = await response.json()

  if (!response.ok || data?.errors?.length) {
    throw new Error(
      data?.errors?.[0]?.message || data?.message || 'GraphQL request failed'
    )
  }

  return data?.data
}

// Recent work spans the resources a user creates. The table below is the
// source of truth: it drives the combined GraphQL query, the kind tag on
// every row, and the tiebreaker order when two items share a timestamp.
export const RECENT_WORK_KINDS = [
  {
    kind: 'Blueprint',
    connection: 'blueprints',
    link: (id) => `/blueprints/${id}/designer`,
  },
  {
    kind: 'Bot',
    connection: 'bots',
    link: (id) => `/bots/${id}`,
  },
  {
    kind: 'Widget',
    connection: 'widgetIntegrations',
    link: (id) => `/integrations/widget/${id}`,
  },
]

export const RECENT_WORK_LIMIT = 4

function buildRecentWorkQuery(kinds) {
  return `query OverviewRecentWork {
${kinds
  .map(
    ({ connection }) => `  ${connection}(first: ${RECENT_WORK_LIMIT}) {
    edges {
      node {
        id
        name
        createdAt
      }
    }
  }`
  )
  .join('\n')}
}`
}

/**
 * Loads the most recent resources across every kind in RECENT_WORK_KINDS. The
 * connections already return the newest first, so only the merged list needs
 * sorting - the kind order breaks ties on identical timestamps.
 */
export function useRecentWork() {
  const [items, setItems] = useState(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const data = await fetchGraphQL(buildRecentWorkQuery(RECENT_WORK_KINDS))

      return RECENT_WORK_KINDS.flatMap(({ kind, connection, link }, order) =>
        (data?.[connection]?.edges || []).map(({ node }) => ({
          ...node,
          kind,
          order,
          link: link(node.id),
        }))
      )
        .sort((a, b) => {
          const createdAtDiff = new Date(b.createdAt) - new Date(a.createdAt)

          return createdAtDiff || a.order - b.order
        })
        .slice(0, RECENT_WORK_LIMIT)
    }

    load()
      .then((items) => {
        if (!cancelled) {
          setItems(items)
        }
      })
      .catch(() => {
        if (!cancelled) {
          // @note recent work is supplementary - an empty card is a better
          // outcome than blocking the overview on it
          setItems([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { items: items || [], loading: items === null }
}

export const OVERVIEW_REPORT_ID = 'pov1s2k3l4m5n6o7p8q9r0sov'

export const OVERVIEW_REPORT_PERIOD_DAYS = 7

/**
 * Loads the platform report that backs the overview metrics. It resolves to
 * null while loading and stays null when the report is unavailable - the
 * cards render their own empty state from it.
 */
export function useOverviewReport() {
  const [report, setReport] = useState(null)

  const { fetch: fetchSilent } = useFetch({})

  useEffect(() => {
    let cancelled = false

    async function loadReport() {
      const { data, error } = await fetchSilent(
        '/api/v1/platform/report/generate',
        {
          data: {
            [OVERVIEW_REPORT_ID]: {
              periodDays: OVERVIEW_REPORT_PERIOD_DAYS,
            },
          },
        }
      )

      if (cancelled || error) {
        return
      }

      const payload = data?.[OVERVIEW_REPORT_ID]

      if (payload && !payload.error) {
        setReport(payload)
      }
    }

    loadReport()

    return () => {
      cancelled = true
    }
  }, [fetchSilent])

  return report
}

/**
 * Derives the display values for the metric cards from the platform report.
 * Every value degrades to null while the report loads or when it is
 * unavailable - the cards render a dash for null.
 */
export function deriveOverviewMetrics(report) {
  const rangeLabel =
    report?.rangeLabel ??
    (() => {
      const fmt = (d) =>
        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const end = new Date()

      end.setDate(end.getDate() - 7)

      const start = new Date(end)

      start.setDate(start.getDate() - 6)

      return `${fmt(start)} – ${fmt(end)}`
    })()

  const conversationsValue = report?.conversations?.value ?? null
  const conversationsDelta =
    conversationsValue !== null
      ? pctChange(
          conversationsValue,
          conversationsValue - report.conversations.change
        )
      : null

  const messagesValue = report?.messages?.value ?? null
  const messagesDelta =
    messagesValue !== null
      ? pctChange(messagesValue, messagesValue - report.messages.change)
      : null

  const positiveCurrent = report?.positiveRatings?.value
  const negativeCurrent = report?.negativeRatings?.value
  const positivePrev =
    report && report.positiveRatings.value - report.positiveRatings.change
  const negativePrev =
    report && report.negativeRatings.value - report.negativeRatings.change

  const totalRatings = (positiveCurrent ?? 0) + (negativeCurrent ?? 0)
  const totalRatingsPrev = (positivePrev ?? 0) + (negativePrev ?? 0)

  const thumbsUpRate =
    report && totalRatings > 0
      ? Math.round((positiveCurrent / totalRatings) * 100)
      : null
  const thumbsUpRatePrev =
    report && totalRatingsPrev > 0
      ? (positivePrev / totalRatingsPrev) * 100
      : null
  const thumbsUpDelta =
    thumbsUpRate !== null && thumbsUpRatePrev !== null
      ? Math.round(thumbsUpRate - thumbsUpRatePrev)
      : null

  return {
    rangeLabel,
    conversationsValue,
    conversationsDelta,
    messagesValue,
    messagesDelta,
    thumbsUpRate,
    thumbsUpDelta,
  }
}

// The channel table cascades over the channels a builder can ship on: the
// first kind with an integration wins. The table order is the priority order,
// and the table drives the combined GraphQL queries, the brand panel, and the
// edit link. Widgets render their live frame; everything else gets the brand
// channel panel.
export const CHANNEL_KINDS = [
  { type: 'widget', title: 'Widget', connection: 'widgetIntegrations' },
  {
    type: 'slack',
    title: 'Slack',
    connection: 'slackIntegrations',
    background: '#611f69',
    appUrl: 'https://app.slack.com',
  },
  {
    type: 'whatsapp',
    title: 'WhatsApp',
    connection: 'whatsappIntegrations',
    background: '#25D366',
    appUrl: 'https://web.whatsapp.com',
  },
  {
    type: 'telegram',
    title: 'Telegram',
    connection: 'telegramIntegrations',
    background: '#0088CC',
    appUrl: 'https://web.telegram.org',
  },
  {
    type: 'messenger',
    title: 'Messenger',
    connection: 'messengerIntegrations',
    background: '#00B2FF',
    appUrl: 'https://www.messenger.com',
  },
  {
    type: 'instagram',
    title: 'Instagram',
    connection: 'instagramIntegrations',
    background: '#E4405F',
    appUrl: 'https://www.instagram.com/direct/inbox/',
  },
  {
    type: 'discord',
    title: 'Discord',
    connection: 'discordIntegrations',
    background: '#5865F2',
    appUrl: 'https://discord.com/app',
  },
  {
    type: 'googlechat',
    title: 'Google Chat',
    connection: 'googlechatIntegrations',
    background: '#0F9D58',
    appUrl: 'https://chat.google.com',
  },
  {
    type: 'microsoftteams',
    title: 'Microsoft Teams',
    connection: 'microsoftteamsIntegrations',
    background: '#6264A7',
    appUrl: 'https://teams.microsoft.com',
  },
  {
    type: 'twilio',
    title: 'Twilio',
    connection: 'twilioIntegrations',
    background: '#F22F46',
  },
  {
    type: 'email',
    title: 'Email',
    connection: 'emailIntegrations',
    background: '#475569',
  },
]

// @note one channel has to be told apart from many, and nothing past that -
// two per kind is all it takes to see a project ships more than one
export const CHANNEL_SCAN = 2

export function buildChannelsQuery(blueprintId) {
  const filter = blueprintId
    ? `, blueprintIds: ${JSON.stringify([blueprintId])}`
    : ''

  return `query OverviewChannels {
${CHANNEL_KINDS.map(
  ({ connection }) => `  ${connection}(first: ${CHANNEL_SCAN}${filter}) {
    edges {
      node {
        id
        name
      }
    }
  }`
).join('\n')}
}`
}

/**
 * Derives the channels a project ships on: the leading one, being the first
 * CHANNEL_KINDS entry with an integration, and how many there are across every
 * kind. The count is capped by the scan, so it says one or many, not how many.
 */
export function deriveChannels(data) {
  const kind = CHANNEL_KINDS.find(
    ({ connection }) => data?.[connection]?.edges?.length
  )

  const count = CHANNEL_KINDS.reduce(
    (total, { connection }) => total + (data?.[connection]?.edges?.length || 0),
    0
  )

  return {
    channel: kind
      ? { ...kind, integration: data[kind.connection].edges[0].node }
      : null,
    count,
  }
}

/**
 * Loads the channel integrations of a project, optionally narrowed to a
 * blueprint. Resolves to a null channel and a count of zero when there is
 * none.
 */
export function useLatestChannel(blueprintId = null) {
  const [state, setState] = useState({
    channel: null,
    count: 0,
    loading: true,
  })

  useEffect(() => {
    let cancelled = false

    setState({ channel: null, count: 0, loading: true })

    fetchGraphQL(buildChannelsQuery(blueprintId))
      .then((data) => {
        if (!cancelled) {
          setState({ ...deriveChannels(data), loading: false })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ channel: null, count: 0, loading: false })
        }
      })

    return () => {
      cancelled = true
    }
  }, [blueprintId])

  return state
}

// A project arrives unauthenticated. Cloning deliberately refuses to carry
// credentials across accounts - `blueprint.fields` strips every secret value
// and every integration token, and OAuth connections are not copied at all -
// so a cloned project is a complete, correct, inert copy: the bots, the
// datasets, the channels and the abilities are all there, and none of them can
// reach anything. Nothing in the product says so. That is what this model is
// for: the gaps a clone leaves behind, which are all of one kind - things that
// need to be authenticated.
export const PROJECT_SETUP_SCAN = 25

// @note only shared secrets belong to the builder. Personal secrets are
// authenticated per end user at conversation time, so they are not the
// project owner's setup task - and asking the graph to verify one outside a
// contact context makes the resolver throw, which would take the whole query
// down with it.
export const PROJECT_SETUP_SECRET_KIND = 'shared'

// @note the channels the credential table models - a channel it does not model
// reports itself configured, so querying it would only add noise
export const PROJECT_SETUP_CHANNEL_KINDS = CHANNEL_KINDS.filter(
  ({ type }) => INTEGRATION_CREDENTIALS[type]?.length
)

export function buildProjectSetupQuery(blueprintId) {
  const filter = `, blueprintIds: ${JSON.stringify([blueprintId])}`

  return `query OverviewProjectSetup {
  secrets(first: ${PROJECT_SETUP_SCAN}${filter}, kind: [${PROJECT_SETUP_SECRET_KIND}]) {
    edges {
      node {
        id
        name
        verification {
          status
        }
      }
    }
  }
${PROJECT_SETUP_CHANNEL_KINDS.map(
  ({ connection }) => `  ${connection}(first: ${PROJECT_SETUP_SCAN}${filter}) {
    edges {
      node {
        id
        name
        verification {
          status
          action {
            type
            url
          }
        }
      }
    }
  }`
).join('\n')}
}`
}

/**
 * Derives the authentication checklist from the project resources.
 *
 * Every item is one thing that has to be authenticated before the project can
 * work. A secret links to its own page - where it is authenticated, whatever
 * its type - and an integration links to its page the same way. The status is
 * all the graph is asked for; a secret value is never exposed, so it cannot be
 * inferred here.
 */
export function deriveProjectSetup(data) {
  const secrets = (data?.secrets?.edges || []).map(({ node }) => ({
    key: `secret:${node.id}`,
    kind: 'secret',
    name: node.name || 'Untitled secret',
    caption: 'Authenticate',
    description: 'This secret needs to be authenticated.',
    done: node.verification?.status === 'authenticated',
    link: `/secrets/${node.id}`,
  }))

  const integrations = PROJECT_SETUP_CHANNEL_KINDS.flatMap(
    ({ type, title, connection }) =>
      (data?.[connection]?.edges || []).map(({ node }) => ({
        key: `${type}:${node.id}`,
        kind: 'integration',
        name: node.name || title,
        caption: 'Install',
        description: `This ${title} channel is not installed yet - nobody can reach the agent through it.`,
        done: node.verification?.status === 'configured',
        // @note the graph hands back the install route the same way it hands
        // back a secret's authenticate URL, so nothing here rebuilds it
        link:
          node.verification?.action?.url || `/integrations/${type}/${node.id}`,
      }))
  )

  // @note secrets lead: an integration that is not installed is visibly dead,
  // while a missing secret value fails silently inside an ability mid
  // conversation, so it is the one more likely to be missed
  const items = [...secrets, ...integrations]

  return {
    items,
    doneCount: items.filter(({ done }) => done).length,
    // @note a project with nothing to authenticate is complete, not empty -
    // there is no panel to show either way
    complete: items.every(({ done }) => done),
  }
}

/**
 * Loads the authentication state of a project. Resolves to null while loading,
 * so a fully authenticated project never flashes a panel it does not need.
 *
 * @note the graph verifies each secret server side, which costs one round trip
 * per secret - the scan is capped for that reason. It is the only trustworthy
 * signal: a secret value is never exposed, so authentication cannot be
 * inferred client side.
 */
export function useProjectSetup(blueprintId) {
  const [setup, setSetup] = useState(null)

  useEffect(() => {
    let cancelled = false

    setSetup(null)

    if (!blueprintId) {
      return
    }

    fetchGraphQL(buildProjectSetupQuery(blueprintId))
      .then((data) => {
        if (!cancelled) {
          setSetup(deriveProjectSetup(data))
        }
      })
      .catch(() => {
        if (!cancelled) {
          // @note the panel is a nudge, not a diagnosis - a project whose
          // resources cannot be read is better left alone than nagged with a
          // list derived from nothing. Reporting it complete keeps the panel
          // off the screen and leaves the feed the whole column.
          setSetup({ items: [], doneCount: 0, complete: true })
        }
      })

    return () => {
      cancelled = true
    }
  }, [blueprintId])

  return setup
}

export const LIVE_CONVERSATIONS_LIMIT = 8

export const LIVE_CONVERSATIONS_SCAN = 50

export const LIVE_CONVERSATIONS_INTERVAL = 60_000

/**
 * Polls the most recently active conversations every minute. When a
 * blueprintId is given the feed narrows to conversations with the blueprint
 * bots; a blueprint without bots yields an empty feed.
 */
export function useLiveConversations(blueprintId = null) {
  const [conversations, setConversations] = useState(null)

  useEffect(() => {
    let cancelled = false

    setConversations(null)

    async function load() {
      let filter = ''

      if (blueprintId) {
        const botsData = await fetchGraphQL(`query OverviewProjectBots {
  bots(first: 100, blueprintIds: ${JSON.stringify([blueprintId])}) {
    edges {
      node {
        id
      }
    }
  }
}`)

        const botIds = (botsData?.bots?.edges || []).map(({ node }) => node.id)

        filter = `, botIds: ${JSON.stringify(botIds)}`
      }

      const data = await fetchGraphQL(`query OverviewLiveConversations {
  conversations(first: ${LIVE_CONVERSATIONS_SCAN}${filter}) {
    edges {
      node {
        id
        name
        description
        createdAt
        updatedAt
      }
    }
  }
}`)

      // @note the connection orders by creation time - re-sort by activity
      // so long-running conversations bubble up as new messages arrive
      return (data?.conversations?.edges || [])
        .map(({ node }) => node)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, LIVE_CONVERSATIONS_LIMIT)
    }

    const tick = () => {
      load()
        .then((items) => {
          if (!cancelled) {
            setConversations(items)
          }
        })
        .catch(() => {
          if (!cancelled) {
            // @note the feed is supplementary - keep whatever is on screen
            // and settle on empty only when nothing loaded at all
            setConversations((conversations) => conversations || [])
          }
        })
    }

    tick()

    const interval = setInterval(() => {
      // @note skip the refresh while the page sits in a background browser
      // tab - the feed catches up on the next visible tick
      if (document.hidden) {
        return
      }

      tick()
    }, LIVE_CONVERSATIONS_INTERVAL)

    return () => {
      cancelled = true

      clearInterval(interval)
    }
  }, [blueprintId])

  return {
    conversations: conversations || [],
    loading: conversations === null,
  }
}

/**
 * Embeds the widget test page so the widget is live on the overview.
 */
export function WidgetPreviewCard({ widget }) {
  // @note the embed is the widget frame itself in the center layout - the
  // chat sits centered on its backdrop instead of simulating a full sample
  // page. The frame width is pinned to the popover width so the preview is as
  // narrow as the widget is when a visitor opens it for real
  const frameUrl = `/integrations/widget/${widget.id}/frame?layout=center&frameWidth=popover`

  const editUrl = `/integrations/widget/${widget.id}`

  return (
    <div
      className={clsx(
        'flex flex-col',
        'border auto-border-gray-200',
        'rounded-xl',
        'auto-bg-white',
        'overflow-hidden'
      )}
    >
      <div className="flex items-start justify-between gap-4 p-5 pb-4">
        <div>
          <h2 className="text-base font-semibold auto-text-gray-900">
            {widget.name || 'Your widget'}
          </h2>
          <p className="text-xs auto-text-gray-500">
            A live preview of your widget.
          </p>
        </div>
        <Link href={editUrl} className="default-link text-sm whitespace-nowrap">
          Edit
        </Link>
      </div>
      <FadeInIframe
        className="w-full flex-1 min-h-[600px] xl:min-h-[700px] 2xl:min-h-[800px] border-t auto-border-gray-100"
        src={frameUrl}
        title={widget.name || 'Widget preview'}
      />
    </div>
  )
}

// @note this stands in for whichever preview resolves - the widget frame, the
// channel panel, or the designer canvas - so it has to occupy their box to the
// pixel, or swapping it out reflows the overview row under it. That means the
// same header block and the same body min-height chain, with the bars laid over
// the line boxes of the heading and the paragraph they stand for
export function PreviewSkeleton() {
  return (
    <div
      className={clsx(
        'flex flex-col',
        'border auto-border-gray-200',
        'rounded-xl',
        'auto-bg-white',
        'overflow-hidden'
      )}
    >
      <div className="flex items-start justify-between gap-4 p-5 pb-4">
        <div>
          <div className="flex items-center h-6">
            <div className="h-4 w-32 rounded auto-bg-gray-100" />
          </div>
          <div className="flex items-center h-4">
            <div className="h-3 w-48 rounded auto-bg-gray-100" />
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-[600px] xl:min-h-[700px] 2xl:min-h-[800px] border-t auto-border-gray-100 auto-bg-gray-50" />
    </div>
  )
}

/**
 * The channel panel for messaging integrations: the brand phone screen with
 * the platform logo and a link to the integration.
 */
export function ChannelCard({ type, title, background, appUrl, integration }) {
  const Icon = integrationIcons[type]

  return (
    <div
      className={clsx(
        'flex flex-col',
        'border auto-border-gray-200',
        'rounded-xl',
        'auto-bg-white',
        'overflow-hidden'
      )}
    >
      <div className="flex items-start justify-between gap-4 p-5 pb-4">
        <div>
          <h2 className="text-base font-semibold auto-text-gray-900">
            {integration.name || `Your ${title} agent`}
          </h2>
          <p className="text-xs auto-text-gray-500">
            Your agent is live on {title}.
          </p>
        </div>
        <Link
          href={`/integrations/${type}/${integration.id}`}
          className="default-link text-sm whitespace-nowrap"
        >
          Edit
        </Link>
      </div>
      <div className="flex-1 min-h-[600px] xl:min-h-[700px] 2xl:min-h-[800px] border-t auto-border-gray-100 auto-bg-gray-50 flex items-center justify-center p-8">
        <IPhoneFrame className="w-full max-w-xs h-[30rem] xl:h-[38rem] shadow-xl">
          <div
            className="flex-1 flex flex-col items-center justify-center gap-4 px-8"
            style={{ backgroundColor: background }}
          >
            {Icon ? <Icon className="h-16 w-16 text-white" /> : null}
            <div className="text-sm text-center text-white font-medium">
              {integration.name || `Your ${title} agent`}
            </div>
            <div className="text-xs text-center text-white/80">
              Message your agent on {title} to try it live.
            </div>
            {appUrl ? (
              <Link
                className="core-button bg-transparent hover:bg-white/10 text-white"
                href={appUrl}
                target="_blank"
              >
                Open {title}
              </Link>
            ) : null}
          </div>
        </IPhoneFrame>
      </div>
    </div>
  )
}

/**
 * Renders the right preview for the leading channel: the live widget frame
 * for widgets, the brand channel panel for everything else.
 */
export function ChannelPreview({ channel }) {
  if (channel.type === 'widget') {
    return <WidgetPreviewCard widget={channel.integration} />
  }

  return <ChannelCard {...channel} />
}

/**
 * Embeds the read-only blueprint preview - the project canvas live on the
 * overview.
 */
export function DesignerPreviewCard({ scope }) {
  const previewUrl = `/blueprints/${scope.id}/preview?controls=false`

  const designerUrl = `/blueprints/${scope.id}/designer`

  return (
    <div
      className={clsx(
        'flex flex-col',
        'border auto-border-gray-200',
        'rounded-xl',
        'auto-bg-white',
        'overflow-hidden'
      )}
    >
      <div className="flex items-start justify-between gap-4 p-5 pb-4">
        <div>
          <h2 className="text-base font-semibold auto-text-gray-900">
            {scope.name || 'Your project'}
          </h2>
          <p className="text-xs auto-text-gray-500">
            A live view of the project blueprint.
          </p>
        </div>
        <Link
          href={designerUrl}
          className="default-link text-sm whitespace-nowrap"
        >
          Edit
        </Link>
      </div>
      <FadeInIframe
        loading="lazy"
        className="w-full flex-1 min-h-[600px] xl:min-h-[700px] 2xl:min-h-[800px] border-t auto-border-gray-100"
        src={previewUrl}
        title={scope.name || 'Blueprint preview'}
      />
    </div>
  )
}

/**
 * The authentication panel: everything the project cannot reach yet.
 *
 * It sits directly above the conversations feed because a project that cannot
 * authenticate is a project that cannot work, and the empty feed underneath is
 * often the first symptom. Unlike a checklist these are not sequential steps -
 * each item is an independent credential - so every pending one carries its
 * own action rather than waiting its turn.
 */
export function ProjectAuthenticationCard({ items, doneCount }) {
  return (
    <div
      className={clsx(
        'flex flex-col',
        // @note min-w-0 stops the intrinsic width of the rows from growing the
        // grid track the card sits in
        'min-w-0',
        'p-5',
        'border auto-border-gray-200',
        'rounded-xl',
        'auto-bg-white'
      )}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold auto-text-gray-900">
            Authenticate your project
          </h2>
          <p className="mt-1 text-xs leading-relaxed auto-text-gray-500">
            These need to be authenticated before your agents can use them.
          </p>
        </div>
        <span className="text-xs auto-text-gray-500 whitespace-nowrap">
          {doneCount} of {items.length} done
        </span>
      </div>
      <ProgressBar className="mb-1" used={doneCount} total={items.length} />
      <ul className="flex-1 min-h-0 max-h-[22rem] overflow-auto subtle-scrollbar flex flex-col divide-y auto-divide-gray-100">
        {items.map(({ key, kind, name, description, done, caption, link }) => (
          <li key={key} className="py-3 last:pb-0">
            <div className="flex items-start gap-3">
              {done ? (
                <CircleCheck className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500 dark:text-white" />
              ) : (
                <Circle className="w-4 h-4 mt-0.5 shrink-0 auto-text-gray-900" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {/* @note line-clamp instead of truncate - nowrap text has the
                      whole line as its intrinsic width, which grows the card */}
                  <span
                    className={clsx(
                      'text-sm line-clamp-1',
                      done
                        ? 'auto-text-gray-500'
                        : 'font-medium auto-text-gray-900'
                    )}
                  >
                    {name}
                  </span>
                  <span className="tag text-xs shrink-0">{kind}</span>
                </div>
                {/* @note only the pending items explain themselves - the
                    finished ones have nothing left to say */}
                {done ? null : (
                  <p className="mt-1 text-xs leading-relaxed auto-text-gray-500">
                    {description}
                  </p>
                )}
              </div>
              {done ? null : (
                <Link
                  // @note use small because the outer is overflow-hidden and
                  // the button uses outline / ring
                  className="primary-button small push shrink-0"
                  href={link}
                >
                  {caption}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export const LIVE_CONVERSATION_ACTIVE_WINDOW = 5 * 60 * 1000

/**
 * The conversations feed: newest activity first, refreshed every minute,
 * with a pulse on conversations active within the last few minutes.
 */
export function LiveConversationsCard({ conversations, loading = false }) {
  const placeholders = Array.from({ length: 5 })

  return (
    <div
      className={clsx(
        'flex flex-col',
        // @note min-w-0 stops the intrinsic width of the rows from growing
        // the grid track the card sits in
        'min-w-0',
        'p-5',
        'border auto-border-gray-200',
        'rounded-xl',
        'auto-bg-white'
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-base font-semibold auto-text-gray-900">
          Live conversations
        </h2>
        <span className="text-xs auto-text-gray-500">
          Refreshes every minute
        </span>
      </div>
      {loading ? (
        <ul className="flex flex-col divide-y auto-divide-gray-100">
          {placeholders.map((_, i) => (
            <li key={i} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full auto-bg-gray-100" />
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <div className="h-3 w-40 rounded auto-bg-gray-100" />
                  <div className="h-2.5 w-16 rounded auto-bg-gray-100" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex-1 min-h-0 max-h-[26rem] overflow-auto subtle-scrollbar flex flex-col divide-y auto-divide-gray-100">
          {conversations.length === 0 ? (
            <li className="text-sm auto-text-gray-500 py-2">
              No conversations yet - they show up here as they happen.
            </li>
          ) : null}
          {conversations.map(({ id, name, description, updatedAt }) => {
            const active =
              Date.now() - new Date(updatedAt).getTime() <
              LIVE_CONVERSATION_ACTIVE_WINDOW

            return (
              <li key={id} className="py-3 first:pt-0 last:pb-0">
                <Link
                  href={`/conversations/${id}`}
                  className="flex items-center gap-3 group"
                >
                  <span
                    className={clsx(
                      'w-2 h-2 rounded-full shrink-0',
                      active ? 'bg-green-500 animate-pulse' : 'auto-bg-gray-200'
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    {/* @note line-clamp instead of truncate - the fallback
                        description can be long, and nowrap text would grow
                        the card by its intrinsic width */}
                    <div className="text-sm font-medium auto-text-gray-900 line-clamp-1 group-hover:underline">
                      {name || description || 'Untitled conversation'}
                    </div>
                    <div className="text-xs auto-text-gray-500">
                      <TimeAgo time={updatedAt} />
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <Link
        href="/conversations"
        className="default-link mt-auto pt-4 text-sm inline-flex items-center gap-1 self-start"
      >
        View all conversations
        <ArrowUpRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}

/**
 * The get started cards shared by both overview experiences.
 */
export function GetStartedRow() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <NextStepItem
        title="Create a website widget"
        description="Build an assistant visitors can chat with directly on your website."
        link="/new?template=widget-agent"
        caption="Start widget"
      />
      <NextStepItem
        title="Create a Slack agent"
        description="Bring an AI agent into your Slack workspace to answer questions and automate tasks for your team."
        link="/new?template=slack-agent"
        caption="Start Slack agent"
      />
      <NextStepItem
        title="Start from an example"
        description="Clone a ready-made agent, assistant or blueprint from the examples catalogue and make it your own."
        link="/new?template=example"
        caption="Browse examples"
      />
    </div>
  )
}

/**
 * The usage row for the builder overview - conversations, messages, and the
 * token usage the plan is billed by.
 *
 * @note the report and the usage are account wide, not project scoped
 */
export function BuilderMetricsRow({ report, usage, limits }) {
  const {
    rangeLabel,
    conversationsValue,
    conversationsDelta,
    messagesValue,
    messagesDelta,
  } = deriveOverviewMetrics(report)

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <MetricCard
        title="Conversations"
        value={
          conversationsValue === null ? '-' : shortFormat(conversationsValue)
        }
        delta={conversationsDelta}
        rangeLabel={rangeLabel}
        link="/conversations"
      />
      <MetricCard
        title="Messages"
        value={messagesValue === null ? '-' : shortFormat(messagesValue)}
        delta={messagesDelta}
        rangeLabel={rangeLabel}
      />
      <TokenUsageCard usage={usage} limits={limits} />
    </div>
  )
}

export const PROJECT_LIST_LIMIT = 100

/**
 * Loads the projects (blueprints) for the builder overview.
 */
export function useProjects() {
  const [projects, setProjects] = useState(null)

  useEffect(() => {
    let cancelled = false

    fetchGraphQL(`query OverviewProjects {
  blueprints(first: ${PROJECT_LIST_LIMIT}) {
    edges {
      node {
        id
        name
        description
        createdAt
      }
    }
  }
}`)
      .then((data) => {
        if (!cancelled) {
          setProjects((data?.blueprints?.edges || []).map(({ node }) => node))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProjects([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { projects: projects || [], loading: projects === null }
}

/**
 * The projects list for the builder overview. Selecting a project scopes the
 * dashboard to it, which specialises this very screen.
 */
export function ProjectsCard({ projects, loading = false }) {
  const { setScope } = useProjectScope()

  const placeholders = Array.from({ length: 5 })

  return (
    <div
      className={clsx(
        'flex flex-col',
        // @note min-w-0 stops the intrinsic width of the rows from growing
        // the grid track the card sits in - without it long text pushes the
        // whole page sideways
        'min-w-0',
        'p-5',
        'border auto-border-gray-200',
        'rounded-xl',
        'auto-bg-white'
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-base font-semibold auto-text-gray-900">Projects</h2>
        <span className="text-xs auto-text-gray-500">Select one to focus</span>
      </div>
      {loading ? (
        <ul className="flex flex-col divide-y auto-divide-gray-100">
          {placeholders.map((_, i) => (
            <li key={i} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full auto-bg-gray-100" />
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <div className="h-3 w-32 rounded auto-bg-gray-100" />
                  <div className="h-2.5 w-48 rounded auto-bg-gray-100" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex-1 min-h-0 max-h-[26rem] overflow-auto subtle-scrollbar flex flex-col divide-y auto-divide-gray-100">
          {projects.length === 0 ? (
            <li className="text-sm auto-text-gray-500 py-2">
              No projects yet - start one from the cards above.
            </li>
          ) : null}
          {projects.map(({ id, name, description, createdAt }) => {
            const initials = (name || 'Untitled')
              .split(/\s+/g)
              .map((word) => word[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()

            return (
              <li key={id} className="py-3 first:pt-0 last:pb-0">
                <button
                  type="button"
                  className="w-full flex items-center gap-3 group text-left"
                  onClick={() => setScope({ id, name: name || 'Untitled' })}
                >
                  <Initials
                    className="auto-bg-gray-100 auto-text-gray-700 rounded-full w-7 h-7 text-xs shrink-0"
                    initials={initials}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium auto-text-gray-900 line-clamp-1 group-hover:underline">
                      {name || 'Untitled'}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs auto-text-gray-500">
                      {/* @note line-clamp instead of truncate - truncate is
                          nowrap, and nowrap text has the whole line as its
                          intrinsic width, which grows the card and pushes
                          the page sideways */}
                      <span className="min-w-0 flex-1 line-clamp-1">
                        {description || 'A project without description.'}
                      </span>
                      <span className="whitespace-nowrap">
                        <TimeAgo time={createdAt} />
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <Link
        href="/blueprints"
        className="default-link mt-auto pt-4 text-sm inline-flex items-center gap-1 self-start"
      >
        View all projects
        <ArrowUpRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}

/**
 * The overview for the builder experience when no project is selected: a
 * generic but builder oriented screen - get started, the projects to focus
 * on, live conversations, and the account usage.
 */
export function BuilderGenericOverviewTab({ limits, usage }) {
  const report = useOverviewReport()

  const { projects, loading: projectsLoading } = useProjects()

  const { conversations, loading: conversationsLoading } =
    useLiveConversations()

  return (
    <div className="space-y-6">
      <GetStartedRow />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 grid">
          <ProjectsCard projects={projects} loading={projectsLoading} />
        </div>
        <div className="lg:col-span-2 grid">
          <LiveConversationsCard
            conversations={conversations}
            loading={conversationsLoading}
          />
        </div>
      </div>

      <BuilderMetricsRow report={report} usage={usage} limits={limits} />
    </div>
  )
}

/**
 * The overview for the builder experience when a project is selected: the
 * project channel live on the page and the conversations its bots are
 * having. Projects that no single channel speaks for show their blueprint
 * canvas instead.
 */
export function BuilderProjectOverviewTab({ scope, limits, usage }) {
  const report = useOverviewReport()

  const {
    channel,
    count: channelCount,
    loading: channelLoading,
  } = useLatestChannel(scope.id)

  const setup = useProjectSetup(scope.id)

  const { conversations, loading: conversationsLoading } = useLiveConversations(
    scope.id
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 grid">
          {/* @note the channel preview is the project only when the project is
              the channel. Ship a second one and the leading channel becomes an
              arbitrary pick that hides the rest, so the canvas - which holds
              all of them - takes over, the same way it does for a project that
              ships none. */}
          {channelLoading ? (
            <PreviewSkeleton />
          ) : channel && channelCount === 1 ? (
            <ChannelPreview channel={channel} />
          ) : (
            <DesignerPreviewCard scope={scope} />
          )}
        </div>
        {/* @note the authentication panel takes the top of this column and the
            feed keeps the rest. A project that cannot authenticate has an empty
            feed anyway, and this is the reason - so the two belong stacked. It
            stays off the screen until the setup resolves, and folds away for
            good once everything is authenticated, handing the feed the whole
            column back. */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {setup && !setup.complete ? (
            <ProjectAuthenticationCard
              items={setup.items}
              doneCount={setup.doneCount}
            />
          ) : null}
          {/* @note the grid wrapper stretches the feed to the height flex-1
              hands it, the way the column did when it held the feed alone */}
          <div className="flex-1 grid">
            <LiveConversationsCard
              conversations={conversations}
              loading={conversationsLoading}
            />
          </div>
        </div>
      </div>

      <BuilderMetricsRow report={report} usage={usage} limits={limits} />
    </div>
  )
}

/**
 * The overview for the builder experience. Selecting a project from the
 * project dropdown specialises the screen to it; without one the screen
 * stays generic but builder oriented.
 */
export function BuilderOverviewTab({ limits, usage }) {
  const { hydrated, scope } = useProjectScope()

  // @note the scope loads from storage after mount - rendering either screen
  // before it settles would flash the wrong one and fire fetches whose
  // results get thrown away
  if (!hydrated) {
    return null
  }

  if (scope?.id) {
    return (
      <BuilderProjectOverviewTab scope={scope} limits={limits} usage={usage} />
    )
  }

  return <BuilderGenericOverviewTab limits={limits} usage={usage} />
}

/**
 * The overview for the platform experience: the full operational picture -
 * performance metrics, usage charts, recent work, and developer shortcuts.
 *
 * @note the panel stays mounted between tab switches (see keepMounted on the
 * SimpleTabs below) so the data it loads here survives the user browsing the
 * other tabs and back.
 */
export function PlatformOverviewTab({ limits, usage }) {
  const report = useOverviewReport()

  const { items: recentItems, loading: recentItemsLoading } = useRecentWork()

  const hasResources = recentItems.length > 0

  const {
    rangeLabel,
    conversationsValue,
    conversationsDelta,
    messagesValue,
    messagesDelta,
    thumbsUpRate,
    thumbsUpDelta,
  } = deriveOverviewMetrics(report)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Conversations"
          value={
            conversationsValue === null ? '-' : shortFormat(conversationsValue)
          }
          delta={conversationsDelta}
          rangeLabel={rangeLabel}
          link="/conversations"
        />
        <MetricCard
          title="Messages"
          value={messagesValue === null ? '-' : shortFormat(messagesValue)}
          delta={messagesDelta}
          rangeLabel={rangeLabel}
        />
        <MetricCard
          title="Thumbs-up rate"
          value={thumbsUpRate === null ? '-' : `${thumbsUpRate}%`}
          delta={thumbsUpDelta}
          rangeLabel={rangeLabel}
          link="/ratings"
        />
        <TokenUsageCard usage={usage} limits={limits} />
      </div>

      {/* @note the next steps stay hidden until the recent work loads,
          otherwise they flash for users who already have resources */}
      {!recentItemsLoading && !hasResources ? <GetStartedRow /> : null}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 grid">
          <UsageChartCard report={report} />
        </div>
        <RecentWorkCard items={recentItems} loading={recentItemsLoading} />
        <div className="flex flex-col gap-4">
          <SystemStatusCard />
          <QuickActionsCard />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 grid">
          <TopBotsCard topBots={report?.topBots} loading={!report} />
        </div>
        <UsefulResourcesCard />
        <NeedHelpCard />
      </div>
    </div>
  )
}

/**
 * Videos and documentation topics opened without leaving the dashboard.
 */
export function LearnTab({ documents = [] }) {
  const router = useRouter()

  const { popup, openPopup } = usePopup({
    dialogClassName: '!max-w-4xl h-screen max-h-[max(calc(100vh*0.5),800px)]',
  })

  return (
    <>
      {popup}
      <div className="space-y-10">
        <div>
          <div className="mb-4 flex flex-col gap-1">
            <h2 className="text-base font-medium auto-text-gray-900">
              Documentation
            </h2>
            <p className="text-sm auto-text-gray-500">
              Open the most important platform topics without leaving the
              dashboard.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-8">
            {documents.map((topic) => (
              <DocumentationItem
                key={topic.href}
                topic={topic}
                openPopup={openPopup}
                router={router}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export default function Index({ limits, usage, documents = [] }) {
  const [selectedTab, setSelectedTab] = useState(0)

  const platformExperience = usePlatformExperience()

  return (
    <section className="section-transparent">
      <div className="main-page main-page-7xl">
        <SimpleTabs
          className="!space-y-14"
          selectedIndex={selectedTab}
          onChange={setSelectedTab}
          // @note the tabs load their own data - keep the panels mounted so
          // switching between them does not refetch
          keepMounted={true}
          tabs={{
            // @note the two experiences get different overview components
            // instead of one overview riddled with conditionals - the
            // platform overview is the developer picture, the builder
            // overview is the productivity picture
            Overview: {
              children: platformExperience ? (
                <PlatformOverviewTab limits={limits} usage={usage} />
              ) : (
                <BuilderOverviewTab limits={limits} usage={usage} />
              ),
              default: true,
            },

            Learn: {
              children: <LearnTab documents={documents} />,
              hidden: !!platformExperience,
            },
          }}
        />
      </div>
    </section>
  )
}

Index.getLayout = function (children, { authenticated }) {
  return (
    <Dashboard
      breadcrumbs={['ChatBotKit']}
      title="Overview"
      description="See how your agents are performing, pick up recent work, and jump to what you need next."
      keywords="overview, dashboard, agent analytics, conversation metrics, token usage, recent activity"
      authenticated={authenticated}
    >
      {authenticated ? (
        children
      ) : (
        <PageHero>
          <DocsLink className="default-button">Learn More</DocsLink>
          {/* <Link
          className="primary-button"
          href={{
            pathname: '/signin',
            query: {
              callbackUrl: '/bots',
            },
          }}
        >
          Sign in
        </Link> */}
        </PageHero>
      )}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

export function PageHero(props) {
  const { isTeamSwitched, isUserSwitched, teams } = useSessionContext()

  return (
    <Hero
      {...props}
      title={['Build', 'your first assistant']}
      description="Start with a website widget, support assistant, messaging bot, or agent. The platform pieces stay available when you need more control."
      compact={true}
    >
      {!isTeamSwitched && !isUserSwitched && teams.length > 0 ? (
        <TeamSwitchButton className="default-button">
          Switch Team
        </TeamSwitchButton>
      ) : null}
    </Hero>
  )
}

export async function getServerSideProps(context) {
  const hideDocuments = false

  const session = await getSoftSession(context.req, context.res)

  if (!session) {
    // @note normally we should show the authentication version of the page but
    // in this case we must redirect the user to sign in in order to complete
    // to reduce the number of steps for new users
    // return {
    //   props: makeJsonSafe({
    //     authenticated: false,
    //   }),
    // }

    return {
      redirect: {
        destination: `/signin?callbackUrl=${encodeURIComponent('/overview')}`,
        permanent: false,
      },
    }
  }

  // @note the recent work is fetched client side over GraphQL - see
  // useRecentWork

  const [limits, usage] = await Promise.all([
    getUserDisplayLimits(session.user),
    getUsage(session.user.id),
  ])

  const documents = hideDocuments
    ? []
    : docs.filter((doc) => {
        return !['Blueprints', 'Portals'].includes(doc.title)
      })

  return {
    props: makeJsonSafe({
      authenticated: true,

      limits,
      usage,

      documents,
    }),
  }
}
