import { useEffect, useRef } from 'react'

import Script from 'next/script'

import toast from '@/lib/toast'

import CodeBlock from '@/components/CodeBlock'
import CopyButton from '@/components/CopyButton'
import Link from '@/components/Link'
import Meta from '@/components/Meta'
import NoRubberBand from '@/components/NoRubberBand'

import usePopup from '@/hooks/usePopup'
import useScreenshot from '@/hooks/useScreenshot'

import {
  ClipboardIcon,
  CodeBracketIcon,
  HomeIcon,
  ShareIcon,
} from '@heroicons/react/24/outline'

import clsx from 'clsx'

export function Popup({ source }) {
  return (
    <CodeBlock
      className="h-screen lg:max-w-[calc(100vw*0.8)] lg:max-h-[calc(100vh*0.8)] text-xs"
      language="javascript"
      showLineNumbers
    >
      {source}
    </CodeBlock>
  )
}

export function SideBySidePage({ className, ...props }) {
  return (
    <div
      {...props}
      className={clsx(
        'w-full h-screen',
        'p-2 pt-12 pb-8',
        'flex flex-cols gap-2',
        className
      )}
    />
  )
}

export default function Demo({
  breadcrumbs,
  title,
  description,
  keywords,
  image,

  slug,

  source,

  copy = false,
  share = false,

  children,
}) {
  const { popup, openPopup } = usePopup({
    dialogClassName: 'w-screen !max-w-[calc(100vw*0.8)]',

    noActions: true,
  })

  const buttonsRef = useRef(null)

  const { targetRef: screenshotTargetRef, takeScreenshot } = useScreenshot({
    onBeforeScreenshot: async () => {
      // @note hide buttons before taking screenshot for clean capture

      if (buttonsRef.current) {
        buttonsRef.current.style.display = 'none'
      }

      // @note hide cursor during screenshot for clean capture

      if (screenshotTargetRef.current) {
        screenshotTargetRef.current.dataset.originalCursor =
          buttonsRef.current.style.display

        screenshotTargetRef.current.style.cursor = 'none'
      }
    },
    onAfterScreenshot: async () => {
      // @note restore buttons after screenshot

      if (buttonsRef.current) {
        buttonsRef.current.style.display = ''
      }

      // @note restore cursor after screenshot

      if (screenshotTargetRef.current) {
        screenshotTargetRef.current.style.cursor =
          screenshotTargetRef.current.dataset.originalCursor || ''

        delete screenshotTargetRef.current.dataset.originalCursor
      }
    },
  })

  useEffect(() => {
    const handleKeyDown = async (event) => {
      if (event.metaKey && event.shiftKey && event.key === 's') {
        event.preventDefault()

        try {
          await takeScreenshot()

          toast.success('Screenshot taken')
        } catch (e) {
          toast.error('Could not take screenshot: ' + e)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [takeScreenshot])

  return (
    <>
      <Meta
        breadcrumbs={breadcrumbs}
        title={title}
        description={description}
        keywords={keywords}
        image={image}
      />
      <NoRubberBand />
      {/* @note demos are full-bleed interactive canvases with no title area of
      their own, so none of them shipped an h1. Render the title the page
      already gives us as a visually hidden h1 - crawlers and assistive tech get
      a document heading without changing the design. */}
      {title ? <h1 className="sr-only">{title}</h1> : null}
      <Script
        strategy="afterInteractive"
        id="chatbotkit-widget"
        src="/integrations/widget/v2.js"
      />
      {popup}
      <div ref={screenshotTargetRef}>{children}</div>
      <div
        ref={buttonsRef}
        className="absolute top-2 left-2 flex flex-row gap-2"
      >
        {slug ? (
          <Link
            className="default-button small push"
            href={`/examples/${slug}`}
          >
            <HomeIcon className="w-4 h-4" />
          </Link>
        ) : null}
        <button
          className="default-button small push"
          type="button"
          onClick={() => {
            openPopup(<Popup source={source} />)
          }}
        >
          <CodeBracketIcon className="w-4 h-4" />
        </button>
        {copy && slug ? (
          <button
            className="default-button small"
            type="button"
            onClick={() => {
              window.open(
                `/new?${new URLSearchParams({
                  template: 'example',
                  example: slug,
                })}`,
                '_blank'
              )
            }}
          >
            <ClipboardIcon className="w-4 h-4" />
          </button>
        ) : null}
        {share && (
          <CopyButton
            className="default-button small push"
            type="button"
            text={() => window.location.href}
          >
            <ShareIcon className="w-4 h-4" />
          </CopyButton>
        )}
      </div>
    </>
  )
}
