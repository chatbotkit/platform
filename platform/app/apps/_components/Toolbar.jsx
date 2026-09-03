'use client'

import clsx from 'clsx'

export function AppToolbar({ className, children, ...props }) {
  return (
    <div
      {...props}
      className={clsx(
        'flex min-h-11 w-full flex-row flex-wrap items-center gap-2',
        'border-b border-gray-200 p-2 text-xs dark:border-gray-800',
        className
      )}
    >
      {children}
    </div>
  )
}

export function ToolbarSpacer() {
  return <div className="min-w-0 flex-1" />
}

export function ToolbarButton({ className, active, children, icon, ...props }) {
  return (
    <button
      {...props}
      className={clsx(
        'tag hover:tag-darker inline-flex h-7 shrink-0 cursor-pointer items-center justify-center gap-1.5',
        'px-2 text-xs leading-none disabled:cursor-not-allowed disabled:opacity-60',
        {
          darker: active,
        },
        className
      )}
      type="button"
    >
      {icon}
      {children}
    </button>
  )
}

export function ToolbarIconButton({ className, active, children, ...props }) {
  return (
    <button
      {...props}
      className={clsx(
        'flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded',
        'hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-gray-800',
        {
          'auto-bg-gray-100 dark:auto-bg-gray-800': active,
        },
        className
      )}
      type="button"
    >
      {children}
    </button>
  )
}

export function ToolbarToggle({
  checked,
  setChecked,
  className,
  children,
  icon,
  onClick,
  ...props
}) {
  return (
    <button
      {...props}
      className={clsx(
        'tag hover:tag-darker inline-flex h-7 shrink-0 cursor-pointer items-center justify-center gap-1.5',
        'px-2 text-xs leading-none',
        {
          darker: checked,
        },
        className
      )}
      type="button"
      aria-pressed={checked}
      onClick={onClick || (() => setChecked((checked) => !checked))}
    >
      {icon}
      {children}
    </button>
  )
}

export function ToolbarSelect({ className, ...props }) {
  return (
    <select
      {...props}
      className={clsx(
        'tag none-input h-7 shrink-0 rounded border border-gray-200 bg-transparent',
        'py-0 pl-2 pr-8 text-xs leading-none dark:border-gray-700',
        className
      )}
    />
  )
}

export function ToolbarSearch({ className, icon, inputClassName, ...props }) {
  return (
    <div className={clsx('relative min-w-56 flex-1', className)}>
      {icon ? (
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">
          {icon}
        </span>
      ) : null}
      <input
        {...props}
        className={clsx(
          'none-input h-7 w-full rounded border border-gray-200 bg-transparent',
          'pl-7 pr-2 text-xs leading-none dark:border-gray-700',
          inputClassName
        )}
      />
    </div>
  )
}

export function ToolbarStatus({ className, children }) {
  return (
    <div
      className={clsx(
        'shrink-0 whitespace-nowrap rounded px-2 py-1 font-mono text-[10px] leading-none text-gray-400',
        className
      )}
    >
      {children}
    </div>
  )
}
