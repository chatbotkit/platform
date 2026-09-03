import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import FAQ from '@/components/FAQ'
import Link from '@/components/Link'

import faq from '@/content/faqs/platform-alerts.yaml'

import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'

import clsx from 'clsx'

function SummaryCard({ title, count, icon, color }) {
  const colorClasses = {
    gray: 'auto-bg-gray-50 auto-border-gray-200 auto-text-gray-600',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400',
    yellow:
      'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-600 dark:text-yellow-400',
    neutral: 'auto-bg-gray-50 auto-border-gray-200 auto-text-gray-600',
  }

  return (
    <div
      className={clsx(
        'p-4 rounded-lg border',
        colorClasses[color] || colorClasses.gray
      )}
    >
      <div className="flex items-center gap-2 mb-2">{icon}</div>
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-sm opacity-75">{title}</p>
    </div>
  )
}

function AlertCard({ alert }) {
  const severityConfig = {
    critical: {
      icon: <ExclamationCircleIcon className="h-5 w-5 text-red-500" />,
      bgClass:
        'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      tagClass: 'error',
    },
    warning: {
      icon: <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />,
      bgClass:
        'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
      tagClass: 'warning',
    },
    info: {
      icon: <InformationCircleIcon className="h-5 w-5 auto-text-gray-500" />,
      bgClass: 'auto-bg-gray-50 auto-border-gray-200',
      tagClass: 'info',
    },
  }

  const config = severityConfig[alert.severity] || severityConfig.info

  return (
    <div className={clsx('p-4 rounded-lg border', config.bgClass)}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={clsx('tag text-xs', config.tagClass)}>
              {alert.severity}
            </span>
            <span className="tag text-xs">{alert.type}</span>
          </div>
          <h3 className="font-medium auto-text-gray-900">{alert.title}</h3>
          <p className="text-sm auto-text-gray-600 mt-1">{alert.message}</p>
          {alert.metric ? (
            <div className="mt-2 text-xs auto-text-gray-500 flex gap-4">
              <span>
                Current:{' '}
                <strong>{alert.metric.current?.toLocaleString('en-US')}</strong>
              </span>
              {alert.metric.baseline !== undefined ? (
                <span>
                  Baseline:{' '}
                  <strong>
                    {Math.round(alert.metric.baseline).toLocaleString('en-US')}
                  </strong>
                </span>
              ) : null}
              {alert.metric.percentage !== undefined ? (
                <span>
                  Change: <strong>{alert.metric.percentage.toFixed(1)}%</strong>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function Index({ alerts, summary, period }) {
  return (
    <>
      <div className="main-page">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold">Alerts</h1>
        </div>
        <div className="space-y-2">
          <p>
            Alerts are generated for the{' '}
            <span className="font-bold">{period}</span>. For more information
            about your usage, see the{' '}
            <Link className="default-link" href="/usage" target="_blank">
              usage
            </Link>{' '}
            page. To adjust your plan limits, visit the{' '}
            <Link
              className="default-link"
              href="/platform/limits"
              target="_blank"
            >
              limits
            </Link>{' '}
            page.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard
            title="Total Alerts"
            count={summary.totalAlerts}
            icon={<ExclamationTriangleIcon className="h-6 w-6" />}
            color="gray"
          />
          <SummaryCard
            title="Critical"
            count={summary.criticalCount}
            icon={<ExclamationCircleIcon className="h-6 w-6" />}
            color="red"
          />
          <SummaryCard
            title="Warnings"
            count={summary.warningCount}
            icon={<ExclamationTriangleIcon className="h-6 w-6" />}
            color="yellow"
          />
          <SummaryCard
            title="Info"
            count={summary.infoCount}
            icon={<InformationCircleIcon className="h-6 w-6" />}
            color="neutral"
          />
        </div>

        {/* Alerts List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Alert Details</h2>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-3 p-6 auto-bg-gray-50 rounded-lg border auto-border-gray-200">
              <CheckCircleIcon className="h-8 w-8 auto-text-gray-900" />
              <div>
                <p className="font-medium auto-text-gray-900">All Clear!</p>
                <p className="text-sm auto-text-gray-600">
                  No alerts detected for the {period}. Your usage patterns and
                  limits are within normal ranges.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert, index) => (
                <AlertCard key={index} alert={alert} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

Index.getLayout = function (children) {
  return (
    <Dashboard
      breadcrumbs={['ChatBotKit']}
      title="Alerts"
      description="View alerts for usage spikes, plan limits, and feedback metrics. Monitor your platform health and identify potential issues."
      keywords="alerts, usage spikes, limits, warnings, monitoring, notifications, platform health"
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  if (!session) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${context.resolvedUrl}`,
        permanent: false,
      },
    }
  }

  // @note import report registry dynamically to avoid circular dependencies

  const { registry } = await import('@/lib/report')

  const report = registry.clr3m5n8k000f08jqcs1u2v6p

  const result = await report.handler(session, { periodDays: 7 })

  return {
    props: makeJsonSafe({
      alerts: result.alerts,
      summary: result.summary,
      period: result.period,
    }),
  }
}
