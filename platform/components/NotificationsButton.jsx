'use client'

import { useCallback, useEffect, useState } from 'react'

import ForwardLink from '@/components/ForwardLink'
import { GlobalRootPortal } from '@/components/GlobalRoot'

import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'

import {
  BellIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'

import clsx from 'clsx'

/**
 * A button component that displays notifications for usage alerts from reports.
 * Shows a bell icon with a dot indicator when there are alerts. Clicking opens
 * a popup with the list of alerts.
 */
export default function NotificationsButton({ className }) {
  const [alerts, setAlerts] = useState([])

  const { fetch } = useFetch()

  const { popup, openPopup } = usePopup({
    title: 'Notifications',
    description: 'Usage alerts that may need your attention.',
    cancelButtonCaption: 'Close',
  })

  const fetchNotifications = useCallback(async () => {
    // @note fetch alerts report

    const alertsResult = await fetch('/api/v1/platform/report/generate', {
      method: 'POST',
      data: {
        clr3m5n8k000f08jqcs1u2v6p: { periodDays: 7 },
      },
      trackLoading: false,
    })

    // @note process alerts report

    if (
      !alertsResult.error &&
      alertsResult.data?.clr3m5n8k000f08jqcs1u2v6p?.alerts
    ) {
      setAlerts(alertsResult.data.clr3m5n8k000f08jqcs1u2v6p.alerts)
    }
  }, [fetch])

  useEffect(() => {
    fetchNotifications()

    // @note refresh notifications every 5 minutes to reduce server load

    const interval = setInterval(fetchNotifications, 300_000)

    return () => clearInterval(interval)
  }, [fetchNotifications])

  const hasNotifications = alerts.length > 0

  // @note check if there are critical alerts

  const hasCriticalAlerts = alerts.some(
    (alert) => alert.severity === 'critical'
  )

  const handleClick = useCallback(() => {
    openPopup(<NotificationsList alerts={alerts} />, {
      noActions: true,
    })
  }, [openPopup, alerts])

  return (
    <>
      <GlobalRootPortal>{popup}</GlobalRootPortal>
      <div className="relative group/tooltip">
        <button
          type="button"
          className={clsx(
            'default-button push relative overflow-visible',
            className
          )}
          onClick={handleClick}
          aria-label="Notifications"
        >
          <BellIcon className="h-5 w-5" />
          {hasNotifications ? (
            <span
              className={clsx(
                'absolute -top-1 -right-1 h-3 w-3 rounded-full',
                hasCriticalAlerts ? 'bg-red-500' : 'bg-blue-500'
              )}
            />
          ) : null}
        </button>
        <div className="tooltip -bottom-3 w-36">
          {hasNotifications ? 'View notifications' : 'No notifications'}
        </div>
      </div>
    </>
  )
}

function NotificationsList({ alerts }) {
  const hasAlerts = alerts.length > 0

  const getSeverityIcon = useCallback((severity) => {
    switch (severity) {
      case 'critical':
        return <ExclamationCircleIcon className="h-4 w-4 text-red-500" />
      case 'warning':
        return <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
      default:
        return <InformationCircleIcon className="h-4 w-4 text-blue-500" />
    }
  }, [])

  const getSeverityTag = useCallback((severity) => {
    switch (severity) {
      case 'critical':
        return 'error'
      case 'warning':
        return 'warning'
      default:
        return 'info'
    }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      {!hasAlerts ? (
        <p className="text-sm italic auto-text-gray-500">
          No recent usage alerts.
        </p>
      ) : (
        <>
          {/* Usage Alerts Section */}
          <div>
            <h3 className="text-xs font-semibold uppercase auto-text-gray-500 mb-2">
              Usage Alerts
            </h3>
            <ul className="divide-y auto-divide-gray-100 max-h-48 overflow-y-auto">
              {alerts.map((alert, index) => (
                <li key={`alert-${index}`} className="py-2">
                  <div className="flex items-start gap-2">
                    {getSeverityIcon(alert.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={clsx(
                            'tag text-xs',
                            getSeverityTag(alert.severity)
                          )}
                        >
                          {alert.severity}
                        </span>
                        <span className="text-sm font-medium auto-text-gray-900 truncate">
                          {alert.title}
                        </span>
                      </div>
                      <p className="text-xs auto-text-gray-500 mt-1">
                        {alert.message}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-2 border-t auto-border-gray-100">
            <ForwardLink
              className="inline-block pr-4 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              href="/alerts"
            >
              View all alerts
            </ForwardLink>
          </div>
        </>
      )}
    </div>
  )
}
