import { Children, isValidElement, useMemo } from 'react'

import Component from '@/components/Component'
import Link from '@/components/Link'
import MenuButton from '@/components/MenuButton'
import TimeAgo from '@/components/TimeAgo'

import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

function ListItemWrapper({
  link,
  target,
  locale,

  prefetch,
  forcePrefetch,
  forcePrefetchInterval,

  onClick,

  children,
}) {
  if (link) {
    return (
      <Link
        className="block focus:outline-none cursor-pointer"
        href={link}
        target={target}
        locale={locale}
        prefetch={prefetch}
        forcePrefetch={forcePrefetch}
        forcePrefetchInterval={forcePrefetchInterval}
      >
        {children}
      </Link>
    )
  } else {
    return (
      <div
        className={clsx({
          'cursor-pointer': !!onClick,
        })}
      >
        {children}
      </div>
    )
  }
}

export function ListItem({
  icon,

  link,
  target,
  locale,

  prefetch,
  forcePrefetch,
  forcePrefetchInterval,

  onClick,

  title,
  body,

  expanded,

  trailing,

  timestamp,

  actions,

  as = 'li',
  headingAs = 'h3',

  role = 'listitem',

  focusable = true,

  selected = false,

  className,

  children,

  ...props
}) {
  return (
    <Component
      {...props}
      className={clsx(
        '@container',
        'overflow-hidden',
        'relative py-5 px-4',
        'flex flex-row gap-6',
        'rounded-xl',
        'hover:auto-bg-gray-5',
        'transition-colors duration-200',
        // @note contain and content-visibility optimize rendering when loading
        // new items, preventing layout thrashing and scroll position jumps
        '[contain:content]',
        '[content-visibility:auto]',
        {
          'focus-within:bg-gray-100/70 dark:focus-within:bg-gray-900/70':
            focusable,
        },
        {
          selected: selected,

          'bg-gray-100/70 dark:bg-gray-900/70': selected,

          '[&.selected]:bg-gray-100/70 dark:[&.selected]:bg-gray-900/70':
            !selected,
        },
        className
      )}
      as={as}
      role={role}
      onClick={onClick}
      // tabIndex={focusable ? 0 : undefined} // @note without this we ensure that only clicking on the clickable areas focuses the item
    >
      {icon ? (
        link ? (
          <Link
            className="select-none"
            href={link}
            target={target}
            locale={locale}
            prefetch={prefetch}
            forcePrefetch={forcePrefetch}
            forcePrefetchInterval={forcePrefetchInterval}
          >
            <div className="flex-shrink-0">{icon}</div>
          </Link>
        ) : (
          <div className="select-none">
            <div className="flex-shrink-0">{icon}</div>
          </div>
        )
      ) : null}
      <div className="w-full flex-1 flex flex-col gap-4">
        <div className="flex flex-row justify-between items-start gap-4">
          <div className="min-w-0 flex-1">
            <ListItemWrapper
              link={link}
              target={target}
              locale={locale}
              prefetch={prefetch}
              forcePrefetch={forcePrefetch}
              forcePrefetchInterval={forcePrefetchInterval}
              onClick={onClick}
            >
              <Component
                as={headingAs}
                className={clsx(
                  'text-sm font-medium',
                  'auto-text-gray-900',
                  'mt-0 pt-0',
                  'break-words',
                  {
                    'line-clamp-2': !expanded,
                  }
                )}
              >
                {title}
              </Component>
              {(Array.isArray(body) ? body : [body])
                .filter((body) => body)
                .map((body, index) => {
                  return (
                    <div
                      key={index}
                      className={clsx(
                        '[word-break:break-word] text-sm auto-text-gray-500',
                        {
                          'line-clamp-2 max-w-xl': !expanded,
                        }
                      )}
                    >
                      {body}
                    </div>
                  )
                })}
            </ListItemWrapper>
          </div>
          <div className="flex items-center gap-4">
            {trailing ? (
              <div className="flex-shrink-0 whitespace-nowrap text-sm auto-text-gray-500 hidden @sm:block cursor-default">
                {trailing}
              </div>
            ) : null}
            {timestamp ? (
              <TimeAgo
                className="flex-shrink-0 whitespace-nowrap text-sm auto-text-gray-500 hidden @sm:block cursor-default"
                time={timestamp}
              />
            ) : null}
            {actions && Object.keys(actions).length > 0 ? (
              <div
                // @note the reason we have this is to prevent the list item from
                // being focused when clicking on the actions menu button
                onMouseDown={(event) => {
                  event.stopPropagation()
                  event.preventDefault()
                }}
                // @note the reason we have this is to prevent the click handler
                // of the list item from being triggered when clicking on the
                // actions menu button
                onClick={(event) => {
                  event.stopPropagation()
                  event.preventDefault()
                }}
              >
                <MenuButton
                  className="flex-shrink-0 p-1 rounded-md hover:auto-bg-gray-100 transition-default"
                  menuClassName="min-w-[120px]"
                  menu={Object.entries(actions).map(([name, action]) => ({
                    title: name,
                    onClick: (...args) => {
                      switch (true) {
                        case typeof action === 'function': {
                          action(...args)

                          break
                        }

                        case typeof action === 'string': {
                          window.open(action)

                          break
                        }
                      }
                    },
                  }))}
                  transitionStyles="scale"
                >
                  <EllipsisHorizontalIcon className="w-4 h-4 auto-text-gray-400" />
                </MenuButton>
              </div>
            ) : null}
          </div>
        </div>
        {children || timestamp ? (
          <div className="flex flex-row flex-wrap gap-2">
            {children}
            {timestamp ? (
              <TimeAgo
                className="tag flex-shrink-0 whitespace-nowrap text-sm auto-text-gray-500 @sm:hidden cursor-default"
                time={timestamp}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </Component>
  )
}

export default function List({
  title,

  link,

  leadingActions,

  actions,

  emptyMessage,

  as = 'ul',

  role = 'list',

  className,

  children,

  ...props
}) {
  const hasChildren = useMemo(
    () => Children.toArray(children).some((child) => isValidElement(child)),
    [children]
  )

  return (
    <div
      className={clsx(
        'list',

        'relative',

        'space-y-6',

        '[&>*]:relative',
        'focus:[&>*]:after:hidden focus-within:[&>*]:after:hidden',
        '[&>*:last-child]:after:hidden',
        '[&>*]:after:content-[""]',
        '[&>*]:after:absolute',
        '[&>*]:after:-bottom-5',
        '[&>*]:after:w-[100%] [&>*]:after:h-px',
        '[&>*]:after:auto-bg-gray-100',
        '[&>*]:after:left-[0%] [&>*]:after:right-[0%]',

        className
      )}
    >
      {!!title ||
      (leadingActions && Children.count(leadingActions) > 0) ||
      (actions && Children.count(actions) > 0) ? (
        <div
          className={clsx('actions flex flex-row items-center gap-4 text-sm')}
        >
          {leadingActions}
          {!!title ? (
            link ? (
              <>
                <div className="flex-1" />
                <Link className="default-link" href={link}>
                  {title}
                </Link>
              </>
            ) : (
              <>
                {title}
                <div className="flex-1" />
              </>
            )
          ) : (
            <div className="flex-1" />
          )}
          {actions}
        </div>
      ) : null}
      {hasChildren ? (
        <Component
          {...props}
          className={clsx(
            'items',

            'relative',

            'space-y-1',

            // children
            '[&>*]:relative',
            'focus:[&>*]:after:hidden focus-within:[&>*]:after:hidden',
            '[&>*:last-child]:after:hidden',
            '[&>*]:after:content-[""]',
            '[&>*]:after:absolute',
            '[&>*]:after:bottom-0',
            '[&>*]:after:w-[96%] [&>*]:after:h-px',
            '[&>*]:after:auto-bg-gray-100',
            '[&>*]:after:left-[2%] [&>*]:after:right-[2%]',
            '[&>*.selected]:after:hidden'
          )}
          as={as}
          role={role}
        >
          {children}
        </Component>
      ) : emptyMessage ? (
        <div className="py-4 text-sm italic auto-text-gray-500">
          {emptyMessage}
        </div>
      ) : null}
    </div>
  )
}

List.Item = ListItem
