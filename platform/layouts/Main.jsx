import { memo, useMemo } from 'react'

import { navbarButtons as _navbarButtons } from '@/config/navigation'

import MainNavbar from '@/components/MainNavbar'
import Meta from '@/components/Meta'
import Widget from '@/components/Widget'

import clsx from 'clsx'

/**
 *
 */
export function Assistant() {
  return <Widget />
}

Assistant.Memo = memo(Assistant)

/**
 * @typedef {{
 *   children: import('react').ReactNode
 * } & import('@/components/Meta').MetaOptions} MainProps
 *
 * @param {MainProps} props
 * @returns {import('react').JSX.Element}
 */
export default function Main({
  breadcrumbs,
  title,
  description,
  keywords,
  image,
  rss,

  baseUrl,
  thisUrl,

  canonical,

  noindex,

  navbarButtonsExtra,

  className,

  children,
}) {
  const navbarButtons = useMemo(() => {
    const buttons = [..._navbarButtons]

    if (navbarButtonsExtra) {
      buttons.unshift(...navbarButtonsExtra)
    }

    return buttons
  }, [navbarButtonsExtra])

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
        canonical={canonical}
        noindex={noindex}
      />
      <Assistant.Memo />
      <MainNavbar
        // title="CBK"
        buttons={navbarButtons}
        miniDarkModeSwitch={true}
      />
      <div className="sticky top-0 z-20">
        <main>
          <div>{children}</div>
        </main>
      </div>
    </div>
  )
}
