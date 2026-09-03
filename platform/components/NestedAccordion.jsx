import { useEffect, useMemo, useState } from 'react'

import DynamicIcon from '@/components/DynamicIcon'
import Link from '@/components/Link'
import PopButton from '@/components/PopButton'

import useRouter from '@/hooks/useRouter'

import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
// @note the bundled lucide components rather than the icon strings DynamicIcon
// resolves - those load from a CDN as images, which cannot follow the text
// colour, and none of the chrome here may go invisible in either theme
import {
  ChevronLeft as ChevronBackIcon,
  ChevronRight as ChevronIcon,
  ExternalLink as ExternalLinkIcon,
  Ellipsis as MenuIcon,
} from 'lucide-react'

/**
 * Reports whether the current location matches any item in the tree - nested
 * folders included, so a section auto-opens for a grandchild and not just for
 * a direct child.
 */
function hasCurrentItem(items, compareHref) {
  return !!items?.some(
    ({ href, link = href, exact, items: children }) =>
      (link && link !== '#' && compareHref(link, { exact })) ||
      hasCurrentItem(children, compareHref)
  )
}

function TitleLink({
  className,

  link,

  target,

  prefetch,
  forcePrefetch,
  forcePrefetchInterval,

  onClick,

  ...props
}) {
  return link === '#' ? (
    <div
      {...props}
      className={clsx({ 'cursor-pointer': onClick }, className)}
      onClick={onClick}
    />
  ) : (
    <Link
      {...props}
      className={className}
      href={link}
      target={target}
      prefetch={prefetch}
      forcePrefetch={forcePrefetch}
      forcePrefetchInterval={forcePrefetchInterval}
      onClick={onClick}
    />
  )
}

export default function NestedAccordion({
  className,

  itemClassName,

  title,

  href,
  link = href,

  target,

  prefetch,
  forcePrefetch,
  forcePrefetchInterval,

  external,

  exact = false,

  onClick,

  data,

  icon: _icon,
  defaultIcon: _defaultIcon,

  items,

  menu,

  folder,

  flat,

  expanded,

  // @note a drilldown does not open in place - it hands the whole menu over to
  // another one, so it carries a chevron that points the way out rather than
  // one that turns to reveal items below
  drilldown = false,

  selectable = true,

  collapsible = true,

  beta = false,

  badge,

  disabled = false,

  children,

  ...props
}) {
  link = link || '#'

  const router = useRouter()

  const [isOpen, setIsOpen] = useState(expanded ?? false)

  useEffect(
    () => {
      if (isOpen) {
        return
      }

      if (hasCurrentItem(items, router.compareHref)) {
        setIsOpen(true)
      }
    },

    // @note disabled because we don't want to trigger this function on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, router.asPath]
  )

  const dataProperties = useMemo(() => {
    const properties = {}

    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        properties[`data-${key}`] = value
      })
    }

    return properties
  }, [data])

  const icon = _icon || _defaultIcon

  const isFolder = folder ?? items?.length > 0

  const isRoot = router.compareHref(link, { exact })

  const isSelected = selectable && !isFolder && isRoot

  return (
    <div
      {...props}
      {...dataProperties}
      className={clsx(
        'nested-accordion',
        'text-gray-800 dark:text-gray-200',
        {
          '!text-gray-200 dark:!text-gray-800': disabled,
        },
        'space-y-[1px]',
        className
      )}
    >
      {title ? (
        <div
          className={clsx(
            'nested-accordion-title',
            'group/title',
            'flex flex-row gap-2 items-center',
            'px-3',
            'transition-all duration-200',
            'select-none',
            'cursor-default',
            {
              'rounded-lg bg-gray-200/60 dark:bg-gray-800/60': isSelected,
              'hover:rounded-lg hover:bg-gray-100/60 dark:hover:bg-gray-900/60':
                !disabled && (isFolder && !drilldown ? !!collapsible : true),
              'cursor-pointer': drilldown || (isFolder && collapsible),
            }
          )}
          onClick={() => {
            if (drilldown) {
              onClick?.()

              return
            }

            if (!isFolder) {
              return
            }

            if (!collapsible) {
              return
            }

            setIsOpen(!isOpen)
          }}
        >
          <TitleLink
            className={clsx(
              'flex-1 min-w-0 flex flex-row gap-2 items-center',
              'whitespace-nowrap',
              'overflow-hidden',
              {
                'gradient-mask-r-90': !!menu,
              },
              'py-1.5',
              {
                'text-xs': isFolder && isOpen && !collapsible,
                disabled: disabled,
              }
            )}
            link={link}
            target={target}
            prefetch={prefetch}
            forcePrefetch={forcePrefetch}
            forcePrefetchInterval={forcePrefetchInterval}
            // @note the row itself handles the drilldown, so the title must not
            // fire it a second time as the click bubbles up
            onClick={drilldown ? undefined : onClick}
            disabled={disabled}
          >
            {icon ? (
              <DynamicIcon
                className="nested-accordion-icon w-[1.2em] h-[1.2em]"
                style={{ filter: 'none' }} // @note because we don't want color filters
                icon={icon}
              />
            ) : null}
            <span className="truncate">{title}</span>
          </TitleLink>
          {badge ? (
            <span
              className={clsx(
                'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                badge.className
              )}
            >
              {badge.label}
            </span>
          ) : null}
          {beta ? <sup className="beta shrink-0">beta</sup> : null}
          {external ? <ExternalLinkIcon className="w-[1em] h-[1em]" /> : null}
          {menu ? (
            <PopButton
              className="nested-accordion-menu ml-2 flex items-center justify-center"
              placement="bottom-start"
              offset={5}
              closeOnClick={true}
              caption={({ open }) => (
                <MenuIcon
                  className={clsx('w-[1.2em] h-[1.2em]', {
                    // @note the reason we use hidden is because we don't want
                    // to have extra space when the item is no hovered in order
                    // to display as much of the item title as possible

                    'hidden group-hover/title:block': !menu.permanent,

                    '!block': !!open,
                  })}
                />
              )}
              transitionStyles="scale"
            >
              <div className="auto-bg-white auto-text-gray-700 border auto-border-gray-300 rounded-xl overflow-hidden min-w-32">
                <NestedAccordion
                  {...menu}
                  className={clsx(
                    '[&_.nested-accordion-title]:!rounded-none [&_.nested-accordion-title]:px-4 [&_.nested-accordion-title]:py-0.5',
                    menu.className
                  )}
                  expanded={true}
                  collapsible={false}
                  flat={true}
                />
              </div>
            </PopButton>
          ) : null}
          {drilldown || (collapsible && isFolder) ? (
            <ChevronIcon
              className={clsx(
                // @note smaller than the 1.5em the heroicon it replaced sat at -
                // a bare stroked chevron fills its box where a solid one does
                // not, and reads a size larger at the same width
                'w-[1.25em] h-[1.25em]',
                'transform transition duration-300',
                {
                  'rotate-0': drilldown || !isOpen,
                  'rotate-90': !drilldown && isOpen,
                }
              )}
            />
          ) : null}
        </div>
      ) : null}
      {isFolder ? (
        <ul
          className={clsx(
            'nested-accordion-items',
            {
              'pl-2': !!title && !flat,
            },
            'overflow-hidden',
            'transition-all duration-300',
            {
              'max-h-[500rem] h-full': isOpen,
              'max-h-0 !py-0': !isOpen,
            },
            'space-y-[1px]'
          )}
        >
          {items.map(
            (
              {
                className: thisClassName,

                itemClassName: thisItemClassName,

                title,

                href,
                link = href,

                target,

                prefetch,
                forcePrefetch,
                forcePrefetchInterval,

                external,

                exact,

                onClick,

                data,

                icon: thisIcon,
                defaultIcon: thisDefaultIcon,

                items,

                menu,

                folder,

                expanded,

                drilldown: thisDrilldown,

                selectable,

                collapsible = !!expanded,

                beta,

                badge: itemBadge,

                disabled: itemDisabled = disabled,
              },
              index
            ) => {
              return (
                <li key={index}>
                  <NestedAccordion
                    className={clsx(thisClassName, itemClassName)}
                    itemClassName={thisItemClassName}
                    title={title}
                    href={href}
                    link={link}
                    target={target}
                    prefetch={prefetch}
                    forcePrefetch={forcePrefetch}
                    forcePrefetchInterval={forcePrefetchInterval}
                    external={external}
                    exact={exact}
                    onClick={onClick}
                    data={data}
                    icon={thisIcon ?? (icon ? '@blank/icon' : undefined)}
                    defaultIcon={thisDefaultIcon ?? _defaultIcon}
                    items={items}
                    menu={menu}
                    folder={folder}
                    flat={flat}
                    drilldown={thisDrilldown}
                    selectable={selectable}
                    expanded={expanded}
                    collapsible={collapsible}
                    beta={beta}
                    badge={itemBadge}
                    disabled={itemDisabled}
                  />
                </li>
              )
            }
          )}
        </ul>
      ) : null}
      {children}
    </div>
  )
}

// @note a drilldown is identified by its key, falling back to its title - items
// nested inside a section carry no key of their own
function drilldownKey({ key, title }) {
  return key ?? title
}

function isDrilldown({ drilldown, items }) {
  return !!drilldown && !!items?.length
}

/**
 * Reports whether any item in the tree points at a matching location.
 */
function hasMatchingItem(items, matches) {
  return !!items?.some(
    ({ href, items: children }) =>
      (href && matches(href)) || hasMatchingItem(children, matches)
  )
}

/**
 * Finds the drilldown holding the current location, as the keys leading to it -
 * so that landing on one of its pages, by link or command palette or deep link,
 * shows the menu that page belongs to rather than the menu it is missing from.
 * Drilldowns nested inside drilldowns resolve to the deepest one, which is the
 * one the page actually lives in.
 */
export function resolveDrilldownPath(sections, matches, path = []) {
  for (const section of sections ?? []) {
    if (isDrilldown(section)) {
      if (hasMatchingItem(section.items, matches)) {
        const here = [...path, drilldownKey(section)]

        return resolveDrilldownPath(section.items, matches, here) ?? here
      }

      // @note a drilldown that does not hold the location hides nothing that
      // does - the menu cannot reach past a door it has not opened
      continue
    }

    const nested = resolveDrilldownPath(section.items, matches, path)

    if (nested) {
      return nested
    }
  }

  return null
}

/**
 * Finds a drilldown by key among these sections, looking inside plain sections
 * but never through another drilldown - you cannot open the far door first.
 */
function findDrilldown(sections, key) {
  for (const section of sections ?? []) {
    if (isDrilldown(section)) {
      if (drilldownKey(section) === key) {
        return section
      }

      continue
    }

    const nested = findDrilldown(section.items, key)

    if (nested) {
      return nested
    }
  }

  return null
}

/**
 * Walks a path of drilldown keys and reports the menu it lands on - the items
 * of the drilldown it opened, and the drilldown itself, which the menu titles
 * its way back with. An unknown key resolves to the root, so a path left over
 * from a menu that has since changed cannot strand anyone.
 */
function openDrilldown(sections, path) {
  let open = null

  for (const key of path) {
    const found = findDrilldown(open ? open.items : sections, key)

    if (!found) {
      return { sections, open: null }
    }

    open = found
  }

  return { sections: open ? open.items : sections, open }
}

/**
 * Turns every drilldown into a row that opens it rather than an accordion that
 * expands in place - its items become the menu rather than a list beneath it.
 */
function withDrilldowns(sections, open) {
  return sections?.map((section) => {
    const { items, ...rest } = section

    if (isDrilldown(section)) {
      return { ...rest, onClick: () => open(drilldownKey(section)) }
    }

    return { ...rest, items: withDrilldowns(items, open) }
  })
}

/**
 * A menu of NestedAccordion sections. A section holding `items` is an accordion
 * that opens in place; a section holding `items` and `drilldown` is a door -
 * following it hands the whole menu over to those items, with a way back. This
 * holds at any depth, so an item buried in a section can be a door too.
 *
 * @note the state lives here rather than in NestedAccordion because a drilldown
 * replaces every section at once, and no section can replace its siblings -
 * only the menu holding them can.
 */
export function NestedAccordionMenu({ className, sections }) {
  const router = useRouter()

  const routePath = useMemo(
    () =>
      resolveDrilldownPath(sections, (href) =>
        router.compareHref(href, { exact: false })
      ) ?? [],

    // @note disabled because compareHref closes over the location, which asPath
    // already stands for here
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sections, router.asPath]
  )

  const [path, setPath] = useState(routePath)

  // @note the location decides which menu you land in - navigating to a page a
  // drilldown holds opens it, leaving for a page it does not closes it - and
  // going back is the one thing that overrides it, which works because it
  // changes no location and so does not run this again
  useEffect(() => {
    setPath(routePath)
  }, [routePath.join('\n'), router.asPath]) // eslint-disable-line react-hooks/exhaustive-deps

  const { sections: visible, open } = openDrilldown(sections, path)

  const rendered = withDrilldowns(visible, (key) => setPath([...path, key]))

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={path.join('\n') || 'root'}
        className={clsx(
          // @note not nested-accordion-menu - that name is taken by the popover
          // menu button below, which this container happens to hold
          'nested-accordion-sections',
          'flex-1 display flex flex-col',
          'divide-y divide-gray-100 dark:divide-gray-900',
          '[&>*:not(:first-child)]:pt-2 [&>*]:pb-2',
          className
        )}
        initial={{ opacity: 0, x: open ? 8 : -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        {open ? (
          <NestedAccordion
            icon={ChevronBackIcon}
            title={open.title}
            // @note back goes up a single level rather than home, so a drilldown
            // reached through another returns to the one that led to it
            onClick={() => setPath(path.slice(0, -1))}
          />
        ) : null}
        {rendered.map(({ key, ...section }, index) => (
          <NestedAccordion key={key ?? index} {...section} />
        ))}
      </motion.div>
    </AnimatePresence>
  )
}
