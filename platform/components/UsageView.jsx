import { useMemo, useState } from 'react'

import { shortFormat } from '@/lib/number'
import { toPascalCase } from '@/lib/string'

import DailyChart from '@/components/DailyChart'
import Expando from '@/components/Expando'
import ProgressBar from '@/components/ProgressBar'
import TimeAgo from '@/components/TimeAgo'

import clsx from 'clsx'

export const LAST_90_DAYS_CAPTION = 'last 90 days'
export const THIS_PERIOD_CAPTION = 'this period'

// @note the period boundaries are derived from counter expiration and may
// drift a few days from the exact billing cycle, hence the UTC-pinned,
// day-level precision
export function formatPeriodDate(time, withYear = false) {
  return new Date(time).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: withYear ? 'numeric' : undefined,
    timeZone: 'UTC',
  })
}

export function UsagePeriod({ usagePeriod }) {
  if (usagePeriod?.start && usagePeriod?.end) {
    const withYear =
      new Date(usagePeriod.start).getUTCFullYear() !==
      new Date(usagePeriod.end).getUTCFullYear()

    return (
      <p className="text-sm text-neutral-500">
        Current usage period:{' '}
        <span className="font-semibold">
          {formatPeriodDate(usagePeriod.start, withYear)} –{' '}
          {formatPeriodDate(usagePeriod.end, withYear)}
        </span>{' '}
        · resets <TimeAgo time={usagePeriod.end} />
      </p>
    )
  }

  return (
    <p className="text-sm text-neutral-500">
      {/* @note the period length must match USAGE_PERIOD_IN_DAYS in
          lib/usage.period.ts, which cannot be imported here as it drags in
          the redis client */}
      No usage recorded in the current period. A new 31-day usage period starts
      with the first recorded activity.
    </p>
  )
}

export function ProgressText({ name, used, total, ttl }) {
  return (
    <h3 className="text-base cursor-default">
      <span className="relative group/tooltip cursor-help">
        <span className="font-semibold">{name}:</span> {shortFormat(used)} /{' '}
        {total === '$Infinity' || total >= Number.MAX_SAFE_INTEGER
          ? '∞'
          : shortFormat(total)}
        <span
          className={clsx('tooltip below', {
            'w-48': !!ttl,
            'w-24': !ttl,
          })}
        >
          {used.toLocaleString('en-US')}{' '}
          {ttl ? (
            <>
              (resets <TimeAgo time={Date.now() + ttl} tooltip={false} />)
            </>
          ) : null}
        </span>
      </span>
    </h3>
  )
}

// @note a limit is only "exceeded" once there is actual consumption at or
// above a finite cap. Infinite/unknown caps (e.g. '$Infinity' after JSON
// serialization) are ignored via Number.isFinite.
function isLimitExceeded(used, total) {
  return Number.isFinite(total) && used > 0 && used >= total
}

/**
 * Returns true when the user has reached or exceeded any of their plan limits.
 * Mirrors the metric-to-limit mapping used by UsageMetrics.
 */
export function hasExceededUsageLimit(usage, otherUsage, limits) {
  for (const [name, { value } = {}] of Object.entries(usage || {})) {
    const total = limits?.[name.toLowerCase()] ?? Infinity

    if (isLimitExceeded(value ?? 0, total)) {
      return true
    }
  }

  for (const [key, value] of Object.entries(otherUsage || {})) {
    const [category, name] = key.split('/')

    const total = limits?.[category]?.[name.toLowerCase()] ?? Infinity

    if (isLimitExceeded(value ?? 0, total)) {
      return true
    }
  }

  return false
}

export function UsageMetrics({ usage, otherUsage, limits }) {
  const metrics = Object.entries(usage || {}).map(([name, { value, ttl }]) => {
    return {
      name: toPascalCase(name),

      used: value ?? 0,

      ttl: ttl ?? 0,

      total: limits?.[name.toLowerCase()] ?? Infinity, // @note not sure if this is the best way to handle this
    }
  })

  const otherMetrics = Object.entries(otherUsage || {}).map(([key, value]) => {
    const [category, name] = key.split('/')

    return {
      name: toPascalCase(name),

      used: value ?? 0,

      total: limits?.[category]?.[name.toLowerCase()] ?? Infinity, // @note not sure if this is the best way to handle this
    }
  })

  return (
    <>
      {metrics.length ? (
        <>
          {metrics.map(({ name, used, ttl, total }) => {
            return (
              <div key={name} className="space-y-2">
                <ProgressText name={name} used={used} total={total} ttl={ttl} />
                <ProgressBar
                  used={used}
                  total={total}
                  useThresholdColors={true}
                />
              </div>
            )
          })}
        </>
      ) : null}
      {otherMetrics.length ? (
        <Expando
          titleClassName="default-link text-sm"
          title="Other Usage Metrics"
        >
          {otherMetrics.map(({ name, used, total }) => {
            return (
              <div key={name} className="space-y-2">
                <ProgressText name={name} used={used} total={total} />
                <ProgressBar
                  used={used}
                  total={total}
                  useThresholdColors={true}
                />
              </div>
            )
          })}
        </Expando>
      ) : null}
    </>
  )
}

export function UsageCharts({
  usageSeries,
  usageSeriesThisPeriod,
  usagePeriod,
}) {
  const thisPeriodCaption = useMemo(() => {
    if (usagePeriod?.start && usagePeriod?.end) {
      return `${formatPeriodDate(usagePeriod.start)} – ${formatPeriodDate(
        usagePeriod.end
      )}`
    }

    return THIS_PERIOD_CAPTION
  }, [usagePeriod])

  const periods = useMemo(() => {
    const periods = [LAST_90_DAYS_CAPTION]

    if (usageSeriesThisPeriod) {
      periods.push(thisPeriodCaption)
    }

    return periods
  }, [usageSeriesThisPeriod, thisPeriodCaption])

  const [period, setPeriod] = useState(periods[0])

  const series = {
    [LAST_90_DAYS_CAPTION]: usageSeries,
    [thisPeriodCaption]: usageSeriesThisPeriod,
  }[period]

  return (
    <>
      <div className="space-y-2">
        <div className="flex flex-row flex-wrap gap-1 justify-end">
          {periods.map((thisPeriod) => (
            <button
              key={thisPeriod}
              className={clsx('default-button tiny push', {
                selected: period === thisPeriod,
              })}
              type="button"
              onClick={() => setPeriod(thisPeriod)}
            >
              {thisPeriod}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4">
          {/* token usage */}
          {series.tokens?.length ? (
            <DailyChart title="Tokens" data={series.tokens} />
          ) : null}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* conversation usage */}
            {series.conversations?.length ? (
              <DailyChart title="Conversations" data={series.conversations} />
            ) : null}
            {/* message usage */}
            {series.messages?.length ? (
              <DailyChart title="Messages" data={series.messages} />
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}

export default function UsageView({
  usage,
  otherUsage,
  usageSeries,
  usageSeriesThisPeriod,
  usagePeriod,
  limits,
}) {
  return (
    <>
      {/* @note undefined means the caller does not surface the period at
          all, while null means there is no active period to display */}
      {usagePeriod !== undefined ? (
        <UsagePeriod usagePeriod={usagePeriod} />
      ) : null}
      <UsageMetrics usage={usage} otherUsage={otherUsage} limits={limits} />
      {usageSeries?.tokens?.length ||
      usageSeries?.conversations?.length ||
      usageSeries?.messages?.length ? (
        <UsageCharts
          usageSeries={usageSeries}
          usageSeriesThisPeriod={usageSeriesThisPeriod}
          usagePeriod={usagePeriod}
        />
      ) : null}
    </>
  )
}
