import 'katex/dist/katex.min.css'

import {
  Children,
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import {
  LuPaperclip as AttachmentIcon,
  LuChevronDown as ButtonDownIcon,
  LuCheck as CheckIcon,
  LuX as CloseIcon,
  LuCopy as CopyIcon,
  LuArrowDown as DownIcon,
  LuDownload as DownloadIcon,
  LuArrowUpLeft as MaximizeIcon,
  LuEllipsis as MenuIcon,
  LuMic as MicIcon,
  LuMicOff as MicMuteIcon,
  LuArrowDownRight as MinimizeIcon,
  LuPlay as PlayIcon,
  LuSend as SendIcon,
  LuSquare as StopIcon,
  LuThumbsDown as ThumbDownIcon,
  LuThumbsUp as ThumbUpIcon,
} from 'react-icons/lu'
import ReactMarkdown from 'react-markdown'
import { useResizeDetector } from 'react-resize-detector'

import { getStartOfDay, getStartOfNextDay } from '@chatbotkit-dev/time'

import messagesConfig from '@/config/messages'

import demos from '@/data/demos.yaml'

import prisma from '@/prisma/client'

import { humanizeActionName } from '@/lib/action.label'
import { logAnalyticsEvent } from '@/lib/analytics'
import { getLast } from '@/lib/array'
import { encode as encodeB64 } from '@/lib/b64'
import { firstBoolLike } from '@/lib/bool'
import {
  getLocalStorage,
  getLocalStorageWithExpiry,
} from '@/lib/browserstorage'
import { CACHE_PRESETS, applyCacheHeaders } from '@/lib/cdn'
import { isOpaqueColor, legibleTextColor } from '@/lib/color2'
import { accessVar } from '@/lib/css.var'
import { looksLikeEmail } from '@/lib/email.validation'
import { isDevelopment } from '@/lib/env'
import { SystemError, captureError } from '@/lib/error'
import fetch from '@/lib/fetch'
import { formToData } from '@/lib/form'
import { getHighlighter, highlight } from '@/lib/highlighter'
import { tryParse } from '@/lib/json'
import { tokenIsFresh } from '@/lib/jwt'
import { fixLaTeXSyntax } from '@/lib/latex'
import { splitBubbleText } from '@/lib/md.chat'
import { extractImagesFromMarkdown } from '@/lib/md.extract'
import { getAccept } from '@/lib/mime'
import { equal, merge, pick } from '@/lib/object'
import { sleep } from '@/lib/promise'
import { isComponent } from '@/lib/react'
import { captureUnknownError, isUnknownError } from '@/lib/response'
import { textToEmojiSpans, wordsToSpans } from '@/lib/rehype.plugins'
import { saveBlob, saveUrl } from '@/lib/save'
import { buildOriginRestrictedCsp } from '@/lib/security.headers'
import { anyString, byteSlice, getRandomId, toPascalCase } from '@/lib/string'
import { makeJsonSafe } from '@/lib/struct'
import { defaultTheme, parseTheme } from '@/lib/theme'
import { tryHashQuery } from '@/lib/url'
import { canDisablePoweredBy, getPoweredByDetails } from '@/lib/widget'
import yaml from '@/lib/yaml'
import { getYoutubeEmbedUrl, getYoutubeId, isYoutubeUrl } from '@/lib/youtube'

import AttachmentsArea from '@/components/AttachmentsArea'
import AutoScrollArea, { AutoScrollStop } from '@/components/AutoScrollArea'
import AutoTextarea from '@/components/AutoTextarea'
import GoodCarousel from '@/components/Carousel'
import Collapsible from '@/components/Collapsible'
import Component from '@/components/Component'
import Diagram from '@/components/Diagram'
import DotsLoader, { DOT } from '@/components/DotsLoader'
import DynamicIcon, { dynamicIconToUrl } from '@/components/DynamicIcon'
import Emoji from '@/components/Emoji'
import InputArea from '@/components/InputArea'
import Meta from '@/components/Meta'
import NoRubberBand from '@/components/NoRubberBand'
import NoSsr from '@/components/NoSsr'
import PortalTarget from '@/components/PortalTarget'
import ReadyFrame from '@/components/ReadyFrame'
import ReadyImage from '@/components/ReadyImage'
import ReloadingPageErrorBoundary from '@/components/ReloadingPageErrorBoundary'
import SilencingErrorBoundary from '@/components/SilencingErrorBoundary'
import SpaceSavingDiv from '@/components/SpaceSavingDiv'

import useAutoRevert from '@/hooks/useAutoRevert'
import useAwaitableComponent from '@/hooks/useAwaitableComponent'
import useClassNameOnNewElements from '@/hooks/useClassNameOnNewElements'
import useConversationManager from '@/hooks/useConversationManager2'
import useDOMQuerySelector from '@/hooks/useDOMQuerySelector'
import useDebounce from '@/hooks/useDebounce'
import useDropzone from '@/hooks/useDropzone'
import useEntryAnimation from '@/hooks/useEntryAnimation'
import useExternalFrontendURL from '@/hooks/useExternalFrontendURL'
import useFetch from '@/hooks/useFetch'
import useFormElementAutoTools from '@/hooks/useFormElementAutoTools'
import useFunctionDispatch from '@/hooks/useFunctionDispatch'
import useIsMounted from '@/hooks/useIsMounted'
import useIsScrolled from '@/hooks/useIsScrolled'
import usePostMessageHandler from '@/hooks/usePostMessageHandler'
import usePrevious from '@/hooks/usePrevious'
import useScrollSaveRestore from '@/hooks/useScrollSaveRestore'
import useTimeout from '@/hooks/useTimeout'

import WidgetIcon from '@/icons/widget.svg'
import { getLanguageMap } from '@/pages/api/v1/integration/widget/[widgetIntegrationId]/setup'

import { Menu as HeadlessMenu } from '@headlessui/react'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PlayCircleIcon,
} from '@heroicons/react/24/outline'

import clsx from 'clsx'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

/*****************************************
 * SECTION: Defaults
 *****************************************/

export const DEFAULT_POPOVER_WIDTH = '420px'
export const DEFAULT_POPOVER_HEIGHT = '860px'

export const DEFAULT_POPOUT_WIDTH = '680px'
export const DEFAULT_POPOUT_HEIGHT = '680px'

// @note 32KB is a sensible limit for widget messages - half of the DB max (65KB)
export const DEFAULT_MAX_MESSAGE_TEXT_BYTE_LENGTH = 32 * 1024

/*****************************************
 * SECTION: Contexts
 *****************************************/

export const ConversationContext = createContext({})

export const IntlContext = createContext({})

export const ConfigContext = createContext({})

export const ThemeContext = createContext({})

export const ResizeContext = createContext({})

export const ModalContext = createContext({})

export const StateContext = createContext({})

/*****************************************
 * SECTION: Contexts
 *****************************************/

export function useConfigContextValues(incomingValues) {
  const config = useContext(ConfigContext)

  return useMemo(() => {
    return merge(config, incomingValues)
  }, [incomingValues, config])
}

/*****************************************
 * SECTION: helpers
 *****************************************/

/**
 * Post a message to the parent window.
 *
 * @note accessing window.parent can throw SecurityError in cross-origin iframe
 * on Safari/iOS when third-party cookies are blocked or the iframe is in a
 * restricted context
 *
 * @param {object} message
 */
export function postToParent(message) {
  try {
    window.parent?.postMessage(message, '*')
  } catch {
    // @note SecurityError thrown in cross-origin iframe on Safari/iOS - silently ignore
  }
}

/**
 * Post a message to self window.
 *
 * @param {object} message
 */
function postToSelf(message) {
  window.postMessage(message)
}

/**
 * Checks if a message event is from a trusted source (same window or parent).
 *
 * @note accessing window.parent can throw SecurityError in cross-origin iframe
 * on Safari/iOS when third-party cookies are blocked or the iframe is in a
 * restricted context
 *
 * @param {MessageEvent} event
 * @returns {boolean}
 */
export function isSafeMessageEvent(event) {
  if (event.source === window) {
    return true
  }

  try {
    return event.source === window.parent
  } catch {
    // @note SecurityError thrown in cross-origin iframe on Safari/iOS

    return false
  }
}

/**
 * Detect whether a User-Agent string looks like a mobile device.
 *
 * @param {string} [userAgent]
 * @returns {boolean}
 */
export function isMobileUserAgent(userAgent = '') {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    userAgent
  )
}

/*****************************************
 * SECTION: hooks
 *****************************************/

/**
 * @param {string} _href
 * @returns {string}
 */
function useHrefAndTarget(_href) {
  const { origin } = useContext(ConfigContext)

  const href = useMemo(() => {
    if (/^(https?:)?\/\//.test(_href)) {
      return _href.replace(/^\/\//, 'https://')
    } else {
      try {
        return URL(_href, origin).href
      } catch {
        return _href
      }
    }
  }, [_href, origin])

  const target = useMemo(() => {
    if (/^(https?:)?\/\//.test(href)) {
      const hashQuery = tryHashQuery(href) || new URLSearchParams()

      if (hashQuery.has('target')) {
        return hashQuery.get('target')
      } else {
        try {
          if (new URL(href).origin === origin) {
            return '_top'
          } else {
            return '_blank'
          }
        } catch {
          return '_blank'
        }
      }
    } else {
      return '_top'
    }
  }, [href, origin])

  return { href, target }
}

/**
 * @param {function} handler
 * @param {any[]} deps
 */
function useFunctionHandler(handler, deps, name) {
  const stableName = useMemo(() => {
    const n = handler.name || name

    if (!n) {
      throw new Error(`Handler must have a name`)
    }

    return n
  }, [handler, name])

  const stableHandler =
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useCallback(handler, deps)

  const idempotentMap = useRef(new Set())

  useEffect(
    () => {
      async function onMessage(event) {
        if (!isSafeMessageEvent(event)) {
          return
        }

        switch (event.data.type) {
          case stableName: {
            if ('id' in event.data && event.data.id) {
              if (idempotentMap.current.has(event.data.id)) {
                return
              }
            }

            try {
              await handler(event.data.props)
            } catch (e) {
              // @note prevent unhandled rejection from propagating to global
              // handler

              await captureUnknownError(e)
            }

            if ('id' in event.data && event.data.id) {
              idempotentMap.current.add(event.data.id)
            }

            break
          }
        }
      }

      window.addEventListener('message', onMessage)

      return () => {
        window.removeEventListener('message', onMessage)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stableName, stableHandler, ...deps]
  )
}

/*****************************************
 * SECTION: Elements
 *****************************************/

export function Carousel({ className, children, isLast: _isLast, ...props }) {
  const items = useMemo(() => {
    let items = yaml.tryParse(children) || []

    // if not array then set to empty array

    if (!Array.isArray(items)) {
      items = []
    }

    // filter out none-items

    items = items.filter(Boolean)

    // filter out items without title, description, and image

    items = items.filter(
      (item) => !!item.title || !!item.description || !!item.image
    )

    // correct item buttons

    items = items.map((item) => {
      // if not array then set to empty array

      if (!Array.isArray(item.buttons)) {
        item.buttons = []
      }

      // filter out buttons without caption

      item.buttons = item.buttons.filter((button) => !!button.caption)

      // return

      return item
    })

    // return

    return items
  }, [children])

  const paddedItems = useMemo(() => {
    // if the items is less than 3 then pad it with empty items up to 3

    return new Array(Math.max(0, 3 - items.length) + 1).fill({}).slice(1)
  }, [items])

  const hasEnoughItemsToScroll = items.length > 1

  return items.length ? (
    <GoodCarousel
      {...props}
      className={clsx(
        'carousel w-full h-[400px]',
        {
          '!overflow-hidden': !hasEnoughItemsToScroll,
        },
        className
      )}
    >
      {hasEnoughItemsToScroll ? (
        <GoodCarousel.Button
          className="cursor-pointer select-none	bg-gray-500/10 w-10 h-10 flex flex-col justify-center items-center"
          position="left"
        >
          <ArrowLeftIcon className="w-[50%] h-[50%] fill-current" />
        </GoodCarousel.Button>
      ) : null}
      {items.map((item, index) => {
        return (
          <GoodCarousel.Item
            {...item}
            key={index}
            className="w-[200px] [&_.carousel-content]:w-[200px] border rounded-lg text-sm"
            buttonAs={({ href, link = href, children }) =>
              link ? (
                <ExternalButton
                  className="whitespace-nowrap overflow-hidden text-ellipsis"
                  href={link}
                >
                  {children}
                </ExternalButton>
              ) : (
                <PostMessageButton className="whitespace-nowrap overflow-hidden text-ellipsis">
                  {children}
                </PostMessageButton>
              )
            }
          />
        )
      })}
      {paddedItems.map((item, index) => {
        return (
          <GoodCarousel.Item
            {...item}
            key={index}
            className="w-[200px] border rounded-lg text-sm"
          />
        )
      })}
      {hasEnoughItemsToScroll ? (
        <GoodCarousel.Button
          className="cursor-pointer select-none	bg-gray-500/10 w-10 h-10 flex flex-col justify-center items-center"
          position="right"
        >
          <ArrowRightIcon className="w-[50%] h-[50%] fill-current" />
        </GoodCarousel.Button>
      ) : null}
    </GoodCarousel>
  ) : null
}

export function Form({ className, children, isLast, ...props }) {
  const [_method, _url, fields] = useMemo(() => {
    let { method, url, fields } = yaml.tryParse(children) || {}

    // if not method or method is not a string then set to POST

    if (typeof method !== 'string' || !method) {
      method = 'POST'
    } else {
      method = method.toUpperCase().trim()
    }

    // if not url or url is not a string then set to empty string

    if (typeof url !== 'string') {
      url = ''
    } else {
      url = url.trim()
    }

    // if not fields or fields is not an object then set to empty object

    if (typeof fields !== 'object' || !fields) {
      fields = []
    } else {
      fields = Object.entries(fields).map(([name, field]) => {
        // if not field or field is not an object then set to empty object

        if (typeof field !== 'object' || !field) {
          if (typeof field === 'string') {
            field = {
              type: field,
            }
          } else {
            field = {}
          }
        } else {
          field = { ...field }
        }

        // if not field type or field type is not a string then set to text

        if (typeof field.type !== 'string' || !field.type) {
          field.type = 'text'
        } else {
          field.type = field.type.toLowerCase().trim()
        }

        // if there are options and options is not an object then set to empty object

        if (field.options) {
          if (typeof field.options !== 'object') {
            if (Array.isArray(field.options)) {
              field.options = Object.fromEntries(
                field.options.map((option) => [option, option])
              )
            } else {
              field.options = {}
            }
          } else {
            field.options = Object.fromEntries(
              Object.entries(field.options || {}).map(([value, label]) => [
                value,
                label,
              ])
            )
          }
        }

        return {
          name,

          ...field,
        }
      })
    }

    // return

    return [method, url, fields]
  }, [children])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [target] = useDOMQuerySelector('#mainInputArea', {
    waitForElements: true,
  })

  function handleOnSubmit(event) {
    event.preventDefault()

    postToSelf({
      type: 'sendMessage',
      props: {
        message: yaml.stringify(formToData(event.target)),
        hidden: true,
        respond: true,
      },
    })
  }

  return isLast
    ? target
      ? createPortal(
          <TextAreaLike
            {...props}
            className={clsx('form', 'relative', className)}
          >
            <form className="relative" onSubmit={handleOnSubmit}>
              {fields.map(({ name, type, options, placeholder }) => {
                if (options) {
                  return (
                    <SegmentSelect key={name} name={name}>
                      {Object.entries(options).map(([value, label]) => {
                        return (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        )
                      })}
                    </SegmentSelect>
                  )
                } else {
                  return (
                    <SegmentInput
                      key={name}
                      name={name}
                      type={type}
                      placeholder={placeholder || name}
                    />
                  )
                }
              })}
              <Send className="absolute bottom-3 right-1" type="submit" />
            </form>
          </TextAreaLike>,
          target
        )
      : null
    : '...'
}

export function Card({ className, children, isLast: _isLast, ...props }) {
  const item = useMemo(() => {
    let item = yaml.tryParse(children)

    return item
  }, [children])

  return item ? (
    <div
      {...props}
      className={clsx('card flex flex-col gap-2 not-prose', className)}
    >
      {item.image ? (
        <div>
          <ExternalImage src={item.image} />
        </div>
      ) : null}
      {item.title ? <p className="text-sm font-bold">{item.title}</p> : null}
      {item.description ? (
        <p className="text-sm text-gray-500">{item.description}</p>
      ) : null}
    </div>
  ) : null
}

export function ButtonGroup({
  className,

  children,

  isLast: _isLast,

  ...props
}) {
  const items = useMemo(() => {
    let items = yaml.tryParse(children) || []

    // if not array then set to empty array

    if (!Array.isArray(items)) {
      items = []
    }

    // filter out none-items

    items = items.filter(Boolean)

    // filter out items without caption

    items = items.filter((item) => !!item.caption)

    // normalize

    items = items.map((item) => {
      let href = (item.href || item.link || '').trim()

      if (!/^https?:\/\/|\//.test(href)) {
        href = undefined
      }

      return {
        ...item,

        href: href,
      }
    })

    // return

    return items
  }, [children])

  return items.length ? (
    <div
      {...props}
      className={clsx('buttons flex flex-row flex-wrap gap-2', className)}
    >
      {items.map((item, index) => {
        return (
          <div key={index} className="relative">
            {item.href ? (
              <ExternalButton href={item.href}>{item.caption}</ExternalButton>
            ) : (
              <PostMessageButton>{item.caption}</PostMessageButton>
            )}
          </div>
        )
      })}
    </div>
  ) : null
}

export function CodeBlock({
  className,

  isLast: _isLast,

  language,

  children,

  ...props
}) {
  const { theme } = useContext(ThemeContext)

  const isDark = isLightOnDarkTheme(theme)

  const [isCopied, setIsCopied] = useState(false)

  const [highlightedHtml, setHighlightedHtml] = useState('')

  useEffect(() => {
    if (!isCopied) {
      return
    }

    const timeout = setTimeout(() => {
      setIsCopied(false)
    }, 2000)

    return () => {
      clearTimeout(timeout)
    }
  }, [isCopied])

  let resolvedLanguage = language

  if (resolvedLanguage === 'plain') {
    switch (true) {
      case children?.startsWith?.('GET'):
      case children?.startsWith?.('POST'):
      case children?.startsWith?.('PUT'):
      case children?.startsWith?.('DELETE'):
      case children?.startsWith?.('HTTP/1.1'): {
        resolvedLanguage = 'http'

        break
      }
    }
  }

  useEffect(() => {
    if (!children) {
      return
    }

    let cancelled = false

    getHighlighter().then(async (highlighter) => {
      if (cancelled) {
        return
      }

      const html = await highlight({
        highlighter,
        code: children,
        lang: resolvedLanguage || 'text',
        theme: isDark ? 'dark' : 'light',
      })

      if (!cancelled) {
        setHighlightedHtml(html)
      }
    })

    return () => {
      cancelled = true
    }
  }, [children, resolvedLanguage, isDark])

  async function handleCopy() {
    try {
      await window.navigator?.clipboard?.writeText(children)

      setIsCopied(true)
    } catch {
      // @note clipboard API may be blocked by permissions policy in cross-origin iframes
    }
  }

  return (
    <div
      className={clsx(
        'codeblock',

        'relative block overflow-hidden not-prose !p-0 !m-0',

        'rounded', // @todo make it customizable

        className
      )}
    >
      <div className="[&_pre]:!m-0 [&_pre]:!p-4 [&_.line]:whitespace-pre-wrap [&_.line]:break-words">
        {highlightedHtml ? (
          <div dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        ) : (
          <pre
            className={clsx(
              'p-4 !m-0',
              isDark ? 'text-gray-300' : 'text-gray-700'
            )}
          >
            <code>{children}</code>
          </pre>
        )}
      </div>
      <div
        className="absolute top-2 right-2 text-gray-500 hover:text-gray-100 cursor-pointer"
        onClick={handleCopy}
      >
        {isCopied ? <CheckIcon /> : <CopyIcon />}
      </div>
    </div>
  )
}

/*****************************************
 * SECTION: External
 *****************************************/

/**
 * @todo maybe render popup icon
 */
export function ExternalLink({ className, href: _href, ...props }) {
  const clsxName = clsx('external-link', 'link', className)

  const { href, target } = useHrefAndTarget(_href)

  // @note because the frame is supposed to be embedded, it is ok and in fact
  // recommended to use a tags instead of the Link component - not only it is
  // safer but also more performant because it does not need to load many
  // dependencies.

  return (
    <a
      {...props}
      className={clsxName}
      href={href}
      target={target}
      onClick={
        target === '_popup'
          ? (event) => {
              event.preventDefault()

              try {
                window.open(
                  href,
                  '_blank',
                  'noreferrer,noopener,width=600,height=400,resizable=yes,scrollbars=yes'
                )
              } catch {
                // @note window.open may fail in sandboxed iframe without allow-popups
              }
            }
          : undefined
      }
      rel="noreferrer noopener"
    />
  )
}

/**
 *
 */
export function ExternalButton({ className, href: _href, ...props }) {
  const { href, target } = useHrefAndTarget(_href)

  function handleClick(event) {
    event.preventDefault()

    try {
      window.open(href, target, 'noreferrer,noopener')
    } catch {
      // @note window.open may fail in sandboxed iframe without allow-popups
    }
  }

  return (
    <button
      {...props}
      className={clsx('external-button', 'button', className)}
      type="button"
      onClick={handleClick}
    />
  )
}

/**
 *
 */
export function ExternalImage({
  className,

  src: _src,

  download,

  onReady,

  ...props
}) {
  const { href: src } = useHrefAndTarget(_src)

  const isBanner = useMemo(() => {
    try {
      const url = new URL(src, 'http://dummy')

      return url.hash === '#banner'
    } catch {
      return false
    }
  }, [src])

  const showDownload = useMemo(() => {
    return download && !isBanner
  }, [download, isBanner])

  // @note we use span because images are inline elements by default and use of
  // div cannot technically appear inside a <p> tag

  return (
    <span className={clsx('relative inline-block')}>
      <ReadyImage
        alt="image"
        {...props}
        className={clsx('external-image', 'image', 'block', className)}
        notReadyClassName="opacity-0 blur-sm"
        readyClassName="opacity-100 blur-none transition-all duration-300"
        src={src}
        referrerPolicy="no-referrer" // @note use this is essential to allow use of hotlinked images
        onReady={onReady}
      />
      {showDownload ? (
        <span className={clsx('absolute top-2 right-2', 'flex flex-row gap-2')}>
          <DownloadIcon
            className={clsx(
              'cursor-pointer',
              'sepia',
              'text-gray-500 hover:text-gray-100',
              'w-4 h-4',
              'transition-all duration-300'
            )}
            onClick={() => {
              saveUrl(src)
            }}
          />
        </span>
      ) : null}
    </span>
  )
}

/**
 *
 */
export function ExternalFrame({
  className,

  src: _src,

  onReady,

  ...props
}) {
  const entryAnimationClassName = useEntryAnimation({
    beforeEnter: 'opacity-0',
    afterEnter: 'opacity-100',
  })

  const { href: src } = useHrefAndTarget(_src)

  return (
    <ReadyFrame
      title="frame"
      {...props}
      className={clsx(
        'external-frame',

        'frame',

        'bg-white', // @todo set the bg color according to the theme

        'transition-all ease-in-out duration-200',

        entryAnimationClassName,

        className
      )}
      src={src}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      onReady={() => {
        if (onReady) {
          onReady()
        }
      }}
    />
  )
}

/**
 *
 */
export function ExternalObject({
  src,
  title,
  image,

  download,

  onReady,

  ...props
}) {
  if (isYoutubeUrl(src)) {
    const id = getYoutubeId(src)

    if (id) {
      src = getYoutubeEmbedUrl(id, {
        rel: false,
      })
    }

    return (
      <ExternalFrame
        {...props}
        src={src}
        title={title}
        onReady={onReady}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    )
  } else if (image) {
    return (
      <ExternalLink href={src}>
        <ExternalImage
          {...props}
          src={image}
          alt={title}
          download={download}
          onReady={onReady}
        />
      </ExternalLink>
    )
  } else {
    return (
      <ExternalImage
        {...props}
        src={src}
        alt={title}
        download={download}
        onReady={onReady}
      />
    )
  }
}

/*****************************************
 * SECTION: Buttons
 *****************************************/

/**
 *
 */
export function PostMessageButton({ className, children, ...props }) {
  const { disabled } = useContext(ConversationContext)

  const ref = useRef()

  function handleClick(event) {
    event.preventDefault()

    if (disabled) {
      return
    }

    const message = ref?.current?.innerText

    if (!message) {
      return
    }

    postToSelf({
      type: 'sendMessage',
      props: {
        message: message,
        respond: true,
      },
    })
  }

  return (
    <button
      {...props}
      className={clsx('post-message-button', className)}
      type="button"
      onClick={handleClick}
      ref={ref}
    >
      {children}
    </button>
  )
}

/**
 *
 */
export function OpenFrameButton({ className, children, href, ...props }) {
  const { disabled } = useContext(ConversationContext)

  const ref = useRef()

  function handleClick(event) {
    event.preventDefault()

    if (disabled) {
      return
    }

    const message = ref?.current?.innerText

    if (!message) {
      return
    }

    postToSelf({
      type: 'render',
      props: {
        frame: {
          src: href,
        },
      },
    })
  }

  return (
    <button
      {...props}
      className={clsx('post-message-button', className)}
      type="button"
      onClick={handleClick}
      ref={ref}
    >
      {children}
    </button>
  )
}

/*****************************************
 * SECTION: Session Management
 *****************************************/

export const sessionItemPrefix = 'session-'

/**
 *
 */
export function getSessionItemKey(session, key) {
  return `${sessionItemPrefix}${session}-${key}`
}

/**
 *
 */
export function getSessionItemValue(session, key) {
  const localStorage = getLocalStorage()

  const sessionItemKey = getSessionItemKey(session, key)

  const json = localStorage.getItem(sessionItemKey)

  if (!json) {
    return
  }

  const { value, expiresAt } = tryParse(json) || {}

  if ((new Date(expiresAt).getTime() || 0) <= Date.now()) {
    localStorage.removeItem(sessionItemKey)

    return
  }

  return value
}

/**
 *
 */
export function setSessionItemValue(session, key, value, expiresAt) {
  if (!expiresAt) {
    expiresAt = getStartOfNextDay().getTime()
  }

  const localStorage = getLocalStorage()

  const sessionItemKey = getSessionItemKey(session, key)

  const json = JSON.stringify({ value, expiresAt })

  if (localStorage.getItem(sessionItemKey) === json) {
    return
  }

  localStorage.setItem(sessionItemKey, json)
}

/**
 *
 */
export function getSessionItemExpiry(session, key) {
  const localStorage = getLocalStorage()

  const sessionItemKey = getSessionItemKey(session, key)

  const json = localStorage.getItem(sessionItemKey)

  if (!json) {
    return
  }

  const { expiresAt } = tryParse(json) || {}

  return new Date(expiresAt)
}

/**
 *
 */
export function setSessionItemExpiry(session, key, expiresAt) {
  const localStorage = getLocalStorage()

  const sessionItemKey = getSessionItemKey(session, key)

  const json = localStorage.getItem(sessionItemKey)

  if (!json) {
    return
  }

  const { value } = tryParse(json) || {}

  setSessionItemValue(session, key, value, expiresAt)
}

/**
 *
 */
export function useSessionChannel({ session }) {
  const [channel, setChannel] = useState()

  useEffect(() => {
    if (!session) {
      return
    }

    if (typeof BroadcastChannel === 'undefined') {
      return
    }

    let channel

    try {
      channel = new BroadcastChannel(getSessionItemKey(session, 'channel'))

      setChannel(channel)
    } catch {
      // @note for some reason BroadcastChannel might be considered an insecure
      // operation thus blocked by the browser, and in those cases we cannot
      // do much but to ignore the error
    }

    return () => {
      channel?.close()
    }
  }, [session])

  return channel
}

/**
 *
 */
export function useSessionCleanup({ session, channel }) {
  const cleanupSession = useCallback(() => {
    if (!session) {
      return
    }

    const localStorage = getLocalStorage()

    // @note use key() iteration for safe cross-origin iframe compatibility

    const keysToClean = []

    for (let i = 0; i < localStorage.length; i++) {
      const name = localStorage.key(i)

      if (name && name.startsWith(getSessionItemKey(session, ''))) {
        keysToClean.push(name)
      }
    }

    keysToClean.forEach((name) => {
      localStorage.removeItem(name)

      try {
        channel?.postMessage({
          type: 'cleanup',
          session: session,
          key: name.slice(getSessionItemKey(session, '').length),
        })
      } catch {
        // @note the channel might be closed
      }
    })
  }, [session, channel])

  // automatically cleanup expired sessions

  useEffect(() => {
    const localStorage = getLocalStorage()

    // @note use key() iteration for safe cross-origin iframe compatibility

    const keysToCheck = []

    for (let i = 0; i < localStorage.length; i++) {
      const name = localStorage.key(i)

      if (name && name.startsWith(sessionItemPrefix)) {
        keysToCheck.push(name)
      }
    }

    keysToCheck.forEach((name) => {
      const value = localStorage.getItem(name)
      const { expiresAt } = tryParse(value) || {}

      if ((new Date(expiresAt).getTime() || 0) <= Date.now()) {
        localStorage.removeItem(name)
      }
    })
  }, [])

  // return a cleanup tool for the specific session

  return cleanupSession
}

/**
 *
 */
export function useSessionSaveRestoreSync(
  {
    session,
    channel,

    key,

    defaultValue,
    value,
    setValue,

    expiresAt,
  },
  changeDetection
) {
  if (!Array.isArray(changeDetection)) {
    changeDetection = [changeDetection]
  }

  // ready

  const [ready, setReady] = useState(false)

  // mounted

  const isMounted = useIsMounted()

  // save

  useEffect(
    () => {
      if (!session) {
        return
      }

      if (!isMounted) {
        return
      }

      setSessionItemValue(session, key, value, expiresAt)
    },

    // eslint-disable-next-line react-hooks/exhaustive-deps
    changeDetection
  )

  // restore

  useEffect(() => {
    if (!session) {
      return
    }

    const restoredValue = getSessionItemValue(session, key)

    // @note deliberately using != to catch nul and undefined

    if (restoredValue != null) {
      setValue(restoredValue)
    }

    setReady(true)
  }, [key, session, setValue])

  // syncing up

  useEffect(
    () => {
      try {
        channel?.postMessage({ type: 'sync', session, key, value })
      } catch {
        // @note the channel might be closed
      }
    },

    // eslint-disable-next-line react-hooks/exhaustive-deps
    changeDetection
  )

  // syncing down

  useEffect(() => {
    function onMessage(event) {
      if (!isSafeMessageEvent(event)) {
        return
      }

      if (event.data.session !== session) {
        return
      }

      if (event.data.key !== key) {
        return
      }

      switch (event.data.type) {
        case 'sync': {
          setValue(event.data.value)

          break
        }

        case 'cleanup': {
          if (defaultValue !== undefined) {
            setValue(defaultValue)
          }

          break
        }
      }
    }

    channel?.addEventListener('message', onMessage)

    return () => {
      channel?.removeEventListener('message', onMessage)
    }
  }, [session, channel, key, defaultValue, setValue])

  // return

  return ready
}

/*****************************************
 * SECTION: Attachments
 *****************************************/

/**
 * @todo probably it is better to return functions instead of objects
 */
export function useAttachmentsManager({ attachments, setAttachments }) {
  const { attachments: isAttachmentsEnabled } = useContext(ConfigContext)

  const { getRootProps, getInputProps, open } = useDropzone({
    noKeyboard: true,

    accept: getAccept([
      '.png',
      '.jpg',
      '.md',
      '.txt',
      '.pdf',
      '.docx',
      '.pptx',
      '.xlsx',
      '.csv',
      '.json',
      '.yaml',
      '.html',
    ]),

    onDropAccepted: async (acceptedFiles) => {
      setAttachments([...attachments, ...acceptedFiles])
    },
  })

  const [rootProps, inputProps, selectAttachments] = useMemo(() => {
    if (isAttachmentsEnabled) {
      const { onClick: _onClick, ...rootProps } = getRootProps()
      const { ...inputProps } = getInputProps()

      return [rootProps, inputProps, open]
    } else {
      return [{}, { type: 'hidden' }, () => {}]
    }
  }, [isAttachmentsEnabled, getRootProps, getInputProps, open])

  const attachmentArea = useMemo(() => {
    return isAttachmentsEnabled && attachments.length > 0 ? (
      <AttachmentsArea
        className="p-2"
        attachments={attachments}
        setAttachments={setAttachments}
      />
    ) : null
  }, [isAttachmentsEnabled, attachments, setAttachments])

  const attachmentButton = useMemo(() => {
    return isAttachmentsEnabled ? (
      <>
        <input {...inputProps} />
        <Attach onClick={selectAttachments} />{' '}
      </>
    ) : null
  }, [isAttachmentsEnabled, inputProps, selectAttachments])

  return {
    rootProps,

    selectAttachments,

    attachmentArea,

    attachmentButton,
  }
}

/*****************************************
 * SECTION: Speech
 *****************************************/

/**
 * @todo probably it is better to return functions instead of objects
 */

export function useSpeechManager({ setText, sendText }) {
  const { voiceIn } = useContext(ConfigContext)

  const [isSupported, setIsSupported] = useState(false)

  const [recognition, setRecognition] = useState(null)

  const [isRecognizing, setIsRecognizing] = useState(false)

  useEffect(() => {
    if (!voiceIn) {
      return
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      return
    }

    setIsSupported(true)

    const speechRecognition = new SpeechRecognition()

    speechRecognition.continuous = true
    speechRecognition.interimResults = true

    speechRecognition.onstart = () => {
      setIsRecognizing(true)
    }

    speechRecognition.onend = () => {
      setIsRecognizing(false)
    }

    speechRecognition.onerror = (event) => {
      // eslint-disable-next-line no-console
      console.error('Speech recognition error:', event.error)

      setIsRecognizing(false)
    }

    setRecognition(speechRecognition)

    return () => {
      speechRecognition.stop()
    }
  }, [voiceIn])

  useEffect(() => {
    if (!recognition) {
      return
    }

    let gapTimeout

    recognition.onresult = (event) => {
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript

        finalTranscript += transcript
      }

      setText(finalTranscript)

      clearTimeout(gapTimeout)

      gapTimeout = setTimeout(() => {
        sendText()
      }, 2000)
    }
  }, [recognition, setText, sendText])

  const handleSpeechButtonClick = () => {
    if (!recognition) {
      return
    }

    if (isRecognizing) {
      recognition.stop()
    } else {
      // @note guard against double-click race condition - check if already
      // started before calling start() to prevent InvalidStateError
      try {
        recognition.start()
      } catch (error) {
        if (error.name === 'InvalidStateError') {
          // recognition already started, ignore
          return
        }

        throw error
      }
    }
  }

  const speechButton = isSupported ? (
    <Speak active={isRecognizing} onClick={handleSpeechButtonClick} />
  ) : null

  return {
    speechButton,
  }
}

/*****************************************
 * SECTION: Values
 *****************************************/

/**
 *
 */
export function useSynchronizedValue({ name, value, setValue, disabled }) {
  useEffect(() => {
    if (disabled) {
      return
    }

    function onMessage(event) {
      if (!isSafeMessageEvent(event)) {
        return
      }

      switch (event.data.type) {
        case `set${toPascalCase(name)}`: {
          const newValue = event.data.props.value

          // @todo perform validation

          if (!equal(newValue, value)) {
            setValue(newValue)
          }

          break
        }

        case `get${toPascalCase(name)}`: {
          // use the channel to send the value back

          const port = event.ports[0]

          if (port) {
            try {
              port.postMessage(value)
            } catch {
              // @note the port might be closed
            }
          }

          break
        }
      }
    }

    window.addEventListener('message', onMessage)

    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [disabled, name, value, setValue])

  const prevValue = usePrevious(value)

  useEffect(() => {
    if (disabled) {
      return
    }

    if (!equal(value, prevValue)) {
      postToParent({
        type: `on${toPascalCase(name)}Change`,
        props: { value: value },
      })
    }
  }, [disabled, name, value, prevValue])
}

/*****************************************
 * SECTION: Elements
 *****************************************/

/**
 * @todo use the default icon and do not take space if there are errors
 */
export function Icon({ className, icon: Icon }) {
  const [hasErrors, setHasErrors] = useState(false)

  return (
    <div
      className={clsx(
        'icon',
        'flex-shrink-0 flex justify-center items-center',
        'overflow-hidden',
        className
      )}
    >
      {isComponent(Icon) ? (
        <Icon className="w-full h-full" />
      ) : typeof Icon === 'string' ? (
        /^(https:\/\/|data:|blob:|\/)/.test(Icon) ? (
          <img
            className={clsx('w-full h-full object-cover', {
              hidden: hasErrors,
            })}
            src={Icon}
            alt="icon"
            onError={() => setHasErrors(true)}
          />
        ) : (
          <Emoji>{Icon}</Emoji>
        )
      ) : (
        <img className="w-full h-full object-cover" src={Icon} alt="icon" />
      )}
    </div>
  )
}

Icon.Memo = memo(Icon)

/**
 *
 */
export function Skeleton({ className, ...props }) {
  return (
    <div
      {...props}
      className={clsx(
        'skeleton bg-gray-100 dark:bg-gray-900',
        'animate-pulse',
        className
      )}
    />
  )
}

/**
 *
 */
export function Micro({
  className,

  type,

  data: { logo, url, image = logo, title, description, publisher },
}) {
  const { theme } = useContext(ThemeContext)

  const ref = useRef()

  const [waitImageToLoad, setWaitImageToLoad] = useState(!!image)

  useTimeout(() => {
    setWaitImageToLoad(false)
  }, 5000)

  const waitToLoad = useDebounce(waitImageToLoad, 1000)

  return url ? (
    <Collapsible
      className={clsx(
        'micro',

        '[&_img]:w-full [&_img]:rounded-lg',
        '[&_video]:w-96 [&_video]:max-w-full [&_video]:rounded-lg [&_video]:overflow-hidden',
        '[&_iframe]:w-96 [&_iframe]:max-w-full [&_iframe]:rounded-lg [&_iframe]:overflow-hidden [&_iframe]:aspect-video',

        'text-sm',

        'transition-all duration-300 ease-in-out',

        {
          'w-full max-w-[96]': theme.messageStyle === 'bubble',

          'flex-row-reverse self-end ml-[10%]':
            type === 'user' && theme.messageStyle === 'bubble',

          'flex-row self-start mr-[10%]':
            type === 'bot' && theme.messageStyle === 'bubble',
        },

        className
      )}
    >
      <div className="flex flex-row gap-4" ref={ref}>
        {image ? (
          <>
            <ExternalObject
              className={clsx('max-w-[5rem] rounded-xl', {
                hidden: waitToLoad,
              })}
              image={image}
              title={title}
              onReady={() => setWaitImageToLoad(false)}
            />
            {waitToLoad ? (
              <ExternalLink href={url}>
                <Skeleton className="w-[5rem] h-[5rem] rounded-xl aspect-square" />
              </ExternalLink>
            ) : null}
          </>
        ) : (
          <ExternalLink href={url}>
            <Skeleton className="w-[5rem] h-[5rem] rounded-xl aspect-square" />
          </ExternalLink>
        )}
        <div className="flex-1">
          <ExternalLink className="space-y-2" href={url}>
            {!waitToLoad && title ? (
              <h2 className="tracking-tight font-bold line-clamp-1">{title}</h2>
            ) : (
              <Skeleton className="w-full h-[1rem] rounded-xl" />
            )}
            {!waitToLoad && description ? (
              <p className="line-clamp-2">{description}</p>
            ) : (
              <Skeleton className="w-full h-[1rem] rounded-xl" />
            )}
          </ExternalLink>
          {publisher === 'YouTube' ? (
            <ExternalObject src={url} title={title} />
          ) : null}
        </div>
      </div>
    </Collapsible>
  ) : null
}

Micro.Memo = memo(Micro)

/**
 *
 */
export function Tools({
  originalMessageId,

  id,

  type,
  text,

  meta: _meta,

  ...props
}) {
  const { conversationId, token } = useContext(ConversationContext)

  const { voiceOut } = useContext(ConfigContext)

  const { fetch } = useFetch()

  const [isVoiceOutClicked, setIsVoiceOutClicked] = useState(false)
  const [isThumbsDownClicked, setIsThumbsDownClicked] = useState(false)
  const [isThumbsUpClicked, setIsThumbsUpClicked] = useState(false)
  const [isCopyClicked, setIsCopyClicked] = useState(false)

  if (type !== 'bot') {
    return null
  }

  const thisMessageId = `${originalMessageId || id || getRandomId('tmp-')}`

  const timeout = 2000

  async function handleThumbsDown() {
    setIsThumbsDownClicked(true)

    try {
      await fetch(
        `/api/v1/conversation/${conversationId}/message/${thisMessageId}/downvote`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          data: {},
        }
      )
    } finally {
      setTimeout(() => {
        setIsThumbsDownClicked(false)
      }, timeout)
    }
  }

  async function handleThumbsUp() {
    setIsThumbsUpClicked(true)

    try {
      await fetch(
        `/api/v1/conversation/${conversationId}/message/${thisMessageId}/upvote`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          data: {},
        }
      )
    } finally {
      setTimeout(() => {
        setIsThumbsUpClicked(false)
      }, timeout)
    }
  }

  async function handleCopy() {
    let html

    try {
      html = await unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype)
        .use(rehypeStringify)
        .process(text)
    } catch (e) {
      await captureError(e)
    }

    setIsCopyClicked(true)

    try {
      await window.navigator?.clipboard?.write([
        new ClipboardItem({
          ...(text
            ? {
                'text/plain': new Blob([text], { type: 'text/plain' }),
              }
            : null),

          ...(html
            ? {
                'text/html': new Blob([html], { type: 'text/html' }),
              }
            : null),
        }),
      ])
    } catch {
      // @note clipboard API may be blocked by permissions policy in cross-origin iframes
    } finally {
      setTimeout(() => {
        setIsCopyClicked(false)
      }, timeout)
    }
  }

  async function handleVoiceOut() {
    setIsVoiceOutClicked(true)

    let timer

    try {
      const { error, data } = await fetch(
        `/api/v1/conversation/${conversationId}/message/${thisMessageId}/synthesize`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          data: {
            text,
          },
        }
      )

      if (error) {
        return
      }

      const { url } = data

      const audio = new Audio(url)

      // @note audio.play() returns a Promise that can reject on mobile browsers with autoplay restrictions

      audio.play().catch(() => {
        // @note autoplay may be blocked by browser policy
      })

      clearTimeout(timer)

      audio.addEventListener('ended', () => {
        setIsVoiceOutClicked(false)
      })
    } finally {
      timer = setTimeout(() => {
        setIsVoiceOutClicked(false)
      }, timeout)
    }
  }

  return (
    <div {...props}>
      <div className={clsx('flex flex-row-reverse gap-2 text-xs', 'p-2')}>
        {/* tools that never hide */}
        <div
          className={clsx('appear-animation', {
            'cursor-default': isCopyClicked,
            'cursor-pointer': !isCopyClicked,
          })}
          onClick={isCopyClicked ? null : handleCopy}
        >
          {isCopyClicked ? <CheckIcon /> : <CopyIcon />}
        </div>
        {/* others */}
        {!thisMessageId?.startsWith('tmp-') ? (
          <div
            className={clsx('appear-animation', {
              'cursor-default': isThumbsDownClicked,
              'cursor-pointer': !isThumbsDownClicked,
            })}
            onClick={isThumbsDownClicked ? null : handleThumbsDown}
          >
            {isThumbsDownClicked ? <CheckIcon /> : <ThumbDownIcon />}
          </div>
        ) : null}
        {!thisMessageId?.startsWith('tmp-') ? (
          <div
            className={clsx('appear-animation', {
              'cursor-default': isThumbsUpClicked,
              'cursor-pointer': !isThumbsUpClicked,
            })}
            onClick={isThumbsUpClicked ? null : handleThumbsUp}
          >
            {isThumbsUpClicked ? <CheckIcon /> : <ThumbUpIcon />}
          </div>
        ) : null}
        {!thisMessageId?.startsWith('tmp-') ? (
          <>
            {voiceOut ? (
              <div
                className={clsx('appear-animation', {
                  'cursor-default': isVoiceOutClicked,
                  'cursor-pointer': !isVoiceOutClicked,
                })}
                onClick={isVoiceOutClicked ? null : handleVoiceOut}
              >
                {isVoiceOutClicked ? <CheckIcon /> : <PlayIcon />}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}

Tools.Memo = memo(Tools)

/**
 *
 */
export function TextArea({ className, style: _style, children, ...props }) {
  const { placeholder } = useContext(ConfigContext)

  const { getLocalText } = useContext(IntlContext)

  const { mobile } = useContext(ResizeContext)

  const style = useMemo(() => {
    return {
      ..._style,

      '--thisInputPadding': accessVar('--inputPadding', '0.5rem 0.75rem'),

      '--thisInputRounding': accessVar('--inputRounding', '0.375rem'),

      '--thisInputBorderSize': accessVar('--inputBorderSize', '1px'),
      '--thisInputBorderPrimary': accessVar('--inputBorderPrimary'),
      '--thisInputBorderSecondary': accessVar(
        '--inputBorderSecondary',
        '--inputBorderPrimary'
      ),
    }
  }, [_style])

  return (
    <div
      className={clsx(
        'text-area',

        'flex flex-row items-stretch gap-2',

        'p-[var(--thisInputPadding)]',

        'bg-[var(--inputPrimary)] hover:bg-[var(--inputSecondary)] focus:bg-[var(--inputSecondary)]',

        'text-[var(--inputText)]',

        'rounded-[var(--thisInputRounding)]',
        '[border-width:var(--thisInputBorderSize)] border-[var(--thisInputBorderPrimary)]',
        'focus:border-[var(--thisInputBorderSecondary)] focus:ring-1 focus:ring-[var(--thisInputBorderSecondary)]',
        'focus-within:border-[var(--thisInputBorderSecondary)] focus-within:ring-1 focus-within:ring-[var(--thisInputBorderSecondary)] ',

        'transition ease-in-out',

        'transform',

        className
      )}
      style={style}
    >
      <AutoTextarea
        className={clsx(
          'w-full max-h-[20rem]',

          '!min-h-[0px]', // @note by default the textarea has some height, hence why we need to set it to 0

          'p-0',

          'bg-transparent',

          'border-0 ring-0 focus:border-0 focus:ring-0',

          '[font-size:inherit]',

          // @note on mobile this prevent zooming into the textarea
          {
            '![font-size:16px]': mobile,
          }
        )}
        {...props}
        placeholder={getLocalText('placeholder', placeholder)}
      />
      {children}
    </div>
  )
}

/**
 *
 */
export function TextAreaLike({ className, children, ...props }) {
  return (
    <div
      className={clsx(
        'text-area-like',

        'w-full rounded-md',

        'bg-[var(--inputPrimary)] hover:bg-[var(--inputSecondary)] focus:bg-[var(--inputSecondary)]',

        'text-[var(--inputText)]',

        '[font-size:inherit]',

        'border border-[var(--inputBorderPrimary)]',
        'focus:border-[var(--inputBorderSecondary)] focus:ring-1 focus:ring-[var(--inputBorderSecondary)]',
        'focus-within:border-[var(--inputBorderSecondary)] focus-within:ring-1 focus-within:ring-[var(--inputBorderSecondary)] ',

        'transition ease-in-out',

        'transform',

        'overflow-hidden',

        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 *
 */
export function SegmentInput({ className, ...props }) {
  const { mobile } = useContext(ResizeContext)

  const { handleOnKeyDown, props: filteredProps } = useFormElementAutoTools({
    reportValidity: true,

    ...props,
  })

  return (
    <InputArea
      onKeyDown={handleOnKeyDown}
      {...filteredProps}
      className={clsx(
        'segment-input',

        'w-full',

        'bg-[var(--inputPrimary)] hover:bg-[var(--inputSecondary)] focus:bg-[var(--inputSecondary)]',

        'text-[var(--inputText)]',

        '[font-size:inherit]',

        // @note on mobile this prevent zooming into the textarea
        {
          '![font-size:16px]': mobile,
        },

        'border-0 ring-0 focus:border-0 focus:ring-0',

        className
      )}
    />
  )
}

/**
 *
 */
export function SegmentTextarea({ className, ...props }) {
  const { mobile } = useContext(ResizeContext)

  const { handleOnKeyDown, props: filteredProps } = useFormElementAutoTools({
    reportValidity: true,

    ...props,
  })

  return (
    <AutoTextarea
      onKeyDown={handleOnKeyDown}
      {...filteredProps}
      className={clsx(
        'segment-textarea',

        'w-full',

        'bg-[var(--inputPrimary)] hover:bg-[var(--inputSecondary)] focus:bg-[var(--inputSecondary)]',

        'text-[var(--inputText)]',

        '[font-size:inherit]',

        // @note on mobile this prevent zooming into the textarea
        {
          '![font-size:16px]': mobile,
        },

        'border-0 ring-0 focus:border-0 focus:ring-0',

        className
      )}
    />
  )
}

/**
 *
 */
export function SegmentSelect({ className, ...props }) {
  const { mobile } = useContext(ResizeContext)

  const { handleOnKeyDown, props: filteredProps } = useFormElementAutoTools({
    reportValidity: true,

    ...props,
  })

  return (
    <select
      onKeyDown={handleOnKeyDown}
      {...filteredProps}
      className={clsx(
        'segment-select',

        'w-full',

        'bg-[var(--inputPrimary)] hover:bg-[var(--inputSecondary)] focus:bg-[var(--inputSecondary)]',

        'text-[var(--inputText)]',

        '[font-size:inherit]',

        // @note on mobile this prevent zooming into the textarea
        {
          '![font-size:16px]': mobile,
        },

        'border-0 ring-0 focus:border-0 focus:ring-0',

        'bg-none',

        className
      )}
    />
  )
}

/**
 *
 */
export function SegmentOption({ className, ...props }) {
  return (
    <option
      {...props}
      className={clsx(
        'segment-option',

        className
      )}
    />
  )
}

/**
 * A component that displays a dialog.
 *
 * @todo add animation effects
 */
export function Dialog({
  open,
  type,

  className,

  children,

  onClick,
  onClickOutside,

  onClose,

  ...props
}) {
  const dialogRef = useRef()

  const [internalOpen, setInternalOpen] = useState(open)

  const { layout } = useContext(ConfigContext)

  useEffect(() => {
    setInternalOpen(open)

    if (open) {
      if (type === 'modal') {
        dialogRef.current?.showModal()
      } else {
        dialogRef.current?.show()
      }
    } else {
      dialogRef.current?.close()
    }
  }, [open, type])

  const canRenderNativeBackdrop = ['fullscreen', 'center', 'popout'].includes(
    layout
  )

  return (
    <dialog
      className={clsx(
        'dialog',

        'p-5 bg-white rounded-xl shadow-lg',

        {
          'backdrop:bg-transparent': !canRenderNativeBackdrop,
          'backdrop:backdrop-blur-sm': canRenderNativeBackdrop,
        },

        className
      )}
      onClick={(event) => {
        if (onClick) {
          onClick(event)
        }

        if (onClickOutside) {
          onClickOutside(event)
        }
      }}
      onClose={(event) => {
        setInternalOpen(false)

        if (onClose) {
          onClose(event)
        }
      }}
      ref={dialogRef}
      {...props}
    >
      {internalOpen && !canRenderNativeBackdrop
        ? createPortal(
            <div
              className={clsx(
                'absolute top-0 bottom-0 left-0 right-0 z-10',

                'backdrop-blur-md'
              )}
            />,
            document.getElementsByClassName('popup')?.[0] || document.body
          )
        : null}
      <div onClick={(event) => event.stopPropagation()}>{children}</div>
    </dialog>
  )
}

/*****************************************
 * SECTION: Attachment && Attachments
 *****************************************/

/**
 * A component that displays an attachment.
 */
export function Attachment({ attachment }) {
  const [isValidImage, setIsValidImage] = useState(false)

  useEffect(() => {
    async function checkIsValid() {
      const isImage = /^image\//.test(attachment.type)

      if (!isImage) {
        return
      }

      try {
        // @todo decide if we should use useFetch hook instead

        const response = await fetch(attachment.localURL)

        setIsValidImage(response.ok)
      } catch {
        setIsValidImage(false)
      }
    }

    checkIsValid()
  }, [attachment])

  const getEllipsisText = (text, maxLength) => {
    if (text.length <= maxLength) {
      return text
    }

    const halfLength = Math.floor(maxLength / 2)

    return text.slice(0, halfLength) + '...' + text.slice(-halfLength)
  }

  return (
    <div className="attachment">
      {isValidImage ? (
        <img
          className="block h-32 aspect-auto rounded-lg"
          src={attachment.localURL}
          alt="attachment"
        />
      ) : (
        <span className="flex flex-row gap-2 items-center">
          <AttachmentIcon className="w-4 h-4 fill-current" />
          <span className="block text-sm whitespace-nowrap">
            {getEllipsisText(attachment.localName, 20)}
          </span>
        </span>
      )}
    </div>
  )
}

Attachment.Memo = memo(Attachment)

/**
 * A component that displays attachments.
 */
export function Attachments({ attachments }) {
  const { theme } = useContext(ThemeContext)

  const isBubble = theme.messageStyle === 'bubble'

  return (
    <div
      className={clsx('attachments flex flex-row flex-wrap gap-2', {
        'justify-end': isBubble,
      })}
    >
      {attachments.map((attachment, index) => {
        return <Attachment key={index} attachment={attachment} />
      })}
    </div>
  )
}

Attachments.Memo = memo(Attachments)

/*****************************************
 * SECTION: Message & Messages
 *****************************************/

/**
 * We cannot say for certainty that these are trusted message types, thus can
 * have some special rendering but it is what we have to work with.
 */
const semiTrustedMessageTypes = ['intro', 'initial', 'bot', 'input']

/**
 * A component that displays a message.
 */
export function Message({
  className,

  style,

  originalMessageId,

  sequenceMessageId,

  id,

  type: _type,
  text: _text,

  actions,

  meta,

  micro,

  extra,

  references: _references,

  attachments,

  isLast,

  isLastOfType,

  isThinking: _isThinking,
  isWriting,

  hideTools,

  disabled,
}) {
  // get the resolved type

  const type = useMemo(() => {
    switch (true) {
      // when the message contains buttons set the type to input
      case semiTrustedMessageTypes.includes(_type) &&
        /(?:\[.*?\]\(\)|\[.*?\]\(.*?#(?:button)\))+/.test(_text): {
        return 'input'
      }

      // when the message contains frames set the type to input
      case semiTrustedMessageTypes.includes(_type) &&
        /(?:\[.*?\]\(\)|\[.*?\]\(.*?#(?:frame)\))+/.test(_text): {
        return 'input'
      }

      // when the message contains forms set the type to input
      case semiTrustedMessageTypes.includes(_type) && /^<form\s+/.test(_text): {
        return 'input'
      }

      // when the message is an image set the type to input
      case semiTrustedMessageTypes.includes(_type) &&
        /^\s*\!\[.*?\]\(.*?\)\s*$/.test(_text): {
        return 'input'
      }

      // when the message is a form set the type to input
      case semiTrustedMessageTypes.includes(_type) &&
        /^\s*<form.*?>.*?<\/form>\s*/.test(_text): {
        return 'input'
      }

      // when the message is of particular fenced code block type set the type to input
      case semiTrustedMessageTypes.includes(_type) &&
        /^```(mermaid|carousel|form|card|buttons?)/.test(_text): {
        return 'input'
      }

      default: {
        return (
          {
            initial: 'bot',
          }[_type] || _type
        )
      }
    }
  }, [_type, _text])

  // extract context

  const {
    botIcon,
    userIcon,
    contextIcon,

    stream,
    tools,

    math,
  } = useContext(ConfigContext)

  // extract theme

  const { theme } = useContext(ThemeContext)

  // it is important to keep this line...

  const legacyAction = useMemo(() => {
    return (
      meta?.dataset?.action ||
      meta?.skillset?.action ||
      meta?.function?.action ||
      null
    )
  }, [meta?.dataset?.action, meta?.skillset?.action, meta?.function?.action])

  const action = useMemo(() => {
    if (actions?.length) {
      return actions[actions.length - 1] || null
    }

    return legacyAction
  }, [actions, legacyAction])

  const showAction = useMemo(() => {
    return ['bot', 'context'].includes(type) && !!action
  }, [action, type])

  const showLoading =
    isLast && isWriting && type === 'bot' && _text === '' && !showAction

  // ...before this line

  const isActionWorking = useMemo(() => {
    return Boolean(action?.working)
  }, [action?.working])

  // @note when the message shows an action instead of real text, keep the
  // shimmer running so the consumer can tell something is still happening and
  // more output will come

  const isShowingWorkingAction =
    isLast && showAction && !_text?.trim?.() && (isWriting || isActionWorking)

  const actionText = useMemo(() => {
    if (!action) {
      return ''
    }

    // @note the action name is a raw function identifier (e.g. `some_function`
    // or `someFunction`); humanize it into a friendly label ("Some function")
    // when we fall back to showing it instead of a justification or input

    const friendlyName = action.name ? humanizeActionName(action.name) : ''

    let resolvedText =
      action.justification || action.input || friendlyName || ''

    if (typeof resolvedText !== 'string') {
      resolvedText = JSON.stringify(resolvedText)
    }

    if (!action.justification && resolvedText.startsWith('{')) {
      resolvedText = friendlyName || resolvedText
    }

    if (math) {
      resolvedText = fixLaTeXSyntax(resolvedText)
    }

    return resolvedText
  }, [action, math])

  const text = useMemo(() => {
    let text = _text?.trim?.() || actionText || '\u00A0'

    if (typeof text !== 'string') {
      text = JSON.stringify(text)
    }

    // @note if the resolved text looks like a JSON object, prefer the action
    // name instead for a cleaner display

    if (math) {
      text = fixLaTeXSyntax(text)
    }

    return text
  }, [_text, actionText, math])

  const shouldRenderMarkdown = useMemo(() => {
    return Boolean(text && text !== '\u00A0')
  }, [text])

  // get references

  const references = useMemo(() => {
    if (!_references) {
      return null
    }

    const uniqueReferences = new Set()

    for (const { source } of _references) {
      if (uniqueReferences.has(source)) {
        continue
      }

      uniqueReferences.add(source)
    }

    return Array.from(uniqueReferences).map((source) => ({
      source,
    }))
  }, [_references])

  // setup markdown tools

  const components = useMemo(() => {
    return {
      // @todo find a whitelist approach

      // enable basic elements

      a({ href, children }) {
        switch (true) {
          case !href: {
            return <PostMessageButton>{children}</PostMessageButton>
          }

          case href.endsWith('#frame'): {
            return (
              <OpenFrameButton href={href.slice(0, -'#frame'.length)}>
                {children}
              </OpenFrameButton>
            )
          }

          case href.endsWith('#button'): {
            return (
              <ExternalButton href={href.slice(0, -'#button'.length)}>
                {children}
              </ExternalButton>
            )
          }

          default: {
            return <ExternalLink href={href}>{children}</ExternalLink>
          }
        }
      },

      img({ src, alt }) {
        return <ExternalObject src={src} title={alt} download={true} />
      },

      blockquote({ children }) {
        return <blockquote>{children}</blockquote> // @todo to special parsing for callouts
      },

      code({ className, children, inline }) {
        if (inline) {
          return <code>{children}</code>
        }

        const [, language] = /language-(\w+)/.exec(className || '') || []

        const source = Children.toArray(children)
          .filter((child) => typeof child === 'string')
          .join('')

        if (!source) {
          return null
        }

        switch (true) {
          case language === 'mermaid': {
            return <Diagram>{source}</Diagram>
          }

          case language === 'carousel': {
            return <Carousel isLast={isLast}>{source}</Carousel>
          }

          case language === 'form': {
            return <Form isLast={isLast}>{source}</Form>
          }

          case language === 'card': {
            return <Card isLast={isLast}>{source}</Card>
          }

          case language === 'button': {
            return <ButtonGroup isLast={isLast}>{source}</ButtonGroup>
          }

          case language === 'buttons': {
            return <ButtonGroup isLast={isLast}>{source}</ButtonGroup>
          }

          case !!language: {
            return (
              <CodeBlock isLast={isLast} language={language}>
                {source}
              </CodeBlock>
            )
          }

          default: {
            return <CodeBlock isLast={isLast}>{source}</CodeBlock>
          }
        }
      },

      pre({ children, node }) {
        if (node?.children?.[0]?.tagName === 'code') {
          return children
        } else {
          return `<pre>${children}</pre>`
        }
      },

      // enable emoji related elements

      emoji({ children }) {
        return <Emoji>{children}</Emoji>
      },

      // enable math elements

      math(props) {
        return <math className="inline">{props.children}</math>
      },

      inlineMath(props) {
        return <math className="block">{props.children}</math>
      },

      // disable unsupported elements
      // @todo find a whitelist approach

      ...Object.fromEntries(
        [
          'hr',
          'form',
          'label',
          'button',
          'input',
          'textarea',
          'select',
          'option',
          'optgroup',
          'fieldset',
          'legend',
          'datalist',
          'output',
          'progress',
          'meter',
        ].map((node) => [node, () => null])
      ),

      // @note forms are only displayed in the lastMessage and are supported
      // only for a handful of message types

      ...(isLast && semiTrustedMessageTypes.includes(type)
        ? {
            form({ children }) {
              function handleOnSubmit(event) {
                event.preventDefault()
                event.stopPropagation()

                event.target.disabled = true

                postToSelf({
                  type: 'sendMessage',
                  props: {
                    message: yaml.stringify(formToData(event.target)),
                    hidden: true,
                    respond: true,
                  },
                })
              }

              if (typeof document === 'undefined') {
                return null
              }

              // eslint-disable-next-line react-hooks/rules-of-hooks
              const [target] = useDOMQuerySelector('#mainInputArea', {
                waitForElements: true,
              })

              return target
                ? createPortal(
                    <TextAreaLike className={clsx('relative')}>
                      <form
                        className="relative"
                        onSubmit={handleOnSubmit}
                        disabled={disabled}
                      >
                        {children}
                        <Send
                          className="absolute bottom-3 right-1"
                          disabled={disabled}
                        />
                      </form>
                    </TextAreaLike>,
                    target
                  )
                : null
            },

            input({ type, name, placeholder }) {
              switch (type) {
                case 'button':
                case 'submit': {
                  return null
                }

                // @todo render segment checkbox, radio, etc.

                default: {
                  return (
                    <SegmentInput
                      name={name}
                      type={type}
                      disabled={disabled}
                      autoTab={true}
                      autoSubmit={true}
                      placeholder={placeholder}
                    />
                  )
                }
              }
            },

            textarea({ name, placeholder }) {
              return (
                <SegmentTextarea
                  name={name}
                  disabled={disabled}
                  autoTab={true}
                  autoSubmit={true}
                  placeholder={placeholder}
                />
              )
            },

            select({ name, children }) {
              return (
                <SegmentSelect
                  name={name}
                  disabled={disabled}
                  autoTab={true}
                  autoSubmit={true}
                >
                  {children}
                </SegmentSelect>
              )
            },

            option({ value, children }) {
              return (
                <SegmentOption
                  value={value}
                  disabled={disabled}
                  autoTab={true}
                  autoSubmit={true}
                >
                  {children}
                </SegmentOption>
              )
            },
          }
        : null),
    }
  }, [type, isLast, disabled])

  const remarkPlugins = useMemo(() => {
    const plugins = [
      ...(math ? [[remarkMath, { singleDollarTextMath: false }]] : []),
      remarkGfm,
    ]

    return plugins
  }, [math])

  const rehypePlugins = useMemo(() => {
    // @todo requires refactoring and testing, possibly into a separate module

    const plugins = [...(math ? [rehypeKatex] : [])]

    if (isLast && semiTrustedMessageTypes.includes(type)) {
      plugins.push(wordsToSpans, rehypeRaw)
    }

    plugins.push(textToEmojiSpans)

    return plugins
  }, [math, type, isLast])

  // animators

  const newElementsObserverRef = useClassNameOnNewElements({
    className: 'appear-animation',
    disabled: !isLast || !stream || type !== 'bot',
  })

  // render

  return (
    // @note the reason we use a SpaceSavingDiv is because some types of
    // messages (forms, popups) might render outside of their container and thus
    // we need to hide them when they do. Otherwise the messages will be visible
    // and look broken - an alternative would be to use some kind of placeholder
    // when we display popped out content

    <>
      {type === 'user' && isLastOfType ? (
        <AutoScrollStop.Memo key="stop" margin={50} />
      ) : null}
      <SpaceSavingDiv className="flex flex-col gap-3" defaultHasContent={true}>
        <Collapsible
          style={{
            ...style,

            // alignment
            ...{
              '--thisMessageAlignItems': accessVar(
                `--${type}MessageAlignItems`,
                '--messageAlignItems',
                'start'
              ),
            },

            // padding
            ...{
              '--thisMessagePadding': accessVar(
                `--${type}MessagePadding`,
                '--messagePadding',
                '1rem'
              ),
            },

            // text & background color
            ...{
              '--thisMessageText': accessVar(
                `--${type}MessageText`,
                '--messageText',
                'inherit'
              ),
              '--thisMessagePrimary': accessVar(
                `--${type}MessagePrimary`,
                '--messagePrimary',
                'transparent'
              ),
            },

            // rounding
            ...{
              '--thisMessageRounding': accessVar(
                `--${type}MessageRounding`,
                '--messageRounding',
                '0.375rem'
              ),
            },

            // font weight
            ...{
              '--thisMessageFontWeight': accessVar(
                `--${type}MessageFontWeight`,
                '--messageFontWeight',
                'inherit'
              ),
            },

            // h* font size
            ...{
              '--thisMessageH1FontSize': accessVar(
                `--${type}MessageH1FontSize`,
                '--messageH1FontSize',
                '2.25em'
              ),
              '--thisMessageH2FontSize': accessVar(
                `--${type}MessageH2FontSize`,
                '--messageH2FontSize',
                '1.5em'
              ),
              '--thisMessageH3FontSize': accessVar(
                `--${type}MessageH3FontSize`,
                '--messageH3FontSize',
                '1.25em'
              ),
            },

            // links
            ...{
              '--thisMessageLinkPrimary': accessVar(
                `--${type}MessageLinkPrimary`,
                '--messageLinkPrimary',
                'inherit'
              ),

              '--thisMessageLinkSecondary': accessVar(
                `--${type}MessageLinkSecondary`,
                '--messageLinkSecondary',
                '--thisMessageLinkPrimary'
              ),

              '--thisMessageLinkDecoration': accessVar(
                `--${type}MessageLinkDecoration`,
                '--messageLinkDecoration',
                'underline'
              ),
            },

            // inner
            ...{
              // padding
              ...{
                '--thisMessageInnerPadding': accessVar(
                  `--${type}MessageInnerPadding`,
                  '--messageInnerPadding',
                  '0px'
                ),
              },

              // text & background color
              ...{
                '--thisMessageInnerText': accessVar(
                  `--${type}MessageInnerText`,
                  '--messageInnerText',
                  'inherit'
                ),
                '--thisMessageInnerPrimary': accessVar(
                  `--${type}MessageInnerPrimary`,
                  '--messageInnerPrimary',
                  'transparent'
                ),
              },

              // rounding
              ...{
                '--thisMessageInnerRounding': accessVar(
                  `--${type}MessageInnerRounding`,
                  '--messageInnerRounding',
                  '0px'
                ),
              },

              // border
              ...{
                '--thisMessageInnerBorderPrimary': accessVar(
                  `--${type}MessageInnerBorderPrimary`,
                  '--messageInnerBorderPrimary',
                  'transparent'
                ),
                '--thisMessageInnerBorderSize': accessVar(
                  `--${type}MessageInnerBorderSize`,
                  '--messageInnerBorderSize',
                  '0px'
                ),
              },

              // shadow
              ...{
                '--thisMessageInnerBoxShadow': accessVar(
                  `--${type}MessageInnerBoxShadow`,
                  '--messageInnerBoxShadow',
                  'none'
                ),
              },
            },

            // buttons
            ...{
              '--thisMessageButtonText': accessVar(
                `--${type}MessageButtonText`,
                '--messageButtonText',
                '--buttonText',
                'inherit'
              ),
              '--thisMessageButtonPrimary': accessVar(
                `--${type}MessageButtonPrimary`,
                '--messageButtonPrimary',
                '--buttonPrimary',
                'transparent'
              ),
              '--thisMessageButtonSecondary': accessVar(
                `--${type}MessageButtonSecondary`,
                '--messageButtonSecondary',
                '--buttonSecondary',
                '--thisMessageButtonPrimary'
              ),
              '--thisMessageButtonBorderPrimary': accessVar(
                `--${type}MessageButtonBorderPrimary`,
                '--messageButtonBorderPrimary',
                'transparent'
              ),
              '--thisMessageButtonBorderSecondary': accessVar(
                `--${type}MessageButtonBorderSecondary`,
                '--messageButtonBorderSecondary',
                '--thisMessageButtonBorderPrimary'
              ),
              '--thisMessageButtonBorderSize': accessVar(
                `--${type}MessageButtonBorderSize`,
                '--messageButtonBorderSize',
                '1px'
              ),
              '--thisMessageButtonPadding': accessVar(
                `--${type}MessageButtonPadding`,
                '--messageButtonPadding',
                '0.2rem 0.5rem 0.2rem 0.5rem'
              ),
              '--thisMessageButtonRounding': accessVar(
                `--${type}MessageButtonRounding`,
                '--messageButtonRounding',
                '0.375rem'
              ),
            },

            // icons
            ...{
              '--thisMessageIconPrimary': accessVar(
                `--${type}MessageIconPrimary`,
                '--messageIconPrimary'
              ),

              '--thisMessageIconText': accessVar(
                `--${type}MessageIconText`,
                '--messageIconText'
              ),

              '--thisMessageIconRounding': accessVar(
                `--${type}MessageIconRounding`,
                '--messageIconRounding',
                '0.375rem'
              ),

              '--thisMessageIconSize': accessVar(
                `--${type}MessageIconSize`,
                '--messageIconSize',
                '2rem'
              ),
            },
          }}
          className={clsx(
            'message',

            type,

            'relative group',

            'transition-all duration-75 ease-out',

            {
              // @note clip only the y axis - the Collapsible animates the
              // height while streaming so vertical overflow must be clipped,
              // but the x axis must stay visible so the absolutely-positioned
              // writing dot (which is deliberately kept out of the layout to
              // avoid layout shifts) is not shaved off when the text ends
              // near the edge of the box
              '[overflow-x:visible] [overflow-y:clip] box-content': isLast,
            },

            //
            // GENERAL STYLES
            //

            // padding
            'p-[var(--thisMessagePadding)]',

            // background & text color
            'bg-[var(--thisMessagePrimary)] text-[var(--thisMessageText)]',

            // rounding
            'rounded-[var(--thisMessageRounding)]',

            // font weight
            'font-[var(--thisMessageFontWeight,inherit)]',

            // legibility
            'rendering-legibility',

            // links
            '[&_a]:!text-[var(--thisMessageLinkPrimary)] hover:[&_a]:!text-[var(--thisMessageLinkSecondary)]',
            '[&_a]:![text-decoration:var(--thisMessageLinkDecoration)]',
            '[&_a]:![font-weight:inherit]',

            // footnotes
            '[&_.footnotes]:text-[0.8em]',
            '[&_.footnotes_li_p]:m-0',

            // buttons
            '[&_button]:m-0.5',
            '[&_button]:!bg-[var(--thisMessageButtonPrimary)] hover:[&_button]:!bg-[var(--thisMessageButtonSecondary)]',
            '[&_button]:!text-[var(--thisMessageButtonText)]',
            '[&_button]:![border-width:var(--thisMessageButtonBorderSize)] [&_button]:![border-color:var(--thisMessageButtonBorderPrimary)] hover:[&_button]:![border-color:var(--thisMessageButtonBorderSecondary)]',
            '[&_button]:!p-[var(--thisMessageButtonPadding)]',
            '[&_button]:!rounded-[--thisMessageButtonRounding]',
            '[&_button]:!text-left',
            '[&_button]:!select-none',
            // '[&_button]:!truncate',
            // @note disabled because not sure
            // {
            //   '[&_button]:w-full': mobile,
            // },

            //
            // TYPE SPECIFIC STYLES
            //

            // intro
            ...(type === 'intro'
              ? [
                  // pass
                ]
              : []),

            // user
            ...(type === 'user'
              ? [
                  // bubble
                  {
                    'flex-row-reverse self-end ml-[10%]':
                      theme.messageStyle === 'bubble' ||
                      theme.userMessageStyle === 'bubble',
                  },

                  // buttons
                  '[&_button]:!hidden',
                ]
              : []),

            // bot
            ...(type === 'bot'
              ? [
                  // bubble
                  {
                    'flex-row self-start mr-[10%]':
                      theme.messageStyle === 'bubble' ||
                      theme.botMessageStyle === 'bubble',
                  },
                ]
              : []),

            // context
            ...(type === 'context'
              ? [
                  // buttons
                  '[&_button]:!hidden',

                  // text
                  'text-sm italic text-gray-500',
                ]
              : []),

            // input
            ...(type === 'input'
              ? [
                  // ordered list
                  '[&_ol]:!list-none [&_ol]:!m-0 [&_ol]:!p-0',

                  // unordered list
                  '[&_ul]:!list-none [&_ul]:!m-0 [&_ul]:!p-0',

                  // list items
                  '[&_li]:!m-0 [&_li]:!p-0',
                ]
              : []),

            // performance
            'translate-y-0', // @note not sure if this makes any difference

            // class name
            className
          )}
          disabled={!isLast || showLoading}
          ref={newElementsObserverRef}
        >
          <div className="flex flex-wrap gap-6 [align-items:var(--thisMessageAlignItems)]">
            {botIcon && type == 'bot' ? (
              <Icon.Memo
                className={clsx(
                  // background & text color
                  'bg-[var(--thisMessageIconPrimary)] text-[var(--thisMessageIconText)]',

                  // rounding
                  'rounded-[var(--thisMessageIconRounding)]',

                  // width & height
                  'w-[var(--thisMessageIconSize)] h-[var(--thisMessageIconSize)] [font-size:var(--thisMessageIconSize)]'
                )}
                icon={botIcon}
              />
            ) : null}
            {userIcon && type === 'user' ? (
              <Icon.Memo
                className={clsx(
                  // background & text color
                  'bg-[var(--thisMessageIconPrimary)] text-[var(--thisMessageIconText)]',

                  // rounding
                  'rounded-[var(--thisMessageIconRounding)]',

                  // width & height
                  'w-[var(--thisMessageIconSize)] h-[var(--thisMessageIconSize)] [font-size:var(--thisMessageIconSize)]'
                )}
                icon={userIcon}
              />
            ) : null}
            {contextIcon && type == 'context' ? (
              <Icon.Memo
                className={clsx(
                  // background & text color
                  'bg-[var(--thisMessageIconPrimary)] text-[var(--thisMessageIconText)]',

                  // rounding
                  'rounded-[var(--thisMessageIconRounding)]',

                  // width & height
                  'w-[var(--thisMessageIconSize)] h-[var(--thisMessageIconSize)] [font-size:var(--thisMessageIconSize)]'
                )}
                icon={contextIcon}
              />
            ) : null}
            <div className="flex-1 w-full">
              {showLoading ? (
                <div
                  className={clsx(
                    // prose

                    'prose prose-sizeless prose-colorless prose-inherit-text-properties',

                    // whitespace

                    ...[
                      // 'whitespace-pre-wrap',

                      '[word-break:break-word]',
                    ]
                  )}
                >
                  <DotsLoader />
                </div>
              ) : (
                <SilencingErrorBoundary>
                  <div
                    className={clsx(
                      'inner',

                      // padding
                      'p-[var(--thisMessageInnerPadding)]',

                      // background & text color
                      'bg-[var(--thisMessageInnerPrimary)] text-[var(--thisMessageInnerText)]',

                      // rounding
                      'rounded-[var(--thisMessageInnerRounding)]',

                      // border
                      '[border-width:var(--thisMessageInnerBorderSize)] [border-color:var(--thisMessageInnerBorderPrimary)]',

                      // shadow
                      '[box-shadow:var(--thisMessageInnerBoxShadow)]'
                    )}
                  >
                    {shouldRenderMarkdown ? (
                      <ReactMarkdown
                        className={clsx(
                          // prose

                          'prose prose-sizeless prose-colorless prose-inherit-text-properties',

                          'prose-h1:[font-size:var(--thisMessageH1FontSize)]',
                          'prose-h2:[font-size:var(--thisMessageH2FontSize)]',
                          'prose-h3:[font-size:var(--thisMessageH3FontSize)]',

                          // whitespace

                          ...[
                            // 'whitespace-pre-wrap',

                            '[word-break:break-word]',

                            'hyphens-auto',
                          ],

                          // individual styles

                          '[&_a]:break-all',
                          '[&_li]:m-0',
                          '[&_img]:w-full [&_img]:rounded-lg [&_img]:m-0',
                          '[&_video]:w-96 [&_video]:max-w-full [&_video]:rounded-lg [&_video]:overflow-hidden',
                          '[&_iframe]:w-96 [&_iframe]:max-w-full [&_iframe]:rounded-lg [&_iframe]:overflow-hidden [&_iframe]:aspect-video',

                          // codeblock

                          '[&_.codeblock+.codeblock]:!mt-2', // @todo required because we override the prose styles in the codeblock itself - maybe undo this
                          '[&_.codeblock+h1]:!mt-4', // @todo required because we override the prose styles in the codeblock itself - maybe undo this

                          // dot

                          '[&_a[href$="#loading-dot"]]:!no-underline [&_a[href$="#loading-dot"]]:pointer-events-none [&_a[href$="#loading-dot"]]:text-inherit [&_a[href$="#loading-dot"]]:animate-pulse',
                          '[&_a[href$="#writing-dot"]]:!no-underline [&_a[href$="#writing-dot"]]:pointer-events-none [&_a[href$="#writing-dot"]]:text-inherit [&_a[href$="#writing-dot"]]:animate-pulse [&_a[href$="#writing-dot"]]:opacity-50 [&_a[href$="#writing-dot"]]:absolute [&_a[href$="#writing-dot"]]:ml-2',
                          {
                            'overflow-hidden whitespace-nowrap text-ellipsis [&>*]:m-0 [&>*]:overflow-hidden [&>*]:whitespace-nowrap [&>*]:text-ellipsis':
                              type === 'context' && !!action,
                            'shimmer-subtle':
                              (type === 'context' &&
                                isActionWorking &&
                                isLast) ||
                              isShowingWorkingAction,
                          }
                        )}
                        remarkPlugins={remarkPlugins}
                        rehypePlugins={rehypePlugins}
                        components={components}
                        skipHtml={true}
                      >
                        {text +
                          (theme.messageStyle === 'stack' && isLast && isWriting
                            ? `${
                                text.endsWith('```') ? '\n\n' : ' '
                              }[${DOT}](#writing-dot)`
                            : '')}
                      </ReactMarkdown>
                    ) : null}
                    {references
                      ? null // @note not used at the moment because the list of references can be quite big
                      : null}
                  </div>
                </SilencingErrorBoundary>
              )}
              {tools && !hideTools && !showLoading ? (
                <Tools.Memo
                  originalMessageId={originalMessageId}
                  id={id}
                  type={type}
                  text={text}
                  meta={meta}
                  extra={extra}
                />
              ) : null}
            </div>
          </div>
        </Collapsible>
        {attachments?.length ? (
          <Attachments.Memo key="attachments" attachments={attachments} />
        ) : null}
        {micro ? <Micro.Memo key="micro" type={type} data={micro} /> : null}
      </SpaceSavingDiv>
    </>
  )
}

Message.Memo = memo(Message)

export function ReceivedMessages({
  intro,

  initial,

  messages,

  hasIncoming,

  disabled,
}) {
  const visibleMessages = useMemo(() => {
    const visibleMessages = messages.filter(
      (message) => message.extra?.visible !== false
    )

    return visibleMessages
  }, [messages])

  const lastUserMessageIndex = useMemo(() => {
    return visibleMessages.findLastIndex((message) => message.type === 'user')
  }, [visibleMessages])

  const lastBotMessageIndex = useMemo(() => {
    if (hasIncoming) {
      return -1
    }

    return visibleMessages.findLastIndex((message) => message.type === 'bot')
  }, [visibleMessages, hasIncoming])

  return (
    <>
      {intro ? (
        <IntroMessage text={intro} isLast={false} disabled={disabled} />
      ) : null}
      {initial ? (
        <InitialMessage text={initial} isLast={false} disabled={disabled} />
      ) : null}
      {visibleMessages.map(
        (
          {
            originalMessageId,
            sequenceMessageId,

            id,

            type,
            text,

            actions,

            meta,

            micro,

            extra,

            references,

            attachments,

            createdAt,
            updatedAt,
          },
          index,
          array
        ) => {
          let key = id || `index/${index}`

          if (createdAt) {
            key = `${key}/createdAt:${createdAt}`
          }

          if (updatedAt) {
            key = `${key}/updatedAt:${updatedAt}`
          }

          // @note temporary override of the key to the index to see if it
          // improves rendering performance
          {
            key = index
          }

          const isLast = !hasIncoming && index === array.length - 1

          const isLastOfType =
            type === 'user'
              ? index === lastUserMessageIndex
              : type === 'bot'
              ? index === lastBotMessageIndex
              : false

          return (
            <Message.Memo
              key={key}
              originalMessageId={originalMessageId}
              sequenceMessageId={sequenceMessageId}
              id={id}
              type={type}
              text={text}
              actions={actions}
              meta={meta}
              micro={micro}
              extra={extra}
              references={references}
              attachments={attachments}
              isLast={isLast}
              isLastOfType={isLastOfType}
              isThinking={false}
              isWriting={false}
              disabled={disabled}
            />
          )
        }
      )}
    </>
  )
}

ReceivedMessages.Memo = memo(ReceivedMessages)

export function IncomingMessage({
  originalMessageId,
  sequenceMessageId,

  id,

  type,
  text,

  actions,

  meta,

  micro,

  extra,

  attachments,

  thinking,
  writing,

  disabled,
}) {
  return (
    <Message.Memo
      originalMessageId={originalMessageId}
      sequenceMessageId={sequenceMessageId}
      key={id}
      id={id}
      type={type}
      text={text}
      actions={actions}
      meta={meta}
      micro={micro}
      extra={extra}
      attachments={attachments}
      isLast={true}
      isThinking={thinking}
      isWriting={writing}
      disabled={disabled}
    />
  )
}

IncomingMessage.Memo = memo(IncomingMessage)

export function IntroMessage({ text, isLast, disabled }) {
  const { getLocalText } = useContext(IntlContext)

  return (
    <>
      <Message.Memo
        key="intro"
        id="intro"
        type="intro"
        text={getLocalText('intro', text)}
        hideTools={true}
        isLast={isLast}
        disabled={disabled}
      />
    </>
  )
}

IntroMessage.Memo = memo(IntroMessage)

export function InitialMessage({ text, isLast, disabled }) {
  const { getLocalText } = useContext(IntlContext)

  const { theme } = useContext(ThemeContext)

  const isBubble = theme.messageStyle === 'bubble'

  const texts = useMemo(() => {
    const localText = getLocalText('initial', text)

    if (isBubble) {
      return splitBubbleText(localText)
    } else {
      return [localText]
    }
  }, [getLocalText, text, isBubble])

  return (
    <>
      {texts.map((text, index) => {
        return (
          <Message.Memo
            key={`initial/${index}`}
            id={`initial/${index}`}
            type="initial"
            text={text}
            hideTools={true}
            isLast={isLast && index === texts.length - 1}
            disabled={disabled}
          />
        )
      })}
    </>
  )
}

InitialMessage.Memo = memo(InitialMessage)

/**
 * The main component for displaying messages.
 */
export function Messages({
  className,

  style,

  intro,

  initial,

  messages: _messages,

  incoming,

  thinking,
  writing,

  visibleUserMessages: _visibleUserMessages = Infinity,
  visibleBotMessages: _visibleBotMessages = Infinity,

  disabled,

  children,
}) {
  const { theme } = useContext(ThemeContext)

  const visibleUserMessages = useMemo(() => {
    let visibleUserMessages = _visibleUserMessages

    visibleUserMessages = Math.max(0, visibleUserMessages)

    return visibleUserMessages
  }, [_visibleUserMessages])

  const visibleBotMessages = useMemo(() => {
    let visibleBotMessages = _visibleBotMessages

    if (thinking || writing) {
      visibleBotMessages -= 1
    }

    visibleBotMessages = Math.max(0, visibleBotMessages)

    return visibleBotMessages
  }, [_visibleBotMessages, thinking, writing])

  const messages = useMemo(() => {
    if (visibleUserMessages === Infinity && visibleBotMessages === Infinity) {
      return _messages
    }

    let messages = _messages

    messages = messages.slice(
      -Math.max(visibleUserMessages, visibleBotMessages)
    )

    let userCount = 0
    let botCount = 0

    messages = messages
      .reverse()
      .filter((message) => {
        if (message.type === 'user') {
          if (userCount < visibleUserMessages) {
            userCount++

            return true
          }
        } else if (message.type === 'bot') {
          if (botCount < visibleBotMessages) {
            botCount++

            return true
          }
        }

        return false
      })
      .reverse()

    return messages
  }, [_messages, visibleUserMessages, visibleBotMessages])

  const hasIncoming =
    incoming &&
    !equal(
      pick(incoming, ['type', 'text']),
      pick(getLast(messages) || {}, ['type', 'text'])
    )

  return (
    <div
      className={clsx(
        'messages',

        'flex flex-col',

        'p-[var(--messagesPadding)]',

        'bg-[var(--messagesPrimary,transparent)]',

        {
          'backdrop-blur-md': theme.messagesBackdropBlurPrimary === 'md',
          'backdrop-blur-lg': theme.messagesBackdropBlurPrimary === 'lg',
          'backdrop-blur-xl': theme.messagesBackdropBlurPrimary === 'xl',
        },

        className
      )}
      style={style}
    >
      <div
        className={clsx(
          'flex flex-col',
          'space-y-[var(--messageSpacing)]', // @note don't use gaps - space-y uses margins which can be overridden
          'divide-y-[var(--messageDividerSize,0px)] divide-[var(--messageDividerPrimary,transparent)]'
        )}
      >
        <ReceivedMessages.Memo
          key="messages"
          intro={intro}
          initial={initial}
          messages={messages}
          hasIncoming={hasIncoming}
          disabled={disabled}
        />
        {hasIncoming ? (
          <IncomingMessage.Memo
            {...incoming}
            key={incoming?.sequenceMessageId || 'seq/0'}
            thinking={thinking}
            writing={writing}
            disabled={disabled}
          />
        ) : null}
      </div>
      {children}
    </div>
  )
}

Messages.Memo = memo(Messages)

/*****************************************
 * SECTION: LanguageSelector
 *****************************************/

/**
 * A component that allows the user to select a language.
 */
export function LanguageSelector({ className }) {
  const {
    availableLocales,

    locale,
    setLocale,
  } = useContext(IntlContext)

  const languageNames = useMemo(() => {
    try {
      return new Intl.DisplayNames([locale || 'en'], {
        type: 'language',
      })
    } catch {
      return {
        of(locale) {
          return locale
        },
      }
    }
  }, [locale])

  const [isDialogOpen, setIsDialogOpen] = useState(false)

  if (availableLocales.length <= 1) {
    return null
  }

  return (
    <div
      className={clsx(
        'language-selector',
        'w-[1.2em] h-[1.2em] [line-height:0px]',
        className
      )}
    >
      <button
        className="w-full h-full"
        type="button"
        onClick={() => setIsDialogOpen(true)}
      >
        <img
          className="w-full h-full rounded-full"
          src={`https://cdn.jsdelivr.net/npm/language-icons@0.3.0/icons/${locale}.svg`}
          alt={locale}
        />
      </button>
      <Dialog
        open={isDialogOpen}
        type="modal"
        onClickOutside={() => setIsDialogOpen(false)}
        onClose={() => setIsDialogOpen(false)}
      >
        <ul className="space-y-5">
          {availableLocales.map((locale) => {
            return (
              <li key={locale}>
                <button
                  className="flex flex-row gap-2 justify-start items-center"
                  type="button"
                  onClick={() => {
                    setLocale(locale)
                    setIsDialogOpen(false)
                  }}
                >
                  <img
                    className="h-10 w-10 rounded-full"
                    src={`https://cdn.jsdelivr.net/npm/language-icons/icons/${locale}.svg`}
                    alt={locale}
                  />
                  <span>{languageNames.of(locale)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </Dialog>
    </div>
  )
}

/*****************************************
 * SECTION: Menu
 *****************************************/

/**
 * A generic menu component used for displaying options, such as the bar.
 */
export function Menu({ className, children }) {
  return (
    <HeadlessMenu className={clsx('menu', className)} as="div">
      <div className="relative">{children}</div>
    </HeadlessMenu>
  )
}

Menu.Button = function MenuButton({ className, children }) {
  return (
    <HeadlessMenu.Button className={className}>{children}</HeadlessMenu.Button>
  )
}

Menu.Items = function MenuItems({ className, children, ...props }) {
  return (
    <HeadlessMenu.Items
      {...props}
      className={clsx(
        'focus:outline-none',
        'absolute z-10',
        'w-40',
        'bg-white text-black',
        'rounded-xl overflow-hidden',
        'border border-gray-200',
        '[font-size:var(--fontSize,1rem)]',
        className
      )}
      as="div"
    >
      {children}
    </HeadlessMenu.Items>
  )
}

Menu.Item = function MenuItem({ className, children, ...props }) {
  return (
    <HeadlessMenu.Item {...props}>
      {({ active }) => {
        return (
          <div
            className={clsx('p-5 truncate', className, {
              'bg-gray-100 text-black': active,
            })}
          >
            {children}
          </div>
        )
      }}
    </HeadlessMenu.Item>
  )
}

/*****************************************
 * SECTION: Bar
 *****************************************/

export function BarButton({
  className,

  as = 'button',

  icon,

  children,

  ...props
}) {
  return (
    <Component
      as={as}
      className={clsx(
        'rounded overflow-hidden',
        'w-[1.2em] h-[1.2em]',
        'cursor-pointer',
        'transition duration-150 ease-in-out',
        'flex flex-row gap-2 items-center',
        'font-normal',
        className
      )}
      type="button"
      {...props}
    >
      {icon ? (
        <div
          className={clsx('h-full', {
            'w-full': !children,
            'w-auto': !!children,
          })}
        >
          <Component className="w-full h-full [stroke-width:1px]" as={icon} />
        </div>
      ) : null}
      {children ? <div>{children}</div> : null}
    </Component>
  )
}

/**
 * The bar at the top of the chat widget.
 */
export function Bar({ className }) {
  const {
    barIcon,
    barTitle,

    layout,

    exportConversation: useExportConversation,
    restartConversation: useRestartConversation,

    maximize: useMaximize,

    disabled,
  } = useContext(ConfigContext)

  const { getLocalText } = useContext(IntlContext)

  const { conversationId } = useContext(ConversationContext)

  const { confirm } = useContext(ModalContext)

  const {
    mobile,

    open,
    setOpen,

    maximize,
    setMaximize,
  } = useContext(ResizeContext)

  const { theme } = useContext(ThemeContext)

  const { autoHideButton } = useButtonFeatures()

  const renderRestartButton = useMemo(() => {
    return useRestartConversation && conversationId
  }, [useRestartConversation, conversationId])

  const renderExportButton = useMemo(() => {
    return useExportConversation && conversationId
  }, [useExportConversation, conversationId])

  const renderMaximizeButton = useMemo(() => {
    return useMaximize && ['popover'].includes(layout) && !mobile
  }, [useMaximize, layout, mobile])

  const renderCloseButton = useMemo(() => {
    if (!['popover', 'popout', 'slideover'].includes(layout)) {
      return false
    }

    if (autoHideButton) {
      return true
    } else {
      if (mobile && open) {
        return true
      } else {
        return false
      }
    }
  }, [layout, mobile, open, autoHideButton])

  return (
    <>
      <div
        className={clsx(
          'bar',

          'bg-[var(--barPrimary,#ffffff)] text-[var(--barText,#000000)]',

          // 'backdrop-blur-xl', // @todo it messes up the corners of the bar so it requires another solution

          'border-b-[var(--barBorderPrimary,var(--barPrimary,transparent))] [border-bottom-width:var(--barBorderSize,1px)]',

          'p-[var(--barPadding,1rem)]',

          '[font-size:var(--barFontSize,1.1rem)] tracking-tight font-bold',

          'flex flex-row items-center gap-2',

          {
            'backdrop-blur-md': theme.barBackdropBlurPrimary === 'md',
            'backdrop-blur-lg': theme.barBackdropBlurPrimary === 'lg',
            'backdrop-blur-xl': theme.barBackdropBlurPrimary === 'xl',
          },

          className
        )}
      >
        <DynamicIcon
          className="w-[1.3em] h-[1.3em] [font-size:1.3em] fill-current rounded-[var(--barIconRounding,100%)] object-cover"
          icon={barIcon || WidgetIcon}
        />
        {barTitle ? (
          <div className="truncate flex-1">
            {getLocalText('title', barTitle)}
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <div className="shrink-0 flex flex-row items-center gap-2">
          <LanguageSelector />
          {renderRestartButton || renderExportButton ? (
            <Menu
              className={clsx(
                '[line-height:0px]' // @note maybe not true anymore but without it we get extra spacing at the bottom of the button
              )}
              disabled={disabled}
            >
              <Menu.Button>
                <BarButton as="div" icon={MenuIcon} />
              </Menu.Button>
              <Menu.Items className="right-0">
                {renderRestartButton ? (
                  <Menu.Item
                    className="cursor-pointer font-normal"
                    onClick={async () => {
                      if (
                        await confirm(
                          getLocalText(
                            'confirmRestart',
                            'Are you sure you want to restart this conversation?'
                          )
                        )
                      ) {
                        postToSelf({ type: 'restartConversation' })
                      }
                    }}
                  >
                    {getLocalText('restart', 'Restart')}
                  </Menu.Item>
                ) : null}
                {renderExportButton ? (
                  <Menu.Item
                    className="cursor-pointer font-normal"
                    onClick={() => {
                      postToSelf({ type: 'downloadConversation' })
                    }}
                  >
                    {getLocalText('export', 'Export')}
                  </Menu.Item>
                ) : null}
              </Menu.Items>
            </Menu>
          ) : null}
          {renderMaximizeButton ? (
            <BarButton
              icon={maximize ? MinimizeIcon : MaximizeIcon}
              onClick={() => setMaximize((prevMaximize) => !prevMaximize)}
              disabled={disabled}
            />
          ) : null}
          {renderCloseButton ? (
            <BarButton
              icon={CloseIcon}
              onClick={() => setOpen(false)}
              disabled={disabled}
            />
          ) : null}
        </div>
      </div>
    </>
  )
}

/*****************************************
 * SECTION: Banner
 *****************************************/

/**
 * The banner at the top of the chat widget.
 */
export function Banner({ className, hideBanner }) {
  const { banner } = useContext(ConfigContext)

  const [hasErrors, setHasErrors] = useState(false)

  const { background, aspect, object } = useMemo(() => {
    const url = new URL(banner, 'https://chatbotkit.com')

    const fragmentQuery = new URLSearchParams(url.hash.slice(1))

    return {
      background: fragmentQuery.get('background'),
      aspect: fragmentQuery.get('aspect'),
      object: fragmentQuery.get('object'),
    }
  }, [banner])

  return hideBanner ? null : banner && !hasErrors ? (
    <div
      className={clsx(
        'banner',

        'bg-[var(--bannerPrimary(var(--barPrimary,#ffffff))]',

        className
      )}
      style={{ background }}
    >
      <img
        className={clsx('w-full select-none pointer-events-none', {
          // aspect
          'max-h-52': !aspect,
          'aspect-auto': aspect === 'auto',

          // object
          'object-cover': !object,
          'object-contain': object === 'contain',
          'object-fill': object === 'fill',
        })}
        src={banner}
        alt="banner"
        onError={() => setHasErrors(true)}
      />
    </div>
  ) : null
}

/*****************************************
 * SECTION: Tap
 *****************************************/

/**
 * A general purpose mobile-friendly button.
 */
export function Tap({
  name,
  icon,
  iconClassName,
  className,
  style: _style,
  disabled,
  ...props
}) {
  const { theme } = useContext(ThemeContext)

  const style = useMemo(() => {
    return {
      ..._style,

      '--thisText': accessVar(
        `--${name}Text`,
        '--tapText',
        '--buttonText',
        'inherit'
      ),
    }
  }, [name, _style])

  return !theme.buttonless ? (
    <button
      type="button" // @note before props because we want to override it
      {...props}
      className={clsx(
        'send',

        'text-[var(--thisText)]',
        'p-1',

        {
          group: !disabled,

          '': disabled, // @todo add disabled style
        },

        className
      )}
      style={style}
      disabled={disabled}
    >
      <Component
        as={icon}
        className={clsx(
          'w-[1.2em] h-[1.2em]',
          'opacity-80 group-hover:opacity-100',
          'transition-opacity duration-200',
          iconClassName
        )}
      />
    </button>
  ) : null
}

/**
 * A mobile-friendly button used for submitting messages, forms, etc.
 */
export function Send({ ...props }) {
  return <Tap name="send" icon={SendIcon} {...props} />
}

/**
 * A mobile-friendly button used for stopping the conversation.
 */
export function Stop({ ...props }) {
  return <Tap name="stop" icon={StopIcon} {...props} />
}

/**
 * A mobile-friendly button used for selecting attachments.
 */
export function Attach({ ...props }) {
  return <Tap name="attach" icon={AttachmentIcon} {...props} />
}

/**
 * A mobile-friendly button for speaking.
 */
export function Speak({ active, ...props }) {
  return (
    <Tap
      name="speak"
      icon={active ? MicMuteIcon : MicIcon}
      iconClassName={active ? 'stroke-red-500' : ''}
      {...props}
    />
  )
}

/*****************************************
 * SECTION: PoweredBy
 *****************************************/

// @note the minimum WCAG contrast ratio the "powered by" badge text must keep
// against the surface behind it. Any theme color below this is overridden with
// a legible black/white so the branding can never be made invisible.
//
// @decision we use 4.5 (WCAG AA for normal text - the badge is `text-sm`, so AA
// applies). The alternative is 3.0 (AA for large/UI text), which respects
// tasteful low-contrast branding and only blocks genuine invisibility. Trade-off:
//   - 4.5 -> maximally legible, but overrides more custom colors. Notably our
//     own indigo-500 (#6366f1) on white is 4.467, i.e. *just* under this floor,
//     so an explicit indigo-500 badge text would be bumped to black. In practice
//     the badge inherits `conversationText` (gray-900), not indigo, so this only
//     bites when a theme explicitly overrides the badge text color.
//   - 3.0 -> honors more brand colors (incl. indigo-500) while still guaranteeing
//     the badge stays clearly visible.
// Kept at 4.5 for the strongest legibility guarantee; change to 3.0 here if brand
// fidelity is preferred over strict AA. This is the single knob for the behavior.
export const POWERED_BY_MIN_CONTRAST = 4.5

/**
 * Resolve a background/text pair for the "powered by" badge that stays legible
 * regardless of the theme colors chosen by the widget owner.
 *
 * The badge is a transparent pill that normally sits on the conversation
 * surface and inherits the message text color. Because every one of those
 * values is user-controlled (and `messageText`/`messageInnerText` only affect
 * the badge, not real messages), a theme could set the text to match the
 * background and make the branding invisible - the abuse the old inline `@todo`
 * warned about. To prevent that we only honor the chosen text color when it
 * clears {@link POWERED_BY_MIN_CONTRAST}; otherwise we force a legible
 * black/white. When the surface is not an opaque color we can reason about
 * (transparent / gradient over an unknown host page) we render the badge as a
 * self-contained opaque chip so it is always visible.
 *
 * @param {object} [theme]
 * @param {number} [minRatio]
 * @returns {{ primary?: string, text: string }}
 */
export function resolvePoweredByColors(
  theme = {},
  minRatio = POWERED_BY_MIN_CONTRAST
) {
  // The pill is transparent by default, so the text sits on the conversation
  // surface - unless the theme gives the pill its own opaque fill.
  const pillFill = theme.messageInnerPrimary ?? theme.messagePrimary

  const surface = isOpaqueColor(pillFill) ? pillFill : theme.conversationPrimary

  // The color the text would actually render in: badge-specific overrides win,
  // otherwise the inherited conversation text.
  const desired =
    theme.messageInnerText ?? theme.messageText ?? theme.conversationText

  const text = legibleTextColor(surface, desired, minRatio)

  if (text != null) {
    // Legible on the existing (usually transparent) pill - keep it as-is and
    // only pin the text color.
    return { text }
  }

  // Indeterminate surface: give the badge its own opaque chip whose colors are
  // guaranteed to contrast, so the branding survives even over a transparent
  // frame on an unknown host page.
  return isLightOnDarkTheme(theme)
    ? { primary: '#1f2937', text: '#f9fafb' } // gray-800 chip / gray-50 text
    : { primary: '#f3f4f6', text: '#374151' } // gray-100 chip / gray-700 text
}

/**
 * The powered by message at the bottom of the chat widget.
 */
export function PoweredBy({ className, style: _style }) {
  const { theme } = useContext(ThemeContext)

  const legible = useMemo(() => resolvePoweredByColors(theme), [theme])

  const style = useMemo(() => {
    return {
      ..._style,

      '--thisPoweredByPadding': accessVar(
        '--poweredByPadding', // @todo this can be potentially abused to hide the powered by so watch out for it
        '--inputPadding',
        '0.5rem 0.75rem'
      ),

      // @note text/background are resolved to a guaranteed-legible pair (see
      // resolvePoweredByColors) so a theme cannot make the branding invisible.

      '--thisPoweredByPrimary':
        legible.primary ??
        accessVar('--messageInnerPrimary', '--messagePrimary', 'transparent'),

      '--thisPoweredByText': legible.text,
    }
  }, [_style, legible])

  const buildFrontendURL = useExternalFrontendURL()

  const {
    brandCaption = 'ChatBotKit',
    brandURL = buildFrontendURL('/'),
    brandLogo,
  } = useContext(ConfigContext)

  return (
    <div
      className={clsx(
        'powered-by',

        'text-sm select-none',

        'p-[var(--thisPoweredByPadding)]',

        className
      )}
      style={style}
    >
      <span
        className={clsx(
          'inline-block rounded-md',

          // We use the same color as the bot message primary color to make it
          // look like it is part of the conversation.

          'bg-[var(--thisPoweredByPrimary)] text-[var(--thisPoweredByText)]',
          '[&_a]:!text-[var(--thisPoweredByText)]'
        )}
      >
        <ExternalLink className="!no-underline" href={brandURL}>
          {brandLogo ? (
            <DynamicIcon className="h-3" icon={brandLogo} />
          ) : (
            <>powered by {brandCaption}</>
          )}
        </ExternalLink>
      </span>
    </div>
  )
}

/*****************************************
 * SECTION: Forms
 *****************************************/

/**
 */
export function StartFirstForm({ className, disabled, ...props }) {
  // state

  const { state } = useContext(StateContext)

  // submitted

  const [submitted, setSubmitted] = useState(false)

  // handle on submit

  const handleOnSubmit = useCallback(
    async function (event) {
      event.preventDefault()
      event.stopPropagation()

      if (disabled) {
        return
      }

      setSubmitted(true)

      postToSelf({
        type: 'receiveMessage',
        props: {},
      })
    },
    [disabled]
  )

  // get rendering target

  const [target] = useDOMQuerySelector('#mainInputArea', {
    waitForElements: true,
  })

  // render condition

  const shouldRender =
    // target is available
    target &&
    // there are some messages in the conversation
    !state.hasMessages

  // render

  return (
    shouldRender &&
    createPortal(
      <form
        {...props}
        id="startFirstForm"
        className={clsx(className, 'relative space-y-2')}
        onSubmit={handleOnSubmit}
        disabled={disabled || submitted}
      >
        <TextAreaLike className={clsx()}>
          <button
            className={clsx('group', 'text-[var(--sendText)]', 'p-2')}
            type="submit"
            disabled={disabled || submitted}
          >
            <PlayCircleIcon
              className={clsx(
                'w-10 h-10 stroke-current',
                'stroke-1 group-hover:stroke-[1.5px]',
                'group-disabled:stroke-1 group-disabled:text-[var(--inputBorderPrimary)]',
                {
                  'animate-spin': submitted,
                }
              )}
            />
          </button>
        </TextAreaLike>
      </form>,
      target
    )
  )
}

StartFirstForm.Memo = memo(StartFirstForm)

/**
 */
export function ContactCollectionForm({ className, disabled, ...props }) {
  // config

  const { contact: _contact } = useContext(ConfigContext)

  // context

  const {
    conversationId,

    token,
    tokenExpiresAt,

    session,
  } = useContext(ConversationContext)

  // state

  const { state, setState } = useContext(StateContext)

  // locale

  const { getLocalText } = useContext(IntlContext)

  // fetch

  const { loading, fetch } = useFetch()

  // flash

  const [flash, setFlash] = useAutoRevert({ delay: 100 })

  // contact

  const contact = state.contact || _contact

  const setContact = useCallback(
    (contact) => {
      setState((state) => {
        return {
          ...state,

          contact,
        }
      })
    },
    [setState]
  )

  // contact session channel

  const channel = useSessionChannel({ session })

  // contact session save/restore/sync

  useSessionSaveRestoreSync(
    {
      session,
      channel,

      key: 'contact',

      defaultValue: null,
      value: contact,
      setValue: setContact,

      expiresAt: tokenExpiresAt,
    },
    [contact]
  )

  // completed

  const [completed, setCompleted] = useState(false)

  // upsert contact helper

  const upsertContact = useCallback(
    async (contact) => {
      if (!conversationId) {
        return
      }

      if (!token) {
        return
      }

      if (completed) {
        return
      }

      if (!contact) {
        await captureError(new Error('Contact expected but not provided'))

        return
      }

      if (!contact.name && !contact.email && !contact.phone) {
        await captureError(new Error(`Contact props expected but not provided`))

        return
      }

      setCompleted(true)

      await fetch(`/api/v1/conversation/${conversationId}/contact/upsert`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          // @note since we are not passing any fingerprint and we are relaying
          // on the untrusted client, the upsert action will create an untrusted
          // contact every time - which is acceptable in this case as the user
          // is completely anonymous at this stage

          // @note the only way to obtain a trusted contact session is to engage
          // with the session creation API directly and passing the session to
          // the widget

          name: contact.name,
          email: contact.email,
          phone: contact.phone,
        },
      })
    },
    [conversationId, token, completed, fetch]
  )

  // upsert the contact if we need to the first time

  useEffect(() => {
    if (!contact) {
      return
    }

    upsertContact(contact)
  }, [contact, upsertContact])

  // sync contact

  useSynchronizedValue({
    name: 'contact',
    value: contact,
    setValue: setContact,
  })

  // legacy functions

  useEffect(() => {
    async function onMessage(event) {
      if (!isSafeMessageEvent(event)) {
        return
      }

      switch (event.data.type) {
        case 'assignContact': {
          setContact(event.data.props)

          break
        }
      }
    }

    window.addEventListener('message', onMessage)

    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [setContact])

  // handle on submit

  const handleOnSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      event.stopPropagation()

      if (disabled) {
        return
      }

      const { name, email } = formToData(event.target)

      if (!name || !email) {
        event.target.reportValidity()

        setFlash(true)

        return
      }

      if (!looksLikeEmail(email)) {
        event.target.reportValidity()

        setFlash(true)

        return
      }

      const contact = { name, email }

      setContact(contact)

      upsertContact(contact)
    },
    [disabled, setFlash, setContact, upsertContact]
  )

  // get rendering target

  const [target] = useDOMQuerySelector('#mainInputArea', {
    waitForElements: true,
  })

  // render condition

  const shouldRender =
    // target is available
    target &&
    // there are some messages in the conversation
    state.hasMessages &&
    // the conversation id is available
    !!conversationId &&
    // the contact is still not set
    !contact

  // render

  return (
    shouldRender &&
    createPortal(
      <form
        {...props}
        id="contactDetailsForm"
        className={clsx(className)}
        onSubmit={handleOnSubmit}
        disabled={disabled || loading}
      >
        <TextAreaLike
          className={clsx(
            'relative',

            {
              'focus:!border-transparent focus:!ring-0 focus-within:!border-transparent focus-within:!ring-0':
                flash,
            }
          )}
        >
          <div className={clsx('flex flex-col')}>
            <SegmentInput
              key="nameInput"
              type="text"
              name="name"
              placeholder={getLocalText('name', 'Name')}
              defaultValue={contact?.name}
              required={true}
              autoTab={true}
              autoSubmit={false}
              disabled={disabled || loading}
              autoFocus={true}
              spellCheck={false}
              tabIndex={1}
              onAutoError={() => setFlash(true)}
            />
            <SegmentInput
              key="emailInput"
              type="email"
              name="email"
              placeholder={getLocalText('email', 'Email')}
              defaultValue={contact?.email}
              required={true}
              autoTab={false}
              autoSubmit={true}
              disabled={disabled || loading}
              autoFocus={false}
              spellCheck={false}
              tabIndex={2}
              onAutoError={() => setFlash(true)}
            />
          </div>
          <Send
            className="absolute bottom-3 right-1"
            type="submit"
            disabled={disabled || loading}
          />
        </TextAreaLike>
      </form>,
      target
    )
  )
}

ContactCollectionForm.Memo = memo(ContactCollectionForm)

/*****************************************
 * SECTION: ScrollButton
 *****************************************/

export function ScrollButton({ style, className, ...props }) {
  return (
    <div
      {...props}
      style={{
        '--thisSize': accessVar('--scrollButtonSize', '40px'),
        '--thisPadding': accessVar('--scrollButtonPadding', '8px'),
        '--thisRounding': accessVar('--scrollButtonRounding', '100%'),
        '--thisPrimary': accessVar('--scrollButtonPrimary', '#000000'),
        '--thisText': accessVar('--scrollButtonText', '#ffffff'),

        ...style,
      }}
      className={clsx(
        'w-[var(--thisSize)] h-[var(--thisSize)]',
        'p-[var(--thisPadding)]',
        'rounded-[var(--thisRounding)]',
        'bg-[var(--thisPrimary)] text-[var(--thisText)]',
        'cursor-pointer',
        className
      )}
    >
      <DownIcon className="w-full h-full text-current" />
    </div>
  )
}

/*****************************************
 * SECTION: Conversation
 *****************************************/

/**
 * @todo this function requires further breakdown to make it easier
 */
export function Conversation({
  className,

  // @note initial messages can be provided directly as a prop
  messages: _messages,

  // @note initial functions can be provided directly as a prop
  functions: _functions,

  // @note initial meta can be provided directly as a prop
  meta: _meta,

  // @note parameter used in the /hub
  // @todo should we get this from the config
  getToken: _getToken,

  // @note parameter used in the /hub
  // @todo should we get this from the config
  getTokenRoute: _getTokenRoute,

  hideBar: _hideBar,
  hideBanner: _hideBanner,

  visibleUserMessages: _visibleUserMessages,
  visibleBotMessages: _visibleBotMessages,

  // @note the conversation can be disabled in general
  disabled,
}) {
  // re-render key

  const [reRenderKey, setReRenderKey] = useState(0)

  // config

  const {
    integrationId,

    session,

    privacy,
    moderation,

    stream,

    verbose,

    unfurl,

    autoScroll,

    autoFocus,

    startFirst,

    contactCollection,

    intro,

    initial,

    poweredBy,

    hideBar,
    hideBanner,

    visibleUserMessages,
    visibleBotMessages,

    messages: configMessages,

    functions: configFunctions,

    meta: configMeta,
  } = useConfigContextValues({
    hideBar: _hideBar,
    hideBanner: _hideBanner,

    visibleUserMessages: _visibleUserMessages,
    visibleBotMessages: _visibleBotMessages,
  })

  // refs

  const scrollContainer = useRef()

  // scroll helpers

  const scrollToBottom = useFunctionDispatch(
    (options) => {
      const { force = false, behavior = 'smooth', delay = 0 } = options || {}

      if (!autoScroll) {
        if (!force) {
          return
        }
      }

      if (!scrollContainer.current) {
        return
      }

      const fn = () => {
        // @note re-check scrollContainer.current as it may have become null
        // if the component unmounted while waiting for setTimeout

        if (!scrollContainer.current) {
          return
        }

        scrollContainer.current.scrollTo({
          top: Number.MAX_SAFE_INTEGER,
          behavior: behavior,
        })
      }

      if (delay) {
        setTimeout(fn, delay)
      } else {
        fn()
      }
    },
    [autoScroll]
  )

  useScrollSaveRestore(scrollContainer, 'scrollPosition', disabled)

  // theme

  const { theme } = useContext(ThemeContext)

  // state

  const { setState } = useContext(StateContext)

  // token expiration

  const [tokenExpiresAt, setTokenExpiresAt] = useState(null)

  // conversation manager event handler

  const onItem = useCallback((conversationId, data) => {
    postToParent({
      type: 'onItem',
      props: { conversationId, item: data },
    })
  }, [])

  const onSend = useCallback(
    (conversationId, data) => {
      // @beta feature
      logAnalyticsEvent('message_send', {
        widget_id: integrationId,
        usage_tokens: 0,
        usage_message: 1,
      })

      postToParent({ type: 'onSend', props: { conversationId, message: data } })

      scrollToBottom({ delay: 1 })
    },
    [integrationId, scrollToBottom]
  )

  const onReceive = useCallback(
    (conversationId, data) => {
      // @beta feature
      logAnalyticsEvent('message_receive', {
        widget_id: integrationId,
        usage_tokens: data.usage.token,
        usage_message: 1,
      })

      postToParent({
        type: 'onReceive',
        props: { conversationId, message: data },
      })
    },
    [integrationId]
  )

  // init messages

  const initMessages = useMemo(() => {
    return [...(configMessages || []), ...(_messages || [])]
  }, [configMessages, _messages])

  // init functions

  const initFunctions = useMemo(() => {
    return [...(configFunctions || []), ...(_functions || [])]
  }, [configFunctions, _functions])

  // init meta

  const initMeta = useMemo(() => {
    return { ...configMeta, ..._meta }
  }, [configMeta, _meta])

  // conversation management

  const {
    receivedMessages,
    incomingMessage,

    messages,
    setMessages,

    functions,
    setFunctions,

    attachments,
    setAttachments,

    conversationId,
    setConversationId,

    token,
    setToken,

    flushText: cmFlushText,

    sendMessage: cmSendMessage,
    receiveMessage: cmReceiveMessage,
    completeMessage: cmCompleteMessage,
    initiateMessage: cmInitiateMessage,

    fetch,

    text,
    setText,

    thinking,
    writing,

    abort: cmAbort,

    appendMessage: cmAppendMessage,
  } = useConversationManager({
    session,

    privacy,
    moderation,

    stream,

    // @note surface a pre-canned bot reply in-chat when the account is over its
    // usage limits, instead of the response silently failing
    limitReplyText: messagesConfig.limitsReachedReply,

    maxTextByteLength: DEFAULT_MAX_MESSAGE_TEXT_BYTE_LENGTH,

    // tps: 10, // @note 238 tokens per minute is the average reading speed of a human

    verbose: useMemo(() => {
      if (verbose) {
        return ['dataset', 'skillset', 'function']
      } else {
        return false
      }
    }, [verbose]),

    unfurl,

    messages: initMessages,

    functions: initFunctions,

    autoStart: true,

    onItem,
    onSend,
    onReceive,

    bubble: theme.messageStyle === 'bubble',

    // @note the following options only apply when the text is streaming and
    // will not affect the messages in the message list

    emitCompleteFencedCodeBlocks: useMemo(
      () => [
        // @todo get this list from globally defined handlers for rendering
        // types so that we can extend the list easily

        'mermaid',
        'carousel',
        'form',
        'card',
        'button',
        'buttons',
        'form',
        'math',
      ],
      []
    ),

    emitCompleteAnchors: true,
    emitCompleteImages: true,
  })

  // sync messages
  {
    useSynchronizedValue({
      name: 'messages',
      value: messages,
      setValue: setMessages,
      disabled: thinking || writing,
    })
  }

  // sync functions
  {
    useSynchronizedValue({
      name: 'functions',
      value: functions,
      setValue: setFunctions,
    })
  }

  // sync meta
  const [meta, setMeta] = useState(initMeta)

  {
    useSynchronizedValue({
      name: 'meta',
      value: meta,
      setValue: setMeta,
    })
  }

  // has messages
  {
    // @note the reason we use boolean is to avoid unnecessary executions of the
    // useEffect hook

    const hasMessages = messages.length > 0

    useEffect(() => {
      setState((state) => {
        return {
          ...state,

          hasMessages,
        }
      })
    }, [hasMessages, setState])
  }

  // last visible bot message
  {
    useEffect(() => {
      if (writing) {
        return
      }

      let lastVisibleBotMessage

      if (messages.length) {
        lastVisibleBotMessage = getLast(messages)
      } else {
        lastVisibleBotMessage = initial
          ? { id: 'initial', type: 'bot', text: initial }
          : null
      }

      if (!lastVisibleBotMessage) {
        return
      }

      if (!['bot', 'input'].includes(lastVisibleBotMessage.type)) {
        return
      }

      setState((state) => {
        return {
          ...state,

          lastVisibleBotMessage,
        }
      })
    }, [writing, initial, messages, setState])
  }

  // session channel

  const channel = useSessionChannel({ session })

  // clean session

  const cleanupSession = useSessionCleanup({ session, channel })

  // save/restore/sync sessions

  const conversationIdIsReady = useSessionSaveRestoreSync(
    {
      session,
      channel,

      key: 'conversationId',

      value: conversationId,
      setValue: setConversationId,

      expiresAt: tokenExpiresAt,
    },
    [conversationId]
  )

  const tokenIsReady = useSessionSaveRestoreSync(
    {
      session,
      channel,

      key: 'token',

      value: useMemo(() => {
        return { token, tokenExpiresAt }
      }, [token, tokenExpiresAt]),
      setValue: useCallback(
        ({ token, tokenExpiresAt }) => {
          setToken(token), setTokenExpiresAt(tokenExpiresAt)
        },
        [setToken, setTokenExpiresAt]
      ),

      expiresAt: tokenExpiresAt,
    },
    [token]
  )

  const messagesIsReady = useSessionSaveRestoreSync(
    {
      session,
      channel,

      key: 'messages',

      value: messages,
      setValue: setMessages,

      expiresAt: tokenExpiresAt,
    },
    [getLast(messages)?.createdAt]
  )

  // ready

  const isReady = conversationIdIsReady && tokenIsReady && messagesIsReady

  useEffect(() => {
    if (!isReady) {
      return
    }

    postToSelf({ type: 'onReady' })
    postToParent({ type: 'onReady', props: {} })
  }, [isReady])

  // context

  const conversationContextValue = useMemo(() => {
    return { conversationId, token, tokenExpiresAt, session, channel }
  }, [conversationId, token, tokenExpiresAt, session, channel])

  // utility

  const getToken = useCallback(async () => {
    // create the options

    const options = {
      ...(initMessages
        ? {
            messages: messages
              .filter((message) => message.type === 'user') // @note only user message types are allowed
              .map(({ type, text, meta }) => ({
                type,
                text: byteSlice(text, 0, DEFAULT_MAX_MESSAGE_TEXT_BYTE_LENGTH), // @note truncate to sensible limit
                meta,
              })),
          }
        : undefined),

      ...(meta ? { meta } : undefined),
    }

    // if there is a token method, use it to get the token

    if (_getToken) {
      try {
        const data = await _getToken({
          ...options,
        })

        if (data) {
          const { conversationId, token, expiresAt } = data

          setTokenExpiresAt(expiresAt)

          return { conversationId, token, expiresAt }
        }
      } catch (e) {
        await captureUnknownError(e)

        return { error: e.message || 'Token method failed', code: e.code }
      }
    }

    // otherwise, use a route to get the token

    const url =
      _getTokenRoute || `/v1/integration/widget/${integrationId}/session/create`

    const { data, error } = await fetch(url, {
      // @note we conditionally set the parameters to support wider range of routes which may not support them

      data: {
        ...options,
      },
    })

    if (error) {
      await captureUnknownError(error)

      return {
        error: error.message || error || 'Fetch failed',
        code: error.code,
      }
    }

    const { conversationId, token, expiresAt } = data

    setTokenExpiresAt(expiresAt)

    return { conversationId, token, expiresAt }
  }, [
    _getToken,
    _getTokenRoute,

    fetch,

    initMessages,

    integrationId,

    messages,

    meta,
  ])

  // conversation helpers

  const ensureTokenIsFresh = useCallback(async () => {
    if (conversationId && token && tokenIsFresh(token)) {
      // @note return the existing conversationId for callers that need it
      // immediately

      return conversationId
    } else {
      let lastError = null
      let lastCode = null

      for (let attempt = 0; attempt < 3; attempt++) {
        const {
          conversationId: newConversationId,
          token,
          expiresAt,
          error,
          code,
        } = await getToken()

        if (newConversationId && token) {
          setConversationId(newConversationId)
          setToken(token)
          setTokenExpiresAt(expiresAt)

          // @note return the new conversationId for callers that need it
          // immediately before React state has propagated

          return newConversationId
        } else {
          lastError = error || 'Empty response'
          lastCode = code

          // @note an expected refusal (account limits, auth) will not clear
          // on retry

          if (code && !isUnknownError({ code })) {
            break
          }

          await sleep(500 * (attempt + 1))
        }
      }

      // @note carry the code so expected refusals stay out of Sentry upstream

      throw new SystemError(
        `Failed to get a fresh token: ${lastError}`,
        lastCode
      )
    }
  }, [conversationId, setConversationId, setToken, token, getToken])

  // conversation functions

  // @note follow-up messages submitted while a reply is still streaming. The
  // widget streams over a direct fetch, so a second concurrent completion would
  // genuinely overlap (shared messages/thinking/writing/aborter). Instead we
  // queue the message and dispatch it once the current reply finishes.

  const [pendingMessages, setPendingMessages] = useState([])

  // @note true from the moment we commit to a completion until its stream ends.
  // Covers the gap between triggering a completion and `thinking`/`writing`
  // actually flipping, so a rapid second submit queues instead of overlapping.

  const completionInFlightRef = useRef(false)

  // @note tracks the previous streaming state so the drain effect can act only
  // on the streaming→idle transition.

  const prevStreamingRef = useRef(false)

  const completeConversationMessage = useFunctionDispatch(
    async function completeConversationMessage() {
      if (disabled) {
        return
      }

      // @note while a reply is streaming, queue this message as a follow-up
      // turn instead of starting a second concurrent completion

      if (thinking || writing || completionInFlightRef.current) {
        const queuedText = (text || '').trim()

        if (!queuedText) {
          return
        }

        setText('')

        setPendingMessages((queue) => [
          ...queue,
          { id: getRandomId('queued-'), text: queuedText },
        ])

        return
      }

      // @note claim the in-flight slot synchronously

      completionInFlightRef.current = true

      // scroll to the bottom

      {
        scrollToBottom({ delay: 1 })
      }

      // flush and get the text

      const { text: textToUse } = await new Promise((resolve) =>
        cmFlushText({
          callback: resolve,
        })
      )

      if (!textToUse) {
        completionInFlightRef.current = false

        return
      }

      try {
        // ensure the token is fresh

        await ensureTokenIsFresh()

        // continue the conversation

        await cmCompleteMessage({ textToUse })
      } catch (error) {
        completionInFlightRef.current = false

        throw error
      }
    },
    [
      disabled,

      thinking,
      writing,

      text,
      setText,

      scrollToBottom,

      ensureTokenIsFresh,

      cmCompleteMessage,

      cmFlushText,
    ]
  )

  // @note dispatch the next queued follow-up once the current reply settles.
  // `prevStreamingRef` lets us act only on the streaming→idle transition;
  // `completionInFlightRef` covers the gap between triggering a completion and
  // its stream actually starting, so we never drain twice.

  useEffect(() => {
    const streaming = thinking || writing

    const wasStreaming = prevStreamingRef.current

    prevStreamingRef.current = streaming

    if (streaming) {
      completionInFlightRef.current = true

      return
    }

    if (wasStreaming) {
      // @note the active reply just finished

      completionInFlightRef.current = false
    }

    if (completionInFlightRef.current) {
      // @note a completion was triggered but its stream has not started yet

      return
    }

    if (pendingMessages.length === 0) {
      return
    }

    const [next, ...rest] = pendingMessages

    setPendingMessages(rest)

    completionInFlightRef.current = true

    cmAppendMessage({
      id: getRandomId('tmp-'),
      type: 'user',
      text: next.text,
      createdAt: Date.now(),
    })

    scrollToBottom({ delay: 1 })

    ensureTokenIsFresh()
      .then(() => cmCompleteMessage({ textToUse: next.text }))
      .catch(() => {
        completionInFlightRef.current = false
      })
  }, [
    thinking,
    writing,
    pendingMessages,
    cmAppendMessage,
    scrollToBottom,
    ensureTokenIsFresh,
    cmCompleteMessage,
  ])

  const removePendingMessage = useCallback((id) => {
    setPendingMessages((queue) => queue.filter((message) => message.id !== id))
  }, [])

  // exposed functions

  useFunctionHandler(
    async function restartConversation() {
      if (disabled) {
        return
      }

      cleanupSession()

      setConversationId(null)

      setToken(null)

      setMessages([])

      setPendingMessages([])

      setReRenderKey((key) => key + 1)

      postToParent({ type: 'onRestartConversation' })
    },
    [disabled, cleanupSession, setConversationId, setToken, setMessages],
    'restartConversation'
  )

  useFunctionHandler(
    async function downloadConversation() {
      if (disabled) {
        return
      }

      if (!conversationId) {
        return
      }

      const text = messages
        .map(({ type, text }) => {
          return `${type === 'user' ? 'You' : 'Bot'}: ${text}`
        })
        .join('\n')

      saveBlob(new Blob([text], { type: 'text/plain' }), {
        name: `conversation-${conversationId}.txt`,
      })
    },
    [disabled, conversationId, messages],
    'downloadConversation'
  )

  useFunctionHandler(
    async function initiateMessage(props) {
      if (disabled) {
        return
      }

      // @note we deliberately handle different cases because this function is
      // called by the user and we want to make sure we handle all the cases

      const message = props.message || props.text || props

      // perform validation
      {
        // @todo add code here
      }

      await ensureTokenIsFresh()

      cmInitiateMessage({ textToUse: message })
    },
    [disabled, ensureTokenIsFresh, cmInitiateMessage],
    'initiateMessage'
  )

  useFunctionHandler(
    async function sendMessage(props) {
      if (disabled) {
        return
      }

      // @note we deliberately handle different cases because this function is
      // called by the user and we want to make sure we handle all the cases

      const message = props.message || props.text || props
      const hidden = props.hidden
      const respond = props.respond

      // perform validation
      {
        // @todo add code here
      }

      // @note if a reply is streaming, queue a visible respond-style send as a
      // follow-up (mirrors the composer queue) rather than starting a concurrent
      // completion. Hidden / non-respond sends keep their existing semantics.

      if (
        respond &&
        !hidden &&
        (thinking || writing || completionInFlightRef.current)
      ) {
        setPendingMessages((queue) => [
          ...queue,
          { id: getRandomId('queued-'), text: message },
        ])

        return
      }

      if (!hidden) {
        cmAppendMessage({
          id: getRandomId('tmp-'),
          type: 'user',
          text: message,
          createdAt: Date.now(),
          extra: {
            hidden: !!hidden,
          },
        })

        scrollToBottom({ delay: 1 })
      }

      await ensureTokenIsFresh()

      if (respond) {
        cmCompleteMessage({ textToUse: message })
      } else {
        cmSendMessage({ textToUse: message })
      }
    },
    [
      disabled,

      thinking,
      writing,

      cmAppendMessage,

      ensureTokenIsFresh,

      cmCompleteMessage,
      cmSendMessage,

      scrollToBottom,
    ],
    'sendMessage'
  )

  useFunctionHandler(
    async function receiveMessage(props) {
      if (disabled) {
        return
      }

      const hidden = props.hidden

      // perform validation
      {
        // @todo add code here
      }

      await ensureTokenIsFresh()

      cmReceiveMessage({
        extra: {
          hidden: !!hidden,
        },
      })
    },
    [disabled, ensureTokenIsFresh, cmReceiveMessage],
    'receiveMessage'
  )

  useFunctionHandler(
    async function publishChannelMessage(props) {
      const channel = props.channel
      const message = props.message

      if (typeof channel !== 'string' || !channel.trim().length) {
        throw new Error(`Channel string expected`)
      }

      if (typeof message !== 'object' || !message) {
        throw new Error(`Message object expected`)
      }

      await fetch(`/v1/channel/${channel}/publish`, {
        data: {
          message,
        },
      })
    },
    [fetch],
    'publishChannelMessage'
  )

  // attachments

  const { rootProps, attachmentArea, attachmentButton } = useAttachmentsManager(
    {
      attachments: attachments,
      setAttachments: setAttachments,
    }
  )

  // speech

  const { speechButton } = useSpeechManager({
    setText: setText,

    sendText: completeConversationMessage,
  })

  // handlers

  function handleOnFocus() {
    if (disabled) {
      return
    }

    // @note it is distracting to scroll to the bottom because there could be
    // something the user want's to reference while they are typing

    // scrollToBottom()
  }

  function handleOnKeyDown(event) {
    if (event.keyCode === 13 && event.shiftKey) {
      return
    }

    if (event.keyCode === 13) {
      event.preventDefault()

      if (thinking || writing) {
        // @note disabled because it is not great for the user experience
        // return
      }

      if (disabled) {
        return
      }

      scrollToBottom()

      completeConversationMessage()

      return
    }
  }

  function handleOnSend(event) {
    event.preventDefault()

    if (disabled) {
      return
    }

    // @note while streaming this queues the message as a follow-up (handled
    // inside completeConversationMessage) instead of starting a second stream

    scrollToBottom()

    completeConversationMessage()
  }

  function handleAbort() {
    // @note aborting the active reply also drops any queued follow-ups

    setPendingMessages([])

    cmAbort()
  }

  // scroll

  const [isScrolledRef, isScrolled] = useIsScrolled({
    anchor: 'bottom',
    threshold: 100,
    interval: 2000,
  })

  useImperativeHandle(isScrolledRef, () => scrollContainer.current)

  // render

  return (
    <ConversationContext.Provider value={conversationContextValue}>
      <div
        {...rootProps}
        className={clsx(
          'conversation',

          'flex-1 flex flex-col min-w-0 min-h-0',

          'overflow-hidden',

          'bg-[var(--conversationPrimary,#ffffff)] text-[var(--conversationText,#000000)]',

          className
        )}
      >
        {/* bar */}
        {!hideBar ? <Bar className={clsx('shrink-0')} /> : null}
        <AutoScrollArea.Memo
          className={clsx(
            'flex-1 min-h-0 flex flex-col',

            'overflow-auto',

            'overscroll-contain', // @note prevents scrolling inside the area to scroll the page

            'no-scrollbar'
          )}
          disabled={disabled || !autoScroll || !(thinking || writing)}
          ref={scrollContainer}
        >
          {/* banner */}
          {!hideBanner ? <Banner /> : null}
          {/* messages */}
          <Messages.Memo
            style={{
              '--thisJustify': accessVar('--conversationJustify', 'flex-start'),
            }}
            className={clsx('flex-1 [justify-content:var(--thisJustify)]')}
            intro={intro}
            initial={initial}
            messages={receivedMessages}
            incoming={incomingMessage}
            thinking={thinking}
            writing={writing}
            disabled={disabled}
            visibleUserMessages={visibleUserMessages}
            visibleBotMessages={visibleBotMessages}
          />
        </AutoScrollArea.Memo>
        {/* actions */}
        <div
          className={clsx('relative z-10 shrink-0')}
          onClick={(event) => {
            if (
              [
                'INPUT',
                'TEXTAREA',
                'SELECT',
                'BUTTON',
                'CHECKBOX',
                'RADIO',
              ].includes(document.activeElement?.tagName)
            ) {
              return
            }

            event.target
              .querySelector('input, textarea, select, button, checkbox, radio')
              ?.focus()
          }}
        >
          {/* scroll button */}
          <ScrollButton
            className={clsx(
              'absolute z-30',
              'top-0 left-1/2',
              'transform -translate-x-1/2 -translate-y-[0%]',
              'opacity-0',
              'transition-all', // @todo ideally we would want to transition the opacity after the button goes down
              {
                '-translate-y-[140%] opacity-100': !isScrolled,
              }
            )}
            onClick={() => {
              scrollToBottom()
            }}
          />
          {/* content */}
          <div
            style={{
              '--thisBorderPrimary': accessVar(
                '--actionsBorderPrimary',
                '--barBorderPrimary',
                '--inputBorderPrimary',
                'transparent'
              ),
              '--thisBorderSize': accessVar(
                '--actionsBorderSize', // @note it was disabled - we don't use because it causes issues with the widgets/preview/[..url]
                '1px'
              ),
            }}
            className={clsx(
              'relative z-40',

              'p-[var(--actionsPadding,1rem)]',

              'bg-clip-padding',

              'border-t-[var(--thisBorderPrimary)] [border-top-width:var(--thisBorderSize)]',

              'bg-[var(--actionsPrimary,var(--conversationPrimary,#ffffff))]',
              // @note we used this before but it is causing issues - revert or improve if it is ok with all themes
              // 'bg-[var(--actionsBorderPrimary,var(--conversationPrimary))]'

              // 'bg-gradient-to-t from-[var(--conversationPrimary)] via-[var(--conversationPrimary)]'

              {
                'backdrop-blur-md': theme.actionsBackdropBlurPrimary === 'md',
                'backdrop-blur-lg': theme.actionsBackdropBlurPrimary === 'lg',
                'backdrop-blur-xl': theme.actionsBackdropBlurPrimary === 'xl',
              }
            )}
          >
            {/* start first */}
            {startFirst && (
              <StartFirstForm.Memo
                key={`start-first-form-${reRenderKey}`}
                disabled={disabled}
              />
            )}
            {/* contact collection */}
            {contactCollection && (
              <ContactCollectionForm.Memo
                key={`contact-collection-form-${reRenderKey}`}
                disabled={disabled}
              />
            )}
            {/* queued follow-up messages */}
            {pendingMessages.length ? (
              <div className="flex flex-col gap-2 mb-[var(--actionsPadding,1rem)]">
                {pendingMessages.map((item) => (
                  <div key={item.id} className="flex flex-row-reverse">
                    <div
                      className="group flex items-center gap-2 max-w-[85%] rounded-2xl px-3 py-2 border border-dashed border-current opacity-60 text-sm"
                      title="Queued - sends when the current reply finishes"
                    >
                      <div className="whitespace-pre-wrap break-words line-clamp-3">
                        {item.text}
                      </div>
                      <button
                        type="button"
                        onClick={() => removePendingMessage(item.id)}
                        className="shrink-0 rounded-full p-1"
                        aria-label="Remove queued message"
                      >
                        <CloseIcon className="w-3 h-3 fill-current" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {/* main input area */}
            <PortalTarget id="mainInputArea" singleChild={true}>
              <div className="relative">
                {/* attachment area */}
                {attachmentArea ? (
                  <div
                    className={clsx(
                      'm-[var(--actionsPadding,1rem)]',
                      'mt-0 ml-0 mr-0'
                    )}
                  >
                    {attachmentArea}
                  </div>
                ) : null}
                {/* text area */}
                <TextArea
                  key="textInput"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onFocus={handleOnFocus}
                  onKeyDown={handleOnKeyDown}
                  placeholder={theme.optPlaceholder}
                  // @note line disabled because it causes for the input to loose focus, instead we do the line below
                  // disabled={disabled || thinking || writing}
                  disabled={disabled}
                  rows={1}
                  autoFocus={autoFocus}
                >
                  <div className="shrink-0 flex flex-col justify-end">
                    <div className="flex flex-row-reverse">
                      {/* @note while streaming, a typed message stays sendable
                      (it is queued as a follow-up); the stop control only shows
                      when the composer is empty */}
                      {(thinking || writing) && !(text || '').trim() ? (
                        <Stop onClick={handleAbort} disabled={disabled} />
                      ) : (
                        <Send onClick={handleOnSend} disabled={disabled} />
                      )}
                      {speechButton}
                      {attachmentButton}
                    </div>
                  </div>
                </TextArea>
              </div>
            </PortalTarget>
            {poweredBy ? <PoweredBy /> : null}
            <div />
          </div>
        </div>
      </div>
    </ConversationContext.Provider>
  )
}

/*****************************************
 * SECTION: Renderer
 *****************************************/

/**
 *
 */
export function Renderer() {
  const [content, setContent] = useState(null)

  useFunctionHandler(
    async function render({ frame, iframe = frame }) {
      switch (true) {
        case !!iframe: {
          const src = frame.src || frame.href || frame.link || iframe

          if (!src) {
            break
          }

          const height = frame.height || '100%'

          function RenderComponent() {
            const containerEntryAnimationClassName = useEntryAnimation({
              beforeEnter: 'opacity-0',
              afterEnter: 'opacity-100',
            })

            const buttonEntryAnimationClassName = useEntryAnimation({
              beforeEnter: 'opacity-0',
              afterEnter: 'opacity-100',

              delay: 1000,
            })

            return (
              <div
                className={clsx(
                  'renderer',

                  'absolute z-50 top-0 left-0 w-full',

                  'flex flex-col',

                  'bg-white',

                  'transition-opacity duration-200',

                  containerEntryAnimationClassName
                )}
                style={{
                  height,
                }}
              >
                <div className="absolute top-0 right-0 p-5">
                  <button
                    className={clsx(
                      'p-1 rounded-full bg-gray-50',
                      'transition-opacity duration-200',
                      buttonEntryAnimationClassName
                    )}
                    type="button"
                    onClick={() => {
                      setContent(null)
                    }}
                  >
                    <CloseIcon className="w-4 h-4 fill-current" />
                  </button>
                </div>
                <ExternalFrame className="w-full h-full" src={src} />
              </div>
            )
          }

          setContent(<RenderComponent />)

          break
        }
      }
    },
    [],
    'render'
  )

  return content
}

/*****************************************
 * SECTION: Popup
 *****************************************/

/**
 * The popup is used to display the chat widget in a popup. It's mainly used to
 * create a nice border around the conversation and handle how to render it
 * based on the different screen sizes.
 */
export function Popup({ className, style, showBorder: _showBorder, ...props }) {
  const { open, mobile } = useContext(ResizeContext)

  const { theme } = useContext(ThemeContext)

  const showBorder = _showBorder ?? !(open && mobile)

  let popupBorderGradientFrom = theme.popupBorderGradientFrom
  let popupBorderGradientVia = theme.popupBorderGradientVia
  let popupBorderGradientTo = theme.popupBorderGradientTo

  if (theme.popupBorderPrimary === 'ai') {
    popupBorderGradientFrom = '#ec4899'
    popupBorderGradientVia = '#06b6d4'
    popupBorderGradientTo = '#8b5cf6'
  }

  const useGradientBorder =
    popupBorderGradientFrom && popupBorderGradientVia && popupBorderGradientTo

  const useSolidBorder = !useGradientBorder

  return (
    <div
      className={clsx(
        'popup',

        'relative',

        'flex-1 flex flex-col',

        'overflow-hidden',

        'shadow-lg',

        '[--i-popupRounding:var(--popupRounding,1.5rem)]',
        '[--i-popupBorderSize:var(--popupBorderSize,2px)]',
        '[--i-popupBorderPrimary:var(--popupBorderPrimary,#000000)]',

        '[--i-outerPopupRounding:calc(var(--i-popupBorderSize)+var(--i-popupRounding))]',

        'rounded-[var(--i-outerPopupRounding)]',

        'p-[var(--i-popupBorderSize)]',

        {
          '!rounded-none !p-0': !showBorder,
        },

        className
      )}
      style={{
        ...style,

        '--i-borderGradientFrom': popupBorderGradientFrom,
        '--i-borderGradientVia': popupBorderGradientVia,
        '--i-borderGradientTo': popupBorderGradientTo,
      }}
    >
      <div
        className={clsx(
          'popup-frame',

          'absolute top-0 left-0 w-full h-full',

          {
            'bg-gradient-dynamic from-[var(--i-borderGradientFrom)] via-[var(--i-borderGradientVia)] to-[var(--i-borderGradientTo)] animate-deg-rotate':
              showBorder && useGradientBorder,
            'bg-[var(--i-popupBorderPrimary)]': showBorder && useSolidBorder,
          }
        )}
        style={{
          ...(showBorder
            ? {
                borderRadius: 'var(--i-outerPopupRounding)',
                padding: 'var(--i-popupBorderSize)',
                boxSizing: 'border-box',

                WebkitMask:
                  'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',

                mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                maskComposite: 'exclude',
              }
            : {}),
        }}
      />
      <div
        className={clsx(
          'popup-content',

          // position

          'relative',

          // dimensions

          'flex-1 w-full h-full',

          'flex flex-col',

          // scroll

          'overflow-hidden',

          // rounding

          'rounded-[var(--i-popupRounding)]',
          {
            '!rounded-none': !showBorder,
          },

          // backdrop

          {
            'backdrop-blur-md': theme.popupBackdropBlurPrimary === 'md',
            'backdrop-blur-lg': theme.popupBackdropBlurPrimary === 'lg',
            'backdrop-blur-xl': theme.popupBackdropBlurPrimary === 'xl',
          }
        )}
      >
        <Conversation {...props} className="flex-1 w-full h-full" />
        <Renderer />
      </div>
    </div>
  )
}

/*****************************************
 * SECTION: Button
 *****************************************/

/**
 *
 */
export function useButtonFeatures() {
  const { hideButton } = useContext(ConfigContext)

  const { open } = useContext(ResizeContext)

  const { theme } = useContext(ThemeContext)

  const buttonFeatures = useMemo(() => {
    if (theme.buttonFeatures) {
      return theme.buttonFeatures
        .split(',')
        .map((feature) => feature.trim())
        .filter(Boolean)
    } else {
      return []
    }
  }, [theme.buttonFeatures])

  const autoHideButton =
    hideButton || (open && buttonFeatures.includes('hide-on-open'))

  return { autoHideButton }
}

/**
 * The button is used to open the chat widget.
 */
export function Button({ className, disabled }) {
  const { buttonIcon: _buttonIcon } = useContext(ConfigContext)

  const buttonIcon = useMemo(() => {
    return dynamicIconToUrl(_buttonIcon)
  }, [_buttonIcon])

  const { open, setOpen } = useContext(ResizeContext)

  const { theme } = useContext(ThemeContext)

  let usePrimaryBackdropBlurSm = theme.buttonBackdropBlurPrimary === 'sm'
  let usePrimaryBackdropBlurLg = theme.buttonBackdropBlurPrimary === 'lg'
  let usePrimaryBackdropBlurXl = theme.buttonBackdropBlurPrimary === 'xl'

  let useSecondaryBackdropBlurSm = theme.buttonBackdropBlurSecondary === 'sm'
  let useSecondaryBackdropBlurLg = theme.buttonBackdropBlurSecondary === 'lg'
  let useSecondaryBackdropBlurXl = theme.buttonBackdropBlurSecondary === 'xl'

  const entryAnimationClassName = useEntryAnimation({
    beforeEnter: 'opacity-0',
    afterEnter: 'opacity-100',

    delay: 500,
  })

  function handleOnClick(event) {
    event.preventDefault()

    if (disabled) {
      return
    }

    setOpen(!open)
  }

  const { autoHideButton } = useButtonFeatures()

  return autoHideButton ? null : (
    <button
      className={clsx(
        'button',

        // box

        'flex justify-center items-center',
        'overflow-hidden',

        // size

        'w-[var(--buttonSize,52px)] h-[var(--buttonSize,52px)]',
        'p-[var(--buttonPadding,0.2rem)]',

        // background and text color

        'bg-[var(--buttonPrimary,#ffffff)] hover:bg-[var(--buttonSecondary,var(--buttonPrimary,#ffffff))]',
        'text-[var(--buttonText,#000000)]',

        // border and shadow

        '[border-width:var(--buttonBorderSize,2px)] border-[var(--buttonBorderPrimary,var(--buttonPrimary))] hover:border-[var(--buttonBorderSecondary,var(--buttonSecondary))] rounded-[var(--buttonRounding,100%)]',
        'shadow-lg',

        // transition

        'transform transition ease-in-out duration-150 hover:scale-110 active:scale-90',

        // icon

        ...(buttonIcon ? ['bg-cover bg-clip-border'] : []),

        // backdrop blur

        {
          'backdrop-blur-sm': usePrimaryBackdropBlurSm,
          'backdrop-blur-lg': usePrimaryBackdropBlurLg,
          'backdrop-blur-xl': usePrimaryBackdropBlurXl,

          'hover:backdrop-blur-sm': useSecondaryBackdropBlurSm,
          'hover:backdrop-blur-lg': useSecondaryBackdropBlurLg,
          'hover:backdrop-blur-xl': useSecondaryBackdropBlurXl,
        },

        // entry

        entryAnimationClassName,

        // other classes

        className
      )}
      style={{
        ...(buttonIcon && !open && /^https:\/\/|data:|blob:|\//.test(buttonIcon)
          ? { backgroundImage: `url(${buttonIcon})` }
          : null),
      }}
      type="button"
      onClick={handleOnClick}
    >
      {open ? (
        <>
          <div className="w-[var(--buttonIconSize,80%)] h-[var(--buttonIconSize,80%)] fill-current [&>*]:w-full [&>*]:h-full">
            <ButtonDownIcon />
          </div>
        </>
      ) : (
        <>
          {!buttonIcon ? (
            <WidgetIcon className="w-[var(--buttonIconSize,80%)] h-[var(--buttonIconSize,80%)] fill-current" />
          ) : null}
          {buttonIcon && !/^https:\/\/|data:|blob:|\//.test(buttonIcon) ? (
            <Emoji className="text-3xl">{buttonIcon}</Emoji>
          ) : null}
        </>
      )}
    </button>
  )
}

/*****************************************
 * SECTION: Peek
 *****************************************/

/**
 * The peek is used to display the initial messages when the chat widget is
 * minimized.
 */
export function Peek({ className, disabled }) {
  // resize

  const { mobile, open, setOpen } = useContext(ResizeContext)

  // config

  const { messagePeek, hideButton, position } = useContext(ConfigContext)

  // state

  const { state } = useContext(StateContext)

  // visibility

  const [visible, setVisible] = useState(true)

  // last visible message

  const lastVisibleBotMessage = state.lastVisibleBotMessage

  // define the bubble messages to render

  const bubbleMessages = useMemo(() => {
    if (disabled) {
      return []
    }

    if (!messagePeek) {
      return []
    }

    if (hideButton) {
      return []
    }

    if (!lastVisibleBotMessage) {
      return []
    }

    const texts = splitBubbleText(lastVisibleBotMessage.text)
      // filter fenced code blocks, except with language: card
      .filter((text) => !text.startsWith('```') || text.startsWith('```card'))
      // filter table blocks
      .filter((text) => !text.startsWith('|'))
      // filter block quotes
      .filter((text) => !text.startsWith('>'))
      // filter html
      .filter((text) => !text.startsWith('<'))

    return texts.map((text, index) => {
      return {
        id: `peek/${lastVisibleBotMessage.id}${index}`,
        type: 'initial',
        text: text,
      }
    })
  }, [disabled, messagePeek, hideButton, lastVisibleBotMessage])

  // define a local storage key

  const storageKey = `hideMessagePeak-${lastVisibleBotMessage?.id || 'x'}`

  // create localStorage with expiry instance (1 day default)

  const storage = useMemo(
    () =>
      getLocalStorageWithExpiry(
        7 * 24 * 60 * 60 * 1000 // @todo make this configurable
      ),
    []
  )

  // cleanup expired items on mount to prevent storage bloat

  useEffect(() => {
    storage.cleanup('hideMessagePeak-')
  }, [storage])

  // when the local storage key changes we need to reset the visibility state
  {
    useEffect(() => {
      setVisible(storage.getItem(storageKey) !== 'true')
    }, [storageKey, storage])
  }

  // define a hide function helper

  const hide = useCallback(() => {
    setVisible(false)

    storage.setItem(storageKey, 'true')
  }, [storageKey, storage])

  // when the open state changes we need to hide the peek

  useEffect(() => {
    if (open) {
      hide()
    }
  }, [hide, open])

  // define an entry animation

  const initialEntryAnimationClassName = useEntryAnimation({
    beforeEnter: 'opacity-0 transform translate-y-4',
    afterEnter: 'opacity-100 transform translate-y-0',

    delay: 500,

    dependsOn: storageKey,
  })

  // render

  // @note on mobile rendering message peek is confusing and distracting so we
  // need another way to do it - right now we simply do not render it

  return mobile || !visible || !bubbleMessages.length ? null : (
    <div className="space-y-4">
      {/* close button */}
      <div
        key={storageKey + '-close-button'}
        className={clsx('flex-col', {
          'flex items-end': position?.includes('right'),
          'inline-flex items-start': position?.includes('left'),
        })}
      >
        <div
          className={clsx(
            'p-1 rounded-full',

            'text-[var(--thisMessageButtonText)] bg-[var(--thisMessageButtonPrimary)] hover:bg-[var(--thisMessageButtonSecondary)]',

            'transition-all ease-in-out duration-500',

            'cursor-pointer',

            'z-10',

            initialEntryAnimationClassName
          )}
          style={{
            '--thisMessageButtonText': accessVar(
              `--inputMessageButtonText`,
              '--messageButtonText',
              '--buttonText',
              'inherit'
            ),
            '--thisMessageButtonPrimary': accessVar(
              `--inputMessageButtonPrimary`,
              '--messageButtonPrimary',
              '--buttonPrimary',
              'transparent'
            ),
            '--thisMessageButtonSecondary': accessVar(
              `--inputMessageButtonSecondary`,
              '--messageButtonSecondary',
              '--buttonSecondary',
              '--thisMessageButtonPrimary'
            ),

            transitionDelay: `${
              bubbleMessages.length + 1000 + (bubbleMessages.length + 1) * 500
            }ms`,
          }}
          onClick={() => hide()}
        >
          <CloseIcon className="w-4 h-4 fill-current" />
        </div>
      </div>
      {/* messages */}
      <div
        key={storageKey + '-messages'}
        className={clsx(
          'w-[25rem] flex flex-col gap-2',

          'cursor-pointer',

          '[&_ul]:!list-inside',
          '[&_ol]:!list-inside',

          {
            'items-end': position?.includes('right'),
            'items-start': position?.includes('left'),
          }
        )}
        onClick={() => setOpen(true)}
      >
        {bubbleMessages
          .slice(0, 3) // @todo make this configurable
          .map(({ id, type, text, attachments }, index) => {
            return (
              <Message.Memo
                key={id}
                className={clsx(
                  // remove ul and ol padding, margins and list styles

                  '[&_ul]:m-0 [&_ul]:p-0 [&_ul]:list-none',
                  '[&_ol]:m-0 [&_ol]:p-0 [&_ol]:list-none',

                  'transition-all ease-in-out duration-500',

                  {
                    'text-right w-full': position?.includes('right'),
                    'text-left w-full': position?.includes('left'),
                  },

                  initialEntryAnimationClassName,

                  className
                )}
                style={{
                  // @note doing it in reverse order
                  // transitionDelay: `${
                  //   bubbleMessages.length -
                  //   index +
                  //   1000 +
                  //   (bubbleMessages.length - index + 1) * 500
                  // }ms`,
                  transitionDelay: `${index + 1000 + (index + 1) * 500}ms`,
                }}
                type={type}
                text={text}
                attachments={attachments}
                hideTools={true}
              />
            )
          })}
      </div>
    </div>
  )
}

/*****************************************
 * SECTION: Composition
 *****************************************/

/**
 * The button composition contains the button and some additional elements, such
 * as the peek messages.
 */
export function Composition({ className, disabled }) {
  const { position } = useContext(ConfigContext)

  return (
    <div
      className={clsx(
        'composition',

        'flex flex-col gap-4',

        {
          'justify-end items-end': position?.includes('right'),
          'justify-start items-start': position?.includes('left'),
        },

        className
      )}
    >
      <Peek disabled={disabled} />
      <Button disabled={disabled} />
    </div>
  )
}

/*****************************************
 * SECTION: Layouts
 *****************************************/

/**
 * A layout that is used to display the chat widget in a popover. The position
 * of the widget is above the button that opens it.
 */
export function PopoverLayout({ className, ...props }) {
  const { setOn, open, mobile, resize } = useContext(ResizeContext)

  const { position, hideButton } = useContext(ConfigContext)

  const { theme } = useContext(ThemeContext)

  useEffect(() => {
    if (open) {
      setOn(false)
      resize(
        theme.popoverWidth || DEFAULT_POPOVER_WIDTH,
        theme.popoverHeight || DEFAULT_POPOVER_HEIGHT,
        'open'
      )
    } else {
      setOn(true)
    }
  }, [open, setOn, resize, theme.popoverWidth, theme.popoverHeight])

  return (
    <div
      className={clsx(
        'popover-layout',

        'overflow-hidden',

        'grid grid-rows-[1fr,auto]',

        {
          'gap-[var(--popoverSpacing,0rem)]': !(open && mobile),

          'p-[var(--popoverPadding,1rem)]': !(open && mobile),

          // @note the padding above will take space when the button is hidden
          // which means that the frame will always take at least 1x1rem - this
          // is not ideal because the button could be hidden for a reason and so
          // we need to remove the padding if this is the case

          '!p-0': hideButton && !open,
        },

        {
          'w-screen h-screen': open,
        },

        // extra classes
        className
      )}
    >
      {/* conversation */}
      <div
        className={clsx(
          'grid grid-rows-[1fr] overflow-hidden',

          // @note added slightly different transition for nicer animations

          'transition-all duration-200 ease-[cubic-bezier(0,1.2,1,1)]',

          {
            'origin-bottom-right': position?.includes('right'),
            'origin-bottom-left': position?.includes('left'),
          },

          {
            'scale-0': !open,
            'scale-100': open,
          },

          // @note we do this to align the popover with the button because the
          // conversation has shadow and the margin is making sure the shadow is
          // visible

          {
            '-ml-6 translate-x-3': open && !mobile,
          }
        )}
      >
        <Popup
          {...props}
          className={clsx({
            hidden: !open,

            // @note as per previous note above, the mx-3 is added mainly for
            // the shadow so that it is visible.

            'mx-3 mb-6': open && !mobile,
          })}
        />
      </div>
      {/* composition */}
      <Composition
        {...props}
        className={clsx({
          hidden: open && mobile,
        })}
      />
    </div>
  )
}

PopoverLayout.shortNames = ['popover']

/**
 * A layout that is used to display the chat widget in a popout. The position
 * of the widget is in the center of the screen.
 */
export function PopoutLayout({ className, ...props }) {
  const { setOn, open, setOpen, mobile, resize } = useContext(ResizeContext)

  const { position, hideButton } = useContext(ConfigContext)

  position // @note should we use use it like in the PopoverLayout?

  useEffect(() => {
    if (open) {
      setOn(false)
      resize('100vw!', '100vh!', 'open')
    } else {
      setOn(true)
    }
  }, [open, setOn, resize])

  return (
    <div
      className={clsx(
        'popout-layout',

        'overflow-hidden',

        'grid grid-rows-[1fr,auto]',

        'transition-colors duration-200',

        'bg-transparent',

        {
          'gap-[var(--popoutSpacing,0rem)]': !(open && mobile),

          'p-[var(--popoutPadding,1rem)]': !(open && mobile),

          // @note the padding above will take space when the button is hidden
          // which means that the frame will always take at least 1x1rem - this
          // is not ideal because the button could be hidden for a reason and so
          // we need to remove the padding if this is the case

          '!p-0': hideButton && !open,
        },

        {
          'w-screen h-screen': open,
          'bg-[var(--popoutOverlayPrimary,rgba(0,0,0,0))]': open,
          'backdrop-blur-[var(--popoutOverlayBlur,0px)]': open,
        },

        // extra classes
        className
      )}
    >
      {/* conversation */}
      <div
        className={clsx(
          'grid grid-rows-[1fr] overflow-hidden justify-center items-center',

          'transition-all ease-in-out origin-center',

          { 'scale-0': !open, 'scale-100': open }
        )}
        onClick={(event) => {
          // @todo maybe close on click outside should be configurable

          if (event.target === event.currentTarget) {
            setOpen(false)
          }
        }}
      >
        <Popup
          className={clsx({
            hidden: !open,

            // @note set the width and height to the screen size

            'w-full h-full': open,
          })}
          // @note unlike the popover layout we need to use style because the
          // popout width and height are dynamic and not able to be used in
          // tailwindcss
          style={{
            ...(open && !mobile
              ? // we are force to use style because DEFAULT_POPOUT_WIDTH and
                // DEFAULT_POPOUT_HEIGHT are dynamic thus not able to be used in
                // by tailwindcss
                {
                  maxWidth: `var(--popoutWidth,${DEFAULT_POPOUT_WIDTH})`,
                  maxHeight: `var(--popoutHeight,${DEFAULT_POPOUT_HEIGHT})`,
                }
              : null),
          }}
          {...props}
        />
      </div>
      {/* composition */}
      <Composition
        {...props}
        className={clsx({
          hidden: open && mobile,
        })}
      />
    </div>
  )
}

PopoutLayout.shortNames = ['popout']

/**
 * A layout that is used to display the chat widget in a slide. The position
 * of the widget is on the right side of the screen.
 */
export function SlidoverLayout({ className, ...props }) {
  const { setOn, open, mobile, resize } = useContext(ResizeContext)

  useEffect(() => {
    if (open) {
      setOn(false)
      resize('30rem!', '100vh!', 'open')
    } else {
      setOn(true)
    }
  }, [open, setOn, resize])

  return (
    <div
      className={clsx(
        'slideover-layout',

        'overflow-hidden',

        'grid',

        {},

        {
          'w-screen h-screen': open,
        },

        // extra classes
        className
      )}
    >
      {/* conversation */}
      <div
        className={clsx(
          'absolute z-10 top-0 right-0',

          'max-w-[var(--slideoverWidth,30rem)] flex w-full h-full',

          {
            hidden: !open,
          }
        )}
      >
        <Conversation {...props} />
        <Renderer />
      </div>
      {/* composition */}
      <div
        className={clsx({
          'p-[var(--slideoverPadding,1rem)]': !(open && mobile),
        })}
      >
        <Composition {...props} />
      </div>
    </div>
  )
}

SlidoverLayout.shortNames = ['slideover']

/**
 * A layout that is used to display the chat widget in the center of the screen.
 */
export function CenterLayout({ className, ...props }) {
  const { setOn, resize } = useContext(ResizeContext)

  useEffect(() => {
    setOn(false)
    resize('100%', '100%', 'open')
  }, [setOn, resize])

  const { background, frameWidth } = useContext(ConfigContext)

  return (
    <div
      className={clsx(
        'center-layout',

        'w-screen h-screen',

        'grid',

        // extra classes
        className
      )}
      style={frameWidth ? { '--frameWidth': frameWidth } : undefined}
    >
      <div
        className="z-9 w-screen h-screen flex flex-col p-10 bg-[var(--framePrimary,rgba(0,0,0,0.1))]"
        style={{
          gridArea: '1/1',

          ...(background
            ? {
                background: `url(${background})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'cover',
              }
            : null),
        }}
      >
        <div className="max-w-[var(--frameWidth,35rem)] max-h-[var(--frameHeight,50rem)] flex-1 flex w-full h-full m-auto">
          <Popup {...props} />
        </div>
      </div>
      <div
        className="z-10 flex flex-col-reverse p-[var(--frameSpacing,1rem)] pointer-events-none"
        style={{ gridArea: '1/1' }}
      ></div>
    </div>
  )
}

CenterLayout.shortNames = ['center', 'centered']

/**
 * A layout that is used to display the chat widget in full stretch mode.
 */
export function StretchLayout({ className, ...props }) {
  const { setOn, resize } = useContext(ResizeContext)

  useEffect(() => {
    setOn(false)
    resize('100%', '100%', 'open')
  }, [setOn, resize])

  return (
    <div
      className={clsx(
        'stretch-layout',

        'w-screen h-screen',

        'overflow-hidden',

        'grid grid-rows-[1fr]',

        // extra classes
        className
      )}
    >
      <Popup {...props} showBorder={true} />
    </div>
  )
}

StretchLayout.shortNames = ['stretch', 'stretched']

/**
 * A layout that is used to display the chat widget in full screen.
 */
export function FullscreenLayout({ className, ...props }) {
  const { setOn, resize } = useContext(ResizeContext)

  useEffect(() => {
    setOn(false)
    resize('100%', '100%', 'open')
  }, [setOn, resize])

  return (
    <div
      className={clsx(
        'fullscreen-layout',

        'w-screen h-screen',

        'overflow-hidden',

        'grid grid-rows-[1fr]',

        // extra classes
        className
      )}
    >
      <Popup {...props} showBorder={false} />
    </div>
  )
}

FullscreenLayout.shortNames = ['fullscreen', 'full', 'screen']

/**
 * The Layout assembles the widget selected layout. As the name suggest,
 * "layout" defines how the widget is actually displayed on the screen, i.e how
 * the widget is positioned and how it looks like.
 *
 * @todo See the previous todo item for more information what needs to be done.
 */
export function Layout(props) {
  const { layout } = useContext(ConfigContext)

  const Layout = useMemo(() => {
    switch (true) {
      case PopoverLayout.shortNames.includes(layout): {
        return PopoverLayout
      }

      case PopoutLayout.shortNames.includes(layout): {
        return PopoutLayout
      }

      case SlidoverLayout.shortNames.includes(layout): {
        return SlidoverLayout
      }

      case CenterLayout.shortNames.includes(layout): {
        return CenterLayout
      }

      case StretchLayout.shortNames.includes(layout): {
        return StretchLayout
      }

      case FullscreenLayout.shortNames.includes(layout): {
        return FullscreenLayout
      }

      default: {
        return FullscreenLayout
      }
    }
  }, [layout])

  return <Layout {...props} />
}

/*****************************************
 * SECTION: Helpers
 *****************************************/

/**
 * Computes the WCAG relative luminance (0 = black, 1 = white) of a hex color.
 *
 * @note this only understands #rgb and #rrggbb. It deliberately returns null
 * for `transparent`, `rgba(...)`, `inherit`, gradients and any non-hex value
 * because in those cases the effective background comes from elsewhere (the
 * host page behind the iframe, a backdrop blur, a gradient, etc.) and cannot be
 * derived from the token alone.
 *
 * @param {string} color
 * @returns {number|null}
 */
export function relativeLuminance(color) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((color || '').trim())

  if (!match) {
    return null
  }

  let hex = match[1]

  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('')
  }

  const [r, g, b] = [0, 2, 4].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255
  )

  const lin = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)

  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/**
 * Determines whether a theme renders light text on a dark surface, used to
 * decide if grayscale font smoothing should be applied.
 *
 * @note grayscale smoothing (`antialiased`) is only desirable for light-on-dark
 * text - on dark-on-light text it thins glyphs and lowers contrast, so when we
 * cannot confidently tell (transparent/rgba/gradient backgrounds) we return
 * false and leave the browser default (subpixel) smoothing in place.
 *
 * @todo themes that set `conversationPrimary: transparent` but are designed for
 * dark host pages (e.g. liquid-glass) will be treated as light here. To handle
 * those we would need to read the rendered background at runtime via
 * `getComputedStyle(el).backgroundColor` instead of the static token.
 *
 * @param {object} theme
 * @returns {boolean}
 */
export function isLightOnDarkTheme(theme) {
  const bg = relativeLuminance(theme.conversationPrimary)
  const fg = relativeLuminance(theme.conversationText)

  if (bg != null && fg != null) {
    return fg > bg
  }

  if (bg != null) {
    return bg < 0.5
  }

  return false
}

export function getThemeConfig(theme) {
  switch (typeof theme) {
    case 'string': {
      theme = parseTheme(theme).config

      break
    }

    case 'object': {
      if ('name' in theme && 'config' in theme) {
        const { name, config } = theme

        theme = merge(parseTheme(name).config, config)
      } else {
        theme = merge(parseTheme('default').config, theme)
      }

      break
    }

    default: {
      theme = {}

      break
    }
  }

  return theme || {}
}

/*****************************************
 * SECTION: Wrappers
 *****************************************/

/**
 * The ConfigWrapper is used to provide the configuration to the rest of the
 * components.
 *
 * @todo To make this solution more generic we need to remove the reference to
 * the integration and instead use the integration unpacked props that we get
 * from the Frame component. This change needs to be done in the Frame component
 * as well. Then the FrameComponent can be used in all other places as a generic
 * component instead of the ConfigWrapper.
 */
export function ConfigWrapper({
  integration,

  integrationId: _integrationId,

  session: _session,

  privacy: _privacy,
  moderation: _moderation,

  theme: _theme,

  layout: _layout,

  frameWidth: _frameWidth,

  position: _position,

  stream: _stream,

  verbose: _verbose,

  tools: _tools,

  unfurl: _unfurl,

  math: _math,

  attachments: _attachments,

  icon: _icon,
  title: _title,

  barIcon: _barIcon = _icon,
  barTitle: _barTitle = _title,

  background: _background,
  banner: _banner,

  intro: _intro,

  initial: _initial,

  placeholder: _placeholder,

  botIcon: _botIcon,
  userIcon: _userIcon,

  contextIcon: _contextIcon,

  buttonIcon: _buttonIcon,
  buttonTitle: _buttonTitle,

  messages: _messages,

  functions: _functions,

  meta: _meta,

  contact: _contact,

  startFirst: _startFirst,

  contactCollection: _contactCollection,

  exportConversation: _exportConversation,
  restartConversation: _restartConversation,

  maximize: _maximize,

  messagePeek: _messagePeek,

  voiceIn: _voiceIn,
  voiceOut: _voiceOut,

  poweredBy: _poweredBy,

  autoScroll: _autoScroll,
  autoFocus: _autoFocus,

  disabled: _disabled,

  intl: _intl,

  hideBar: _hideBar,
  hideButton: _hideButton,

  origin,

  brandCaption: _brandCaption,
  brandURL: _brandURL,
  brandLogo: _brandLogo,

  cache,
  cacheKey,

  children,
}) {
  const buildFrontendURL = useExternalFrontendURL()

  const integrationId = useMemo(() => {
    return _integrationId || integration?.id
  }, [_integrationId, integration?.id])

  const session = useMemo(() => {
    const session = _session

    if (session === 'none') {
      return ''
    } else {
      return `${integration?.id || getRandomId('tmp-')}-${
        session || getStartOfDay().getTime()
      }`
    }
  }, [integration?.id, _session])

  const privacy = useMemo(() => {
    return firstBoolLike(_privacy, integration?.privacy, false)
  }, [_privacy, integration?.privacy])

  const moderation = useMemo(() => {
    return firstBoolLike(_moderation, integration?.moderation, false)
  }, [_moderation, integration?.moderation])

  const theme = useMemo(() => {
    return getThemeConfig(_theme || integration?.theme)
  }, [_theme, integration?.theme])

  const layout = useMemo(() => {
    let layout = _layout || integration?.layout

    if (layout === 'default') {
      layout = integration?.layout || 'popover'
    }

    if (layout === 'default') {
      layout = 'popover'
    }

    return layout || 'fullscreen'
  }, [_layout, integration?.layout])

  // @note the center layout caps the widget with the --frameWidth theme
  // variable - this overrides that cap for a single render, which is what the
  // previews use to show the widget at a realistic width. The `popover` value
  // resolves to the width the widget has when its popover is open.
  const frameWidth = useMemo(() => {
    if (_frameWidth === 'popover') {
      return theme.popoverWidth || DEFAULT_POPOVER_WIDTH
    }

    return _frameWidth || undefined
  }, [_frameWidth, theme.popoverWidth])

  const position = useMemo(() => {
    return _position || integration?.position || 'bottom-right'
  }, [_position, integration?.position])

  const stream = useMemo(() => {
    return firstBoolLike(_stream, integration?.stream, true)
  }, [_stream, integration?.stream])

  const verbose = useMemo(() => {
    return firstBoolLike(_verbose, integration?.verbose, true)
  }, [_verbose, integration?.verbose])

  const tools = useMemo(() => {
    return firstBoolLike(_tools, integration?.tools, false)
  }, [_tools, integration?.tools])

  const unfurl = useMemo(() => {
    return firstBoolLike(_unfurl, integration?.unfurl, true)
  }, [_unfurl, integration?.unfurl])

  const math = useMemo(() => {
    return firstBoolLike(_math, integration?.math, true)
  }, [_math, integration?.math])

  const attachments = useMemo(() => {
    return firstBoolLike(_attachments, integration?.attachments, false)
  }, [_attachments, integration?.attachments])

  const startFirst = useMemo(() => {
    return firstBoolLike(_startFirst, integration?.startFirst, false)
  }, [_startFirst, integration?.startFirst])

  const contactCollection = useMemo(() => {
    return firstBoolLike(
      _contactCollection,
      integration?.contactCollection,
      false
    )
  }, [_contactCollection, integration?.contactCollection])

  const exportConversation = useMemo(() => {
    return firstBoolLike(
      _exportConversation,
      integration?.exportConversation,
      true
    )
  }, [_exportConversation, integration?.exportConversation])

  const restartConversation = useMemo(() => {
    return firstBoolLike(
      _restartConversation,
      integration?.restartConversation,
      true
    )
  }, [_restartConversation, integration?.restartConversation])

  const maximize = useMemo(() => {
    return firstBoolLike(_maximize, integration?.maximize, true)
  }, [_maximize, integration?.maximize])

  const messagePeek = useMemo(() => {
    return firstBoolLike(_messagePeek, integration?.messagePeek, true)
  }, [_messagePeek, integration?.messagePeek])

  const voiceIn = useMemo(() => {
    return firstBoolLike(_voiceIn, integration?.voiceIn, false)
  }, [_voiceIn, integration?.voiceIn])

  const voiceOut = useMemo(() => {
    return firstBoolLike(_voiceOut, integration?.voiceOut, false)
  }, [_voiceOut, integration?.voiceOut])

  const poweredBy = useMemo(() => {
    return firstBoolLike(_poweredBy, integration?.poweredBy, true)
  }, [_poweredBy, integration?.poweredBy])

  /**
   */
  const getSpecialUrl = useCallback((input, type) => {
    type = type.trim().toLowerCase()

    return extractImagesFromMarkdown(input).filter(({ title, url }) => {
      return (
        title.toLowerCase().trim() === type ||
        url.toLowerCase().trim().endsWith(`#${type}`)
      )
    })[0]?.url
  }, [])

  /**
   */
  const removeSpecialUrls = useCallback((input, types) => {
    for (let type of types) {
      type = type.trim().toLowerCase()

      const images = extractImagesFromMarkdown(input)

      for (const image of images) {
        if (
          image.title.toLowerCase().trim() === type ||
          image.url.toLowerCase().trim().endsWith(`#${type}`)
        ) {
          if (
            typeof image.start === 'number' &&
            typeof image.end === 'number'
          ) {
            input = input.slice(0, image.start) + input.slice(image.end)
          }
        }
      }
    }

    return input
  }, [])

  /**
   * @todo use the s3 url instead of the chatbotkit.com url, this will required
   * some presigned url logic in the getServerSideProps function
   * @todo use a dedicated CDN url
   */
  const getFileUrl = useCallback(
    (files, type) => {
      const file = files?.find((file) => file.type === type)

      if (file) {
        const pathname = `/api/v1/file/${
          file.fileId || file.id
        }/thumbnail/download`

        const query = new URLSearchParams()

        if (cache) {
          query.set('strategy', 'auto')
          query.set('cache', 'true')
          query.set('version', cacheKey)
        }

        const queryString = query.toString()

        return `${pathname}${queryString ? `?${queryString}` : ''}`
      }
    },
    [cache, cacheKey]
  )

  const preIntro = useMemo(() => {
    return anyString(_intro, integration?.intro)?.trim()
  }, [_intro, integration?.intro])

  const barIcon = useMemo(() => {
    return anyString(
      _barIcon,
      _icon,
      getSpecialUrl(preIntro, 'barIcon'),
      getFileUrl(integration?.files, 'bar'),
      theme?.barIcon
    )?.trim()
  }, [
    _barIcon,
    _icon,
    getSpecialUrl,
    preIntro,
    getFileUrl,
    integration?.files,
    theme?.barIcon,
  ])

  const barTitle = useMemo(() => {
    return anyString(_barTitle, _title, integration?.title)?.trim()
  }, [_barTitle, _title, integration?.title])

  const background = useMemo(() => {
    return anyString(
      _background,
      integration?.background,
      (() => {
        // extract the background from the intro, where the background image is
        // a normal markdown image with "background" as the alt text

        return getSpecialUrl(preIntro, 'background')
      })()
    )?.trim()
  }, [_background, integration?.background, getSpecialUrl, preIntro])

  const banner = useMemo(() => {
    return anyString(
      _banner,
      integration?.banner,
      (() => {
        // extract the banner from the intro, where the banner image is a normal
        // markdown image with "banner" as the alt text

        let url = getSpecialUrl(preIntro, 'banner')

        switch (true) {
          case url?.startsWith('#'): {
            // it is a color so generate a data url of an svg with the color

            url = `data:image/svg+xml;base64,${encodeB64(
              '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="' +
                url +
                '"/></svg>'
            )}`

            break
          }
        }

        return url
      })()
    )?.trim()
  }, [_banner, integration?.banner, getSpecialUrl, preIntro])

  const intro = useMemo(() => {
    // return the preIntro but also remove images with special alt text

    return removeSpecialUrls(preIntro || '', [
      'background',
      'banner',
      'barIcon',
      'botIcon',
      'userIcon',
      'buttonIcon',
    ])?.trim()
  }, [preIntro, removeSpecialUrls])

  const initial = useMemo(() => {
    // we do not allow for the initial message to be overridden by the query
    // because this could be a security issue, contributing to the model
    // hallucinating things that are not there

    return anyString(_initial, integration?.initial)?.trim()
  }, [_initial, integration?.initial])

  const placeholder = useMemo(() => {
    return anyString(_placeholder, integration?.placeholder)?.trim()
  }, [_placeholder, integration?.placeholder])

  const botIcon = useMemo(() => {
    return anyString(
      _botIcon,
      getFileUrl(integration?.files, 'bot'),
      getSpecialUrl(preIntro, 'botIcon'),
      theme?.botIcon
    )?.trim()
  }, [
    _botIcon,
    getFileUrl,
    integration?.files,
    getSpecialUrl,
    preIntro,
    theme?.botIcon,
  ])

  const userIcon = useMemo(() => {
    return anyString(
      _userIcon,
      getFileUrl(integration?.files, 'user'),
      getSpecialUrl(preIntro, 'userIcon'),
      theme?.userIcon
    )?.trim()
  }, [
    _userIcon,
    getFileUrl,
    integration?.files,
    getSpecialUrl,
    preIntro,
    theme?.userIcon,
  ])

  const contextIcon = useMemo(() => {
    return anyString(
      _contextIcon,
      getFileUrl(integration?.files, 'context'),
      getSpecialUrl(preIntro, 'contextIcon'),
      theme?.contextIcon
    )?.trim()
  }, [
    _contextIcon,
    getFileUrl,
    integration?.files,
    getSpecialUrl,
    preIntro,
    theme?.contextIcon,
  ])

  const buttonIcon = useMemo(() => {
    return anyString(
      _buttonIcon,
      _icon,
      getFileUrl(integration?.files, 'button'),
      getSpecialUrl(preIntro, 'buttonIcon'),
      theme?.buttonIcon
    )?.trim()
  }, [
    _buttonIcon,
    _icon,
    getFileUrl,
    integration?.files,
    getSpecialUrl,
    preIntro,
    theme?.buttonIcon,
  ])

  const buttonTitle = useMemo(() => {
    return anyString(_buttonTitle, _title, integration?.title)?.trim()
  }, [_buttonTitle, _title, integration?.title])

  const messages = useMemo(() => {
    return _messages || integration?.messages || undefined
  }, [_messages, integration?.messages])

  const functions = useMemo(() => {
    return _functions || integration?.functions || undefined
  }, [_functions, integration?.functions])

  const meta = useMemo(() => {
    return _meta || integration?.meta || undefined
  }, [_meta, integration?.meta])

  const contact = useMemo(() => {
    return _contact || undefined
  }, [_contact])

  const autoScroll = useMemo(() => {
    return firstBoolLike(_autoScroll, integration?.autoScroll, false) // @note false because we don't want to scroll the top frame
  }, [_autoScroll, integration?.autoScroll])

  const autoFocus = useMemo(() => {
    return firstBoolLike(_autoFocus, integration?.autoFocus, false) // @note false because we don't want to focus the top frame
  }, [_autoFocus, integration?.autoFocus])

  const disabled = useMemo(() => {
    return firstBoolLike(_disabled, false)
  }, [_disabled])

  const intl = useMemo(() => {
    return Object.fromEntries(
      Object.entries(_intl || {}).map(([name, value]) => {
        if (value.intro) {
          value.intro = value.intro
            ?.replace(
              /!\[(background|banner|barIcon|botIcon|userIcon)\]\([^)]+\)/gi,
              ''
            )
            .replace(
              /!\[.*?\]\(.*?#(background|banner|barIcon|botIcon|userIcon)\)/gi,
              ''
            )
            .trim()
        }

        return [name, value]
      })
    )
  }, [_intl])

  const hideBar = useMemo(() => {
    return firstBoolLike(_hideBar, false)
  }, [_hideBar])

  const hideButton = useMemo(() => {
    return firstBoolLike(_hideButton, false)
  }, [_hideButton])

  const brandCaption = useMemo(() => {
    return _brandCaption || 'ChatBotKit'
  }, [_brandCaption])

  const brandURL = useMemo(() => {
    return _brandURL || buildFrontendURL('/')
  }, [_brandURL, buildFrontendURL])

  const brandLogo = useMemo(() => {
    return _brandLogo
  }, [_brandLogo])

  return (
    <ConfigContext.Provider
      value={{
        integrationId,

        session,

        privacy,
        moderation,

        stream,

        verbose,

        tools,

        unfurl,

        math,

        attachments,

        autoScroll,

        autoFocus,

        startFirst,

        contactCollection,

        exportConversation,
        restartConversation,

        maximize,

        messagePeek,

        voiceIn,
        voiceOut,

        poweredBy,

        theme,

        layout,

        frameWidth,

        position,

        barIcon,
        barTitle,

        background,
        banner,

        intro,

        initial,

        placeholder,

        botIcon,
        userIcon,
        contextIcon,

        buttonIcon,
        buttonTitle,

        messages,

        functions,

        meta,

        contact,

        disabled,

        intl,

        hideBar,
        hideButton,

        origin,

        brandCaption,
        brandURL,
        brandLogo,
      }}
    >
      {children}
    </ConfigContext.Provider>
  )
}

/**
 * The IntlWrapper is used to provide the internationalization support to the
 * rest of the components.
 */
export function IntlWrapper({
  intl: _intl,

  language: _language,
  locale: _locale,

  children,
}) {
  const intl = useMemo(() => {
    return Object.fromEntries(
      Object.entries(_intl || {}).map(([name, value]) => {
        if (value.intro) {
          value.intro = value.intro
            ?.replace(
              /!\[(background|banner|barIcon|botIcon|userIcon)\]\([^)]+\)/gi,
              ''
            )
            .replace(
              /!\[.*?\]\(.*?#(background|banner|barIcon|botIcon|userIcon)\)/gi,
              ''
            )
            .trim()
        }

        return [name, value]
      })
    )
  }, [_intl])

  const availableLocales = useMemo(() => {
    return Object.keys(intl || {}).filter(
      (language) =>
        language !== 'default' &&
        typeof intl[language] === 'object' &&
        intl[language] !== null
    )
  }, [intl])

  const defaultLocale = useMemo(() => {
    let names

    try {
      names = new Intl.DisplayNames(['en'], {
        type: 'language',
      })
    } catch {
      names = {
        of(locale) {
          return locale
        },
      }
    }

    const map = Object.fromEntries(
      availableLocales.flatMap((locale) => [
        [names.of(locale)?.toLowerCase?.() || locale, locale],
        [locale, locale],
      ])
    )

    const search =
      _language?.toLowerCase?.().trim() ||
      _locale?.toLowerCase?.().trim() ||
      availableLocales[0]

    const locale = map[search] || availableLocales[0]

    return locale
  }, [_language, _locale, availableLocales])

  const [locale, setLocale] = useState(
    defaultLocale || availableLocales[0] || ''
  )

  useEffect(() => {
    document.documentElement.lang = locale

    const rtlLanguages = ['ar', 'he', 'fa', 'ur'] // @todo find a generic way to do this

    document.documentElement.dir = rtlLanguages.includes(
      locale.toLowerCase().split('-')[0]
    )
      ? 'rtl'
      : 'ltr'
  }, [locale])

  const getLocalText = useCallback(
    (key, defaultValue) => {
      function getValue(key, languages) {
        const [language, ...restOfLanguages] = languages

        if (!language) {
          return
        }

        return intl?.[language]?.[key] || getValue(key, restOfLanguages)
      }

      const languages = [locale]

      try {
        languages.push(...navigator.languages)
      } catch {
        // pass
      }

      languages.push('default')

      return getValue(key, languages) || defaultValue
    },
    [intl, locale]
  )

  return (
    <IntlContext.Provider
      value={{
        intl,

        availableLocales,

        locale,
        setLocale,

        getLocalText,
      }}
    >
      {children}
    </IntlContext.Provider>
  )
}

/**
 * The ThemeWrapper is used to provide the theme to the rest of the components.
 */
export function ThemeWrapper({ className, theme: _theme, children }) {
  const config = useContext(ConfigContext)

  const theme = useMemo(() => {
    return getThemeConfig(_theme || config.theme)
  }, [_theme, config.theme])

  const cssVariables = useMemo(() => {
    return {
      // @todo add defaults

      ...Object.fromEntries(
        Object.entries(theme)
          .filter(([name]) => !['name', 'version'].includes(name))
          .map(([name, value]) => {
            if (name === 'fontFamily') {
              const fonts = [value]

              if (value === 'ui-monospace') {
                fonts.push('SFMono-Regular')
                fonts.push('SF Menlo')
                fonts.push('Menlo')
                fonts.push('Consolas')
                fonts.push('Liberation Mono')
                fonts.push('monospace')
              }

              fonts.push('sans-serif')

              value = fonts
                .map((font) => (/\s/.test(font) ? `"${font}"` : font))
                .join(', ')
            }

            return [`--${name}`, value]
          })
      ),
    }
  }, [theme])

  // @note we apply grayscale font smoothing only for light-on-dark themes
  // where it makes light text look crisper. On dark-on-light themes it would
  // thin the text and reduce contrast, so we leave the browser default there.
  // @note these are non-standard, WebKit/Blink-only properties that only have
  // an effect on macOS - they are safely ignored on other platforms/browsers.
  const fontSmoothing = useMemo(() => {
    return isLightOnDarkTheme(theme)
      ? {
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        }
      : {}
  }, [theme])

  const contextValue = useMemo(() => {
    return { theme, cssVariables }
  }, [theme, cssVariables])

  useEffect(() => {
    if (theme.fontFamily) {
      if (/^(ui-|monospace)/.test(theme.fontFamily)) {
        return
      }

      const link = document.createElement('link')

      link.rel = 'stylesheet'
      link.type = 'text/css'

      // @note use display=optional to prevent CLS from font loading
      // swap causes text to reflow when font loads, optional avoids this

      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
        theme.fontFamily
      )}:wght@400;700&display=optional`

      document.head.appendChild(link)

      return () => {
        // @note use link.remove() instead of document.head.removeChild(link)
        // to avoid NotFoundError when the link is already removed (e.g., by
        // React Strict Mode double-invocation, concurrent rendering, or
        // external scripts).

        link.remove()
      }
    }
  }, [theme.fontFamily])

  return (
    <>
      <div
        className={clsx(
          'theme-wrapper',
          {
            '![font-family:var(--fontFamily)]': theme.fontFamily,
            '![font-size:var(--fontSize)]': theme.fontSize,
            '![font-weight:var(--fontWeight)]': theme.fontWeight,
            '![line-height:var(--lineHeight)]': theme.lineHeight,
          },
          className
        )}
        style={{ ...cssVariables, ...fontSmoothing }}
      >
        <ThemeContext.Provider value={contextValue}>
          {children}
        </ThemeContext.Provider>
      </div>
    </>
  )
}

/**
 * The ResizeWrapper is used to provide the resize context to the rest of the
 * components.
 */
export function ResizeWrapper({ className, disabled, children }) {
  // extract config

  const { position } = useContext(ConfigContext)

  // controls....

  const [on, setOn] = useState(true)

  // controls whether the widget is open or closed

  const [open, setOpen] = useState(false)

  // controls weather the widget is maximized or not

  const [maximize, setMaximize] = useState(false)

  // controls weather the widget is in mobile mode
  //
  // @note detect from the live client User-Agent rather than a server-passed
  // header, so getServerSideProps output stays independent of the request
  // User-Agent. That keeps the frame response a pure function of its URL, so it
  // can be cached at the CDN/edge without a `Vary: User-Agent` (which would
  // otherwise shatter the cache). This component only renders on the client (it
  // lives inside <NoSsr>), so reading navigator here is safe; the parent's
  // `media` message still refines this to the real viewport afterwards.

  const [mobile, setMobile] = useState(() =>
    typeof navigator === 'undefined'
      ? false
      : isMobileUserAgent(navigator.userAgent)
  )

  // controls the widget size

  const { width, height, ref } = useResizeDetector()

  // helper methods

  const resize = useCallback(
    (width, height, reason) => {
      if (maximize) {
        height = '5000px'
        width = `650px`
      }

      postToParent({ type: 'resize', props: { width, height, reason } })
    },
    [maximize]
  )

  const reset = useCallback((open) => {
    postToParent({ type: 'reset', props: { open } })
  }, [])

  // use effects

  useEffect(() => {
    if (disabled) {
      return
    }

    function onMessage(event) {
      if (!isSafeMessageEvent(event)) {
        return
      }

      switch (event.data.type) {
        case 'media': {
          setMobile(event.data.props.matches)

          break
        }

        case 'setOpen': {
          setOpen(!!event.data.props.value)

          break
        }

        case 'setMaximize': {
          setMaximize(!!event.data.props.value)

          break
        }
      }
    }

    window.addEventListener('message', onMessage)

    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [disabled])

  useEffect(() => {
    // @note resize when width or height changes

    if (disabled) {
      return
    }

    if (!on) {
      return
    }

    if (typeof width === 'undefined' || typeof height === 'undefined') {
      return
    }

    resize(`${width}px`, `${height}px`, 'resize')
  }, [disabled, on, width, height, resize])

  useEffect(() => {
    // @note reset size when open state changes to ensure iframe resizes
    // correctly

    if (disabled) {
      return
    }

    reset(open)
  }, [disabled, open, reset])

  useEffect(() => {
    // @note reset maximize state when widget is closed to ensure iframe resizes
    // correctly

    if (disabled) {
      return
    }

    if (!open) {
      setMaximize(false)
    }
  }, [disabled, open])

  // set the context

  const contextValue = useMemo(() => {
    return {
      on,
      setOn,

      open,
      setOpen,

      maximize,
      setMaximize,

      mobile,
      setMobile,

      resize,

      disabled,
    }
  }, [
    on,
    setOn,

    open,
    setOpen,

    maximize,
    setMaximize,

    mobile,
    setMobile,

    resize,

    disabled,
  ])

  // render

  return (
    <div
      className={clsx('resize-wrapper', className, {
        // @note this is a bit of a hack
        ...{
          'right-0':
            position?.includes('right') && className?.includes('absolute'),
          'left-0':
            position?.includes('left') && className?.includes('absolute'),
        },
      })}
      ref={ref}
    >
      <ResizeContext.Provider value={contextValue}>
        {children}
      </ResizeContext.Provider>
    </div>
  )
}

/**
 * The ModalWrapper is used to provide the modal context to the rest of the
 * components.
 */
export function ModalWrapper({ className, disabled, children }) {
  const [style, setStyle] = useState('')

  const [message, setMessage] = useState('')

  const [status, execute, resolve, _reject, reset] = useAwaitableComponent()

  const { getLocalText } = useContext(IntlContext)

  async function confirm(message) {
    setStyle('confirm')
    setMessage(message)

    let value

    try {
      value = await execute()
    } finally {
      setStyle('')
      setMessage('')

      reset()
    }

    return value
  }

  return (
    <ModalContext.Provider value={{ confirm, disabled }}>
      {style === 'confirm' ? (
        <Dialog
          className="max-w-[80%]"
          type="modal"
          open={status === 'awaiting'}
          onClose={() => {
            resolve(false)
          }}
        >
          <div>
            <p>{message}</p>
            <div className="flex justify-end space-x-2">
              <button
                className="p-2 font-semibold"
                type="button"
                onClick={() => {
                  resolve(true)
                }}
              >
                {getLocalText('confirmYes', 'Yes')}
              </button>
              <button
                className="p-2 font-semibold"
                type="button"
                onClick={() => {
                  resolve(false)
                }}
              >
                {getLocalText('confirmNo', 'No')}
              </button>
            </div>
          </div>
        </Dialog>
      ) : null}
      <div className={clsx('modal-wrapper', className)}>{children}</div>
    </ModalContext.Provider>
  )
}

/**
 * The StateWrapper is used to provide the state context to the rest of the
 * components.
 */
export function StateWrapper({ children }) {
  const [state, setState] = useState({})

  const contextValue = useMemo(() => {
    return {
      state,
      setState,
    }
  }, [state, setState])

  return (
    <StateContext.Provider value={contextValue}>
      {children}
    </StateContext.Provider>
  )
}

/**
 * The RequiredWrappers assembles all the required wrappers for the widget to
 * work properly.
 */
export function RequiredWrappers({
  themeWrapperClassName,
  resizeWrapperClassName,
  modalWrapperClassName,

  children,

  ...props
}) {
  return (
    <ConfigWrapper {...props}>
      <IntlWrapper {...props}>
        <ThemeWrapper {...props} className={themeWrapperClassName}>
          <ResizeWrapper {...props} className={resizeWrapperClassName}>
            <ModalWrapper {...props} className={modalWrapperClassName}>
              <StateWrapper {...props}>{children}</StateWrapper>
            </ModalWrapper>
          </ResizeWrapper>
        </ThemeWrapper>
      </IntlWrapper>
    </ConfigWrapper>
  )
}

/*****************************************
 * SECTION: Frame
 *****************************************/

/**
 * The FrameComponent assembles the widget main components.
 *
 * @todo See the previous todo item for more information what needs to be done.
 */
export function FrameComponent(props) {
  return (
    <RequiredWrappers {...props} resizeWrapperClassName="absolute bottom-0">
      <Layout {...props} />
    </RequiredWrappers>
  )
}

/**
 * This is the main component of the widget. It is responsible for fetching the
 * widget integration and rendering the FrameComponent.
 *
 * @todo See the previous todo item for more information what needs to be done.
 */
export default function Frame(props) {
  // @note For whatever reason we do get a null integration here, from time to
  // time. This is why we need to check for it. This could be a bug in the the
  // getServerSideProps method or something else. Because this is mission
  // critical we need to make sure that we do continue reloading the page until
  // we get a valid integration.

  useEffect(() => {
    if (!props.integration) {
      // @note we use standard window.location instead of the nextjs router
      // because we need to hard reload the page

      window.location.reload()
    }
  }, [props.integration])

  return props.integration ? (
    <>
      <Meta
        breadcrumbs={[
          props.integration.id,
          'Frame',
          'Widget',
          'Integrations',
          'ChatBotKit',
        ]}
        title={props.integration.name || 'AI Widget'}
        target="_blank"
      />
      <NoRubberBand />
      {/* @todo figure this out */}
      {/* @note disabled until we figure out faster / cheaper asset loading */}
      {/* {props.botIcon && isURL(props.botIcon) ? (
        <link
          href={props.botIcon}
          rel="preload"
          as="image"
        />
      ) : null}
      {props.userIcon && isURL(props.botIcon) ? (
        <link
          href={props.userIcon}
          rel="preload"
          as="image"
        />
      ) : null} */}
      <NoSsr>
        <ReloadingPageErrorBoundary>
          <FrameComponent {...props} />
        </ReloadingPageErrorBoundary>
      </NoSsr>
    </>
  ) : null
}

Frame.getLayout = function (children) {
  // @note we've noticed that by setting the visibility to hidden initially and
  // then to visible when the onReady message is received from the parent
  // improves the CLS score for the iframe a lot

  // eslint-disable-next-line react-hooks/rules-of-hooks
  usePostMessageHandler(
    'onReady',
    () => {
      document.body.dataset.ready = 'true'
    },
    []
  )

  return (
    <>
      <style jsx global>{`
        html,
        body {
          overscroll-behavior: none;
          overscroll-behavior-x: none;
          overscroll-behavior-y: none;
          width: 100vh;
          height: 100vh;
          overflow: hidden;
        }

        body {
          visibility: hidden;
        }

        body[data-ready='true'] {
          visibility: visible;
        }
      `}</style>
      {children}
    </>
  )
}

Frame.theme = 'none' // ensure that the frame is not styled by the theme

/*****************************************
 * SECTION: Server Side Rendering
 *****************************************/

// @note uncomment to turn off SSR
// @note for some reason turning it of also setups the frame background
// export default dynamic(() => Promise.resolve(Frame), {
//   ssr: false,
// })

/*****************************************
 * SECTION: Server Side Props
 *****************************************/

/**
 * The getServerSideProps function is used to fetch the widget integration and
 * prepare the props for the Frame component. This function is called every time
 * the page is requested. This is why we need to be careful with the caching
 * strategy we use.
 */
export async function getServerSideProps(context) {
  const widgetIntegrationId = context.query.widgetIntegrationId?.trim?.()

  if (!widgetIntegrationId) {
    return {
      notFound: true,
    }
  }

  // Because the widget is public we need to be super careful what fields we are
  // disclosing via this method. This is why, instead of fetching all widget
  // fields, we select those we believe to be safe and further remove the fields
  // which are needed to perform validation in this method but not required by
  // the client.

  const integration = await prisma.widgetIntegration.findUnique({
    where: {
      id: widgetIntegrationId,
    },

    select: {
      id: true,

      name: true,

      theme: true,

      layout: true,

      title: true,

      intro: true,

      initial: true,

      placeholder: true,

      origin: true,

      language: true,

      stream: true,

      verbose: true,

      tools: true,

      unfurl: true,

      math: true,

      carousel: true,

      form: true,

      attachments: true,

      autoScroll: true,

      startFirst: true,

      contactCollection: true,

      exportConversation: true,
      restartConversation: true,

      maximize: true,

      messagePeek: true,

      voiceIn: true,
      voiceOut: true,

      poweredBy: true,

      updatedAt: true,

      files: {
        select: {
          fileId: true,

          type: true,
        },
      },

      // The user field is only used for validation in this method and
      // subsequently removed.

      user: {
        select: {
          id: true,

          email: true,

          billingSubscriptionId: true,
          billingSubscriptionStatus: true,

          parentId: true,
        },
      },
    },

    // We cache the user for 60 seconds to avoid hitting the database too often.
    // @todo perhaps activate this with a flag
    ...(!isDevelopment
      ? {
          // @note disable this because it is causing weird situations with
          // powered by
          // cacheStrategy: {
          //   swr: 60,
          //   ttl: 60,
          // },
        }
      : null),
  })

  if (!integration) {
    return {
      redirect: {
        destination: `/integrations/widget/${widgetIntegrationId}/404`,
        permanent: false,
      },
    }
  }

  if (!integration.user) {
    return {
      redirect: {
        destination: `/integrations/widget/${widgetIntegrationId}/404`,
        permanent: false,
      },
    }
  }

  // Allow overriding of certain fields if signed config is provided.
  {
    // @todo add code here
  }

  // Handle powered by.
  {
    if (!integration.poweredBy) {
      if (!(await canDisablePoweredBy(integration.user))) {
        integration.poweredBy = true
      }
    }
  }

  // Process the origin field and set the Content-Security-Policy accordingly.
  {
    const csp = buildOriginRestrictedCsp(integration.origin)

    if (csp) {
      context.res.setHeader('Content-Security-Policy', csp)
    }
  }

  let config = {}

  // Process common incoming parameters and set the extra object accordingly.
  {
    config.session = context.query.session || undefined

    config.position = context.query.position || undefined

    config.layout = context.query.layout || 'fullscreen'

    config.frameWidth = context.query.frameWidth || undefined

    config.intro = context.query.intro || undefined // @note left alone because at is similar to notification messages

    config.icon = context.query.icon || undefined
    config.title = context.query.title || undefined

    config.barIcon = context.query.barIcon || undefined
    config.barTitle = context.query.barTitle || undefined

    config.background = context.query.background || undefined

    config.banner = context.query.banner || undefined

    config.placeholder = context.query.placeholder || undefined

    config.botIcon = context.query.botIcon || undefined
    config.userIcon = context.query.userIcon || undefined
    config.contextIcon = context.query.contextIcon || undefined

    config.buttonIcon = context.query.buttonIcon || undefined
    config.buttonTitle = context.query.buttonTitle || undefined

    config.autoScroll = context.query.autoScroll || undefined
    config.autoFocus = context.query.autoFocus || undefined

    config.hideBar = context.query.hideBar === 'true'
    config.hideButton = context.query.hideButton === 'true'

    // The following are legacy fields which we need to support for a while.

    config.meta = context.query.meta ? tryParse(context.query.meta) : undefined
    {
      // @todo perform validation
    }

    config.messages = context.query.messages
      ? tryParse(context.query.messages)
      : undefined
    {
      // @todo perform validation
    }
  }

  // Process the demo field and set the extra object accordingly.
  {
    switch (true) {
      case context.query.demo === 'true': {
        config.intro = demos.default.into
        config.initial = demos.default.initial
        config.messages = demos.default.messages
        config.disabled = true

        break
      }

      case Object.prototype.hasOwnProperty.call(demos, context.query.demo): {
        config.intro = demos[context.query.demo].into
        config.initial = demos[context.query.demo].initial
        config.messages = demos[context.query.demo].messages
        config.disabled = true

        break
      }
    }
  }

  // Process the theme field and set the config.theme object accordingly.
  {
    try {
      config.theme = parseTheme(
        context.query.theme || integration.theme || defaultTheme // @todo decide if this is even good to allow
      ).config
    } catch {
      config.theme = {}
    }
  }

  // Process the language field and set the config.intl object accordingly.
  {
    config.language = context.query.language || undefined
    config.locale = context.query.locale || undefined

    if (integration.language) {
      config.intl = await getLanguageMap(integration)
    }
  }

  // Get messages.
  {
    let messages = context.query.messages

    if (messages) {
      messages = tryParse(messages)
    }

    if (messages) {
      config.messages = messages
    }
  }

  // Get functions.
  {
    let functions = context.query.functions

    if (functions) {
      functions = tryParse(functions)
    }

    if (functions) {
      config.functions = functions
    }
  }

  // Get meta.
  {
    let meta = context.query.meta

    if (meta) {
      meta = tryParse(meta)
    }

    if (meta) {
      config.meta = meta
    }
  }

  // Get the origin.
  {
    let origin = context.query.origin

    if (origin && /^https?:\/\//i.test(origin)) {
      config.origin = origin
    }
  }

  // Convert the updatedAt to a cache key.
  {
    config.cache = context.query.cache === 'true'

    if (integration.updatedAt) {
      config.cacheKey = integration.updatedAt.getTime().toString()
    }
  }

  // Get the powered by details.
  {
    const { caption, url, logo } = await getPoweredByDetails(integration.user)

    config.brandCaption = caption
    config.brandURL = url
    config.brandLogo = logo
  }

  // Set the appropriate headers to enable caching.
  {
    if (!isDevelopment) {
      if (context.query.cache === 'true') {
        // @note short freshness windows with generous stale-while-revalidate: a
        // widget config change (or plan/powered-by change) goes live within ~1
        // minute under real traffic, while every request is still served
        // instantly (stale served + async background refresh) so visitors never
        // block on the origin. The response is a pure function of its URL (no
        // request-header dependency), so this is safe to cache without `Vary`.
        // See CACHE_PRESETS.WIDGET_FRAME.

        applyCacheHeaders(context.res, CACHE_PRESETS.WIDGET_FRAME)

        // @note no ETag/Last-Modified: getServerSideProps always runs to
        // completion (it never returns a 304), and under stale-while-revalidate
        // the edge refreshes with a full 200 rather than a conditional GET, so a
        // validator would save neither compute nor bandwidth. Freshness comes
        // entirely from the short max-age + SWR above.
      }
    }
  }

  // Delete the user field to prevent it from being disclosed to the client.
  {
    delete integration.user
  }

  // WARNING: be extremely careful what information is exposed from the
  // integration object as that will become public information

  return {
    props: makeJsonSafe({
      ...config,

      integration,
    }),
  }
}
