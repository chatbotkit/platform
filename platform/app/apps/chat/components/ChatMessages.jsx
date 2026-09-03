'use client'

import dynamic from 'next/dynamic'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  LuCopy as CopyIcon,
  LuDownload as DownloadIcon,
  LuActivity,
  LuArrowRight,
  LuBug,
  LuCheck,
  LuChevronDown,
  LuClock,
  LuEllipsis,
  LuLightbulb,
  LuLink,
  LuMoveDiagonal,
  LuThumbsDown as ThumbDownIcon,
  LuThumbsUp as ThumbUpIcon,
  LuX,
} from 'react-icons/lu'

import { stripHtml } from '@chatbotkit-dev/file-html/parse'

import { isPairedActivityMessage } from '@/lib/activity'
import { logAnalyticsEvent } from '@/lib/analytics'
import { extractInput } from '@/lib/extract.input'
import { extractReferences } from '@/lib/extract.references'
import { splitStackText } from '@/lib/md.chat'
import { splitFrontmatter } from '@/lib/md.frontmatter'
import { textToEmojiSpans, wordsToSpans } from '@/lib/rehype.plugins'
import { normalizeText, toHeadingCase } from '@/lib/string'
import { isURL } from '@/lib/url'
import {
  stringify as stringifyYaml,
  tryParse as tryParseYaml,
} from '@/lib/yaml'

import { useInfobarToggle } from '@/layouts/App'

import { Attachment } from '@/components/AttachmentsArea'
import AudioPlayer from '@/components/AudioPlayer'
import Component from '@/components/Component'
import CopyButton from '@/components/CopyButton'
import Diagram from '@/components/Diagram'
import { DOT } from '@/components/DotsLoader'
import DynamicIcon from '@/components/DynamicIcon'
import Emoji from '@/components/Emoji'
import FancyLink from '@/components/FancyLink'
import Link from '@/components/Link'
import PopButton from '@/components/PopButton'
import SaveButton from '@/components/SaveButton'
import TimeAgo from '@/components/TimeAgo'
import TooltipButton from '@/components/TooltipButton'

import useAutoRevert from '@/hooks/useAutoRevert'
import useClassNameOnNewElements from '@/hooks/useClassNameOnNewElements'
import useIncrementIndexAfterDelay from '@/hooks/useIncrementIndexAfterDelay'

import useDebugMode from '../hooks/useDebugMode'
import { downvoteMessage, upvoteMessage } from '../server'
import ChatReasoning from './ChatReasoning'
import { useConversationContext } from './ConversationContext'
import { FeedbackForm } from './Form'
import { TextSelectionTip } from './Tips'

import clsx from 'clsx'
import { motion } from 'framer-motion'
import pluralize from 'pluralize'

// @note keep markdown rendering out of the initial chat message module graph
// because eager loading this path can trigger vague dev-time invalid element
// failures during app startup
const Safedown = dynamic(() => import('@/components/Safedown'), {
  ssr: false,
})

const diagramInit = {
  // theme: 'base',

  themeVariables: {
    // general

    fontFamily: 'Roboto',
    fontSize: '14px',

    // primaryColor: '#0674C4',
    // secondaryColor: '#DDDDDD',
    // tertiaryColor: '#A9A9A9',

    // pie

    pieTitleTextSize: '18px',
    pieLegendTextSize: '14px',
    pieOuterStrokeWidth: 1,
    pieStrokeWidth: 1,
  },
}

function getActivityResponseMessages(messages, messageId) {
  const messageIndex = Math.max(
    0,
    messages.findIndex((message) => message.id === messageId)
  )

  const previousMessages = messages.slice(0, messageIndex)

  const cutoffMessageIndex = Math.max(
    0,
    previousMessages.findLastIndex((message) =>
      ['bot', 'user'].includes(message.type)
    )
  )

  const activityRequestMessages = previousMessages
    .slice(cutoffMessageIndex)
    .filter((message) => ['activity'].includes(message.type))
    .filter((message) => message.meta?.activity?.type === 'request')

  const activityResponseMessages = activityRequestMessages
    .map((requestMessage) => {
      // @todo when/if implemented, bind requests and responses with unique
      // identifiers

      const responseMessage = previousMessages.find((message) =>
        isPairedActivityMessage(requestMessage, message)
      )

      return {
        ...requestMessage,
        ...responseMessage,

        meta: {
          ...requestMessage.meta,
          ...responseMessage?.meta,

          activity: {
            ...requestMessage.meta?.activity,
            ...responseMessage?.meta?.activity,

            function: {
              ...requestMessage.meta?.activity?.function,
              ...responseMessage?.meta?.activity?.function,

              // @note the result is usually stored as a serialized string, but
              // some paths store it as an already-parsed object/array. Passing a
              // non-string to js-yaml coerces it via `String()` -> "[object
              // Object]", which parses back into `["object Object"]` and renders
              // as "- object Object" in the debug panel. Only parse strings;
              // pass objects through untouched (mirrors `getActivityResult` in
              // @/lib/activity).
              result: (() => {
                const rawResult =
                  responseMessage?.meta?.activity?.function?.result

                return typeof rawResult === 'string'
                  ? tryParseYaml(rawResult)
                  : rawResult
              })(),
            },
          },
        },
      }
    })
    .filter(Boolean)

  return activityResponseMessages
}

function useActivities(messageId) {
  const { messages } = useConversationContext()

  const activities = useMemo(() => {
    const activityResponseMessages = getActivityResponseMessages(
      messages,
      messageId
    )

    const activities = activityResponseMessages.map((message) => {
      const {
        query,
        search,
        action,
        reason,
        input: _input,
      } = message.meta.activity.function.arguments || {}

      const input =
        (typeof query === 'string' ? query : null) ||
        (typeof search === 'string' ? search : null) ||
        (typeof action === 'string' ? action : null) ||
        (typeof reason === 'string' ? reason : null) ||
        // @todo legacy `{ input: { ... } }` fallback - required for rendering
        // tool calls from conversations created before tool-call arguments were
        // flattened. Stored history is immutable and mixed-shape, so do NOT
        // remove this until pre-flatten conversations have aged out (revisit in
        // the future once we are confident no old transcripts are being read).
        (typeof _input?.query === 'string' ? _input.query : null) ||
        (typeof _input?.search === 'string' ? _input.search : null) ||
        (typeof _input?.action === 'string' ? _input.action : null) ||
        (typeof _input?.reason === 'string' ? _input.reason : null)

      return {
        name: toHeadingCase(message.meta.activity.function.name || 'Activity'),

        input: typeof input === 'string' ? input : null,

        references: extractReferences(
          message.meta.activity.function.result
        ).map(({ name, description, ...rest }) => ({
          ...rest,

          name: name ? normalizeText(stripHtml(name)) : null,

          description: description
            ? normalizeText(stripHtml(description))
            : null,
        })),

        createdAt: message.createdAt,
      }
    })

    return activities
  }, [messageId, messages])

  return activities
}

function useDebugActivities(messageId) {
  const { messages } = useConversationContext()

  const debugActivities = useMemo(() => {
    const activityResponseMessages = getActivityResponseMessages(
      messages,
      messageId
    )

    const activities = activityResponseMessages.map((message) => {
      const functionArgs = message.meta.activity.function.arguments || {}
      const functionResult = message.meta.activity.function.result

      return {
        name: toHeadingCase(message.meta.activity.function.name || 'Activity'),

        // @note include full arguments as input for debug view
        fullInput: functionArgs,

        // @note include full result as output for debug view
        fullOutput: functionResult,

        createdAt: message.createdAt,
      }
    })

    return activities
  }, [messageId, messages])

  return debugActivities
}

export function ReferencesBlock({
  messageId,

  references: _references,

  className,

  ...props
}) {
  const activities = useActivities(messageId)

  const references = useMemo(() => {
    if (_references && _references.length > 0) {
      return _references
    }

    return activities
      .flatMap((activity) => {
        return activity.references || []
      })
      .slice(0, 5)
  }, [_references, activities])

  const showMore = useMemo(() => {
    return references.length > 0
  }, [references.length])

  const { toggle, toRender } = useInfobarToggle({
    id: `references-block-${messageId}`,

    width: '30%',

    render: useCallback(
      () => <ReferencesPanel.Memo references={references} />,
      [references]
    ),

    renderNav: useCallback(() => <h1>References</h1>, []),
  })

  return (
    <>
      <div className={clsx('custom-block', className)}>
        <div
          {...props}
          className={clsx(
            'grid gap-2',
            'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          )}
        >
          {references
            .filter(Boolean)
            .filter(
              ({
                // @todo abstract the href extraction logic

                link,
                src = link,
                url = src,
                href = url,
              }) => !!href
            )
            .map(
              (
                {
                  name,
                  title = name,

                  description,
                  summary = description,

                  link,
                  src = link,
                  url = src,
                  href = url,
                },
                index
              ) => {
                return (
                  <TooltipButton
                    key={index}
                    caption={
                      <FancyLink
                        className={clsx(
                          'w-full',
                          '[&_span]:text-xs',
                          'auto-bg-gray-200 auto-text-gray-800'
                        )}
                        href={href}
                        target="_blank"
                      >
                        {title || href}
                      </FancyLink>
                    }
                    delay={500}
                  >
                    {summary ? (
                      <div className={clsx('max-w-sm', 'text-left')}>
                        <h4
                          className={clsx(
                            'flex flex-row gap-2 items-center',
                            'font-bold'
                          )}
                        >
                          <DynamicIcon
                            className={clsx(
                              'shrink-0',
                              'block',
                              'size-[1em] supports-[height:1lh]:size-[max(1lh,1em)]',
                              'rounded-full overflow-hidden'
                            )}
                            icon={`@favicon/${href}`}
                          />
                          <span className="block truncate">
                            {title || href}
                          </span>
                        </h4>
                        <p className="mt-2 line-clamp-3">{summary}</p>
                      </div>
                    ) : null}
                  </TooltipButton>
                )
              }
            )}
          {showMore ? (
            <FancyLink
              className={clsx(
                'w-full',
                // 'border auto-border-gray-300',
                '[&_span]:text-xs'
              )}
              href="#"
              icon={({ className, ...props }) => (
                <div {...props}>
                  <LuEllipsis
                    className={clsx('size-full p-0.5 text-black', className)}
                  />
                </div>
              )}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()

                toggle()
              }}
            >
              More
            </FancyLink>
          ) : null}
        </div>
      </div>
      {toRender}
    </>
  )
}

ReferencesBlock.Memo = memo(ReferencesBlock)

export function FileBlock({
  messageId,

  path,

  className,

  children,

  ...props
}) {
  const [name, ext] = useMemo(() => {
    const name = path ? path.split('/').pop() : 'file.md'

    const ext = name.split('.').pop()

    return [name, ext]
  }, [path])

  // @note markdown front matter renders "funky" when fed straight to the
  // markdown renderer: the `---` fences turn into a stray horizontal rule and
  // a setext heading. Detect it, and surface the front matter - exactly as
  // written in the file - as a fenced yaml code block above the rendered body.
  // `children` (the raw file) is left untouched so copy/download still get the
  // original file.
  const source = useMemo(() => {
    if (ext !== 'md' || typeof children !== 'string') {
      return children
    }

    try {
      const { data, content } = splitFrontmatter(children)

      if (data && Object.keys(data).length > 0) {
        // `content` is an exact suffix of `children`, so the leading slice is
        // the original front matter block verbatim (fences included) - not a
        // re-serialized copy.
        const frontmatter = children
          .slice(0, children.length - content.length)
          .trim()

        return `\`\`\`yaml\n${frontmatter}\n\`\`\`\n\n${content}`
      }
    } catch {
      // not valid front matter (e.g. a leading horizontal rule) - render as-is
    }

    return children
  }, [ext, children])

  const rehypePlugins = useMemo(() => {
    return [textToEmojiSpans]
  }, [])

  const extraComponents = useMemo(() => {
    return {
      emoji({ children }) {
        return <Emoji>{children}</Emoji>
      },
    }
  }, [])

  const as = useMemo(() => {
    return (
      {
        md: ({ className, children, ...props }) => (
          <Safedown
            {...props}
            className={clsx(
              'p-2',
              'prose dark:prose-invert prose-xs prose-headings:text-sm prose-headings:font-normal prose-headings:text-[inherit] prose-headings:mt-0 prose-headings:mb-2',
              className
            )}
            rehypePlugins={rehypePlugins}
            extraComponents={extraComponents}
          >
            {children}
          </Safedown>
        ),
        txt: ({ className, children, ...props }) => (
          <pre {...props} className={clsx('p-2', 'text-xs', className)}>
            <code className="whitespace-pre-wrap break-words">{children}</code>
          </pre>
        ),
      }[ext] || 'div'
    )
  }, [ext, rehypePlugins, extraComponents])

  const as2 = useMemo(() => {
    return (
      {
        md: ({ className, children, ...props }) => (
          <Safedown
            {...props}
            className={clsx(
              'file-block-content',
              'p-5',
              'prose dark:prose-invert prose-xs prose-hr:auto-border-gray-100',
              className
            )}
            rehypePlugins={rehypePlugins}
            extraComponents={extraComponents}
          >
            {children}
          </Safedown>
        ),
        txt: ({ className, children, ...props }) => (
          <pre
            {...props}
            className={clsx('file-block-content', 'p-5', 'text-xs', className)}
          >
            <code className="whitespace-pre-wrap break-words">{children}</code>
          </pre>
        ),
      }[ext] || 'div'
    )
  }, [ext, rehypePlugins, extraComponents])

  const { toggle, toRender } = useInfobarToggle({
    id: useMemo(() => {
      return `file-block-${messageId}-${path}-${name}`
    }, [messageId, path, name]),

    width: '50%',

    render: useCallback(() => {
      return (
        <>
          <TextSelectionTip />
          <Component as={as2}>{source}</Component>
        </>
      )
    }, [source, as2]),

    renderNav: useCallback(() => {
      return (
        <>
          <SaveButton
            className="default-button rounded-full push pointer-events-auto"
            data={children}
            type="text/markdown"
            name={name}
          >
            <DownloadIcon />
          </SaveButton>
          <CopyButton
            className="default-button rounded-full push pointer-events-auto"
            text={children}
          >
            <CopyIcon />
          </CopyButton>
        </>
      )
    }, [children, name]),
  })

  return (
    <>
      <div
        {...props}
        className={clsx(
          'custom-block',
          'text-sm',
          'border auto-border-gray-200 rounded-xl overflow-hidden',
          'select-none',
          className
        )}
      >
        <div
          className={clsx(
            'px-2 py-2',
            'flex flex-row items-center gap-2',
            'auto-bg-gray-100',
            'auto-text-gray-500'
          )}
        >
          <div className="truncate">{name}</div>
          <div className="flex-1" />
          <CopyButton
            className="default-button small rounded-full push pointer-events-auto"
            text={children}
          >
            <CopyIcon />
          </CopyButton>
          <button
            className="default-button small rounded-full push pointer-events-auto"
            type="button"
            onClick={toggle}
          >
            <LuMoveDiagonal />
          </button>
        </div>
        <div
          className={clsx(
            'px-2 py-2',
            'auto-bg-gray-50',
            'gradient-mask-b-20',
            // @note bound the collapsed preview to a fixed height with the fade
            // mask. `line-clamp-3` does not reliably clamp block-level markdown
            // (prose headings/paragraphs render via `-webkit-box`), so long
            // files overflowed; a `max-h` + `overflow-hidden` clips regardless
            // of the content shape (mirrors the activity input/output previews).
            'max-h-24 overflow-hidden',
            'cursor-pointer'
          )}
          onClick={toggle}
        >
          <Component as={as}>{source}</Component>
        </div>
      </div>
      {toRender}
    </>
  )
}

FileBlock.Memo = memo(FileBlock)

function ActivitiesPanel({ activities, className, children, ...props }) {
  const [expandReferences, setExpandReferences] = useState(false)

  return (
    <div
      {...props}
      className={clsx(
        // 'px-4 pb-10',
        'pl-3 pt-4 pb-4 pr-4',
        className
      )}
    >
      {/* <h1 className="text-lg font-semibold flex items-center mb-3 ml-0.5">
        Activities
      </h1> */}
      {activities.map(({ name, input, references, createdAt }, index) => {
        return (
          <div key={index}>
            <h2 className="text-sm font-semibold flex items-center">
              <div className="size-5 auto-bg-gray-100 flex items-center justify-center rounded-full mr-1.5">
                <LuActivity
                  className="inline-block size-2.5 auto-text-gray-500"
                  strokeWidth={2}
                />
              </div>
              <div className="truncate">{name}</div>
              {createdAt ? (
                <div>
                  <TimeAgo
                    className="ml-2 tag text-xs font-normal truncate"
                    time={createdAt}
                  />
                </div>
              ) : null}
            </h2>
            {input ? (
              <div className="space-y-2 ml-2.5 pl-4 pt-4 border-l auto-border-gray-200 border-dashed">
                <div className="flex items-center gap-2.5 -ml-[22.5px]">
                  <div className="size-3 flex items-center justify-center rounded-full border auto-border-gray-200 auto-bg-gray-100 border-dashed"></div>
                  <div className="flex items-center gap-1">
                    <LuArrowRight className="inline-block size-3 auto-text-gray-500" />
                    <h2 className="font-semibold auto-text-gray-500 text-xs">
                      Input
                    </h2>
                  </div>
                </div>
                <div>
                  <p className="text-xs auto-bg-gray-100 p-2 px-2.5 rounded-lg inline-block">
                    <span className="text-xs italic auto-text-gray-950 line-clamp-1">
                      {input.charAt(0).toUpperCase() + input.slice(1)}
                    </span>
                  </p>
                </div>
              </div>
            ) : null}
            {references?.length ? (
              <div className="space-y-2 ml-2.5 pl-4 pt-4 border-l auto-border-gray-200 border-dashed">
                <div className="flex items-center gap-2.5 -ml-[22.5px]">
                  <div className="size-3 flex items-center justify-center rounded-full border auto-border-gray-200 auto-bg-gray-100 border-dashed"></div>
                  <div className="flex items-center gap-1">
                    <LuLink className="inline-block size-3 auto-text-gray-500" />
                    <h2 className="font-semibold auto-text-gray-500 text-xs">
                      References
                    </h2>
                  </div>
                </div>
                <div className="flex flex-col -mx-1 rounded-xl auto-bg-gray-100 p-0.5">
                  <div className="flex items-center justify-between py-2 px-3">
                    <p className="text-xs auto-text-gray-500">
                      Analyzed{' '}
                      <span className="auto-text-gray-950">
                        {' '}
                        {references.length}
                      </span>{' '}
                      {pluralize('reference', references.length)}.
                    </p>
                    <button
                      type="button"
                      className="size-5 flex items-center justify-center auto-bg-gray-200 rounded-full"
                      onClick={() => setExpandReferences((prev) => !prev)}
                    >
                      <LuChevronDown
                        className={clsx(
                          'inline-block size-3 auto-text-gray-950 transition-transform duration-200',
                          {
                            'rotate-180': expandReferences,
                          }
                        )}
                      />
                    </button>
                  </div>
                  {/* @todo add animations */}
                  <div className="p-2.5 auto-bg-gray-50 rounded-xl border auto-border-gray-200 shadow relative overflow-hidden flex-1 w-full flex flex-col gap-1.5">
                    {references
                      .filter(({ url }) => !!url)
                      .slice(0, expandReferences ? references.length : 5)
                      .map(({ url, name, description }, index) => {
                        return (
                          <TooltipButton
                            key={index}
                            className="h-auto leading-none"
                            tooltip={
                              name || description ? (
                                <div className="text-left max-w-xs space-y-2">
                                  {name ? (
                                    <div
                                      className={clsx({
                                        'font-semibold': !!description,
                                      })}
                                    >
                                      {name}
                                    </div>
                                  ) : null}
                                  {description ? (
                                    <div className="line-clamp-2">
                                      {description}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null
                            }
                            allowedPlacements={['bottom', 'top']}
                            delay={500}
                          >
                            <FancyLink
                              className="flex-1 w-full text-base [&_span]:text-xs"
                              href={url}
                              target="_blank"
                            >
                              {name || url}
                            </FancyLink>
                          </TooltipButton>
                        )
                      })}
                    {references.length > 5 && !expandReferences ? (
                      <div className="pointer-events-none absolute left-0 bottom-0 h-[6rem] w-full bg-gradient-to-t from-gray-50 dark:from-gray-950" />
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
            {index !== activities.length - 1 && (
              <div className="h-4 w-1 border-l auto-border-gray-200 border-dashed ml-2.5" />
            )}
          </div>
        )
      })}
      {children}
    </div>
  )
}

ActivitiesPanel.Memo = memo(ActivitiesPanel)

function DebugPanel({ debugActivities, className, children, ...props }) {
  const [expandedItems, setExpandedItems] = useState({})

  const toggleExpand = useCallback((index, section) => {
    setExpandedItems((prev) => ({
      ...prev,
      [`${index}-${section}`]: !prev[`${index}-${section}`],
    }))
  }, [])

  function hasContent(value) {
    if (!value) {
      return false
    }

    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.length > 0
      }

      return Object.keys(value).length > 0
    }

    return true
  }

  return (
    <div
      {...props}
      className={clsx('pl-3 pt-4 pb-4 pr-4 overflow-auto', className)}
    >
      {debugActivities.map(
        ({ name, fullInput, fullOutput, createdAt }, index) => {
          const isInputExpanded = expandedItems[`${index}-input`]
          const isOutputExpanded = expandedItems[`${index}-output`]

          return (
            <div key={index} className="mb-4 last:mb-0">
              <h2 className="text-sm font-semibold flex items-center">
                <div className="size-5 auto-bg-gray-100 flex items-center justify-center rounded-full mr-1.5">
                  <LuBug
                    className="inline-block size-2.5 auto-text-gray-500"
                    strokeWidth={2}
                  />
                </div>
                <div className="truncate">{name}</div>
                {createdAt ? (
                  <div>
                    <TimeAgo
                      className="ml-2 tag text-xs font-normal truncate"
                      time={createdAt}
                    />
                  </div>
                ) : null}
              </h2>

              {/* Input Section */}
              {hasContent(fullInput) ? (
                <div className="space-y-2 ml-2.5 pl-4 pt-4 border-l auto-border-gray-200 border-dashed">
                  <div className="flex items-center gap-2.5 -ml-[22.5px]">
                    <div className="size-3 flex items-center justify-center rounded-full border auto-border-gray-200 auto-bg-gray-100 border-dashed"></div>
                    <div className="flex items-center gap-1 flex-1">
                      <LuArrowRight className="inline-block size-3 auto-text-gray-500" />
                      <h3 className="font-semibold auto-text-gray-500 text-xs">
                        Input
                      </h3>
                      <button
                        type="button"
                        className="ml-auto size-5 flex items-center justify-center auto-bg-gray-200 rounded-full"
                        onClick={() => toggleExpand(index, 'input')}
                      >
                        <LuChevronDown
                          className={clsx(
                            'inline-block size-3 auto-text-gray-950 transition-transform duration-200',
                            {
                              'rotate-180': isInputExpanded,
                            }
                          )}
                        />
                      </button>
                    </div>
                  </div>
                  <div
                    className={clsx(
                      'auto-bg-gray-100 rounded-lg overflow-hidden transition-all duration-200',
                      {
                        'max-h-24 gradient-mask-t-10': !isInputExpanded,
                        'max-h-none': isInputExpanded,
                      }
                    )}
                  >
                    <pre className="text-xs p-2 px-2.5 overflow-x-auto whitespace-pre-wrap break-words">
                      <code className="auto-text-gray-950">
                        {stringifyYaml(fullInput)}
                      </code>
                    </pre>
                  </div>
                </div>
              ) : null}

              {/* Output Section */}
              {hasContent(fullOutput) ? (
                <div className="space-y-2 ml-2.5 pl-4 pt-4 border-l auto-border-gray-200 border-dashed">
                  <div className="flex items-center gap-2.5 -ml-[22.5px]">
                    <div className="size-3 flex items-center justify-center rounded-full border auto-border-gray-200 auto-bg-gray-100 border-dashed"></div>
                    <div className="flex items-center gap-1 flex-1">
                      <LuLink className="inline-block size-3 auto-text-gray-500" />
                      <h3 className="font-semibold auto-text-gray-500 text-xs">
                        Output
                      </h3>
                      <button
                        type="button"
                        className="ml-auto size-5 flex items-center justify-center auto-bg-gray-200 rounded-full"
                        onClick={() => toggleExpand(index, 'output')}
                      >
                        <LuChevronDown
                          className={clsx(
                            'inline-block size-3 auto-text-gray-950 transition-transform duration-200',
                            {
                              'rotate-180': isOutputExpanded,
                            }
                          )}
                        />
                      </button>
                    </div>
                  </div>
                  <div
                    className={clsx(
                      'auto-bg-gray-100 rounded-lg overflow-hidden transition-all duration-200',
                      {
                        'max-h-24 gradient-mask-b-10': !isOutputExpanded,
                        'max-h-none': isOutputExpanded,
                      }
                    )}
                  >
                    <pre className="text-xs p-2 px-2.5 overflow-x-auto whitespace-pre-wrap break-words">
                      <code className="auto-text-gray-950">
                        {typeof fullOutput === 'string'
                          ? fullOutput
                          : stringifyYaml(fullOutput)}
                      </code>
                    </pre>
                  </div>
                </div>
              ) : null}

              {index !== debugActivities.length - 1 && (
                <div className="h-4 w-1 border-l auto-border-gray-200 border-dashed ml-2.5" />
              )}
            </div>
          )
        }
      )}
      {children}
    </div>
  )
}

DebugPanel.Memo = memo(DebugPanel)

function ReferencesPanel({
  activities,

  references = activities.flatMap((activity) => activity.references || []),

  className,

  children,

  ...props
}) {
  return (
    <div
      {...props}
      className={clsx(
        // 'px-4 pb-10',
        'px-4 pt-4 pb-4',
        className
      )}
    >
      {/* <h1 className="text-lg font-semibold flex items-center mb-3 ml-0.5">
        References
      </h1> */}
      <div className="flex flex-col gap-1">
        {references
          .filter(
            ({
              // @todo abstract the href extraction logic

              link,
              src = link,
              url = src,
              href = url,
            }) => !!href
          )
          .map(
            (
              {
                name,
                title = name,

                description,
                summary = description,

                link,
                src = link,
                url = src,
                href = url,
              },
              index
            ) => {
              return (
                <TooltipButton
                  key={index}
                  className="h-auto leading-none"
                  tooltip={
                    title || summary ? (
                      <div className="text-left max-w-xs space-y-2">
                        {title ? (
                          <div
                            className={clsx({
                              'font-semibold': !!summary,
                            })}
                          >
                            {title}
                          </div>
                        ) : null}
                        {summary ? (
                          <div className="line-clamp-2">{summary}</div>
                        ) : null}
                      </div>
                    ) : null
                  }
                  allowedPlacements={['bottom', 'top']}
                  delay={500}
                >
                  <FancyLink
                    className="flex-1 w-full text-base [&_span]:text-xs"
                    href={href}
                    target="_blank"
                  >
                    {title || href}
                  </FancyLink>
                </TooltipButton>
              )
            }
          )}
      </div>
      {children}
    </div>
  )
}

ReferencesPanel.Memo = memo(ReferencesPanel)

export function ChatReferences({ messageId, text, className, ...props }) {
  const hasReferences = useMemo(() => {
    return /\`\`\`references/.test(text)
  }, [text])

  return hasReferences ? null : (
    <ReferencesBlock.Memo
      {...props}
      className={className}
      messageId={messageId}
    />
  )
}

ChatReferences.Memo = memo(ChatReferences)

export function ChatTools({
  conversationId,
  messageId,

  text,

  collectFeedbackReason,

  className,

  actions,

  createdAt,

  children,

  ...props
}) {
  const isDebugMode = useDebugMode()

  const [thumbUpClicked, setThumbUpClicked] = useAutoRevert({ delay: 1000 })
  const [thumbDownClicked, setThumbDownClicked] = useAutoRevert({ delay: 1000 })

  async function handleThumbUp() {
    setThumbUpClicked(true)

    await upvoteMessage({ conversationId, messageId })

    logAnalyticsEvent('thumb_up', {
      event_type: 'feedback',

      conversationId,
      messageId,
    })
  }

  async function handleThumbDown({ reason } = {}) {
    setThumbDownClicked(true)

    await downvoteMessage({ conversationId, messageId, reason })

    logAnalyticsEvent('thumb_down', {
      event_type: 'feedback',

      conversationId,
      messageId,
    })
  }

  return (
    <div {...props} className={clsx('flex flex-row gap-2 text-sm', className)}>
      <div className="flex items-center">
        {isDebugMode ? (
          <div className="flex items-center gap-1.5">
            <ChatDebug.Memo messageId={messageId} />
            <ChatSeparator.Memo />
          </div>
        ) : actions?.length ? (
          <div className="flex items-center gap-1.5">
            <ChatActions.Memo messageId={messageId} actions={actions} />
            <ChatSeparator.Memo />
          </div>
        ) : null}
        <CopyButton
          className="flex items-center gap-2 hover:auto-bg-gray-100 rounded-lg p-2 transition-opacity duration-200 group"
          text={text}
        >
          <CopyIcon className="size-4 text-gray-500 group-hover:text-gray-950 dark:group-hover:text-gray-50 transform group-hover:-rotate-12 transition duration-200" />
        </CopyButton>
        {conversationId && messageId ? (
          <div className="flex items-center">
            <button
              className="flex items-center gap-2 hover:auto-bg-gray-100 rounded-lg p-2 transition-opacity duration-200 group"
              type="button"
              onClick={handleThumbUp}
            >
              <Component
                as={thumbUpClicked ? LuCheck : ThumbUpIcon}
                className="size-4 text-gray-500 group-hover:text-gray-950 dark:group-hover:text-gray-50 transform group-hover:-rotate-12 transition duration-200"
              />
            </button>
            {collectFeedbackReason ? (
              <PopButton
                caption={
                  <div
                    className="flex items-center gap-2 hover:auto-bg-gray-100 rounded-lg p-2 transition-opacity duration-200 group"
                    type="button"
                  >
                    <ThumbDownIcon className="size-4 text-gray-500 group-hover:text-gray-950 dark:group-hover:text-gray-50 transform group-hover:-rotate-12 transition duration-200" />
                  </div>
                }
                placement="top"
                closeOnClick={false}
                transitionStyles="scale"
              >
                {({ close }) => (
                  <FeedbackForm.Memo
                    onSubmit={async (data) => {
                      await handleThumbDown(data)
                      close()
                    }}
                    onCancel={close}
                  />
                )}
              </PopButton>
            ) : (
              <button
                className="flex items-center gap-2 hover:auto-bg-gray-200 rounded-lg p-2 transition-opacity duration-200 group"
                type="button"
                onClick={handleThumbDown}
              >
                <Component
                  as={thumbDownClicked ? LuCheck : ThumbDownIcon}
                  className="size-4 text-gray-500 group-hover:text-gray-950 dark:group-hover:text-gray-50 transform group-hover:-rotate-12 transition duration-200"
                />
              </button>
            )}
          </div>
        ) : null}
        {createdAt ? <ChatDate.Memo createdAt={createdAt} /> : null}
      </div>
      {children}
    </div>
  )
}

ChatTools.Memo = memo(ChatTools)

export function ChatActivity({
  messageId: _messageId,

  actions,

  working,

  className,

  children,

  ...props
}) {
  const actionIndex = useIncrementIndexAfterDelay(
    actions.length - 1,
    500,
    !working
  )

  const currentAction = useMemo(() => {
    return actions[actionIndex] || null
  }, [actions, actionIndex])

  return (
    <div {...props} className={clsx('relative group', className)}>
      {working ? (
        currentAction ? (
          <div className="flex items-center gap-2 py-1">
            <div className="size-4 rounded-full bg-white p-[1px]">
              <DynamicIcon
                className="size-4 text-gray-500 rounded-full"
                icon={currentAction.icon || '@logo/chatbotkit.com'}
              />
            </div>
            <p
              className={clsx(
                'text-base auto-text-gray-500 max-w-[20rem] truncate',
                { 'shimmer-subtle': working }
              )}
            >
              {extractInput(currentAction.input, { capitalize: true }) ||
                'Working...'}
            </p>
          </div>
        ) : null
      ) : (
        <div className="flex items-center gap-2 py-1">
          <LuActivity className="size-4 text-gray-500" />
          <p className="text-base auto-text-gray-500 max-w-[20rem] truncate flex items-center gap-1 cursor-default">
            Completed ({actions.length}) actions
          </p>
        </div>
      )}
      {children}
    </div>
  )
}

ChatActivity.Memo = memo(ChatActivity)

export function ChatActions({
  messageId,

  actions,

  working,

  className,

  children,

  ...props
}) {
  const activities = useActivities(messageId)

  const hasActivities = useMemo(() => {
    return activities.length > 0
  }, [activities.length])

  const { toggle, toRender } = useInfobarToggle({
    id: `chat-actions-${messageId}`,

    width: '400px',

    render: useCallback(
      () => <ActivitiesPanel.Memo activities={activities} />,
      [activities]
    ),

    renderNav: useCallback(() => <h1>Activities</h1>, []),
  })

  return (
    <>
      <motion.div
        {...props}
        className={clsx(
          'flex items-center gap-2',
          'rounded-full',
          'p-1.5 px-2',
          'transition-colors duration-150',
          'auto-bg-gray-100',
          {
            'hover:auto-bg-gray-200': hasActivities,
            'cursor-pointer': hasActivities,
            'cursor-progress': working && !hasActivities,
            'cursor-not-allowed': !working && !hasActivities,
          },
          className
        )}
        initial={working ? { opacity: 0, y: 8 } : undefined}
        animate={working ? { opacity: 1, y: 0 } : undefined}
        transition={working ? { duration: 0.4 } : undefined}
        onClick={hasActivities ? toggle : undefined}
      >
        {actions.slice(0, 2).map(({ icon }, index) => (
          <motion.div
            key={index}
            className="size-4 object-cover rounded-full"
            initial={working ? { opacity: 0, scale: 0.7 } : undefined}
            animate={working ? { opacity: 1, scale: 1 } : undefined}
            transition={
              working ? { duration: 0.4, delay: index * 0.1 } : undefined
            }
          >
            <div className="rounded-full bg-white p-[1px] size-4">
              <DynamicIcon
                className="size-full rounded-full bg-white"
                icon={icon || '@logo/chatbotkit.com'}
              />
            </div>
          </motion.div>
        ))}
        {actions.length > 2 ? (
          <p className="text-sm pr-1">+ {actions.length - 2} more</p>
        ) : (
          <p className="text-sm pr-1">
            {actions.length} {pluralize('actions', actions.length)}
          </p>
        )}
        {children}
      </motion.div>
      {toRender}
    </>
  )
}

ChatActions.Memo = memo(ChatActions)

export function ChatDebug({
  messageId,

  className,

  children,

  ...props
}) {
  const debugActivities = useDebugActivities(messageId)

  const hasDebugActivities = useMemo(() => {
    return debugActivities.length > 0
  }, [debugActivities.length])

  const { toggle, toRender } = useInfobarToggle({
    id: `chat-debug-${messageId}`,

    width: '450px',

    render: useCallback(
      () => <DebugPanel.Memo debugActivities={debugActivities} />,
      [debugActivities]
    ),

    renderNav: useCallback(() => <h1>Debug</h1>, []),
  })

  return (
    <>
      <motion.div
        {...props}
        className={clsx(
          'flex items-center gap-2',
          'rounded-full',
          'p-1.5 px-2',
          'transition-colors duration-150',
          'auto-bg-gray-100',
          {
            'hover:auto-bg-gray-200': hasDebugActivities,
            'cursor-pointer': hasDebugActivities,
            'cursor-not-allowed': !hasDebugActivities,
          },
          className
        )}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        onClick={hasDebugActivities ? toggle : undefined}
      >
        <LuBug className="size-4 text-gray-500" />
        <p className="text-sm pr-1">
          {debugActivities.length} {pluralize('action', debugActivities.length)}
        </p>
        {children}
      </motion.div>
      {toRender}
    </>
  )
}

ChatDebug.Memo = memo(ChatDebug)

export function ChatAttachments({
  attachments,
  className,
  children,
  ...props
}) {
  return (
    <div
      {...props}
      className={clsx('flex flex-row justify-end flex-wrap gap-2', className)}
    >
      {attachments.map(({ name, type, url }, index) => {
        return <Attachment key={index} type={type} url={url} name={name} />
      })}
      {children}
    </div>
  )
}

ChatAttachments.Memo = memo(ChatAttachments)

export function ChatSeparator({ animated, className, children, ...props }) {
  return (
    <motion.div
      {...props}
      className={clsx('flex items-center gap-1 mx-1', className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {[...Array(2)].map((_, i) => (
        <motion.div
          key={i}
          className={`size-1 bg-gray-300 dark:bg-gray-700 rounded-full ${
            i % 2 === 0
              ? 'bg-gray-200 dark:bg-gray-800'
              : 'bg-gray-400 dark:bg-gray-600'
          }`}
          animate={{ scale: [1, 1.5, 1] }}
          transition={{
            repeat: animated ? Infinity : 0,
            duration: 0.8,
            delay: i * 0.2,
          }}
        />
      ))}
      {children}
    </motion.div>
  )
}

ChatSeparator.Memo = memo(ChatSeparator)

export function ChatDate({ createdAt, className, children, ...props }) {
  return (
    <div
      {...props}
      className={clsx(
        'text-xs text-gray-500 flex items-center gap-1.5 p-2',
        className
      )}
    >
      <LuClock className="size-4" />
      {new Date(createdAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })}
      {children}
    </div>
  )
}

ChatDate.Memo = memo(ChatDate)

export function UserContent({
  rehypePlugins: _rehypePlugins,
  extraComponents: _extraComponents,
  codeRenderers: _codeRenderers,

  ...props
}) {
  // @todo limit the user message to a few lines but allow to be expanded

  return <div {...props} />
}

UserContent.Memo = memo(UserContent)

export function BotContent({ ...props }) {
  return <Safedown {...props} />
}

BotContent.Memo = memo(BotContent)

export function ChatMessage({
  conversationId,
  messageId,

  bots,

  reasoning,

  text: _text,
  type,

  createdAt,

  from,

  actions,

  attachments,

  forceReferences,
  collectFeedbackReason,

  showTools,

  thinking,
  writing,

  className,

  children,

  ...props
}) {
  const working = thinking || writing

  const text = useMemo(() => {
    if (working) {
      return splitStackText(_text, {
        emitCompleteFencedCodeBlocks: [
          'mermaid',
          'audio',
          'file',
          'references',
        ],
        emitCompleteTableBlockRows: true,
        emitCompleteAnchors: true,
        emitCompleteImages: true,
      }).join('\n\n')
    } else {
      return _text
    }
  }, [_text, working])

  const newElementsObserverRef = useClassNameOnNewElements({
    excludeTypes: [
      'img', // @note it makes images flicker
    ],

    className: 'appear-animation',

    disabled: !working,
  })

  return (
    <div
      {...props}
      className={clsx(
        'message',
        'flex flex-col gap-4',
        '[&_.custom-block+.custom-block]:mt-4',
        className
      )}
    >
      {attachments?.length ? (
        <ChatAttachments.Memo attachments={attachments} />
      ) : null}
      <div
        className={clsx({
          'flex flex-row justify-end': type === 'user',
          'flex flex-col gap-4': type === 'bot',
        })}
      >
        {writing && !reasoning && !text && (
          <div className="flex items-center gap-2 py-1 relative motion-preset-blur-up motion-preset-blur">
            <div className="group">
              <LuLightbulb className="size-4 text-gray-500" />
            </div>
            <p className="text-base auto-text-gray-500 not-italic shimmer-subtle cursor-default">
              Understanding intent...
            </p>
          </div>
        )}
        {reasoning ? (
          <ChatReasoning.Memo
            reasoning={reasoning}
            working={!!reasoning && !text}
          />
        ) : null}
        {actions?.length ? (
          <ChatActivity.Memo
            messageId={messageId}
            actions={actions}
            working={working}
          />
        ) : null}
        <div
          ref={newElementsObserverRef}
          className={clsx({
            [clsx(
              'max-w-lg',
              'bg-gray-200/70 dark:bg-gray-900',
              'rounded-2xl',
              'px-4 py-2'
            )]: type === 'user',
          })}
        >
          <Component
            as={type === 'user' ? UserContent.Memo : BotContent.Memo}
            className={clsx(
              {
                'whitespace-pre-wrap': type === 'user',
              },

              'prose prose-sizeless dark:prose-invert prose-headings:text-lg prose-headings:auto-text-gray-800 prose-th:align-top',

              'overflow-x-hidden', // @note prevents long links from overflowing the box

              // '[&_[data-footnote-ref="true"]]:!no-underline [&_[data-footnote-ref="true"]]:w-[1.5em] [&_[data-footnote-ref="true"]]:aspect-square [&_[data-footnote-ref="true"]]:inline-flex [&_[data-footnote-ref="true"]]:justify-center [&_[data-footnote-ref="true"]]:items-center [&_[data-footnote-ref="true"]]:rounded-full [&_[data-footnote-ref="true"]]:auto-bg-gray-200 [&_[data-footnote-ref="true"]]:auto-text-gray-800',
              // '[&_.footnotes_ol]:list-none [&_.footnotes_ol]:m-0 [&_.footnotes_ol]:p-0 [&_.footnotes_ol]:flex [&_.footnotes_ol]:flex-row [&_.footnotes_ol]:flex-wrap [&_.footnotes_ol]:gap-2',
              // '[&_.footnotes_li]:m-0 [&_.footnotes_li]:p-0 [&_.footnotes_li_p]:p-0',
              '[&_.footnotes_a]:!no-underline [&_.footnotes_a[data-footnote-backref="true"]]:hidden',

              'relative', // @note needed for the dot

              '[&_a]:break-all [&_a]:hyphens-auto',

              '[&_img]:max-w-lg', // @todo implement hover zoom
              '[&_img]:rounded-xl',

              '[&_.codeblock]:text-xs',

              '[&_.footnotes]:text-[0.8em]',
              '[&_.footnotes_li_p]:m-0',

              '[&_a[href$="#loading-dot"]]:!no-underline [&_a[href$="#loading-dot"]]:pointer-events-none [&_a[href$="#loading-dot"]]:text-inherit [&_a[href$="#loading-dot"]]:inline-block [&_a[href$="#loading-dot"]]:animate-pulse',
              '[&_a[href$="#writing-dot"]]:!no-underline [&_a[href$="#writing-dot"]]:pointer-events-none [&_a[href$="#writing-dot"]]:text-inherit [&_a[href$="#writing-dot"]]:inline-block [&_a[href$="#writing-dot"]]:animate-pulse [&_a[href$="#writing-dot"]]:absolute [&_a[href$="#writing-dot"]]:ml-2',

              // '[&_a[href$="#action"]]:!no-underline [&_a[href$="#action"]]:pointer-events-none [&_a[href$="#action"]]:cursor-crosshair [&_a[href$="#action"]]:px-2 [&_a[href$="#action"]]:inline-flex [&_a[href$="#action"]]:items-center [&_a[href$="#action"]]:auto-bg-gray-200 [&_a[href$="#action"]]:auto-text-gray-800 [&_a[href$="#action"]]:rounded-lg [&_a[href$="#action"]]:[font-size:0.8em]'
              '[&_a[href$="#action"]]:!hidden'
            )}
            rehypePlugins={useMemo(() => {
              return working
                ? [wordsToSpans, textToEmojiSpans]
                : [textToEmojiSpans]
            }, [working])}
            extraComponents={useMemo(() => {
              return {
                a({ node: _node, href, className, children, ...props }) {
                  const isAuth =
                    href?.includes?.('cbk=1') && href?.includes?.('auth=1')

                  isAuth // @todo take into account

                  const isFootnote = props['data-footnote-ref'] === true

                  // @note the reason we wrap the link into a span is to make
                  // sure that prose is rendered correctly as in some cases it
                  // it can add extra margin / padding in ol and ul elements

                  return href ? (
                    <span className={className}>
                      {FancyLink.isExternal(href) ? (
                        <FancyLink
                          {...props}
                          className={clsx(
                            'not-prose',
                            'text-sm',
                            '[&_span]:text-xs',
                            'max-w-96',
                            'auto-bg-gray-200 auto-text-gray-800'
                          )}
                          href={href}
                          target={isURL(href) ? '_blank' : undefined}
                          rel="noreferrer"
                        >
                          {children}
                        </FancyLink>
                      ) : (
                        <Link
                          {...props}
                          className={clsx({
                            'default-link': !isFootnote,
                            'not-prose no-underline rounded-full auto-bg-gray-200 p-1 aspect-square inline-flex justify-center items-center ml-0.5':
                              !!isFootnote,
                          })}
                          href={href}
                          target={isURL(href) ? '_blank' : undefined}
                          rel="noreferrer"
                        >
                          {children}
                        </Link>
                      )}
                    </span>
                  ) : null
                },

                emoji({ children }) {
                  return <Emoji>{children}</Emoji>
                },

                table({ children }) {
                  return (
                    <div className="p-5 rounded-2xl auto-bg-gray-100 overflow-auto">
                      <table className="w-full !m-0"> {children}</table>
                    </div>
                  )
                },
              }
            }, [])}
            codeRenderers={useMemo(() => {
              return {
                mermaid({ children }) {
                  return (
                    <div className="p-2 auto-bg-gray-100 rounded-2xl">
                      <Diagram.Memo init={diagramInit} source={children} />
                    </div>
                  )
                },

                references({ children }) {
                  const items = tryParseYaml(children) || []

                  if (Array.isArray(items) && items.length) {
                    return (
                      <ReferencesBlock.Memo
                        messageId={messageId}
                        references={items}
                      />
                    )
                  } else {
                    return null
                  }
                },

                clips({}) {
                  return (
                    <div className="text-xs">Content clips provided...</div>
                  ) // @todo add specific clip renderer within text message here
                },

                audio({ children }) {
                  const { src } = tryParseYaml(children) || {}

                  if (src) {
                    return (
                      <AudioPlayer.Memo
                        className="max-w-md p-5 rounded-2xl auto-bg-gray-100"
                        src={src}
                      />
                    )
                  } else {
                    return null
                  }
                },

                file({ children, language }) {
                  // @note split on the first `:` only so paths that themselves
                  // contain a colon survive intact
                  const [, path = ''] = language.split(/:(.*)/s)

                  return (
                    <FileBlock.Memo messageId={messageId} path={path}>
                      {children}
                    </FileBlock.Memo>
                  )
                },
              }
            }, [messageId])}
          >
            {`${text ? `${text}` : ''}${
              working
                ? ' ' +
                  (text
                    ? `${
                        text.endsWith('```') ? '\n\n' : ' '
                      }[${DOT}](#writing-dot)`
                    : `[${DOT}](#loading-dot)`)
                : ''
            }`}
          </Component>
        </div>
      </div>
      {forceReferences ? (
        <ChatReferences.Memo messageId={messageId} text={text} />
      ) : null}
      {showTools ? (
        <ChatTools.Memo
          conversationId={conversationId}
          messageId={messageId}
          text={text}
          collectFeedbackReason={collectFeedbackReason}
          actions={actions}
          createdAt={createdAt}
        />
      ) : null}
      {children}
    </div>
  )
}

ChatMessage.Memo = memo(ChatMessage)

export function PendingMessages({ pending, onCancel }) {
  // @note queued follow-up messages waiting for the current reply to finish.
  // Rendered as muted, dashed user bubbles so it is clear they are not sent
  // yet but will be dispatched automatically once the stream completes.

  return (pending || []).map((item) => (
    <div key={item.id} className="flex flex-row justify-end">
      <div
        className={clsx(
          'group relative',
          'flex items-center gap-2',
          'max-w-lg',
          'rounded-2xl px-4 py-2',
          'border border-dashed auto-border-gray-300',
          'bg-gray-100/60 dark:bg-gray-900/40'
        )}
        title="Queued - sends when the current reply finishes"
      >
        <LuClock className="size-3.5 shrink-0 auto-text-gray-400" />
        <div className="whitespace-pre-wrap text-sm auto-text-gray-500 line-clamp-3">
          {item.text}
        </div>
        <button
          type="button"
          onClick={() => onCancel?.(item.id)}
          className="shrink-0 rounded-full p-1 auto-text-gray-400 hover:auto-bg-gray-200 transition-colors duration-150"
          aria-label="Remove queued message"
        >
          <LuX className="size-3.5" />
        </button>
      </div>
    </div>
  ))
}

PendingMessages.Memo = memo(PendingMessages)

export function ChatMessages({
  messages,

  incoming,

  bots,

  conversationId,

  thinking,
  writing,

  forceReferences = false,
  collectFeedbackReason = false,

  showTools = true,

  className,

  children,

  ...props
}) {
  const nickToNameMap = useMemo(() => {
    return bots.reduce((acc, bot) => {
      acc[bot.nick] = bot.name

      return acc
    }, {})
  }, [bots])

  const hasIncoming = useMemo(() => {
    return !!incoming
  }, [incoming])

  useEffect(() => {
    if (!hasIncoming) {
      return
    }

    const appContent = document.querySelector('#app-content')

    if (appContent) {
      appContent.scrollTo({
        top: appContent.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [hasIncoming])

  let lastIndex

  return (
    <div
      {...props}
      className={clsx('messages flex flex-col gap-10', className)}
    >
      {messages
        .filter(({ type }) => type !== 'reasoning')
        .filter(({ text }) => !!text)
        .map(
          (
            {
              id: messageId,

              text,
              type,

              from,

              reasoning,

              actions,

              attachments,

              createdAt,

              meta,
            },
            index,
            array
          ) => {
            lastIndex = index

            const isLastItem = index === array.length - 1

            return (
              <ChatMessage.Memo
                key={messageId || index}
                className={clsx({
                  // @note this helps with scrolling the current message to the
                  // top adding a gap - the value 320 is an arbitrary value that
                  // kind of

                  'min-h-[calc(100vh-320px)]': isLastItem && !incoming,
                })}
                bots={bots}
                conversationId={conversationId}
                messageId={messageId}
                reasoning={reasoning}
                text={text}
                type={type}
                createdAt={createdAt}
                from={
                  nickToNameMap[from] ||
                  from ||
                  meta?.bot?.name ||
                  meta?.bot?.nick ||
                  'Auto'
                }
                actions={actions}
                attachments={attachments}
                forceReferences={forceReferences && type === 'bot'}
                collectFeedbackReason={collectFeedbackReason && type === 'bot'}
                showTools={showTools && type === 'bot'}
              />
            )
          }
        )}
      {incoming ? (
        <ChatMessage.Memo
          key={lastIndex + 1}
          className={clsx(
            // @note this helps with scrolling the current message to the top
            // adding a gap - the value 320 is an arbitrary value that kind of
            // works for now

            'min-h-[calc(100vh-320px)]'
          )}
          bots={bots}
          conversationId={conversationId}
          messageId={incoming.id}
          reasoning={incoming.reasoning}
          text={incoming.text}
          type={incoming.type}
          from={nickToNameMap[incoming.from] || incoming.from}
          actions={incoming.actions}
          thinking={thinking}
          writing={writing}
        />
      ) : null}
      {children}
    </div>
  )
}

ChatMessages.Memo = memo(ChatMessages)

export default ChatMessages
