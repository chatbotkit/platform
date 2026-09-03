import Collapsible from '@/components/Collapsible'

import useControlledState from '@/hooks/useControlledState'

import { ChevronRightIcon } from '@heroicons/react/24/solid'

import clsx from 'clsx'

export default function Expando({
  title,

  beforeTitle,
  afterTitle,

  defaultOpen: _defaultOpen = false,
  open: _open,
  setOpen: _setOpen,

  className,

  titleClassName,

  children,

  ...props
}) {
  const [open, setOpen] = useControlledState(_defaultOpen, _open, _setOpen)

  return (
    <div {...props} className={clsx('expando w-full', className)}>
      <div className="expando-title text-left flex items-center gap-2 select-none">
        {beforeTitle}
        <div
          className={clsx(
            'text-left flex items-center gap-2 cursor-pointer',
            titleClassName
          )}
          onClick={() => setOpen(!open)}
        >
          <ChevronRightIcon
            className={clsx('w-[1em] h-[1em] transition-all duration-300', {
              'transform rotate-90': open,
            })}
          />
          <div>{title}</div>
        </div>
        {afterTitle}
      </div>
      <Collapsible
        className={clsx('opacity-100 transition-all duration-300', {
          '!opacity-0 !h-0 overflow-hidden': !open,
        })}
      >
        <div
          className={clsx(
            'expando-inner ml-1.5 border-l-2 auto-border-gray-100'
          )}
        >
          <div className="expando-children p-4 space-y-6">{children}</div>
        </div>
      </Collapsible>
    </div>
  )
}
