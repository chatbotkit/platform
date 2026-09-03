import { useMemo } from 'react'

import clsx from 'clsx'

export function usePlaceholderColorClass(isDark) {
  const [colorClass01, colorClass02] = useMemo(() => {
    if (isDark) {
      return ['bg-gray-800', 'bg-gray-700']
    } else {
      return ['bg-gray-100', 'bg-gray-300']
    }
  }, [isDark])

  return { colorClass01, colorClass02 }
}

export function LargeSectionPlaceholder({ isDark }) {
  const { colorClass01, colorClass02 } = usePlaceholderColorClass(isDark)

  return (
    <div className={clsx(colorClass01, 'rounded-lg p-4 mb-4')}>
      <div className={clsx(colorClass02, 'h-4 rounded w-1/2 mb-2')} />
      <div className={clsx(colorClass02, 'h-4 rounded w-1/3 mb-2')} />
      <div className={clsx(colorClass02, 'h-4 rounded w-1/4 mb-2')} />
    </div>
  )
}

export function SmallTextPlaceholder({ isDark }) {
  const { colorClass01, colorClass02 } = usePlaceholderColorClass(isDark)

  return (
    <div className={clsx(colorClass01, 'rounded-lg p-4 mb-4')}>
      <div className={clsx(colorClass02, 'h-1 rounded w-1/4 mb-2')} />
      <div className={clsx(colorClass02, 'h-1 rounded w-1/3 mb-2')} />
      <div className={clsx(colorClass02, 'h-1 rounded w-1/2 mb-2')} />
      <div className={clsx(colorClass02, 'h-1 rounded w-1/2 mb-2')} />
      <div className={clsx(colorClass02, 'h-1 rounded w-1/2 mb-2')} />
      <div className={clsx(colorClass02, 'h-1 rounded w-1/2 mb-2')} />
      <div className={clsx(colorClass02, 'h-1 rounded w-1/2 mb-2')} />
      <div className={clsx(colorClass02, 'h-1 rounded w-1/2 mb-2')} />
    </div>
  )
}

export function SidebarPlaceholder({ isDark }) {
  const { colorClass01, colorClass02 } = usePlaceholderColorClass(isDark)

  return (
    <div className={clsx(colorClass01, 'rounded-lg p-4 mb-4')}>
      <div className={clsx(colorClass02, 'h-4 rounded w-1/2 mb-2')} />
      <div className={clsx(colorClass02, 'h-4 rounded w-1/3 mb-2')} />
      <div className={clsx(colorClass02, 'h-4 rounded w-1/4 mb-2')} />
    </div>
  )
}

export function DashboardPlaceholder({ isDark }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <aside className="md:col-span-1 space-y-4">
        <SidebarPlaceholder isDark={isDark} />
        <SidebarPlaceholder isDark={isDark} />
      </aside>
      <main className="md:col-span-3 space-y-4">
        <LargeSectionPlaceholder isDark={isDark} />
        <LargeSectionPlaceholder isDark={isDark} />
        <SmallTextPlaceholder isDark={isDark} />
        <LargeSectionPlaceholder isDark={isDark} />
      </main>
    </div>
  )
}

export default function PagePlaceholder({ isDark, ...props }) {
  return (
    <div {...props}>
      <LargeSectionPlaceholder isDark={isDark} />
      <LargeSectionPlaceholder isDark={isDark} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <LargeSectionPlaceholder isDark={isDark} />
        <LargeSectionPlaceholder isDark={isDark} />
        <LargeSectionPlaceholder isDark={isDark} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LargeSectionPlaceholder isDark={isDark} />
        <LargeSectionPlaceholder isDark={isDark} />
      </div>
      <SmallTextPlaceholder isDark={isDark} />
      <SmallTextPlaceholder isDark={isDark} />
      <SmallTextPlaceholder isDark={isDark} />
      <LargeSectionPlaceholder isDark={isDark} />
      <LargeSectionPlaceholder isDark={isDark} />
      <LargeSectionPlaceholder isDark={isDark} />
      <LargeSectionPlaceholder isDark={isDark} />
      <LargeSectionPlaceholder isDark={isDark} />
      <LargeSectionPlaceholder isDark={isDark} />
      <LargeSectionPlaceholder isDark={isDark} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <LargeSectionPlaceholder isDark={isDark} />
        <LargeSectionPlaceholder isDark={isDark} />
        <LargeSectionPlaceholder isDark={isDark} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LargeSectionPlaceholder isDark={isDark} />
        <LargeSectionPlaceholder isDark={isDark} />
      </div>
      <SmallTextPlaceholder isDark={isDark} />
      <SmallTextPlaceholder isDark={isDark} />
      <SmallTextPlaceholder isDark={isDark} />
      <LargeSectionPlaceholder isDark={isDark} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <LargeSectionPlaceholder isDark={isDark} />
        <LargeSectionPlaceholder isDark={isDark} />
        <LargeSectionPlaceholder isDark={isDark} />
      </div>
    </div>
  )
}
