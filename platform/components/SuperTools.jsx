import { memo, useCallback, useMemo, useState } from 'react'

import { GlobalRootPortal } from '@/components/GlobalRoot'
import Portal from '@/components/Portal'
import Pullout from '@/components/Pullout'
import Toggle from '@/components/Toggle'

import { usePublish } from '@/hooks/useBus'
import useLocalStorage from '@/hooks/useLocalStorage'
import usePlatformExperience from '@/hooks/usePlatformExperience'
import usePopup from '@/hooks/usePopup'
import useRouter from '@/hooks/useRouter'
import useSearchParam from '@/hooks/useSearchParam'

import { CommandLineIcon } from '@heroicons/react/24/outline'
import { Cog6ToothIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

const CHANNEL = 'super-tools'
const ENABLED_APPS_STORAGE_KEY = 'super-tools:enabled-apps'

/**
 * @returns {{ open: () => void }}
 */
export function useSuperTools() {
  const open = usePublish(CHANNEL)

  return { open }
}

/**
 * Reports whether the SuperTools pullout renders for the current experience
 * and search params. Layouts derive from it any space they reserve for the
 * pullout handle so the two can never disagree.
 *
 * @param {object} [options]
 * @param {boolean} [options.force] Render regardless of the platform/builder
 *   experience (e.g. the blueprint designer). The `_supertools=off` search
 *   param still wins so the explicit opt-out keeps working everywhere.
 * @returns {boolean}
 */
export function useSuperToolsVisible({ force = false } = {}) {
  const isPlatformExperience = usePlatformExperience()

  const isOff = useSearchParam('_supertools') === 'off'

  return (force || isPlatformExperience) && !isOff
}

/**
 * @param {object} props
 * @param {object[]} props.allApps
 * @param {object} props.enabledApps
 * @param {(appId: string, enabled: boolean) => void} props.setAppEnabled
 */
function SuperToolsSettings({ allApps, enabledApps, setAppEnabled }) {
  const configurableApps = allApps.filter((app) => app.id !== 'chat')

  const [draftEnabledApps, setDraftEnabledApps] = useState(enabledApps)

  const setDraftAppEnabled = useCallback(
    (appId, enabled) => {
      setDraftEnabledApps((enabledApps) => ({
        ...enabledApps,

        [appId]: enabled,
      }))

      setAppEnabled(appId, enabled)
    },
    [setAppEnabled]
  )

  return (
    <div className="flex flex-col divide-y auto-divide-gray-100">
      {configurableApps.map((app) => (
        <div key={app.id} className="py-3 flex flex-row items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium auto-text-gray-900">
              {app.label}
            </div>
            {app.description ? (
              <div className="mt-1 text-xs auto-text-gray-500">
                {app.description}
              </div>
            ) : null}
          </div>
          <Toggle
            caption={app.label}
            checked={Boolean(draftEnabledApps[app.id])}
            setChecked={(enabled) => setDraftAppEnabled(app.id, enabled)}
          />
        </div>
      ))}
    </div>
  )
}

/**
 * @param {object} props
 * @param {string} [props.className]
 * @param {string} [props.blueprintId]
 */
export function SuperToolsInner({ className, theme, blueprintId }) {
  const router = useRouter()

  const [activeApp, setActiveApp] = useState('chat')

  const [enabledApps, setEnabledApps] = useLocalStorage(
    ENABLED_APPS_STORAGE_KEY,
    {
      trace: false,
      eventlog: true,
      auditlog: false,
      usagelog: true,
      conversations: false,
      automations: false,
      analytics: false,
      inspector: true,
      apidocs: false,
    }
  )

  const { popup, openPopup } = usePopup({
    title: 'Tools',
    cancelButtonCaption: 'Close',
  })

  // @note every app embedded here is rendered in an <iframe> as a client-only
  // dashboard tool. Their pages wrap <Main> in <NoSsr> on purpose - SSR-ing
  // them aborts the app-layout Suspense boundary. When you add a new app to
  // this list, wrap its <Main> in <NoSsr> as well.
  // See app/apps/layout.jsx for the full rationale.

  const allApps = useMemo(() => {
    const generalParams = new URLSearchParams()

    {
      generalParams.set('_embed', 'dashboard')

      if (theme) {
        generalParams.set('_theme', theme)
      }
    }

    const chatParams = new URLSearchParams()

    {
      chatParams.set('debug', 'true')

      if (blueprintId) {
        chatParams.set('blueprintId', blueprintId)
      }
    }

    const allParams = new URLSearchParams({
      ...Object.fromEntries(generalParams.entries()),
      ...Object.fromEntries(chatParams.entries()),
    })

    const inspectorParams = new URLSearchParams({
      ...Object.fromEntries(generalParams.entries()),
      inspect: router.asPath,
    })

    return [
      {
        id: 'chat',
        label: 'Agent Console',
        description:
          'Open the embedded agent console with dashboard debugging.',
        src: `/apps/chat?${allParams.toString()}`,
      },
      {
        id: 'trace',
        label: 'Agent Trace',
        description: 'Inspect model calls, tool activity, and trace details.',
        src: `/apps/trace?${allParams.toString()}`,
      },
      {
        id: 'eventlog',
        label: 'Event Logs',
        description: 'Review platform events and live operational logs.',
        src: `/apps/eventlog?${allParams.toString()}`,
      },
      {
        id: 'auditlog',
        label: 'Audit Logs',
        description:
          'Review account changes, audit history, and request context.',
        src: `/apps/auditlog?${allParams.toString()}`,
      },
      {
        id: 'usagelog',
        label: 'Usage Logs',
        description:
          'Review detailed usage records, models, and resource consumption.',
        src: `/apps/usagelog?${allParams.toString()}`,
      },
      {
        id: 'conversations',
        label: 'Live Conversations',
        description:
          'Monitor remote conversations and inspect live execution streams.',
        src: `/apps/5c0a7a11?${allParams.toString()}`,
      },
      {
        id: 'automations',
        label: 'Live Automations',
        description:
          'Monitor running tasks and trigger integrations with live cancel controls.',
        src: `/apps/6e3b7f2a?${generalParams.toString()}`,
      },
      {
        id: 'analytics',
        label: 'Analytics',
        description:
          'Monitor analytics, trends, and high-level activity insights.',
        src: `/apps/7cb29ccc?${generalParams.toString()}`,
      },
      {
        id: 'inspector',
        label: 'Inspector',
        description:
          'Inspect the current dashboard resource with related object data and logs.',
        src: `/apps/41f203dc?${inspectorParams.toString()}`,
      },
      {
        id: 'apidocs',
        label: 'API Docs',
        description:
          'Browse the embedded API reference with endpoint details and examples.',
        src: `/apps/b4d0c8f2?${generalParams.toString()}`,
      },
    ]
  }, [theme, blueprintId, router.asPath])

  const apps = useMemo(() => {
    return allApps.filter((app) => app.id === 'chat' || enabledApps[app.id])
  }, [allApps, enabledApps])

  const setAppEnabled = useCallback(
    (appId, enabled) => {
      setEnabledApps((enabledApps) => ({
        ...enabledApps,
        [appId]: enabled,
      }))

      if (!enabled) {
        setActiveApp((activeApp) => (activeApp === appId ? 'chat' : activeApp))
      }
    },
    [setEnabledApps]
  )

  const openSettings = useCallback(() => {
    openPopup(
      <SuperToolsSettings
        allApps={allApps}
        enabledApps={enabledApps}
        setAppEnabled={setAppEnabled}
      />
    )
  }, [allApps, enabledApps, openPopup, setAppEnabled])

  return (
    <Pullout
      id="super-tools"
      className={clsx(
        {
          dark: theme === 'dark',
        },
        className,
        '[&[data-closed="false"]_.handle]:rounded-tr-none'
      )}
      enableHandleHintAnimation={false}
      enableResize={true}
      handleAriaLabel="Toggle developer tools"
      handleContent={
        <span className="pointer-events-none flex h-full w-full items-center justify-center gap-2 px-3 text-xs font-medium leading-none select-none">
          <CommandLineIcon className="block w-4 h-4 shrink-0" />
          <span className="block leading-none">Developer</span>
        </span>
      }
      handleSemantics={false}
      keydownKey="b"
      openChannel={CHANNEL}
      resizeStorageKey="super-tools:height"
      lockScroll={true}
    >
      <GlobalRootPortal>{popup}</GlobalRootPortal>
      <Portal query="#super-tools .handle-extra">
        {apps.map((app) => (
          // @todo when the width is bellow certain threshold, we should
          // collapse to icon only buttons with tooltip or in a dropdown to save
          // space
          <button
            key={app.id}
            type="button"
            className={clsx(
              'pointer-events-auto',
              'flex min-w-0 items-center justify-center',
              'px-4 h-8',
              // @note border-b matches content area border-t to prevent visual shift on hover
              'border-t border-r border-b border-gray-200 dark:border-gray-800',
              'bg-white dark:bg-black',
              'text-xs font-medium leading-none',
              'cursor-pointer',
              'select-none',
              'transition-colors duration-200',
              {
                'text-gray-900 dark:text-gray-100': activeApp === app.id,
                'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200':
                  activeApp !== app.id,
              }
            )}
            onClick={() => setActiveApp(app.id)}
          >
            <span className="block max-w-full truncate px-0.5">
              {app.label}
            </span>
          </button>
        ))}
        <button
          type="button"
          className={clsx(
            'pointer-events-auto',
            'flex items-center justify-center',
            'px-3 h-8',
            'border-t border-r border-b border-gray-200 dark:border-gray-800',
            'rounded-tr-xl',
            'bg-white dark:bg-black',
            'text-xs font-medium leading-none',
            'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
            'cursor-pointer',
            'select-none',
            'transition-colors duration-200'
          )}
          onClick={openSettings}
          aria-label="Configure Super Tools"
          title="Configure Super Tools"
        >
          <Cog6ToothIcon className="w-4 h-4" />
        </button>
      </Portal>
      <div className="relative w-full h-full">
        {apps.map((app) => (
          <iframe
            key={app.id}
            id={`console-${app.id}`}
            className={clsx('absolute inset-0 w-full h-full auto-bg-white', {
              invisible: activeApp !== app.id,
            })}
            src={app.src}
          />
        ))}
      </div>
    </Pullout>
  )
}

SuperToolsInner.Memo = memo(SuperToolsInner)

/**
 * @param {object} props
 * @param {string} [props.className]
 * @param {string} [props.blueprintId]
 * @param {boolean} [props.force] Render regardless of the platform/builder
 *   experience. Used by surfaces like the blueprint designer that always want
 *   the tools available.
 */
export default function SuperTools({ className, theme, blueprintId, force }) {
  const isVisible = useSuperToolsVisible({ force })

  return isVisible ? (
    <SuperToolsInner.Memo
      className={className}
      theme={theme}
      blueprintId={blueprintId}
    />
  ) : null
}

SuperTools.Memo = memo(SuperTools)
