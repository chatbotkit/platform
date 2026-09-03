import { useMemo } from 'react'

import { Tab } from '@headlessui/react'

import clsx from 'clsx'

export default function SimpleTabs({
  className,

  panelClassName,
  panelsClassName,
  tabListClassName,

  tabs: _tabs,

  // @note by default the panels that are not selected are unmounted. Pass
  // keepMounted when the panels own state or data fetching that should
  // survive the user switching between tabs.
  keepMounted = false,

  ...props
}) {
  const tabs = useMemo(() => {
    if (Array.isArray(_tabs)) {
      return _tabs.map((tab) => {
        return [tab.title || tab.label || tab.name || tab.key || `Tab`, tab]
      })
    } else {
      return Object.entries(_tabs)
    }
  }, [_tabs])

  const defaultIndex = useMemo(() => {
    const index = tabs.findIndex(([, tab]) => tab?.default)

    return index === -1 ? 0 : index
  }, [tabs])

  return (
    <Tab.Group
      {...props}
      className={clsx('simple-tabs', 'space-y-6', className)}
      as="div"
      defaultIndex={defaultIndex}
    >
      <Tab.List className={clsx('tab-list flex space-x-4', tabListClassName)}>
        {tabs
          .filter(([, tab]) => !tab?.hidden)
          .map(([tab], index) => {
            return (
              <Tab
                key={index}
                className={({ selected }) =>
                  clsx(
                    'tab',
                    'text-sm !no-underline p-2 border-b-4 focus:!ring-0 focus:!outline-none',
                    'min-w-0 truncate',
                    'select-none cursor-pointer transition-colors',
                    {
                      'border-transparent auto-text-gray-800 hover:auto-text-gray-900':
                        !selected,
                      'border-[var(--color-accent)] text-[var(--color-accent)]':
                        selected,
                    }
                  )
                }
              >
                {tab}
              </Tab>
            )
          })}
      </Tab.List>
      <Tab.Panels className={clsx('tab-panels', panelsClassName)}>
        {tabs
          .filter(([, tab]) => !tab?.hidden)
          .map(([, tab], index) => {
            return (
              <Tab.Panel
                key={index}
                className={panelClassName}
                unmount={!keepMounted}
              >
                {tab?.children || tab?.content || tab?.panel || tab}
              </Tab.Panel>
            )
          })}
      </Tab.Panels>
    </Tab.Group>
  )
}
