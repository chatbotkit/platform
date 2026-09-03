'use client'

import { memo, useMemo, useState } from 'react'
import {
  LuBookOpen,
  LuBot,
  LuBrainCircuit,
  LuChevronDown,
  LuCircleStop,
  LuFlag,
  LuTag,
  LuUser,
  LuWrench,
} from 'react-icons/lu'
import {
  MdAttachFile,
  MdCopyAll,
  MdDataObject,
  MdOutlineThumbDown,
  MdOutlineThumbUp,
} from 'react-icons/md'

import { defaultLanguageModel } from '@/config/models'

import {
  getActivityArguments,
  getActivityArgumentsAndResult,
  getActivityResult,
  groupActivityMessages,
} from '@/lib/activity'
import { saveUrl } from '@/lib/save'
import toast from '@/lib/toast'

import AutoTextarea from '@/components/AutoTextarea'
import BackstoryInput from '@/components/BackstoryInput'
import BotSelect from '@/components/BotSelect'
import ChatInput from '@/components/ChatInput'
import CodeAction from '@/components/CodeAction'
import CopyButton from '@/components/CopyButton'
import DatasetSelect from '@/components/DatasetSelect'
import Expando from '@/components/Expando'
import LanguageModelSelect from '@/components/LanguageModelSelect'
import Link from '@/components/Link'
import ObjectView from '@/components/ObjectView'
import Safedown from '@/components/Safedown'
import SkillsetSelect from '@/components/SkillsetSelect'
import TimeAgo from '@/components/TimeAgo'
import TokenAutoTextarea from '@/components/TokenAutoTextarea'

import { useAvailableDefaultModel } from '@/hooks/useAvailableModels'
import useConversationManager from '@/hooks/useConversationManager'
import usePopup from '@/hooks/usePopup'
import useTokenCount from '@/hooks/useTokenCount'

import clsx from 'clsx'
import pluralize from 'pluralize'

/**
 * @param {{
 *   meta?: Partial<import('@/lib/meta').DatasetMeta>
 * }} params
 */
export function DatasetActionInfo({ meta }) {
  if (!meta?.dataset?.action?.input) {
    return null
  }

  return (
    <span className="space-x-2">
      <span className="font-semibold relative group/tooltip">
        <span className="tooltip -bottom-2 w-52">
          {meta.dataset.action.input}
        </span>
      </span>
      {meta?.dataset?.id ? (
        <Link
          className="default-link"
          href={`/datasets/${meta.dataset.id}`}
          target="_blank"
        >
          ↗
        </Link>
      ) : null}
    </span>
  )
}

/**
 * @param {{
 *   meta?: Partial<import('@/lib/meta').DatasetMeta>
 * }} params
 */
export function SkillsetActionInfo({ meta }) {
  const label =
    meta?.skillset?.action?.justification || meta?.skillset?.action?.name

  if (!label) {
    return null
  }

  return (
    <span className="space-x-2">
      <span className="font-semibold relative group/tooltip">
        <span className="tooltip -bottom-2 w-52">{label}</span>
      </span>
      {meta?.skillset?.id ? (
        <Link
          className="default-link"
          href={`/skillsets/${meta.skillset.id}`}
          target="_blank"
        >
          ↗
        </Link>
      ) : null}
    </span>
  )
}

export function Actions({
  className,

  messageId,
  messageType,
  messageText,

  onRemove,
  onEdit,
}) {
  const [text, setText] = useState(messageText)

  const [editing, setEditing] = useState(false)

  function handleEditKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.keyCode === 13) {
      event.preventDefault()

      handleEditCommit()
    }
  }

  function handleEditCommit() {
    onEdit(messageId, text)
    setEditing(false)
  }

  function handleEditCancel() {
    setEditing(false)
  }

  if (onRemove || onEdit) {
    return (
      <div className={className}>
        <div className="space-y-2">
          <div className="space-x-2">
            {onRemove ? (
              <button
                className="text-sm danger-link"
                type="button"
                onClick={() => onRemove(messageId)}
              >
                Delete
              </button>
            ) : null}
            {onEdit ? (
              !editing ? (
                <button
                  className="text-sm default-link"
                  type="button"
                  onClick={() => setEditing(true)}
                >
                  Edit
                </button>
              ) : (
                <span className="text-sm">Editing...</span>
              )
            ) : null}
          </div>
          {editing ? (
            <div className="space-y-2">
              {messageType === 'backstory' ? (
                <BackstoryInput
                  className="default-input max-h-96 !overflow-auto"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={handleEditKeyDown}
                />
              ) : (
                <TokenAutoTextarea
                  className="default-input max-h-96 !overflow-auto"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={handleEditKeyDown}
                />
              )}
              <div className="flex flex-row gap-2">
                <button
                  className="primary-button"
                  type="button"
                  onClick={handleEditCommit}
                >
                  Commit
                </button>
                <button
                  className="default-button"
                  type="button"
                  onClick={handleEditCancel}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    )
  } else {
    return null
  }
}

Actions.Memo = memo(Actions)

export function Activity({ conversationId, activity }) {
  const object = useMemo(() => {
    const act = activity || {}

    let type

    if (typeof act === 'object' && act !== null && 'type' in act) {
      type = act.type
    } else {
      type = 'unknown'
    }

    if (type === 'request') {
      return getActivityArguments(act) || {}
    }

    if (type === 'response') {
      return getActivityResult(act) || {}
    }

    return getActivityArgumentsAndResult(act) || {}
  }, [activity])

  return (
    <ObjectView className="text-xs max-h-96" object={object}>
      {activity?.function?.name === 'uploadAttachment' &&
      activity?.function?.result?.name ? (
        <MdAttachFile
          className="cursor-pointer text-gray-300 hover:text-gray-500 dark:text-gray-700 dark:hover:text-gray-500 w-4 h-4 transition-all"
          onClick={() => {
            saveUrl(
              `/api/v1/conversation/${conversationId}/attachment/${activity.function.result.name}/download`,
              {
                name: activity.function.result.name,
              }
            )
          }}
        />
      ) : null}
    </ObjectView>
  )
}

Activity.Memo = memo(Activity)

export function Text({ className, ...props }) {
  return (
    <Safedown
      {...props}
      className={clsx(
        'text',

        'prose dark:prose-invert prose-sm prose-img:rounded-xl',

        // preserve white-spacing but negate the effect of prose
        // @note this is currently disabled because it does not work well,
        // besides the content is expected to be markdown in most cases
        /*
        ...[
          'whitespace-pre-wrap',

          '[&>*]:mt-0 [&>*]:mb-0',
          '[&_ul]:mt-0 [&_ul]:mb-0 [&_ul]:pt-0 [&_ul]:pb-0',
          '[&_ol]:mt-0 [&_ol]:mb-0 [&_ul]:pt-0 [&_ol]:pb-0',
          '[&_li]:mt-0 [&_li]:mb-0 [&_li]:pt-0 [&_li]:pb-0',
        ],
        */

        // format some elements to look like markdown
        ...[
          `[&_h1]:before:content-['#_'] [&_h1]:text-base`,
          `[&_h2]:before:content-['##_'] [&_h2]:text-base`,
          `[&_h3]:before:content-['###_'] [&_h3]:text-base`,
          `[&_h4]:before:content-['####_'] [&_h4]:text-base`,
          `[&_h5]:before:content-['#####_'] [&_h5]:text-base`,
          `[&_h6]:before:content-['######_'] [&_h6]:text-base`,
        ],

        // fix code blocks
        ...[
          '[.codeblock]:p-0',
          '[.codeblock]:text-sm',
          '[.codeblock]:max-h-96 [.codeblock]:!overflow-auto',
        ],

        className
      )}
    />
  )
}

Text.Memo = memo(Text)

export function Arrow({ collapsed, className, ...props }) {
  return (
    <LuChevronDown
      {...props}
      className={clsx(
        'inline-block align-middle h-[1em] w-[1em]',
        'transition-transform duration-300',
        { '-rotate-90': collapsed },
        className
      )}
    />
  )
}

Arrow.Memo = memo(Arrow)

/**
 *
 */
export function Tools({
  conversationId,
  messageId,

  text,
  meta,

  upvoteHandler,
  downvoteHandler,

  ...props
}) {
  const { popup, openPopup } = usePopup()

  const hasText = text?.length
  const hasMeta = meta && Object.keys(meta).length > 0

  const tokens = useTokenCount(text)

  return (
    <>
      {popup}
      {hasText || hasMeta ? (
        <div {...props}>
          <div className="flex flex-row gap-2">
            {hasText ? (
              <CopyButton
                className="cursor-pointer"
                text={text}
                message="Message text copied to clipboard"
              >
                <MdCopyAll />
              </CopyButton>
            ) : null}
            {hasMeta ? (
              <button
                type="button"
                onClick={() => {
                  openPopup(<ObjectView className="text-xs" object={meta} />, {
                    title: 'Meta Data',
                    cancelButtonCaption: 'Close',
                  })
                }}
              >
                <MdDataObject />
              </button>
            ) : null}
            {upvoteHandler ? (
              <button
                type="button"
                onClick={async () => {
                  openPopup(<></>, {
                    title: 'Upvote',
                    description: 'Do you really want to upvote this message?',

                    actions: {
                      Upvote: {
                        fn: async ({}, { close }) => {
                          toast.loading('Upvoting...')

                          await upvoteHandler({ conversationId, messageId })

                          toast.success('Message upvoted')

                          close()
                        },
                      },
                    },
                  })

                  await upvoteHandler({ conversationId, messageId })
                }}
              >
                <MdOutlineThumbUp />
              </button>
            ) : null}
            {downvoteHandler ? (
              <button
                type="button"
                onClick={() => {
                  openPopup(
                    <AutoTextarea
                      className="default-input max-h-96"
                      name="reason"
                    />,
                    {
                      title: 'Downvote',
                      description:
                        'You can optionally provide a reason for the downvote.',

                      actions: {
                        Downvote: {
                          fn: async ({ reason }, { close }) => {
                            toast.loading('Downvoting...')

                            await downvoteHandler({
                              conversationId,
                              messageId,
                              reason,
                            })

                            toast.success('Message downvoted')

                            close()
                          },
                        },
                      },
                    }
                  )
                }}
              >
                <MdOutlineThumbDown />
              </button>
            ) : null}
            {tokens > 0 ? (
              <div className="ml-2 text-xs auto-text-gray-500 cursor-default">
                ~{tokens} {pluralize('token', tokens)}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}

Tools.Memo = memo(Tools)

export function Message({
  className,

  conversationId,

  message,

  onRemove,
  onEdit,

  thinking,
  writing,

  isLast,

  upvoteHandler,
  downvoteHandler,

  codeRenderers,

  props,
}) {
  const { id, type, text, createdAt, meta, actions } = message

  const latestAction = useMemo(() => {
    return Array.isArray(actions) && actions.length
      ? actions[actions.length - 1]
      : null
  }, [actions])

  const latestActionText = useMemo(() => {
    if (!latestAction) {
      return ''
    }

    let resolvedText =
      latestAction.justification ||
      latestAction.input ||
      latestAction.name ||
      ''

    if (typeof resolvedText !== 'string') {
      resolvedText = JSON.stringify(resolvedText)
    }

    if (!latestAction.justification && resolvedText.startsWith('{')) {
      resolvedText = latestAction.name || resolvedText
    }

    return resolvedText
  }, [latestAction])

  const [collapsed, setCollapsed] = useState(
    type === 'activity' || type === 'reasoning'
  )

  return (
    <li
      {...props}
      className={clsx(className, 'message', type)}
      id={`message-${id}`}
    >
      <div className="relative pb-8">
        {!isLast ? (
          <span
            className="absolute top-4 left-4 h-full w-px bg-gray-100 dark:bg-gray-900"
            aria-hidden="true"
          />
        ) : null}
        <div className="relative flex items-start gap-3">
          {['user', 'bot'].includes(type) ? (
            <>
              <div className="relative">
                {type === 'user' ? (
                  <div className="flex h-8 w-8 cursor-default select-none items-center justify-center rounded-full border border-gray-200 bg-white ring-4 ring-white dark:border-gray-800 dark:bg-gray-950 dark:ring-gray-950">
                    <LuUser
                      className="h-3.5 w-3.5 text-gray-500 dark:text-gray-500"
                      aria-hidden="true"
                    />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 cursor-default select-none items-center justify-center rounded-full border border-gray-200 bg-white ring-4 ring-white dark:border-gray-800 dark:bg-gray-950 dark:ring-gray-950">
                    <LuBot
                      className="h-3.5 w-3.5 text-gray-500 dark:text-gray-500"
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div
                  className="cursor-pointer"
                  onClick={() =>
                    setCollapsed((prevCollapsed) => !prevCollapsed)
                  }
                >
                  <div className="mt-0.5 text-sm text-gray-500 dark:text-gray-500 flex flex-row items-center gap-2">
                    <Arrow.Memo collapsed={collapsed} />
                    <span>
                      Commented{' '}
                      <TimeAgo
                        className="flex-shrink-0 whitespace-nowrap text-sm text-gray-500 dark:text-gray-500"
                        time={createdAt}
                      />
                    </span>
                  </div>
                </div>
                <div
                  className={clsx(
                    'space-y-2 text-sm text-gray-700 dark:text-gray-300 group',
                    'transition-all duration-300',
                    '[interpolate-size:allow-keywords]',
                    'h-auto overflow-hidden',
                    {
                      '!h-[0px]': collapsed,
                    }
                  )}
                >
                  {type === 'user' ? (
                    <Text.Memo codeRenderers={codeRenderers}>{text}</Text.Memo>
                  ) : (
                    <>
                      {latestActionText ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-500">
                          <LuWrench className="h-3.5 w-3.5 flex-shrink-0" />
                          <p
                            className={clsx(
                              'm-0 max-w-full overflow-hidden whitespace-nowrap text-ellipsis',
                              {
                                'shimmer-subtle':
                                  latestAction?.working && !text?.trim?.(),
                              }
                            )}
                          >
                            {latestActionText}
                          </p>
                        </div>
                      ) : null}
                      <Text.Memo
                        conversationId={conversationId}
                        messageId={id}
                        interactive={true}
                        codeRenderers={codeRenderers}
                      >
                        {text}
                      </Text.Memo>
                    </>
                  )}
                  <Tools.Memo
                    className="text-sm opacity-0 group-hover:opacity-100 transition-all"
                    conversationId={conversationId}
                    messageId={id}
                    text={text}
                    meta={meta}
                    upvoteHandler={upvoteHandler}
                    downvoteHandler={downvoteHandler}
                  />
                </div>
                <Actions.Memo
                  messageId={id}
                  messageType={type}
                  messageText={text}
                  onRemove={onRemove}
                  onEdit={onEdit}
                />
              </div>
            </>
          ) : ['backstory', 'checkpoint'].includes(type) ? (
            <>
              <div>
                <div className="relative">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white ring-4 ring-white dark:border-gray-800 dark:bg-gray-950 dark:ring-gray-950">
                    {type === 'backstory' ? (
                      <LuBookOpen
                        className="h-3.5 w-3.5 text-gray-500 dark:text-gray-500"
                        aria-hidden="true"
                      />
                    ) : (
                      <LuTag
                        className="h-3.5 w-3.5 text-gray-500 dark:text-gray-500"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div
                  className="cursor-pointer"
                  onClick={() =>
                    setCollapsed((prevCollapsed) => !prevCollapsed)
                  }
                >
                  <div className="mt-0.5 text-sm text-gray-500 dark:text-gray-500 flex flex-row items-center gap-2">
                    <Arrow.Memo collapsed={collapsed} />
                    <span>
                      {type === 'backstory' ? 'Created' : 'Checkpointed'}{' '}
                      <TimeAgo
                        className="flex-shrink-0 whitespace-nowrap text-sm text-gray-500 dark:text-gray-500"
                        time={createdAt}
                      />
                    </span>
                  </div>
                </div>
                <div
                  className={clsx(
                    'space-y-2 text-sm text-gray-700 dark:text-gray-300 group',
                    'transition-all duration-300',
                    '[interpolate-size:allow-keywords]',
                    'h-auto overflow-hidden',
                    {
                      '!h-[0px]': collapsed,
                    }
                  )}
                >
                  <Text.Memo>{text}</Text.Memo>
                  <Tools.Memo
                    className="text-sm opacity-0 group-hover:opacity-100 transition-all"
                    text={text}
                    meta={meta}
                  />
                </div>
                <Actions.Memo
                  messageId={id}
                  messageType={type}
                  messageText={text}
                  onRemove={onRemove}
                  onEdit={onEdit}
                />
              </div>
            </>
          ) : ['reasoning'].includes(type) ? (
            <>
              <div className="relative">
                <div className="flex h-8 w-8 cursor-default select-none items-center justify-center rounded-full border border-gray-200 bg-white ring-4 ring-white dark:border-gray-800 dark:bg-gray-950 dark:ring-gray-950">
                  <LuBrainCircuit
                    className="h-3.5 w-3.5 text-gray-500 dark:text-gray-500"
                    aria-hidden="true"
                  />
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div
                  className="cursor-pointer"
                  onClick={() =>
                    setCollapsed((prevCollapsed) => !prevCollapsed)
                  }
                >
                  <div className="mt-0.5 text-sm text-gray-500 dark:text-gray-500 flex flex-row items-center gap-2">
                    <Arrow.Memo collapsed={collapsed} />
                    <span>
                      Created{' '}
                      <TimeAgo
                        className="flex-shrink-0 whitespace-nowrap text-sm text-gray-500 dark:text-gray-500"
                        time={createdAt}
                      />
                    </span>
                  </div>
                </div>
                <div
                  className={clsx(
                    'space-y-2 text-sm text-gray-700 dark:text-gray-300 group',
                    'transition-all duration-300',
                    '[interpolate-size:allow-keywords]',
                    'h-auto overflow-hidden',
                    {
                      '!h-[0px]': collapsed,
                    }
                  )}
                >
                  <Text.Memo>{text}</Text.Memo>
                  <Tools.Memo
                    className="text-sm opacity-0 group-hover:opacity-100 transition-all"
                    text={text}
                    meta={meta}
                  />
                </div>
                <Actions.Memo
                  messageId={id}
                  messageType={type}
                  messageText={text}
                  onRemove={onRemove}
                  onEdit={onEdit}
                />
              </div>
            </>
          ) : ['context'].includes(type) ? (
            <>
              <div>
                <div className="relative">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white ring-4 ring-white dark:border-gray-800 dark:bg-gray-950 dark:ring-gray-950">
                    <LuTag
                      className="h-3.5 w-3.5 text-gray-500 dark:text-gray-500"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div
                  className="cursor-pointer"
                  onClick={() =>
                    setCollapsed((prevCollapsed) => !prevCollapsed)
                  }
                >
                  <div className="mt-0.5 text-sm text-gray-500 dark:text-gray-500 flex flex-row items-center gap-2">
                    <Arrow.Memo collapsed={collapsed} />
                    <span>
                      Created{' '}
                      <TimeAgo
                        className="flex-shrink-0 whitespace-nowrap text-sm text-gray-500 dark:text-gray-500"
                        time={createdAt}
                      />
                    </span>
                    <DatasetActionInfo meta={meta} />
                    <SkillsetActionInfo meta={meta} />
                  </div>
                </div>
                <div
                  className={clsx(
                    'space-y-2 text-sm text-gray-700 dark:text-gray-300 group',
                    'transition-all duration-300',
                    '[interpolate-size:allow-keywords]',
                    'h-auto overflow-hidden',
                    {
                      '!h-[0px]': collapsed,
                    }
                  )}
                >
                  <Text.Memo>{text}</Text.Memo>
                  <Tools.Memo
                    className="text-sm opacity-0 group-hover:opacity-100 transition-all"
                    text={text}
                    meta={meta}
                  />
                </div>
                <Actions.Memo
                  messageId={id}
                  messageType={type}
                  messageText={text}
                  onRemove={onRemove}
                  onEdit={onEdit}
                />
              </div>
            </>
          ) : ['instruction'].includes(type) ? (
            <>
              <div>
                <div className="relative">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white ring-4 ring-white dark:border-gray-800 dark:bg-gray-950 dark:ring-gray-950">
                    <LuFlag
                      className="h-3.5 w-3.5 text-gray-500 dark:text-gray-500"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div
                  className="cursor-pointer"
                  onClick={() =>
                    setCollapsed((prevCollapsed) => !prevCollapsed)
                  }
                >
                  <div className="mt-0.5 text-sm text-gray-500 dark:text-gray-500 flex flex-row items-center gap-2">
                    <Arrow.Memo collapsed={collapsed} />
                    <span>
                      Created{' '}
                      <TimeAgo
                        className="flex-shrink-0 whitespace-nowrap text-sm text-gray-500 dark:text-gray-500"
                        time={createdAt}
                      />
                    </span>
                  </div>
                </div>
                <div
                  className={clsx(
                    'space-y-2 text-sm text-gray-700 dark:text-gray-300 group',
                    'transition-all duration-300',
                    '[interpolate-size:allow-keywords]',
                    'h-auto overflow-hidden',
                    {
                      '!h-[0px]': collapsed,
                    }
                  )}
                >
                  <Text.Memo>{text}</Text.Memo>
                  <Tools.Memo
                    className="text-sm opacity-0 group-hover:opacity-100 transition-all"
                    text={text}
                    meta={meta}
                  />
                </div>
                <Actions.Memo
                  messageId={id}
                  messageType={type}
                  messageText={text}
                  onRemove={onRemove}
                  onEdit={onEdit}
                />
              </div>
            </>
          ) : ['activity'].includes(type) ? (
            <>
              <div>
                <div className="relative">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white ring-4 ring-white dark:border-gray-800 dark:bg-gray-950 dark:ring-gray-950">
                    <LuWrench
                      className="h-3.5 w-3.5 text-gray-500 dark:text-gray-500"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div
                  className="cursor-pointer"
                  onClick={() =>
                    setCollapsed((prevCollapsed) => !prevCollapsed)
                  }
                >
                  <div className="mt-0.5 text-sm text-gray-500 dark:text-gray-500 flex flex-row items-center gap-2">
                    <Arrow.Memo collapsed={collapsed} />
                    <span>
                      Created{' '}
                      <TimeAgo
                        className="flex-shrink-0 whitespace-nowrap text-sm text-gray-500 dark:text-gray-500"
                        time={createdAt}
                      />
                    </span>
                    <span>
                      activity{' '}
                      <span className="font-bold">
                        {meta?.activity?.type === 'request-response'
                          ? 'call'
                          : meta?.activity?.type || '?'}
                      </span>{' '}
                      <span className="tag text-xs [line-height:1em] cursor-pointer">
                        {meta?.activity?.function?.name || '?'}
                      </span>
                    </span>
                    <DatasetActionInfo meta={meta} />
                    <SkillsetActionInfo meta={meta} />
                  </div>
                </div>
                <div
                  className={clsx(
                    'space-y-2 text-sm text-gray-700 dark:text-gray-300 group',
                    'transition-all duration-300',
                    '[interpolate-size:allow-keywords]',
                    'h-auto overflow-hidden',
                    {
                      '!h-[0px]': collapsed,
                    }
                  )}
                >
                  <Activity.Memo
                    conversationId={conversationId}
                    activity={meta?.activity}
                  />
                </div>
              </div>
            </>
          ) : ['end'].includes(type) ? (
            <>
              <div>
                <div className="relative">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white ring-4 ring-white dark:border-gray-800 dark:bg-gray-950 dark:ring-gray-950">
                    <LuCircleStop
                      className={clsx(
                        'h-3.5 w-3.5 text-gray-500 dark:text-gray-500',
                        { 'animate-ping': thinking || writing }
                      )}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </li>
  )
}

Message.Memo = memo(Message)

export function Messages({
  conversationId,

  datasetId,
  skillsetId,

  messages: _messages,

  onRemove,
  onEdit,

  thinking,
  writing,

  upvoteHandler,
  downvoteHandler,

  codeRenderers,

  groupActivities = true,

  ...props
}) {
  const messages = useMemo(() => {
    const processed = groupActivities
      ? groupActivityMessages(_messages)
      : _messages

    return [].concat(processed, [{ type: 'end' }])
  }, [_messages, groupActivities])

  return (
    <div {...props} className="flow-root">
      <ul role="list" className="-mb-8">
        {messages.map((message, index) => {
          const isLast = index === messages.length - 1

          return (
            <Message.Memo
              key={message.id || index}
              conversationId={conversationId}
              datasetId={datasetId}
              skillsetId={skillsetId}
              message={message}
              onRemove={onRemove}
              onEdit={onEdit}
              thinking={thinking}
              writing={writing}
              isLast={isLast}
              upvoteHandler={upvoteHandler}
              downvoteHandler={downvoteHandler}
              codeRenderers={codeRenderers}
            />
          )
        })}
      </ul>
    </div>
  )
}

Messages.Memo = memo(Messages)

export default function Conversation({
  className,

  botId: _botId,

  backstory: _backstory,

  model: _model,

  datasetId: _datasetId,
  skillsetId: _skillsetId,

  token,

  conversationId: _conversationId,

  messages: _messages,

  functional = true,

  autoClear,
  autoStart,
  autoAddBackstory,

  privacy,
  moderation,

  stream,

  verbose,

  conversationCreateEndpoint,
  conversationInitiateEndpoint,
  conversationSendEndpoint,
  conversationReceiveEndpoint,
  conversationCompleteEndpoint,
  conversationAttachmentUploadEndpoint,

  urlUnfurlEndpoint,

  loadingMessage: _loadingMessage = true,
  failureMessage: _failureMessage = true,
  successMessage: _successMessage = false,
  streamingMessage: _streamingMessage = stream,

  upvoteHandler,
  downvoteHandler,

  onStart,

  bots,

  datasets,
  skillsets,

  advancedOptions = true,

  chatPlaceholder = 'Ask me anything...',

  startPlaceholder = 'What would you like to know?',

  backstoryPlaceholder = "Describe your bot's role and personality to begin.",

  paralyzed,

  disabled,

  codeRenderers,
}) {
  const {
    conversationId,

    messages,

    interact,
    abort,

    backstory,
    setBackstory,

    model,
    setModel,

    text,
    setText,

    thinking,
    writing,

    botId,
    setBotId,

    datasetId,
    setDatasetId,

    skillsetId,
    setSkillsetId,

    code,
  } = useConversationManager({
    botId: _botId,

    model: _model,

    backstory: _backstory,

    datasetId: _datasetId,
    skillsetId: _skillsetId,

    token,

    conversationId: _conversationId,

    messages: _messages,

    autoClear,
    autoStart,
    autoAddBackstory,

    privacy,
    moderation,

    stream,
    verbose,

    conversationCreateEndpoint,
    conversationInitiateEndpoint,
    conversationSendEndpoint,
    conversationReceiveEndpoint,
    conversationCompleteEndpoint,
    conversationAttachmentUploadEndpoint,

    urlUnfurlEndpoint,

    loadingMessage: _loadingMessage,
    failureMessage: _failureMessage,
    successMessage: _successMessage,
    streamingMessage: _streamingMessage,

    onStart,

    app: 'console',
  })

  const availableDefaultModel = useAvailableDefaultModel('language')

  function handleOnSend(event) {
    event.preventDefault()

    if (paralyzed) {
      return
    }

    if (thinking || writing) {
      return
    }

    interact()
  }

  function handleOnStop(event) {
    event.preventDefault()

    if (paralyzed) {
      return
    }

    abort()
  }

  return (
    <div className={clsx('conversation', className)}>
      <CodeAction key={code} code={code} />
      <div className="space-y-4">
        {messages.length ? (
          <Messages.Memo
            conversationId={conversationId}
            datasetId={datasetId}
            skillsetId={skillsetId}
            messages={messages}
            thinking={thinking}
            writing={writing}
            upvoteHandler={upvoteHandler}
            downvoteHandler={downvoteHandler}
            codeRenderers={codeRenderers}
          />
        ) : null}
        {autoStart ? (
          <>
            {functional ? (
              <div>
                <ChatInput
                  className="default-input max-h-96 !overflow-auto"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onSend={handleOnSend}
                  placeholder={
                    conversationId ? chatPlaceholder : startPlaceholder
                  }
                  disabled={disabled}
                >
                  {(thinking || writing) && !disabled && !paralyzed ? (
                    <div className="flex justify-center">
                      <button
                        className="default-button small"
                        type="button"
                        onClick={handleOnStop}
                      >
                        Stop
                      </button>
                    </div>
                  ) : null}
                </ChatInput>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="space-y-6">
              {!conversationId && !messages.length ? (
                <>
                  {/* backstory */}
                  <div className="sm:col-span-6">
                    <label
                      className="default-label dark:text-gray-300"
                      htmlFor="backstory"
                    >
                      Backstory
                    </label>
                    <div className="mt-1">
                      <ChatInput
                        className="default-input"
                        name="backstory"
                        value={backstory}
                        onChange={(event) => setBackstory(event.target.value)}
                        onSend={handleOnSend}
                        placeholder={
                          botId
                            ? 'Ready to start conversation?'
                            : backstoryPlaceholder
                        }
                        disabled={disabled}
                        inputDisabled={!!botId}
                        sendCaption={botId ? 'Start Conversation' : undefined}
                      />
                    </div>
                  </div>
                  {/* Advanced Options */}
                  {advancedOptions ? (
                    <Expando
                      titleClassName="default-link text-sm"
                      title="Advanced Options"
                    >
                      {bots?.length ? (
                        <>
                          {/* bots */}
                          <div>
                            <label
                              className="default-label dark:text-gray-300"
                              htmlFor="botId"
                            >
                              Bot
                            </label>
                            <div className="mt-1">
                              <BotSelect
                                className="block w-full max-w-sm default-input"
                                name="botId"
                                value={botId}
                                onChange={(event) =>
                                  setBotId(event.target.value)
                                }
                                bots={bots}
                                disabled={disabled}
                              />
                            </div>
                            <p className="input-description dark:text-gray-500">
                              Optional bot for this interaction.
                            </p>
                          </div>
                        </>
                      ) : null}
                      {!botId && datasets?.length ? (
                        <>
                          {/* datasets */}
                          <div>
                            <label
                              className="default-label dark:text-gray-300"
                              htmlFor="datasetId"
                            >
                              Dataset
                            </label>
                            <div className="mt-1">
                              <DatasetSelect
                                className="block w-full max-w-sm default-input"
                                name="datasetId"
                                value={datasetId}
                                onChange={(event) =>
                                  setDatasetId(event.target.value)
                                }
                                datasets={datasets}
                                disabled={disabled}
                              />
                            </div>
                            <p className="input-description dark:text-gray-500">
                              Optional dataset for this interaction.
                            </p>
                          </div>
                        </>
                      ) : null}
                      {!botId && skillsets?.length ? (
                        <>
                          {/* skillsets */}
                          <div>
                            <label
                              className="default-label dark:text-gray-300"
                              htmlFor="skillsetId"
                            >
                              Skillset
                            </label>
                            <div className="mt-1">
                              <SkillsetSelect
                                className="block w-full max-w-sm default-input"
                                name="skillsetId"
                                value={skillsetId}
                                onChange={(event) =>
                                  setSkillsetId(event.target.value)
                                }
                                skillsets={skillsets}
                                disabled={disabled}
                              />
                            </div>
                            <p className="input-description dark:text-gray-500">
                              Optional skillset for this interaction.
                            </p>
                          </div>
                        </>
                      ) : null}
                      {!botId ? (
                        <>
                          {/* model */}
                          <div>
                            <label
                              className="default-label dark:text-gray-300"
                              htmlFor="model"
                            >
                              Model
                            </label>
                            <div className="mt-1">
                              <LanguageModelSelect
                                className="block w-full max-w-sm default-input"
                                name="model"
                                value={model}
                                setValue={setModel}
                                disabled={disabled}
                              />
                            </div>
                            <p className="input-description dark:text-gray-500">
                              Optional model name for this interaction. The
                              default is{' '}
                              <strong>
                                {availableDefaultModel || defaultLanguageModel}
                              </strong>
                              .
                            </p>
                          </div>
                        </>
                      ) : null}
                    </Expando>
                  ) : null}
                </>
              ) : (
                <>
                  {functional ? (
                    <ChatInput
                      className="default-input"
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      onSend={handleOnSend}
                      placeholder={chatPlaceholder}
                      disabled={disabled}
                    />
                  ) : null}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

Conversation.Memo = memo(Conversation)
