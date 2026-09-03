import { useCallback } from 'react'

import { navbarButtons } from '@/config/navigation'

import Consent from '@/components/Consent'
import MainNavbar from '@/components/MainNavbar'
import Meta from '@/components/Meta'
import Widget from '@/components/Widget'

import useComboKeybinding from '@/hooks/useComboKeyBinding'
import useIsTop from '@/hooks/useIsTop'
import usePartner from '@/hooks/usePartner'

import useWidgetInstance from '@chatbotkit/react/hooks/useWidgetInstance'

import clsx from 'clsx'

export const rootUrl = '/'

export const navigation = [
  {
    title: 'Examples',
    href: '/examples',
  },
  {
    title: 'Connections',
    href: '/connections',
  },
]

export function getExploreNavbarButtons(
  widgetInstance,
  askQuestionButton,
  buttons = navbarButtons
) {
  return widgetInstance ? [askQuestionButton, ...buttons] : buttons
}

/**
 * @typedef {{
 *   children: import('react').ReactNode
 * } & import('@/components/Meta').MetaOptions} ExploreProps
 *
 * @param {ExploreProps} props
 * @returns {import('react').JSX.Element}
 */
export default function Explore({
  breadcrumbs,
  title,
  description,
  keywords,
  image,
  rss,

  baseUrl,
  thisUrl,

  className,

  children,
}) {
  const partner = usePartner()

  const isTop = useIsTop()

  const widgetInstance = useWidgetInstance('chatbotkit-widget')

  const openWidget = useCallback(() => {
    try {
      widgetInstance.open = true
    } catch {
      // pass
    }
  }, [widgetInstance])

  // @note open the widget on the typical search shortcut (Cmd+K on Mac,
  // Ctrl+K on Windows/Linux)

  useComboKeybinding('k', openWidget)

  const askQuestionButton = {
    title: 'Ask a Question',
    as: function AskQuestionButton({ className, children }) {
      return (
        <button className={className} type="button" onClick={openWidget}>
          {children}
        </button>
      )
    },
  }

  return (
    <div
      className={clsx(
        'min-h-[calc(100vh-4rem)]',
        'bg-white dark:bg-black',
        className
      )}
    >
      <Meta
        breadcrumbs={breadcrumbs}
        title={title}
        description={description}
        keywords={keywords}
        image={image}
        rss={rss}
        baseUrl={baseUrl}
        thisUrl={thisUrl}
      />
      {isTop ? <Consent /> : null}
      {isTop ? <Widget /> : null}
      {isTop ? (
        <MainNavbar
          rootUrl={rootUrl}
          navigation={navigation}
          buttons={getExploreNavbarButtons(widgetInstance, askQuestionButton)}
          miniDarkModeSwitch={true}
          partner={partner}
        />
      ) : null}
      <div className="sticky top-0 z-20">
        <main>
          <div>{children}</div>
        </main>
      </div>
    </div>
  )
}
