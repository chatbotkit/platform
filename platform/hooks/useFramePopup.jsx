'use client'

import { useCallback, useState } from 'react'

import usePopup from '@/hooks/usePopup'

import clsx from 'clsx'

// @note default dialog sizing matches the large preview modal used across the
// marketing site (feature previews, documentation, overview videos)

const DEFAULT_DIALOG_CLASS_NAME =
  'w-screen h-screen lg:max-w-[calc(100vw*0.8)] lg:max-h-[calc(100vh*0.8)]'

const DEFAULT_IFRAME_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'

// @note render the iframe transparent and fade it in once it finishes loading
// so the modal does not flash a blank or half-painted page

function FramePopupIframe({ className, ...props }) {
  const [loaded, setLoaded] = useState(false)

  return (
    <iframe
      {...props}
      className={clsx(
        className,
        'transition-opacity duration-500 ease-out',
        loaded ? 'opacity-100' : 'opacity-0'
      )}
      onLoad={() => setLoaded(true)}
    />
  )
}

/**
 * Open an arbitrary page inside a large iframe popup. Generalises the
 * open-a-page-in-a-modal pattern repeated across the site (feature previews,
 * documentation, item displays) into one reusable hook.
 *
 * @example
 *   const { popup, openFramePopup } = useFramePopup()
 *   // ...
 *   {popup}
 *   <button onClick={() => openFramePopup('/stories/quench', {
 *     goToCaption: 'Read the full story',
 *     goToTarget: '_blank',
 *   })}>Case study</button>
 */
export default function useFramePopup(defaultOptions) {
  const { popup, openPopup, closePopup, ...rest } = usePopup({
    dialogClassName: DEFAULT_DIALOG_CLASS_NAME,
    cancelButtonCaption: 'Close',
    ...defaultOptions,
  })

  const openFramePopup = useCallback(
    (
      src,
      {
        // @note append `?mode=preview` (using the pathname only, dropping the
        // origin) the way feature previews do, so chrome-aware pages can hide
        // their navigation inside the modal
        preview = false,

        // @note when set, renders a default action button that navigates to the
        // page instead of just closing the modal
        goToCaption,
        goToTarget = '_self',

        allow = DEFAULT_IFRAME_ALLOW,
        allowFullScreen = true,
        iframeClassName = 'w-full h-full rounded-lg border auto-border-gray-100',

        ...popupOptions
      } = {}
    ) => {
      let iframeSrc = src

      if (preview) {
        try {
          const url = new URL(src, window.location.origin)

          iframeSrc = `${url.pathname}?mode=preview`
        } catch {
          iframeSrc = src
        }
      }

      const actionOptions = goToCaption
        ? {
            actions: {
              [goToCaption]: {
                default: true,
                fn: () => {
                  window.open(src, goToTarget)
                },
              },
            },
          }
        : { noActions: true }

      openPopup(
        <FramePopupIframe
          className={iframeClassName}
          src={iframeSrc}
          allow={allow}
          allowFullScreen={allowFullScreen}
        />,
        {
          animateContentHeight: false,
          contentClassName: 'h-full',
          ...actionOptions,
          ...popupOptions,
        }
      )
    },
    [openPopup]
  )

  return {
    popup,
    openFramePopup,
    openPopup,
    closePopup,
    ...rest,
  }
}
