/* eslint-disable custom-eslint-rules/no-restricted-client-imports -- used inside getServerSideProps only */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useResizeDetector } from 'react-resize-detector'

import Head from 'next/head'

import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { siteHostname } from '@/config/site'

import demos from '@/data/demos.yaml'

import { CACHE_PRESETS, applyCacheHeaders } from '@/lib/cdn'
import { blackOrWhite } from '@/lib/color2'
import { setupRequestContext } from '@/lib/context.setup'
import {
  executeInContext,
  getContextFrontendHost,
  getContextRequestHost,
} from '@/lib/context.store'
import { fetchDataUrl } from '@/lib/dataurl.fetch'
import { isDataURL } from '@/lib/dataurl.parse'
import { responseToDataUrl } from '@/lib/dataurl.response'
import { stringToDbString } from '@/lib/db.string'
import { debug } from '@/lib/debug'
import { isProduction } from '@/lib/env'
import { captureException } from '@/lib/error'
import fetch from '@/lib/fetch'
import { saveBlob } from '@/lib/save'
import { joinTrimmedNotEmpty } from '@/lib/string'
import { makeJsonSafe } from '@/lib/struct'
import { buildTheme, parseTheme } from '@/lib/theme'
import toast from '@/lib/toast'
import { isURL } from '@/lib/url'
import {
  makeScreenshot,
  makeScreenshotRequest,
  readScreenshotMetadata,
} from '@/lib/webshot'

import DotsLoader from '@/components/DotsLoader'
import Meta from '@/components/Meta'
import Toggle from '@/components/Toggle'
import WidgetPreview from '@/components/WidgetPreview'

import useEntryAnimation from '@/hooks/useEntryAnimation'
import useFetch from '@/hooks/useFetch'
import useImageColorPalette from '@/hooks/useImageColorPalette'
import usePopup from '@/hooks/usePopup'
import useRouter from '@/hooks/useRouter'
import useSession from '@/hooks/useSession'

import { unfurlPage } from '@/pages/api/v1/url/unfurl'

import clsx from 'clsx'

export default function Preview({
  commit,

  url,

  screenshotImage,
  bannerImage,

  data,

  brandPrimary: _brandPrimary,
  brandText: _brandText,

  bar: _useBar = true,
  banner: _useBanner = true,
  bubble: _useBubble = true,
  rounded: _useRounded = true,
  glow: _useGlow = false,

  demo,

  layout = 'default',
}) {
  const router = useRouter()

  const { status } = useSession()

  const rootRef = useRef(null)

  const isFullScreen = layout === 'fullscreen'

  const [isFramed, setIsFramed] = useState(false)

  useEffect(() => {
    if (window !== window.parent) {
      setIsFramed(true)
    }
  }, [])

  const barIcon = useMemo(() => {
    return data.logo || null
  }, [data.logo])

  const barTitle = useMemo(() => {
    return (
      (data.title?.split(/(?:\W*(?:\||:|-|-|&mdash;))/)[0].trim() || '') + ' AI'
    ).trim()
  }, [data.title])

  const banner = useMemo(() => {
    return data.image || null
  }, [data.image])

  const intro = useMemo(() => {
    return data.description ? data.description : demo.intro
  }, [demo.intro, data.description])

  const initial = useMemo(() => {
    return demo.initial
  }, [demo.initial])

  const messages = useMemo(() => {
    return demo.messages
  }, [demo.messages])

  const placeholder = useMemo(() => {
    return 'Ask me anything...'
  }, [])

  const {
    width: imageWidth,
    height: imageHeight,
    ref: imageRef,
  } = useResizeDetector()

  const {
    width: widgetWidth,
    height: widgetHeight,
    ref: widgetRef,
  } = useResizeDetector()

  const [brandPrimary, setBrandPrimary] = useState(_brandPrimary || '#000000')
  const [brandText, setBrandText] = useState(_brandText || '#ffffff')

  const fontFamily = useMemo(() => {
    const first = data.fonts?.[0]?.first

    if (['sans-serif', 'serif'].includes(first)) {
      return null
    }

    return first
  }, [data])

  const [useBar, setUseBar] = useState(_useBar)
  const [useBanner, setUseBanner] = useState(_useBanner)
  const [useBubble, setUseBubble] = useState(_useBubble)
  const [useRounded, setUseRounded] = useState(_useRounded)
  const [useGlow, setUseGlow] = useState(_useGlow)

  const { colorPalette: _imageColorPalette, error: imageColorPaletteError } =
    useImageColorPalette(bannerImage || screenshotImage)

  const imageColorPalette = useMemo(() => {
    if (_imageColorPalette) {
      return Array.from(new Set(_imageColorPalette)).slice(0, 5)
    } else {
      return null
    }
  }, [_imageColorPalette])

  useEffect(() => {
    if (!imageColorPalette) {
      return
    }

    const color = imageColorPalette?.[0]

    // @note we check because we don't want to override the query params
    if (!_brandPrimary) {
      setBrandPrimary(color)
    }

    // @note we check because we don't want to override the query params
    if (!_brandText) {
      setBrandText(blackOrWhite(color))
    }

    // @note we want to run this only once when the imageColorPalette is ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageColorPalette])

  const [themeName, setThemeName] = useState('default')
  const [themeConfig, setThemeConfig] = useState({})

  useEffect(() => {
    if (!brandPrimary) {
      return
    }

    const { name, config } = parseTheme('default')

    setThemeName(name)

    setThemeConfig({
      ...config,

      popupBorderPrimary: brandPrimary,

      // @note disabled because we just preserve the default colors

      ...(useBar
        ? {
            barText: brandText,
            barPrimary: brandPrimary,
            barBorderSize: 0,
          }
        : null),

      botMessageText: '#000000',
      botMessagePrimary: '#f3f4f6',

      userMessageText: brandText,
      userMessagePrimary: brandPrimary,

      inputBorderPrimary: 'transparent',
      inputBorderSecondary: 'transparent',

      tapText: brandPrimary,

      buttonText: brandText,
      buttonPrimary: brandPrimary,
      buttonSecondary: brandPrimary,

      ...(useGlow
        ? {
            popupBorderGradientFrom: '#ec4899',
            popupBorderGradientVia: '#06b6d4',
            popupBorderGradientTo: '#8b5cf6',
          }
        : {}),

      ...(useBubble
        ? {
            messageStyle: 'bubble',
          }
        : {
            messageStyle: 'stack',
          }),

      ...(useRounded
        ? {
            messageRounding: '1rem',
            messagePadding: '0.5rem 1rem 0.5rem 1rem',

            // messageButtonPadding: '0.2rem 1rem 0.2rem 1rem',
            // messageButtonRounding: 'calc(infinity*1px)',
            messageButtonRounding: '0.5rem',

            buttonRounding: '1rem',

            scrollButtonRounding: '100%',
          }
        : {
            messageRounding: '0rem',
            messagePadding: '0.5rem 1rem 0.5rem 1rem',

            // messageButtonPadding: '0.2rem 1rem 0.2rem 1rem',
            messageButtonRounding: '0rem',

            popupRounding: '0rem',

            buttonRounding: '0rem',

            scrollButtonRounding: '0rem',
          }),

      brandPrimary,

      fontFamily,
    })
  }, [
    fontFamily,
    brandPrimary,
    brandText,
    useBar,
    useBubble,
    useRounded,
    useGlow,
  ])

  useEffect(() => {
    const handleKeyDown = async (event) => {
      if (event.metaKey && event.shiftKey && event.key === 's') {
        try {
          const cropTarget = await window.CropTarget.fromElement(
            rootRef.current
          )

          const stream = await navigator.mediaDevices.getDisplayMedia({
            // @ts-ignore
            preferCurrentTab: true,
          })

          const [track] = stream.getVideoTracks()

          // @ts-ignore
          await track.cropTo(cropTarget)

          const video = document.createElement('video')

          {
            video.srcObject = stream
            video.play()
          }

          video.onloadedmetadata = async function () {
            const canvas = document.createElement('canvas')

            {
              canvas.width = video.videoWidth
              canvas.height = video.videoHeight
            }

            const context = canvas.getContext('2d')

            {
              context?.drawImage(video, 0, 0, canvas.width, canvas.height)
            }

            canvas.toBlob(function (blob) {
              if (!blob) {
                toast.error('Failed to take screenshot')

                return
              }

              saveBlob(blob, { name: 'screenshot.png' })

              toast.success('Screenshot taken')
            })

            stream.getTracks().forEach((track) => track.stop())
          }
        } catch (e) {
          toast.error('Could not take screenshot: ' + e)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const { fetch, loading } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  const { popup, openPopup } = usePopup({
    closePopupOnClickOutside: false,
  })

  // @note the sign-in round trip loses the in-page customisation, so we carry
  // the current configuration back into the preview through the callback url
  function getSignInCallbackUrl() {
    // @note the base only satisfies the URL parser - the return value is
    // pathname + search, so the callback stays on the current origin
    const url = new URL(router.asPath, window.location.origin)

    url.searchParams.set('brandPrimary', brandPrimary)
    url.searchParams.set('brandText', brandText)
    url.searchParams.set('bar', useBar)
    url.searchParams.set('banner', useBanner)
    url.searchParams.set('bubble', useBubble)
    url.searchParams.set('rounded', useRounded)
    url.searchParams.set('glow', useGlow)

    return url.pathname + url.search
  }

  async function handleCommit() {
    window.postMessage('commit', {
      theme: buildTheme(themeName, themeConfig),
    })
  }

  async function handleBuild() {
    // @todo use the theme instead
    const barIconText = barIcon ? `![barIcon](${barIcon}#barIcon)` : null

    // @todo use the theme instead
    const bannerText =
      banner && useBanner ? `![banner](${banner}#banner)` : null

    const theme = buildTheme(themeName, themeConfig)

    if (isFramed) {
      window.parent.postMessage(
        {
          type: 'setProperties',

          data: {
            title: barTitle,

            intro: joinTrimmedNotEmpty([barIconText, bannerText, intro]),

            initial,

            placeholder,

            theme,
          },
        },
        '*'
      )

      return
    } else {
      if (status !== 'authenticated') {
        openPopup(
          <p>
            You need to sign in to complete the setup. If you don&apos;t have an
            account, you can get started for free.
          </p>,
          {
            title: 'Sign In To Continue',

            actions: {
              'Sign In': {
                default: true,

                fn: () => {
                  router.push({
                    pathname: '/signin',
                    query: {
                      callbackUrl: getSignInCallbackUrl(),
                    },
                  })
                },
              },
            },
          }
        )

        return
      }

      // @note this is not ideal but it does not work otherwise
      // @todo we might need to set the max value of the db to lower than 255

      const name = stringToDbString(barTitle)
      const description = stringToDbString(data.description?.trim() || '')

      const { error: blueprintError, data: blueprintData } = await fetch(
        `/api/v1/blueprint/create`,
        {
          data: {
            name,
            description,
          },
        }
      )

      if (blueprintError) {
        return
      }

      const { error: datasetError, data: datasetData } = await fetch(
        `/api/v1/dataset/create`,
        {
          data: {
            blueprintId: blueprintData.id,

            name,
            description,
          },
          loadingMessage: 'Creating dataset...',
        }
      )

      if (datasetError) {
        return
      }

      const { error: sitemapError, data: sitemapData } = await fetch(
        `/api/v1/integration/sitemap/create`,
        {
          data: {
            blueprintId: blueprintData.id,

            name,
            description,

            url,

            glob: `${new URL(url).pathname}/**`.replace(/\/+/g, '/'),

            datasetId: datasetData.id,
          },
          loadingMessage: 'Creating sitemap...',
        }
      )

      if (sitemapError) {
        return
      }

      const { error: syncError } = await fetch(
        `/api/v1/integration/sitemap/${sitemapData.id}/sync`,
        {
          data: {},
        }
      )

      if (syncError) {
        return
      }

      const { error: botError, data: botData } = await fetch(
        `/api/v1/bot/create`,
        {
          data: {
            blueprintId: blueprintData.id,

            name,
            description,

            datasetId: datasetData.id,
          },
          loadingMessage: 'Creating bot...',
        }
      )

      if (botError) {
        return
      }

      const { error: widgetError, data: widgetData } = await fetch(
        `/api/v1/integration/widget/create`,
        {
          data: {
            blueprintId: blueprintData.id,

            name,
            description,

            botId: botData.id,

            title: stringToDbString(barTitle),

            intro: joinTrimmedNotEmpty([barIconText, bannerText, intro]),

            initial,

            placeholder,

            theme,
          },
          loadingMessage: 'Creating widget...',
        }
      )

      if (widgetError) {
        return
      }

      router.push(`/integrations/widget/${widgetData.id}`)

      return
    }

    assertUnreachable('Impossible state')
  }

  // @note the preview is ready once its theme is built. When there is a source
  // image we also wait for its color palette so the first paint already carries
  // the brand color - but a failed or absent screenshot must never block the
  // page, otherwise the loader spins forever for any site that blocks
  // screenshots and has no OpenGraph image to fall back on.
  const hasSourceImage = !!(bannerImage || screenshotImage)

  const paletteResolved = !!imageColorPalette || !!imageColorPaletteError

  const isReady =
    Object.keys(themeConfig).length > 0 && (!hasSourceImage || paletteResolved)

  const entryAnimationClassName = useEntryAnimation({
    beforeEnter: 'opacity-0',
    afterEnter: 'opacity-100',

    delay: 500,

    disabled: !isReady,
  })

  return (
    <>
      {/* @note this page had no heading of any level. The design is a
      full-bleed preview canvas with no title area, so the h1 is visually
      hidden - crawlers and assistive tech get a document heading without
      altering the layout. */}
      <h1 className="sr-only">ChatBotKit AI Widget Preview of {url}</h1>
      {popup}
      <div className="pt-rectangles min-h-screen">
        {isReady ? (
          <div
            className={clsx(
              'mx-auto max-w-6xl flex flex-col justify-center gap-4 p-[5rem]',

              'transition-all duration-300 ease-in-out',

              entryAnimationClassName
            )}
          >
            <div className="p-2" ref={rootRef}>
              <div className="relative group border border-gray-300 rounded-3xl shadow-lg">
                {screenshotImage ? (
                  <img
                    ref={imageRef}
                    className="bg-gray-100 flex-1 w-full h-full min-h-[1000px] max-h-[calc(90vh-2*5rem)] rounded-3xl border-8 border-gray-50 object-left-top object-cover"
                    src={screenshotImage}
                    alt="screenshot"
                  />
                ) : (
                  // @note the screenshot service can fail or be blocked; render
                  // a neutral placeholder in its place so the widget still has a
                  // backdrop to sit on instead of a broken image
                  <div
                    ref={imageRef}
                    className="bg-gray-100 flex-1 w-full h-full min-h-[1000px] max-h-[calc(90vh-2*5rem)] rounded-3xl border-8 border-gray-50"
                  />
                )}
                {brandPrimary ? (
                  <div className="absolute z-10 bottom-6 right-6">
                    <div
                      ref={widgetRef}
                      className="origin-bottom-right"
                      style={{
                        backfaceVisibility: 'hidden',

                        transform: `scale(${Math.min(
                          (imageWidth / widgetWidth) * 0.699,
                          (imageHeight / widgetHeight) * 0.698
                        )})`,

                        'will-change': 'transform',
                      }}
                    >
                      <div>
                        <WidgetPreview
                          className="w-[400px] h-[800px]"
                          barIcon={barIcon}
                          barTitle={barTitle}
                          banner={useBanner ? banner : null}
                          intro={intro}
                          initial={initial}
                          messages={messages}
                          placeholder={placeholder}
                          theme={themeConfig}
                          interactive={true}
                          poweredBy={false}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            {isFullScreen ? null : (
              <div className="sticky z-20 bottom-10 p-2 bg-gray-50 rounded-xl border border-gray-300 shadow-lg max-w-5xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-4">
                <div className="relative group/tooltip">
                  <div className="flex flex-wrap gap-2">
                    {imageColorPalette?.map((color, index) => (
                      <div
                        key={index}
                        className={clsx(
                          'w-8 h-8 rounded-full border-4 border-white cursor-pointer transition-all duration-300 ease-in-out hover:scale-110 hover:border-gray-300 hover:shadow-lg',
                          {
                            '!border-gray-300': color === brandPrimary,
                          }
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          setBrandPrimary(color)
                          setBrandText(blackOrWhite(color))
                        }}
                      />
                    ))}
                    <div className="w-8 h-8 border-4 border-white cursor-pointer transition-all duration-300 ease-in-out hover:scale-110 hover:border-gray-300 hover:shadow-lg">
                      <input
                        className="w-full cursor-pointer"
                        type="color"
                        value={brandPrimary}
                        onChange={(e) => setBrandPrimary(e.target.value)}
                      />
                    </div>
                    <div className="w-8 h-8 border-4 border-white cursor-pointer transition-all duration-300 ease-in-out hover:scale-110 hover:border-gray-300 hover:shadow-lg">
                      <input
                        className="w-full cursor-pointer"
                        type="color"
                        value={brandText}
                        onChange={(e) => setBrandText(e.target.value)}
                      />
                    </div>
                  </div>
                  <span className="tooltip below">Brand Color</span>
                </div>
                <div className="flex flex-row gap-2">
                  <div className="relative group/tooltip flex items-center">
                    <Toggle checked={useBar} setChecked={setUseBar} />
                    <span className="tooltip below">Bar</span>
                  </div>
                  <div className="relative group/tooltip flex items-center">
                    <Toggle checked={useBanner} setChecked={setUseBanner} />
                    <span className="tooltip below">Banner</span>
                  </div>
                  <div className="relative group/tooltip flex items-center">
                    <Toggle checked={useBubble} setChecked={setUseBubble} />
                    <span className="tooltip below">Bubble</span>
                  </div>
                  <div className="relative group/tooltip flex items-center">
                    <Toggle checked={useRounded} setChecked={setUseRounded} />
                    <span className="tooltip below">Rounded</span>
                  </div>
                  <div className="relative group/tooltip flex items-center">
                    <Toggle checked={useGlow} setChecked={setUseGlow} />
                    <span className="tooltip below">Glow</span>
                  </div>
                </div>
                <div className="space-x-2">
                  {commit ? (
                    <>
                      <button
                        className="primary-button"
                        type="button"
                        onClick={handleCommit}
                        disabled={loading}
                      >
                        Commit
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="relative group/tooltip">
                        <button
                          className="primary-button"
                          type="button"
                          onClick={handleBuild}
                          disabled={loading}
                        >
                          {isFramed ? 'Use' : 'Make'}
                        </button>
                        <span className="tooltip above -mt-2 w-64">
                          You can apply further customization after the widget
                          is created.
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="absolute top-0 left-0 w-full h-full flex justify-center items-center">
            <div className="flex flex-col gap-4 bg-gray-50 border border-gray-300 p-5 rounded-xl shadow-lg">
              <DotsLoader />
              <p className="text-sm font-semibold">
                Creating your unique AI experience...
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

Preview.getLayout = function (children, { url }) {
  return (
    <>
      <Meta
        title={`ChatBotKit AI Widget Preview of ${url}`}
        description="If you want to build an AI chatbot for your website, you can use ChatBotKit. It's a powerful and easy-to-use tool that allows you to create a chatbot for your website in minutes."
        keywords="chatbot, chatbot widget, chatbot for website, chatbot ai, chatbot builder, chatbot platform, chatbot integration, chatbot plugin, chatbot software, chatbot tool, chatbot service, chatbot solution, chatbot app, chatbot development, chatbot framework, chatbot library, chatbot sdk, chatbot api, chatbot code, chatbot script"
        image={`/widgets/preview/card/${url.replace(/^https?:\/\//, '')}`}
      />
      <Head>
        <link
          rel="preload"
          href={`/widgets/preview/card/${url.replace(/^https?:\/\//, '')}`}
          as="image"
        />
      </Head>
      {children}
    </>
  )
}

Preview.theme = 'light'

export async function getServerSideProps(context) {
  return executeInContext(async () => {
    setupRequestContext(context.req)

    // @todo return an error page that describes the error rather than a 404

    const urlParts = context.query.url

    if (!Array.isArray(urlParts)) {
      return {
        notFound: true,
      }
    }

    let capture = false

    if (urlParts[0] === 'capture') {
      capture = true

      urlParts.shift()
    }

    let screenshot = false

    if (urlParts[0] === 'screenshot') {
      screenshot = true

      urlParts.shift()
    }

    let card = false

    if (urlParts[0] === 'card') {
      card = true

      urlParts.shift()
    }

    let commit = false

    if (urlParts[0] === 'commit') {
      commit = true

      urlParts.shift()
    }

    const frontendHost =
      getContextFrontendHost() || getContextRequestHost() || siteHostname

    if (capture) {
      const url = new URL(
        context.resolvedUrl.replace('/capture/', '/'),
        `https://${frontendHost}`
      )

      url.searchParams.set('layout', 'fullscreen')

      return {
        redirect: {
          destination: makeScreenshot(url.toString(), {
            format: 'jpeg',
            waitUntil: 'networkidle0',
            timeout: 20_000,
            delay: 1_000,
          }),
          permanent: false,
        },
      }
    }

    if (screenshot) {
      const url = new URL(
        context.resolvedUrl.replace('/screenshot/', '/'),
        `https://${frontendHost}`
      )

      url.searchParams.set('layout', 'fullscreen')

      return {
        redirect: {
          destination: makeScreenshot(url.toString(), {
            format: 'png',
            waitUntil: 'networkidle0',
            timeout: 20_000,
            delay: 1_000,
          }),
          permanent: false,
        },
      }
    }

    if (card) {
      const url = new URL(
        context.resolvedUrl.replace('/card/', '/'),
        `https://${frontendHost}`
      )

      url.searchParams.set('layout', 'default')

      return {
        redirect: {
          destination: makeScreenshot(url.toString(), {
            format: 'png',
            waitUntil: 'networkidle0',
            timeout: 20_000,
            delay: 1_000,
          }),
          permanent: false,
        },
      }
    }

    let url = urlParts.join('/')

    url = url.replace(/^(https?):?\/+/, '$1://').trim()

    if (!url) {
      return {
        notFound: true,
      }
    }

    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`
    }

    if (!isURL(url)) {
      return {
        notFound: true, // @todo maybe send them to an error page
      }
    }

    if (isProduction) {
      applyCacheHeaders(context.res, CACHE_PRESETS.CARD)
    }

    let data

    try {
      debug(`unfurl data`, { data })

      const meta = await unfurlPage(url)

      data = meta.data
    } catch {
      data = {}
    }

    try {
      const { url: screenshotUrl, headers: screenshotHeaders } =
        makeScreenshotRequest(url, {
          format: 'jpeg',
          viewportWidth: 990,
          imageQuality: 80,
          cacheTtl: 14400,
          timeout: 60_000,
          block: true,
          metadata: true,
        })

      const response = await fetch(screenshotUrl, {
        headers: screenshotHeaders,
      })

      let screenshotImage

      if (!response.ok) {
        debug('Screenshot service error', {
          status: response.status,
          url,
        }).log('landing.widgets.preview')

        // @note use placeholder for failed screenshots instead of throwing

        screenshotImage = null
      } else {
        screenshotImage = await responseToDataUrl(response)
      }

      const { title, icon, fonts, openGraph } = readScreenshotMetadata(
        response.headers
      )

      data.title ??= title
      data.icon ??= icon
      data.fonts ??= fonts

      data.title ??= openGraph?.title
      data.description ??= openGraph?.description
      data.image ??= openGraph?.image

      if (data.description?.length < 180) {
        delete data.description
      }

      if (isDataURL(data.icon)) {
        delete data.icon
      }

      if (isDataURL(data.image)) {
        delete data.image
      }

      let bannerImage

      try {
        bannerImage = await fetchDataUrl(data.image)
      } catch {
        delete data.image
      }

      return {
        props: makeJsonSafe({
          commit,

          url,

          screenshotImage,
          bannerImage,

          data,

          brandPrimary: context.query.brandPrimary || null,
          brandText: context.query.brandText || null,

          bar:
            typeof context.query.bar !== 'undefined'
              ? context.query.bar === 'true'
              : true,

          banner:
            typeof context.query.banner !== 'undefined'
              ? context.query.banner === 'true'
              : true,

          bubble:
            typeof context.query.bubble !== 'undefined'
              ? context.query.bubble === 'true'
              : true,

          rounded:
            typeof context.query.rounded !== 'undefined'
              ? context.query.rounded === 'true'
              : true,

          glow:
            typeof context.query.glow !== 'undefined'
              ? context.query.glow === 'true'
              : false,

          layout: context.query.layout || null,

          demo:
            demos[context.query.demo] ||
            Object.values(demos).find(({ keywords }) => {
              return keywords?.some((keyword) => {
                return (
                  data.title?.toLowerCase().includes(keyword.toLowerCase()) ||
                  data.description
                    ?.toLowerCase()
                    .includes(keyword.toLowerCase())
                )
              })
            }) ||
            demos.default,
        }),
      }
    } catch (e) {
      await captureException(e)

      return {
        notFound: true,
      }
    }
  })
}
