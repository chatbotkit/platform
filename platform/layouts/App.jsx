'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { LuArrowLeft, LuX } from 'react-icons/lu'

import { FIVE_MINUTE_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import { CUSTOM_TYPE, PORTAL_TYPE, apps as configApps } from '@/config/apps'

import { getAppTypeByHostname } from '@/lib/app.helpers'
import { isProduction } from '@/lib/env'
import { toKebabCase, toTitleCase } from '@/lib/string'
import { undefinedOr } from '@/lib/util'

import Children from '@/components/Children'
import Collapsible from '@/components/Collapsible'
import Confirm from '@/components/Confirm'
import DynamicIcon from '@/components/DynamicIcon'
import DynamicLogo from '@/components/DynamicLogo'
import Emoji from '@/components/Emoji'
import GTag from '@/components/GTag'
import Link from '@/components/Link'
import Meta from '@/components/Meta'
import NestedAccordion from '@/components/NestedAccordion'
import Portal from '@/components/Portal'
import ProfileDropdown from '@/components/ProfileDropdown'

import useDOMQuerySelector from '@/hooks/useDOMQuerySelector'
import useIsTop from '@/hooks/useIsTop'
import usePopup from '@/hooks/usePopup'
import useRouter from '@/hooks/useRouter'
import useScopedQuerySessionOption from '@/hooks/useScopedQuerySessionOption'

import useWidgetInstance from '@chatbotkit/react/hooks/useWidgetInstance'

import clsx from 'clsx'
import { motion } from 'framer-motion'

/* eslint-disable custom-eslint-rules/no-restricted-client-imports -- build-frozen fallback; migration to runtime hooks pending */

export const DEFAULT_SIDEBAR_WIDTH = 260
export const DEFAULT_INFOBAR_WIDTH = 320

export const SIDEBAR_AUTO_HIDE_WIDTH = 768

const DEFAULT_SIDEBAR_ICON = '/icon.png;/icon.png#filter=invertGrayscale'

export const AppContext = createContext()

export function AppProvider({
  slug,

  config: _config = {},

  sidebarItems: _sidebarItems = [],
  sidebarAlways: _sidebarAlways = false,

  showHeader: _showHeader,
  showFooter: _showFooter,

  state: _state = {},

  children,
}) {
  const [config, setConfig] = useState(() => _config || {})

  const [state, setState] = useState(_state)

  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)

  const [sidebarToggleId, setSidebarToggleId] = useState(null)

  const resetSidebarWidth = useCallback(() => {
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)
  }, [])

  const openSidebar = useCallback((width = DEFAULT_SIDEBAR_WIDTH) => {
    setSidebarWidth(width)
  }, [])

  const closeSidebar = useCallback(() => {
    setSidebarWidth(0)
  }, [])

  const toggleSidebar = useCallback(
    (width = DEFAULT_SIDEBAR_WIDTH, id) => {
      if (id) {
        if (id === sidebarToggleId) {
          setSidebarWidth((sidebarWidth) => (!!sidebarWidth ? 0 : width))
        } else {
          setSidebarWidth(width)
        }

        setSidebarToggleId(id)
      } else {
        setSidebarWidth((sidebarWidth) => (!!sidebarWidth ? 0 : width))
      }
    },
    [sidebarToggleId]
  )

  const [sidebarItems, setSidebarItems] = useState(_sidebarItems)

  const [sidebarAlways, setSidebarAlways] = useState(_sidebarAlways)

  const [infobarWidth, setInfobarWidth] = useState(0)

  const [infobarToggleId, setInfobarToggleId] = useState(null)

  const resetInfobarWidth = useCallback(() => {
    setInfobarWidth(0)
  }, [])

  const openInfobar = useCallback((width = DEFAULT_INFOBAR_WIDTH) => {
    setInfobarWidth(width)
  }, [])

  const closeInfobar = useCallback(() => {
    setInfobarWidth(0)
  }, [])

  const toggleInfobar = useCallback(
    (width = DEFAULT_INFOBAR_WIDTH, id) => {
      if (id) {
        if (id === infobarToggleId) {
          setInfobarWidth((infobarWidth) => (!!infobarWidth ? 0 : width))
        } else {
          setInfobarWidth(width)
        }

        setInfobarToggleId(id)
      } else {
        setInfobarWidth((infobarWidth) => (!!infobarWidth ? 0 : width))
      }
    },
    [infobarToggleId]
  )

  const [infobarContent, setInfobarContent] = useState(null)

  const [infobarNav, setInfobarNav] = useState(null)

  const [showHeader, setShowHeader] = useState(_showHeader)

  const [showFooter, setShowFooter] = useState(_showFooter)

  return (
    <AppContext.Provider
      value={useMemo(
        () => ({
          slug,

          config,
          setConfig,

          state,
          setState,

          sidebarWidth,
          sidebarToggleId,
          setSidebarWidth,
          resetSidebarWidth,

          openSidebar,
          closeSidebar,
          toggleSidebar,

          sidebarItems,
          setSidebarItems,

          sidebarAlways,
          setSidebarAlways,

          infobarWidth,
          infobarToggleId,
          setInfobarWidth,
          resetInfobarWidth,

          openInfobar,
          closeInfobar,
          toggleInfobar,

          infobarNav,
          setInfobarNav,

          infobarContent,
          setInfobarContent,

          showHeader,
          setShowHeader,

          showFooter,
          setShowFooter,
        }),
        [
          slug,

          config,
          setConfig,

          state,
          setState,

          sidebarWidth,
          sidebarToggleId,
          setSidebarWidth,
          resetSidebarWidth,

          openSidebar,
          closeSidebar,
          toggleSidebar,

          sidebarItems,
          setSidebarItems,

          sidebarAlways,
          setSidebarAlways,

          infobarWidth,
          infobarToggleId,
          setInfobarWidth,
          resetInfobarWidth,

          openInfobar,
          closeInfobar,
          toggleInfobar,

          infobarNav,
          setInfobarNav,

          infobarContent,
          setInfobarContent,

          showHeader,
          setShowHeader,

          showFooter,
          setShowFooter,
        ]
      )}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}

export function AppConfig({ config = {}, children }) {
  const { setConfig } = useApp()

  useEffect(() => {
    if (!config) {
      return
    }

    setConfig(config)
  }, [config, setConfig])

  return children
}

export function AppTip({
  title,
  description,

  feature,
  category,

  delay = 0,

  children,

  disabled,
}) {
  const isTop = useIsTop()

  const { slug, config } = useApp()

  const { popup, openPopup } = usePopup({
    title,
    description,

    cancelButtonCaption: 'Got It',

    closePopupOnClickOutside: false,
  })

  useEffect(() => {
    if (disabled) {
      return
    }

    if (!isTop) {
      return
    }

    const appId = slug || config?.slug || config?.name || config?.id || 'app'

    const baseKey = `app-tip-${feature || toKebabCase(appId)}`

    const fullStorageKey = category ? `${baseKey}-${category}` : baseKey

    const hasShown = localStorage.getItem(fullStorageKey)

    if (!hasShown) {
      const timeoutId = setTimeout(() => {
        openPopup(<Children>{children}</Children>, {
          onClose: () => {
            localStorage.setItem(fullStorageKey, 'true')
          },
        })
      }, delay)

      return () => clearTimeout(timeoutId)
    }
  }, [
    disabled,
    isTop,
    slug,
    config,
    feature,
    category,
    delay,
    children,
    openPopup,
  ])

  return popup
}

export function AppScene({
  className,

  name: _name,
  headline: _headline,
  description: _description,
  benefits: _benefits,

  showName: _showName = true,
  showHeadline: _showHeadline = true,
  showDescription: _showDescription = true,
  showBenefits: _showBenefits = true,

  compact = false,

  collapsed = false,

  children,

  ...props
}) {
  const { config } = useApp()

  const name = undefinedOr(_name, config.name)
  const headline = undefinedOr(_headline, config.headline)
  const description = undefinedOr(_description, config.description)
  const benefits = undefinedOr(_benefits, config.benefits)

  const layout = config.layout

  const [appNavExtra] = useDOMQuerySelector('#app-nav-title')

  const showName = useMemo(() => {
    return _showName && name != null
  }, [_showName, name])

  const showHeadline = useMemo(() => {
    return _showHeadline && headline != null
  }, [_showHeadline, headline])

  const showDescription = useMemo(() => {
    return _showDescription && description != null
  }, [_showDescription, description])

  const showBenefits = useMemo(() => {
    return _showBenefits && benefits != null && !!benefits.length
  }, [_showBenefits, benefits])

  return (
    <>
      {false && layout?.sidebar && collapsed && name && appNavExtra
        ? createPortal(<div>{name}</div>, appNavExtra)
        : null}
      <Collapsible
        {...props}
        className={clsx(
          'transition-all duration-300',
          {
            '!h-0 overflow-hidden': collapsed,
          },
          className
        )}
        innerClassName="space-y-4"
      >
        {showName || showHeadline ? (
          <div className="flex flex-col gap-2">
            {showName ? (
              <h1
                className={clsx('title break-all line-clamp-1', {
                  'screen-title heading-highlight':
                    !compact && !layout?.sidebar,
                })}
              >
                {name}
              </h1>
            ) : null}
            {headline ? (
              <p className="text-xl sm:text-3xl font-light">{headline}</p>
            ) : null}
          </div>
        ) : null}
        {showDescription || showBenefits ? (
          <div className="prose prose-sm dark:prose-invert prose-sizeless">
            {showDescription ? <p>{description}</p> : null}
            {showBenefits ? (
              <ul className="list-none px-0 [&_li]:rounded-lg [&_li]:px-0 [&_li]:py-2 [&_li]:flex [&_li]:flex-row [&_li]:gap-4">
                {benefits.map(({ icon, description }, index) => (
                  <li key={index}>
                    <DynamicIcon
                      className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-800 p-2 !m-0 dark:invert"
                      icon={icon}
                    />
                    <div>{description}</div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {children}
      </Collapsible>
    </>
  )
}

export function AppNavBar({ className, before, after, children, ...props }) {
  return (
    <nav
      {...props}
      className={clsx(
        'sticky top-0 z-30',
        'w-full',
        'pointer-events-none',
        'auto-bg-white',
        'border-b auto-border-gray-100',
        'relative',
        className
      )}
    >
      {before}
      <div
        className={clsx(
          'relative',
          'px-3',
          'h-14 min-h-14 box-content',
          'flex flex-row items-center gap-2'
        )}
      >
        {children}
      </div>
      {after}
    </nav>
  )
}

export function AppNavFloat({ className, children, ...props }) {
  const { infobarWidth } = useApp()

  const showInfobar = true

  return (
    <motion.div
      {...props}
      className={clsx(
        'fixed z-20 top-0 right-0',
        'pointer-events-auto',
        className
      )}
      initial={false}
      animate={{
        right:
          showInfobar && infobarWidth
            ? typeof infobarWidth === 'number'
              ? `${infobarWidth}px`
              : infobarWidth
            : '0px',
      }}
      transition={{
        duration: 0.3,
        type: 'tween',
      }}
    >
      <div
        className={clsx(
          'px-3',
          'h-14 min-h-14 box-content',
          'flex flex-row items-center gap-2'
        )}
      >
        {children}
      </div>
    </motion.div>
  )
}

/**
 * @todo use this helper method to replace where we portals directly to render
 * into the #app-nav-title
 */
export function AppNavTitle({ children }) {
  return <Portal query="#app-nav-title">{children}</Portal>
}

/**
 * @todo use this helper method to replace where we portals directly to render
 * into the #app-nav-extra
 */
export function AppNavExtra({ children }) {
  return <Portal query="#app-nav-extra">{children}</Portal>
}

export function AppSidebarButton({ className, ...props }) {
  return (
    <button
      {...props}
      className={clsx(
        'relative group/tooltip',
        'p-2 rounded-lg',
        'hover:bg-gray-200 dark:hover:bg-gray-800',
        'pointer-events-auto',
        className
      )}
      type="button"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="auto-text-gray-950 size-4"
        strokeWidth={2}
      >
        <path d="M6.83496 3.99992C6.38353 4.00411 6.01421 4.0122 5.69824 4.03801C5.31232 4.06954 5.03904 4.12266 4.82227 4.20012L4.62207 4.28606C4.18264 4.50996 3.81498 4.85035 3.55859 5.26848L3.45605 5.45207C3.33013 5.69922 3.25006 6.01354 3.20801 6.52824C3.16533 7.05065 3.16504 7.71885 3.16504 8.66301V11.3271C3.16504 12.2712 3.16533 12.9394 3.20801 13.4618C3.25006 13.9766 3.33013 14.2909 3.45605 14.538L3.55859 14.7216C3.81498 15.1397 4.18266 15.4801 4.62207 15.704L4.82227 15.79C5.03904 15.8674 5.31234 15.9205 5.69824 15.9521C6.01398 15.9779 6.383 15.986 6.83398 15.9902L6.83496 3.99992ZM18.165 11.3271C18.165 12.2493 18.1653 12.9811 18.1172 13.5702C18.0745 14.0924 17.9916 14.5472 17.8125 14.9648L17.7295 15.1415C17.394 15.8 16.8834 16.3511 16.2568 16.7353L15.9814 16.8896C15.5157 17.1268 15.0069 17.2285 14.4102 17.2773C13.821 17.3254 13.0893 17.3251 12.167 17.3251H7.83301C6.91071 17.3251 6.17898 17.3254 5.58984 17.2773C5.06757 17.2346 4.61294 17.1508 4.19531 16.9716L4.01855 16.8896C3.36014 16.5541 2.80898 16.0434 2.4248 15.4169L2.27051 15.1415C2.03328 14.6758 1.93158 14.167 1.88281 13.5702C1.83468 12.9811 1.83496 12.2493 1.83496 11.3271V8.66301C1.83496 7.74072 1.83468 7.00898 1.88281 6.41985C1.93157 5.82309 2.03329 5.31432 2.27051 4.84856L2.4248 4.57317C2.80898 3.94666 3.36012 3.436 4.01855 3.10051L4.19531 3.0175C4.61285 2.83843 5.06771 2.75548 5.58984 2.71281C6.17898 2.66468 6.91071 2.66496 7.83301 2.66496H12.167C13.0893 2.66496 13.821 2.66468 14.4102 2.71281C15.0069 2.76157 15.5157 2.86329 15.9814 3.10051L16.2568 3.25481C16.8833 3.63898 17.394 4.19012 17.7295 4.84856L17.8125 5.02531C17.9916 5.44285 18.0745 5.89771 18.1172 6.41985C18.1653 7.00898 18.165 7.74072 18.165 8.66301V11.3271ZM8.16406 15.995H12.167C13.1112 15.995 13.7794 15.9947 14.3018 15.9521C14.8164 15.91 15.1308 15.8299 15.3779 15.704L15.5615 15.6015C15.9797 15.3451 16.32 14.9774 16.5439 14.538L16.6299 14.3378C16.7074 14.121 16.7605 13.8478 16.792 13.4618C16.8347 12.9394 16.835 12.2712 16.835 11.3271V8.66301C16.835 7.71885 16.8347 7.05065 16.792 6.52824C16.7605 6.14232 16.7073 5.86904 16.6299 5.65227L16.5439 5.45207C16.32 5.01264 15.9796 4.64498 15.5615 4.3886L15.3779 4.28606C15.1308 4.16013 14.8165 4.08006 14.3018 4.03801C13.7794 3.99533 13.1112 3.99504 12.167 3.99504H8.16406C8.16407 3.99667 8.16504 3.99829 8.16504 3.99992L8.16406 15.995Z"></path>
      </svg>
      <span className="tooltip below w-12">⌘+B</span>
    </button>
  )
}

function AppSidebarFloatingButton({ className }) {
  const { sidebarWidth, toggleSidebar } = useApp()

  if (sidebarWidth) {
    return null
  }

  return (
    <div
      className={clsx('fixed top-3 left-3 z-30', 'hidden md:block', className)}
    >
      <AppSidebarButton
        className="auto-bg-white border auto-border-gray-100 shadow-sm"
        onClick={() => toggleSidebar()}
      />
    </div>
  )
}

export function AppSidebar({
  className,

  icon = DEFAULT_SIDEBAR_ICON,

  logo,

  title,

  link: _link, // @note not used

  apps = [],

  items = [],

  children,

  ...props
}) {
  const { config, sidebarAlways, sidebarWidth, closeSidebar, toggleSidebar } =
    useApp()

  // layout config

  const maxItemsBeforeCollapse = useMemo(() => {
    return config?.layout?.sidebar?.maxItemsBeforeCollapse ?? 2
  }, [config])

  // animation

  const isClosing = !sidebarWidth

  const [isAnimating, setIsAnimating] = useState(false)

  // expand / collapse
  {
    // hide the sidebar on small screens

    useEffect(() => {
      if (sidebarAlways) {
        return
      }

      const handleResize = () => {
        if (window.innerWidth < SIDEBAR_AUTO_HIDE_WIDTH) {
          closeSidebar()
        }
      }

      handleResize()

      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
      }
    }, [sidebarAlways, closeSidebar])

    // toggle the sidebar with cmd/ctrl + b

    useEffect(() => {
      const handleKeyDown = (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
          event.preventDefault()

          toggleSidebar()
        }
      }

      window.addEventListener('keydown', handleKeyDown)

      return () => {
        window.removeEventListener('keydown', handleKeyDown)
      }
    }, [toggleSidebar])
  }

  // main button and items

  const [mainAppButton, displayAppItems] = useMemo(() => {
    if (!apps?.length) {
      return [null, apps]
    }

    const chatAppIndex = apps.findIndex((item) =>
      item.href?.startsWith?.('/apps/chat')
    )

    return [null, apps]

    // @note ignored for now

    if (chatAppIndex === -1) {
      return [null, apps]
    }

    const mainAppButton = {
      href: apps[chatAppIndex].href,
      title: 'New Chat',
    }

    const displayAppItems = apps.map((app) => ({
      ...app,

      forcePrefetch: true,
      forcePrefetchInterval: FIVE_MINUTE_IN_MILLISECONDS,
    }))

    displayAppItems.splice(chatAppIndex, 1)

    return [mainAppButton, displayAppItems]
  }, [apps])

  const [mainAppItems, categoryAppItems] = useMemo(() => {
    const mainItems = []
    const categoryItems = {}

    for (const item of displayAppItems) {
      if (item.category === 'main') {
        mainItems.push(item)
      } else {
        if (!categoryItems[item.category]) {
          categoryItems[item.category] = []
        }

        categoryItems[item.category].push(item)
      }
    }

    const hasMainItemsIcons = mainItems.some((item) => !!item.icon)

    return [
      mainItems,

      Object.entries(categoryItems).map(([category, items]) => ({
        items: items,

        title:
          ({}[category] ?? items.length > maxItemsBeforeCollapse)
            ? toTitleCase(category)
            : '',

        icon: hasMainItemsIcons
          ? items.length > maxItemsBeforeCollapse
            ? {
                support: '@heroicons/chat-bubble-left-ellipsis',
                settings: '@heroicons/cog-8-tooth',
                admin: '@heroicons/cog-6-tooth',
                user: '@heroicons/user-circle',
                developer: '@heroicons/code-bracket',
              }[category]
            : undefined
          : undefined,

        collapsible:
          ({}[category] ?? items.length > maxItemsBeforeCollapse)
            ? true
            : false,

        expanded:
          ({}[category] ?? items.length > maxItemsBeforeCollapse)
            ? false
            : true,
      })),
    ]
  }, [maxItemsBeforeCollapse, displayAppItems])

  return (
    <>
      <Portal query="#app-nav-icon">
        <AppSidebarButton
          className={clsx({
            hidden: !!sidebarWidth,
            block: !sidebarWidth,
          })}
          onClick={() => toggleSidebar()}
        />
      </Portal>
      <motion.aside
        {...props}
        className={clsx(
          'h-screen',
          sidebarAlways ? 'flex' : 'hidden md:flex',
          'flex-col gap-4',
          'overflow-auto no-scrollbar',
          'text-sm',
          'bg-gray-50/50 dark:bg-gray-950/50',
          'border-r auto-border-gray-100',
          className
        )}
        initial={false}
        animate={{
          width: sidebarWidth,
          paddingHorizontal: !!sidebarWidth ? 20 : 0,
        }}
        transition={{
          duration: 0.3,
          type: 'tween',
        }}
        onAnimationStart={() => setIsAnimating(true)}
        onAnimationComplete={() => setIsAnimating(false)}
      >
        <div
          className={clsx(
            'h-screen',
            'flex flex-col',
            // 'gap-4',
            // 'overflow-auto',
            'no-scrollbar',
            'transition-opacity duration-200',
            {
              'opacity-0 pointer-events-none': isClosing,
              'opacity-100': !isClosing,
              'whitespace-nowrap overflow-hidden text-ellipsis': isAnimating,
            },
            className
          )}
        >
          {/* top */}
          {icon || logo || title || mainAppButton || mainAppItems?.length ? (
            <>
              <div
                className={clsx(
                  'shrink-0',
                  // 'sticky z-20 top-0',
                  // 'auto-bg-gray-50',
                  // 'backdrop-blur-lg',
                  'border-b auto-border-gray-100',
                  'px-2'
                )}
              >
                {logo || icon || title ? (
                  <div className="h-14 pl-3 flex flex-row items-center gap-2">
                    <Link href="/apps">
                      <DynamicLogo
                        className={clsx({ 'h-6': !!icon, 'h-4': !icon })}
                        src={logo || icon}
                        alt="Logo"
                      />
                      {title && (icon || logo) ? (
                        <h1 className="text-lg font-semibold">{title}</h1>
                      ) : null}
                    </Link>
                    <div className="flex-1" />
                    <AppSidebarButton onClick={() => toggleSidebar()} />
                  </div>
                ) : null}
                {mainAppButton ? (
                  <Link
                    href={mainAppButton.href}
                    className="primary-button w-full"
                  >
                    <span className="truncate">{mainAppButton.title}</span>
                  </Link>
                ) : null}
                {mainAppItems?.length ? (
                  <NestedAccordion
                    className={clsx('mb-2')}
                    items={mainAppItems}
                    expanded={true}
                    collapsible={false}
                    flat={true}
                  />
                ) : null}
              </div>
            </>
          ) : (
            <div />
          )}
          {/* items */}
          <div
            className={clsx('flex-1', 'overflow-auto', 'no-scrollbar')}
            style={{
              maskImage:
                'linear-gradient(to bottom, transparent 0px, black 10px, black calc(100% - 10px), transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, transparent 0px, black 10px, black calc(100% - 10px), transparent 100%)',
            }}
          >
            <div
              className={clsx(
                'px-2 py-2',
                'divide-y divide-gray-100 dark:divide-gray-900',
                '[&>*:not(:first-child)]:pt-4 [&>*:not(:last-child)]:pb-4'
              )}
            >
              {items?.map((item, index) => (
                <NestedAccordion key={index} {...item} flat={true} />
              ))}
              {children}
            </div>
          </div>
          {/* bottom */}
          {categoryAppItems?.length ? (
            <>
              <div
                className={clsx(
                  'shrink-0',
                  // 'sticky z-20 bottom-0',
                  // 'auto-bg-gray-50',
                  // 'backdrop-blur-lg',
                  'border-t auto-border-gray-100',
                  'divide-y divide-gray-100 dark:divide-gray-900',
                  '[&>*]:px-2 [&>*]:pt-2 [&>*]:pb-2'
                )}
              >
                {categoryAppItems.map((item, index) => (
                  <NestedAccordion key={index} {...item} />
                ))}
              </div>
            </>
          ) : (
            <div />
          )}
        </div>
      </motion.aside>
    </>
  )
}

export function AppInfobar({ className, children, ...props }) {
  const { infobarWidth, infobarNav, infobarContent, closeInfobar } = useApp() // get closeInfobar from context

  const isClosing = !infobarWidth

  const [isAnimating, setIsAnimating] = useState(false)

  const [appInfobarNava] = useDOMQuerySelector('#app-infobar-nav')

  const [infobarNavHeight, setInfobarNavHeight] = useState()

  useEffect(() => {
    if (!appInfobarNava) {
      return
    }

    const updateNavHeight = () => {
      const height = appInfobarNava.offsetHeight

      setInfobarNavHeight(height)
    }

    updateNavHeight()

    const resizeObserver = new ResizeObserver(() => {
      updateNavHeight()
    })

    resizeObserver.observe(appInfobarNava)

    return () => {
      resizeObserver.disconnect()
    }
  }, [appInfobarNava])

  return (
    <motion.aside
      {...props}
      className={clsx(
        'h-screen',
        'flex flex-col gap-4',
        'overflow-auto no-scrollbar',
        'text-sm',
        'auto-bg-gray-50',
        'border-l auto-border-gray-100',
        className
      )}
      initial={false}
      animate={{
        width: infobarWidth,
        paddingHorizontal: !!infobarWidth ? 20 : 0,
      }}
      transition={{
        duration: 0.3,
        type: 'tween',
      }}
      onAnimationStart={() => setIsAnimating(true)}
      onAnimationComplete={() => setIsAnimating(false)}
    >
      <div
        className={clsx(
          'h-screen',
          'flex flex-col gap-0',
          'overflow-auto no-scrollbar',
          'transition-opacity duration-200',
          {
            'opacity-0 pointer-events-none': isClosing,
            'opacity-100': !isClosing,
            'whitespace-nowrap overflow-hidden text-ellipsis': isAnimating,
          }
        )}
      >
        <AppNavBar
          id="app-infobar-nav"
          className={clsx('bg-none auto-bg-gray-50')}
        >
          <button
            className="-ml-2 p-2 rounded-full hover:auto-bg-gray-100 transition-colors pointer-events-auto"
            type="button"
            aria-label="Close infobar"
            onClick={closeInfobar}
          >
            <LuX className="size-5 text-gray-500" />
          </button>
          <div id="app-infobar-nav-start" />
          <div className="flex-1" />
          {infobarNav}
          <div id="app-infobar-nav-end" />
        </AppNavBar>
        <div
          id="app-infobar-content"
          className="w-full min-h-[calc(100%-var(--app-infobar-nav-height))] relative"
          style={{
            '--app-infobar-nav-height': infobarNavHeight
              ? `${infobarNavHeight}px`
              : 'auto',
          }}
        >
          <div id="app-infobar-content-top" />
          {infobarContent}
          {children}
          <div id="app-infobar-content-bottom" />
        </div>
      </div>
    </motion.aside>
  )
}

export function AppMain({
  slug,

  breadcrumbs,

  title,
  description,

  keywords,

  favicon: _favicon,

  image,

  appManifest,

  navClassName,
  navChildren,

  footerClassName,
  footerChildren,

  goBackTo: _goBackTo,

  withBilling: _withBilling = true,
  withDarkModeSwitch: _withDarkModeSwitch = true,

  name: _name,

  logo: _logo,
  icon: _icon,

  sidebarLogo: _sidebarLogo,
  sidebarIcon: _sidebarIcon,
  sidebarTitle: _sidebarTitle,
  sidebarLink: _sidebarLink,
  sidebarItems: _sidebarItems,

  showSidebar: _showSidebar = true,

  showNav: _showNav = true,

  showHeader: _showHeader,
  showFooter: _showFooter,

  madeWith: _madeWith,

  gtag: _gtag,

  className,

  children,
}) {
  const router = useRouter()

  const isEmbedded = !!useScopedQuerySessionOption('_embed')

  const {
    config: appConfig,

    sidebarItems: appSidebarItems,
    sidebarAlways: appSidebarAlways,

    showHeader: appShowHeader,
    showFooter: appShowFooter,
  } = useApp()

  const favicon = useMemo(() => {
    if (!_favicon) {
      return
    }

    if (typeof _favicon === 'string') {
      return _favicon
    }

    if (typeof _favicon === 'boolean') {
      if (slug) {
        return `/apps/${slug}/icon`
      }
    }
  }, [_favicon, slug])

  const appType = useMemo(() => {
    return getAppTypeByHostname(router.hostname || '')
  }, [router.hostname])

  const goBackTo = useMemo(() => {
    // @todo consider moving this logic into the router

    if (_goBackTo === ':prev') {
      const pathParts = router.pathname.split('/')

      pathParts.pop()

      return pathParts.join('/') || '/'
    } else {
      return _goBackTo
    }
  }, [_goBackTo, router.pathname])

  const withBilling = useMemo(() => {
    switch (true) {
      case appType === PORTAL_TYPE: {
        return false
      }

      case appType === CUSTOM_TYPE: {
        return false
      }

      default: {
        return _withBilling
      }
    }
  }, [appType, _withBilling])

  const withDarkModeSwitch = useMemo(() => {
    return _withDarkModeSwitch
  }, [_withDarkModeSwitch])

  const widgetInstance = useWidgetInstance('chatbotkit-widget')

  {
    useEffect(() => {
      if (!widgetInstance) {
        return
      }

      widgetInstance.hide()
    }, [widgetInstance])
  }

  const name = useMemo(() => {
    const value = _name || appConfig?.layout?.name || appConfig?.name

    if (typeof value === 'string') {
      return value
    }
  }, [appConfig, _name])

  const logo = useMemo(() => {
    const value = _logo || appConfig?.layout?.logo

    if (typeof value === 'string') {
      return value
    }
  }, [appConfig, _logo])

  const icon = useMemo(() => {
    const value = _icon || appConfig?.layout?.icon

    if (typeof value === 'string') {
      return value
    }
  }, [appConfig, _icon])

  const showHeader = useMemo(() => {
    const value =
      appShowHeader ?? !!(_showHeader ?? appConfig?.layout?.header ?? true)

    return !!value
  }, [appShowHeader, _showHeader, appConfig])

  const showFooter = useMemo(() => {
    const value =
      appShowFooter ?? !!(_showFooter ?? appConfig?.layout?.footer ?? true)

    return !!value
  }, [appShowFooter, _showFooter, appConfig])

  const sidebarLogo = useMemo(() => {
    const value = _sidebarLogo || appConfig?.layout?.sidebar?.logo || logo

    if (typeof value === 'string') {
      return value
    }
  }, [appConfig, _sidebarLogo, logo])

  const sidebarIcon = useMemo(() => {
    const value = _sidebarIcon || appConfig?.layout?.sidebar?.icon || icon

    if (typeof value === 'string') {
      return value
    }
  }, [appConfig, _sidebarIcon, icon])

  const sidebarTitle = useMemo(() => {
    const value = _sidebarTitle || appConfig?.layout?.sidebar?.title

    if (typeof value === 'string') {
      return value
    }
  }, [appConfig, _sidebarTitle])

  const sidebarLink = useMemo(() => {
    const value = _sidebarLink || appConfig?.layout?.sidebar?.link || '/apps'

    if (typeof value === 'string') {
      return value
    }
  }, [appConfig, _sidebarLink])

  const sidebarApps = useMemo(() => {
    const apps = []

    if (!appConfig?.layout?.sidebar) {
      return apps
    }

    if (typeof appConfig?.apps !== 'object') {
      return apps
    }

    const entries = Object.entries(appConfig.apps)

    if (entries.length) {
      apps.push(
        ...entries
          .filter(
            ([, { sidebar = true, hidden = false }]) => !!sidebar && !hidden
          )
          .map(([slug, { icon, name, sidebar, order, category }]) => {
            // @todo access to the config should be only accessible to the
            // backend and not injected in client-side components - while this
            // does not represent a security issue, it is still not a good
            // practice

            const instance = configApps.find(
              (app) => app.slug === slug || app.id === slug
            )

            return {
              slug: slug,

              title: name || instance?.name || toTitleCase(slug),

              href: `/apps/${slug}`,

              icon: sidebar?.icon || icon,

              order: order ?? instance?.order ?? Number.MAX_SAFE_INTEGER,

              category: category ?? instance?.category ?? 'main',
            }
          })
          .sort(({ order: orderA }, { order: orderB }) => {
            return orderA - orderB // @note sorted in ascending order
          })
      )
    }

    return apps
  }, [appConfig])

  const sidebarItems = useMemo(() => {
    const items = []

    const sbi = appConfig?.layout?.sidebar?.items || _sidebarItems

    if (Array.isArray(sbi)) {
      items.push(...sbi)
    }

    if (appSidebarItems?.length) {
      items.push(...appSidebarItems)
    }

    return items
  }, [appConfig, _sidebarItems, appSidebarItems])

  const madeWith = useMemo(() => {
    const value = _madeWith ?? appConfig?.layout?.footer?.madeWith ?? true // @todo should be only allowed for white-label users

    return !!value
  }, [appConfig, _madeWith])

  const gtag = useMemo(() => {
    const value = _gtag ?? appConfig?.analytics?.gtag ?? '' // @todo should be only allowed for white-label users

    if (typeof value === 'string') {
      return value
    }
  }, [appConfig, _gtag])

  const showSidebar =
    _showSidebar &&
    (!isEmbedded || appSidebarAlways) &&
    (!!appConfig?.layout?.sidebar ||
      !!sidebarApps.length ||
      !!sidebarItems.length)

  const showNav = !!_showNav

  const showSidebarNavButton =
    !isEmbedded && showSidebar && showNav && showHeader

  const showSidebarFloatingButton =
    !isEmbedded && showSidebar && !showSidebarNavButton

  const showInfobar = true

  return (
    <div>
      <Meta
        breadcrumbs={breadcrumbs || ['Apps', 'ChatBotKit']}
        title={title}
        description={description}
        keywords={keywords}
        favicon={favicon}
        image={image}
        appManifest={appManifest}
        baseUrl={router.hostname ? `https://${router.hostname}` : undefined}
      />
      {gtag ? <GTag gtag={gtag} disabled={!isProduction} /> : null}
      {/* the following code prevents the rubber-band effect */}
      <style jsx global>{`
        html,
        body {
          overscroll-behavior-y: none;
        }
      `}</style>
      <Confirm>
        <div className="flex flex-row">
          {showSidebar ? (
            <AppSidebar
              className="h-screen"
              id="app-sidebar"
              logo={sidebarLogo}
              icon={sidebarIcon}
              title={sidebarTitle}
              link={sidebarLink}
              apps={sidebarApps}
              items={sidebarItems}
            />
          ) : null}
          {showSidebarFloatingButton ? <AppSidebarFloatingButton /> : null}
          <div
            id="app-content"
            className={clsx(
              'h-screen',
              'overflow-auto',
              'subtle-scrollbar',
              'flex-1 flex flex-col',
              'relative',
              className
            )}
          >
            {/* header */}
            {!isEmbedded && showNav ? (
              showHeader ? (
                <AppNavBar
                  className={clsx('!bg-transparent !border-0', navClassName)}
                  before={
                    <div
                      className="absolute inset-0 backdrop-blur-lg pointer-events-none"
                      style={{
                        maskImage:
                          'linear-gradient(to bottom, black calc(100% - 10px), transparent 100%)',
                        WebkitMaskImage:
                          'linear-gradient(to bottom, black calc(100% - 10px), transparent 100%)',
                      }}
                    />
                  }
                >
                  {!showSidebar && goBackTo ? (
                    <Link
                      className="hidden xl:block pointer-events-auto group"
                      href={goBackTo}
                    >
                      {logo || icon ? (
                        <div
                          className={clsx('flex gap-2', {
                            'flex-col justify-normal': !!logo,
                            'flex-row items-center': !!icon,
                          })}
                        >
                          <DynamicIcon icon={logo || icon} className="h-5" />
                          {name ? (
                            <span className="text-sm font-semibold">
                              {name}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <LuArrowLeft
                          className={clsx(
                            'size-5',
                            'opacity-20 group-hover:opacity-100',
                            'transition-all duration-200'
                          )}
                        />
                      )}
                    </Link>
                  ) : null}
                  {showSidebarNavButton ? (
                    <div className="hidden md:block" id="app-nav-icon" />
                  ) : null}
                  <div className="hidden md:block" id="app-nav-title" />
                  <div className="flex-1" />
                  {navChildren}
                  <div
                    className="flex flex-row gap-2 items-center"
                    id="app-nav-extra"
                  />
                  <div className="pointer-events-auto">
                    <ProfileDropdown
                      compact={true}
                      withBilling={withBilling}
                      withDarkModeSwitch={withDarkModeSwitch}
                    />
                  </div>
                </AppNavBar>
              ) : (
                <AppNavFloat className={navClassName}>
                  <div className="flex-1" />
                  {navChildren}
                  <div
                    className="flex flex-row gap-2 items-center"
                    id="app-nav-extra"
                  />
                  <ProfileDropdown
                    compact={true}
                    withBilling={withBilling}
                    withDarkModeSwitch={withDarkModeSwitch}
                  />
                </AppNavFloat>
              )
            ) : null}
            {/* main */}
            <main>{children}</main>
            {/* footer */}
            {!isEmbedded ? (
              showFooter ? (
                <footer
                  className={clsx(
                    footerClassName,
                    'mt-auto p-8 space-y-4 text-sm text-gray-500 dark:text-gray-500'
                  )}
                >
                  {madeWith ? (
                    <div className="text-center">
                      <span>
                        With <Emoji className="dark:grayscale">❤️</Emoji>
                      </span>{' '}
                      by{' '}
                      {/* @note the reason we use a instead of Link is because Link strips the domain */}
                      <a
                        className="text-indigo-600 dark:text-gray-100"
                        href={appConfig?.layout?.footer?.brandUrl || '/'}
                        target="_blank"
                      >
                        {appConfig?.layout?.footer?.brandName || 'CBK'}
                      </a>
                    </div>
                  ) : null}
                  {appConfig?.layout?.footer?.privacy ||
                  appConfig?.layout?.footer?.terms ? (
                    <div className="flex flex-row justify-center gap-2">
                      {appConfig?.layout?.footer?.privacy ? (
                        <a
                          className="text-gray-500 dark:text-gray-500"
                          href={appConfig?.layout?.footer?.privacy}
                          target="_blank"
                        >
                          Privacy
                        </a>
                      ) : null}
                      {appConfig?.layout?.footer?.terms ? (
                        <a
                          className="text-gray-500 dark:text-gray-500"
                          href={appConfig?.layout?.footer?.terms}
                          target="_blank"
                        >
                          Terms
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                  {footerChildren}
                </footer>
              ) : null
            ) : null}
          </div>
          {showInfobar ? (
            <AppInfobar className="h-screen" id="app-infobar" />
          ) : null}
        </div>
      </Confirm>
    </div>
  )
}

export default function App({
  slug,

  config,

  sidebarItems,
  sidebarAlways,

  showNav,
  showHeader,
  showFooter,

  state = {},

  ...props
}) {
  return (
    <AppProvider
      slug={slug}
      config={config}
      sidebarItems={sidebarItems}
      sidebarAlways={sidebarAlways}
      showHeader={showHeader}
      showFooter={showFooter}
      state={state}
    >
      <AppMain
        slug={slug}
        showNav={showNav}
        showHeader={showHeader}
        showFooter={showFooter}
        {...props}
      />
    </AppProvider>
  )
}

export function useInfobarToggle({
  id: _id,

  width = '30%',

  render,

  renderNav,

  className,
}) {
  const {
    infobarToggleId,

    toggleInfobar,

    setInfobarNav,

    setInfobarContent,
  } = useApp()

  const id = useMemo(() => {
    return toKebabCase(`infobar-content-${_id}`)
  }, [_id])

  const toggle = useCallback(() => {
    toggleInfobar(width, id)

    if (renderNav) {
      setInfobarNav(renderNav())
    } else {
      setInfobarNav(null)
    }

    setInfobarContent(<div id={id} className={className} />)
  }, [
    id,
    width,
    renderNav,
    className,
    toggleInfobar,
    setInfobarNav,
    setInfobarContent,
  ])

  const toRender = (
    <>
      {infobarToggleId === id ? (
        <Portal query={`#${id}`}>{render()}</Portal>
      ) : null}
    </>
  )

  return { toggle, toRender }
}
