import { Children, useMemo } from 'react'

import DynamicIcon from '@/components/DynamicIcon'
import Link from '@/components/Link'

import clsx from 'clsx'

export default function FancyLink({
  href,

  icon,

  className,

  children,

  ...props
}) {
  const isExternal = useMemo(() => {
    return FancyLink.isExternal(href)
  }, [href])

  const isText = useMemo(() => {
    return Children.toArray(children).every(
      (child) => typeof child === 'string'
    )
  }, [children])

  const content = useMemo(() => {
    return isText
      ? Children.toArray(children)
          .join('')
          .replace(/^https?:\/\/(www\.)?/i, '')
          .replace(/\/+$/, '')
      : children
  }, [children, isText])

  return (
    <Link
      {...props}
      className={clsx(
        'group',
        'inline-flex flex-row gap-0.5 items-center align-middle',
        'text-[inherit] font-normal',
        'no-underline',
        'auto-bg-gray-50 hover:auto-bg-gray-100',
        'rounded-full',
        'pl-0.5 pr-2',
        className
      )}
      href={href}
    >
      {!!icon || isExternal ? (
        <DynamicIcon
          className="bg-white block rounded-full m-0 p-0 h-[1em] supports-[height:1lh]:h-[max(0.8lh,1em)] aspect-square object-center object-cover align-middle"
          icon={icon || `@favicon/${href}`}
        />
      ) : null}
      <br />
      <span className="auto-text-gray-800 group-hover:auto-text-gray-800 block truncate">
        {content}
      </span>
    </Link>
  )
}

FancyLink.isExternal = function (href) {
  if (!href) {
    return false
  }

  if (href instanceof URL) {
    href = href.href
  }

  return href.startsWith('http://') || href.startsWith('https://')
}
