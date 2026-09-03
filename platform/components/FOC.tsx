import type { ReactNode } from 'react'
import type React from 'react'

import NestedAccordion from '@/components/NestedAccordion'

import clsx from 'clsx'

// @todo use nested accordion item type once exported
interface FOCItem {
  title?: string
  href?: string
  link?: string
  target?: string
  prefetch?: boolean
  forcePrefetch?: boolean
  forcePrefetchInterval?: number
  external?: boolean
  exact?: boolean
  onClick?: () => void
  data?: unknown
  icon?: string
  defaultIcon?: string
  items?: FOCItem[]
  menu?: unknown
  folder?: boolean
  flat?: boolean
  expanded?: boolean
  selectable?: boolean
  collapsible?: boolean
  beta?: boolean
  disabled?: boolean
  children?: React.ReactNode
}

interface FOCProps {
  className?: string
  autoPosition?: boolean | 'left' | 'right'
  top?: number
  items: FOCItem[]
  defaultIcon?: string
  children?: ReactNode
  [key: string]: unknown
}

export default function FOC({
  className,

  autoPosition,

  top = 76,

  items,

  defaultIcon,

  children,

  ...props
}: FOCProps): React.ReactElement {
  return (
    <nav
      {...props}
      className={clsx(
        'foc',
        'max-w-[14rem] min-w-[14rem]',
        'backdrop-blur-lg',
        'p-1',
        'rounded-xl',
        '!m-0',
        'text-xs',

        autoPosition && [
          'hidden xl:block fixed z-10',
          {
            'left-20': autoPosition === true || autoPosition === 'left',
            'right-20': autoPosition === 'right',
          },
        ],

        className
      )}
      style={{
        top: autoPosition ? `${top}px` : undefined,
      }}
    >
      {items.map((item, index) => {
        return (
          // @todo remove the line once NestedAccordion types are fixed
          // @ts-expect-error NestedAccordion is JSX and has incorrect type inference
          <NestedAccordion
            {...item}
            className="space-y-2"
            key={index}
            defaultIcon={defaultIcon}
          />
        )
      })}
      {children}
    </nav>
  )
}
