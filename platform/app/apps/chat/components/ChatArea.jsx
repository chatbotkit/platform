'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LuArrowUp as ArrowUpIcon,
  LuPlus as AttachIcon,
  LuArrowDown as DownIcon,
  LuAtom,
  LuBox,
  LuChevronDown,
  LuCombine,
  LuCpu,
  LuHighlighter,
  LuX,
  LuZap,
} from 'react-icons/lu'

import AttachmentsArea from '@/components/AttachmentsArea'
import { useConfirmYesNo } from '@/components/Confirm'
import DynamicIcon from '@/components/DynamicIcon'
import MenuButton from '@/components/MenuButton'
import Spinner from '@/components/Spinner'
import TooltipButton from '@/components/TooltipButton'

import useDOMQuerySelector from '@/hooks/useDOMQuerySelector'
import useIsContainerScrolled from '@/hooks/useIsContainerScrolled'
import useScopedQuerySessionOption from '@/hooks/useScopedQuerySessionOption'

import { useChatExtraFeatures } from './ChatExtraFeaturesContext'
import {
  BotMentionHandler,
  CommandMentionHandler,
  ModelMentionHandler,
  SourceMentionHandler,
} from './Selector'

import { Extension } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

import clsx from 'clsx'

export function ScrollButton({ className, ...props }) {
  return (
    <div
      {...props}
      className={clsx(
        'size-9 p-2 rounded-full',
        'auto-bg-gray-900/60 backdrop-blur',
        'cursor-pointer',
        'border auto-border-gray-200',
        'flex items-center justify-center',
        className
      )}
    >
      <DownIcon className="size-4 text-current" />
    </div>
  )
}

ScrollButton.Memo = memo(ScrollButton)

export function ClipsArea({ clips, setClips }) {
  return clips?.length ? (
    <div className="flex flex-row flex-wrap gap-2">
      {clips.map((clip, index) => {
        return (
          <div
            key={index}
            className="cursor-default text-xs clip flex flex-row items-center gap-2 p-2 py-1.5 bg-gray-50 dark:bg-gray-950 border  auto-border-gray-200 rounded-lg max-w-36 border-dashed shadow-md shadow-gray-200 dark:shadow-gray-900"
          >
            <LuHighlighter className="size-4" />
            <div className="w-full truncate">{clip.comment}</div>
            <button
              type="button"
              onClick={() => {
                setClips(clips.filter((_, i) => i !== index))
              }}
            >
              <LuX className="text-indigo-500" />
            </button>
          </div>
        )
      })}
    </div>
  ) : null
}

ClipsArea.Memo = memo(ClipsArea)

export function ChatInput({
  editorRef,

  bots,
  models,
  sources,

  onSubmit,

  handleLargeTextPaste,

  autoFocus,

  onContentChange,

  className,

  ...props
}) {
  const ref = useRef({ bots, models, sources, onSubmit })

  useEffect(() => {
    ref.current.onSubmit = onSubmit
  }, [onSubmit])

  useEffect(() => {
    ref.current.bots = bots
  }, [bots])

  useEffect(() => {
    ref.current.models = models
  }, [models])

  useEffect(() => {
    ref.current.sources = sources
  }, [sources])

  const confirmYesNo = useConfirmYesNo()

  const editor = useEditor(
    {
      ref,

      extensions: [
        StarterKit.configure({
          // @note see StarterKit type definition

          hardBreak: true, // @note enable hard breaks for shift+enter
          bold: false,
          blockquote: false,
          bulletList: false,
          code: false,
          codeBlock: false,
          heading: false,
          italic: false,
          listItem: false,
          orderedList: false,
          strike: false,
        }),

        Placeholder.configure({
          placeholder: (() => {
            const hasBots = bots.filter(({ auto }) => !auto).length > 0
            const hasModels = models.filter(({ auto }) => !auto).length > 0
            const hasSources = sources.filter(({ auto }) => !auto).length > 0

            if (hasBots && hasModels && hasSources) {
              return 'Use @ for agents, ^ for models, # for sources...'
            } else if (hasBots && hasModels) {
              return 'Use @ to reference an agent, ^ for models...'
            } else if (hasBots && hasSources) {
              return 'Use @ to reference an agent, # for sources...'
            } else if (hasModels && hasSources) {
              return 'Use ^ to reference a model, # for sources...'
            } else if (hasBots) {
              return 'Use @ to reference an agent by name...'
            } else if (hasModels) {
              return 'Use ^ to reference a model by name...'
            } else if (hasSources) {
              return 'Use # to reference a source by name...'
            } else {
              return 'Type your message...'
            }
          })(),
        }),

        Extension.create({
          onCreate({ editor }) {
            this.editor = editor
          },

          onUpdate({ editor }) {
            const text = editor.getText().trim()

            onContentChange?.(text)
          },

          addKeyboardShortcuts() {
            return {
              Enter: () => {
                ref.current.onSubmit?.(this.editor)

                return true
              },
              'Shift-Enter': () => {
                // @note allow new line when shift is pressed with enter

                return false // @note let the default behavior happen (insert hard break)
              },
              'Mod-Enter': () => {
                // @note allow new line when cmd/ctrl is pressed with enter

                return false // @note let the default behavior happen (insert hard break)
              },
            }
          },
        }),

        CommandMentionHandler,

        // @note always include mention handlers - they read from ref.current
        // which gets updated when bots/models/sources change

        BotMentionHandler,
        ModelMentionHandler,
        SourceMentionHandler,
      ],

      content: ``,

      immediatelyRender: false,

      autofocus: autoFocus,

      editorProps: {
        async handlePaste(view, event) {
          event.preventDefault()

          const text = event.clipboardData?.getData('text/plain')

          if (text) {
            if (text.length > 500 && handleLargeTextPaste) {
              if (
                await confirmYesNo(
                  'Do you want to paste this large text as a file?',
                  {
                    noButtonCaption: 'No',
                    yesButtonCaption: 'Upload as File Attachment',
                  }
                )
              ) {
                handleLargeTextPaste(text)

                return true
              }
            }

            const { state, dispatch } = view
            const { tr } = state

            dispatch(tr.insertText(text, tr.selection.from, tr.selection.to))
          }

          return true
        },
      },
    },
    []
  )

  editorRef.current = editor

  const onClick = useCallback(() => {
    editor.commands.focus()
  }, [editor])

  if (!editor) {
    return (
      <p className="animate-pulse auto-text-gray-500">
        Setting up environment...
      </p>
    )
  }

  return (
    <div {...props} className={clsx('chat-input', className)}>
      <EditorContent
        className={clsx(
          'max-h-96 overflow-auto',
          '[&>*]:!outline-none',
          'subtle-scrollbar'
        )}
        editor={editor}
        onClick={onClick}
      />
    </div>
  )
}

ChatInput.Memo = memo(ChatInput)

export function ChatArea({
  config: _config,

  editorRef,

  bots,
  models,
  sources,

  attachments,
  setAttachments,

  clips,
  setClips,

  hasMessages,

  handleOnSubmit,
  handleSubmit,

  handleAttachFile,

  handleLargeTextPaste,

  handleTakeScreenshot,

  handleSelectBotClick,
  handleDeselectBot,

  handleSelectModelClick,
  handleDeselectModel: _handleDeselectModel,

  handleSelectSourcesClick,
  handleDeselectSource,

  handleAbortStream,

  handleImprovePrompt,

  selectedBot,

  selectedModel,

  selectedSources,

  thinking,
  writing,

  improvingPrompt,

  features,

  // @note trace prop is no longer needed since trace is now available in SuperTools
  trace: _trace,

  className,

  innerClassName,

  ...props
}) {
  const botsAreLoading = bots.length === 0

  const { extraFeatures, toggleFeature } = useChatExtraFeatures()

  const isInDashboard = useScopedQuerySessionOption('_embed') === 'dashboard'

  // @note embedded surfaces (SuperTools, designer, external widget) expose only
  // the agent selector - model and source selection are hidden there. The chat
  // still runs with the auto model and no explicit sources. The one exception
  // is the dashboard agent console, which surfaces spaces so a conversation can
  // be scoped to a space and (with reprogramming) extend that space's skills.
  // The implicit auto source is kept so the selector threshold (> 1) still
  // works when at least one space exists.

  const isEmbedded = !!useScopedQuerySessionOption('_embed')

  const visibleModels = isEmbedded ? [] : models

  const visibleSources = isInDashboard
    ? sources.filter((source) => source.auto || source.type === 'space')
    : isEmbedded
      ? []
      : sources

  const [appContent] = useDOMQuerySelector('#app-content')

  // @note wrap the DOM element in a ref-like object for useIsContainerScrolled

  const appContentRef = useMemo(() => ({ current: appContent }), [appContent])

  const isScrolled = useIsContainerScrolled(appContentRef, {
    anchor: 'bottom',
    threshold: 200,
    interval: 2000,
    defaultValue: true,
  })

  const [hasContent, setHasContent] = useState(false)

  return (
    <div
      {...props}
      className={clsx(
        'chat-area',
        'sticky left-0 right-0 bottom-0',
        {
          'pb-2': hasMessages,

          // @note used to hide the the text as it scrolls behind the area

          'auto-bg-white': hasMessages,
        },
        className
      )}
    >
      <ScrollButton.Memo
        className={clsx(
          'absolute z-0',
          'top-2 left-1/2',
          'transform -translate-x-1/2 -translate-y-[0%]',
          'transition-transform duration-500',
          {
            '-translate-y-[140%]': !isScrolled,
          }
        )}
        onClick={() => {
          if (appContent) {
            appContent.scrollTo({
              top: appContent.scrollHeight,
              behavior: 'smooth',
            })
          }
        }}
      />
      <div
        className={clsx(
          'relative z-10',
          'rounded-[1.6rem] p-1',
          'auto-bg-gray-100',
          {
            'bg-[#e0e7ff] dark:bg-[#262b41]': selectedBot && !selectedBot.auto,
          },
          innerClassName
        )}
      >
        {attachments?.length || clips?.length ? (
          <div className="flex flex-col gap-2 px-4 py-2.5">
            {attachments?.length ? (
              <AttachmentsArea
                attachments={attachments}
                setAttachments={setAttachments}
              />
            ) : null}
            {clips?.length ? (
              <ClipsArea clips={clips} setClips={setClips} />
            ) : null}
          </div>
        ) : null}
        {selectedBot && !selectedBot.auto && (
          <div className="mb-1 text-xs auto-text-gray-500 px-4 pt-2 pb-1 flex flex-row items-center gap-2 justify-between">
            <div className="text-xs flex items-center gap-2">
              <p>Responding as </p>
              <div className="flex items-center gap-1">
                {selectedBot.icon ? (
                  <DynamicIcon
                    className="size-3 rounded-full"
                    icon={selectedBot.icon}
                  />
                ) : (
                  <LuAtom className="size-3 text-indigo-50 dark:text-black fill-black dark:fill-white" />
                )}

                <strong className="text-black dark:text-white">
                  {selectedBot?.name || selectedBot?.nick}
                </strong>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDeselectBot}
              className="bg-indigo-200 rounded-full p-1"
            >
              <LuX className="size-3 text-indigo-500" />
            </button>
          </div>
        )}
        <div
          className={clsx(
            '@container',
            // 'default-input',
            'space-y-4',
            'bg-white dark:bg-black backdrop-blur-md',
            'p-5',
            'rounded-3xl border border-gray-200 dark:border-gray-800',
            'shadow-md shadow-gray-200 dark:shadow-gray-900'
          )}
          onClick={(event) => {
            if (!event.target.closest('button')) {
              const input = editorRef.current

              if (input) {
                input.commands.focus()
              }
            }
          }}
        >
          <div>
            {selectedSources?.some((s) => s.type !== 'auto') ? (
              <div className="relative">
                <div className="absolute right-0 h-full bg-gradient-to-l from-white dark:from-black w-14 z-50 pointer-events-none" />
                <div className="flex items-center gap-2 mb-3 -mt-1 overflow-x-scroll no-scrollbar pr-20">
                  {selectedSources
                    .filter((i) => i.type !== 'auto')
                    .map((source) => (
                      <button
                        key={source.id}
                        type="button"
                        className="flex items-center auto-text-gray-500 h-7 px-3 pl-8 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-400/20 transition-colors duration-200 group relative border auto-border-gray-300 border-dashed hover:border-indigo-300"
                        onClick={() => handleDeselectSource(source)}
                      >
                        <DynamicIcon
                          className="size-4 group-hover:opacity-0 opacity-60 absolute left-2 transition duration-200"
                          icon={
                            source.icon ||
                            {
                              dataset: '@lucide/hard-drive',
                              skillset: '@lucide/boxes',
                              space: '@lucide/folder-open',
                              mcp: '@lucide/boxes',
                            }[source.type] ||
                            '@lucide/boxes'
                          }
                        />
                        <div className="size-4 bg-indigo-200 rounded-full flex items-center justify-center group-hover:opacity-100 opacity-0 absolute left-2 transition duration-200 group-hover:text-indigo-500">
                          <LuX className="size-3" />
                        </div>
                        <p className="text-xs text-nowrap">{source.name}</p>
                      </button>
                    ))}
                </div>
              </div>
            ) : null}
            <ChatInput.Memo
              key="chatInput"
              bots={bots}
              models={visibleModels}
              sources={visibleSources}
              onSubmit={handleOnSubmit}
              handleLargeTextPaste={handleLargeTextPaste}
              autoFocus={true}
              spellCheck={false}
              editorRef={editorRef}
              onContentChange={(content) => setHasContent(!!content)}
            />
          </div>
          <div className="hidden @sm:flex flex-row items-center">
            {bots.length > 1 ? ( // @note 1 because we assume there is always an auto bot
              <>
                <TooltipButton
                  as="div"
                  tooltip="Select Agent"
                  transitionStyles="scale"
                  placement="top"
                >
                  <button
                    className="default-button push size-9 rounded-xl p-2 border-gray-200 dark:border-gray-800"
                    type="button"
                    onClick={handleSelectBotClick}
                    tabIndex={-1}
                  >
                    {botsAreLoading ? (
                      <Spinner className="size-4" />
                    ) : selectedBot?.icon ? (
                      <DynamicIcon
                        className="size-4 rounded-full"
                        icon={selectedBot.icon}
                      />
                    ) : (
                      <LuAtom className="size-4 text-white dark:text-black fill-black dark:fill-white" />
                    )}
                  </button>
                </TooltipButton>
                <div className="h-5 w-px auto-bg-gray-200 ml-4 mr-2" />
              </>
            ) : null}
            <TooltipButton
              as="div"
              tooltip="Attach File"
              transitionStyles="scale"
              placement="top"
            >
              <MenuButton
                className="-ml-1 hover:auto-bg-gray-100 transition-colors duration-200 push size-9 rounded-xl p-2 flex items-center justify-center"
                placement="bottom"
                allowedPlacements={['bottom', 'top']}
                menu={[
                  {
                    icon: '@heroicons/paper-clip',
                    title: 'Attach File',
                    onClick: handleAttachFile,
                  },
                  {
                    icon: '@heroicons/viewfinder-circle',
                    title: 'Take Screenshot',
                    onClick: handleTakeScreenshot,
                  },
                ]}
                transitionStyles="scale"
              >
                <AttachIcon className="size-4" />
              </MenuButton>
            </TooltipButton>
            {visibleSources.length > 1 ? ( // @note 1 because we assume there is always an auto source (hidden when embedded)
              <TooltipButton
                as="div"
                tooltip="Select Source"
                transitionStyles="scale"
                placement="top"
              >
                <button
                  className={clsx(
                    'push h-9',
                    'hover:auto-bg-gray-100 transition-colors duration-150',
                    'flex items-center justify-center gap-1',
                    'rounded-xl text-xs',
                    '[interpolate-size:allow-keywords]',
                    'w-auto',
                    'transition-all duration-300'
                  )}
                  type="button"
                  onClick={handleSelectSourcesClick}
                  tabIndex={-1}
                >
                  <div className="h-full w-full flex items-center justify-center aspect-square p-0.5">
                    <LuCombine className="size-3.5" />
                  </div>
                </button>
              </TooltipButton>
            ) : null}
            <div className="flex-1" />
            <div className="flex items-center gap-1">
              {visibleModels.length > 1 ? ( // @note 1 because we assume there is always an auto model (hidden when embedded)
                <TooltipButton
                  as="div"
                  tooltip="Select Model"
                  transitionStyles="scale"
                  placement="top"
                  className={clsx('transition-all duration-200', {
                    'motion-opacity-out-0 motion-blur-out-md pointer-events-none':
                      selectedBot && !selectedBot.auto,
                    'motion-opacity-in-0 motion-blur-in-md pointer-events-auto':
                      !selectedBot || selectedBot.auto,
                  })}
                >
                  <button
                    type="button"
                    onClick={handleSelectModelClick}
                    className="flex items-center justify-center gap-2 h-9 px-3 rounded-xl hover:auto-bg-gray-100 transition-colors duration-200"
                  >
                    {selectedModel?.icon ? (
                      <DynamicIcon
                        className="size-5 rounded-full"
                        icon={selectedModel.icon}
                      />
                    ) : (
                      <LuBox className="size-4 opacity-50" />
                    )}
                    <p className="text-sm hidden sm:block">
                      {selectedModel?.name || 'Auto'}
                    </p>
                    <LuChevronDown className="size-4 opacity-50" />
                  </button>
                </TooltipButton>
              ) : null}
              {/* @note trace button is no longer needed since trace is now available in SuperTools
              {trace ? (
                <TooltipButton
                  as="div"
                  tooltip="Trace"
                  transitionStyles="scale"
                  placement="top"
                >
                  <Link
                    className="default-button push size-9 rounded-xl p-2"
                    href="/apps/trace"
                    target="_blank"
                    tabIndex={-1}
                  >
                    <LuLogs className="size-full" />
                  </Link>
                </TooltipButton>
              ) : null}
              */}
              {isInDashboard && selectedBot && !selectedBot.auto ? (
                <TooltipButton
                  as="div"
                  tooltip={
                    extraFeatures.reprogramming
                      ? 'Reprogramming mode active'
                      : 'Enable reprogramming mode'
                  }
                  transitionStyles="scale"
                  placement="top"
                >
                  {extraFeatures.reprogramming ? (
                    <div className="p-[2px] rounded-xl bg-gradient-dynamic from-pink-500 via-cyan-500 to-violet-500 animate-deg-rotate">
                      <button
                        className="push flex items-center justify-center rounded-[10px] size-8 p-2 bg-white dark:bg-black"
                        type="button"
                        onClick={() => toggleFeature('reprogramming')}
                        tabIndex={-1}
                      >
                        <LuCpu className="size-4 text-violet-500 animate-hue-rotate" />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="default-button push size-9 rounded-xl p-2 border-gray-200 dark:border-gray-800"
                      type="button"
                      onClick={() => toggleFeature('reprogramming')}
                      tabIndex={-1}
                    >
                      <LuCpu className="size-4" />
                    </button>
                  )}
                </TooltipButton>
              ) : null}
              {features?.promptImprovement?.enabled ? (
                <TooltipButton
                  as="div"
                  tooltip="Improve Prompt"
                  transitionStyles="scale"
                  placement="top"
                >
                  <button
                    className="default-button push size-9 rounded-xl p-2 border-gray-200 dark:border-gray-800"
                    type="button"
                    onClick={handleImprovePrompt}
                    disabled={
                      !hasContent || improvingPrompt || thinking || writing
                    }
                    tabIndex={-1}
                  >
                    {improvingPrompt ? (
                      <Spinner className="size-4" />
                    ) : (
                      <LuZap className="size-4" />
                    )}
                  </button>
                </TooltipButton>
              ) : null}
              <TooltipButton
                as="div"
                tooltip={
                  (thinking || writing) && !hasContent
                    ? 'Abort'
                    : thinking || writing
                      ? 'Send next'
                      : 'Submit'
                }
                transitionStyles="scale"
                placement="top"
              >
                {/* @note while streaming, a typed message becomes the primary
                action (it is queued as a follow-up); the abort control only
                shows when the composer is empty */}
                {(thinking || writing) && !hasContent ? (
                  <button
                    className="default-button push size-9 rounded-xl p-2 border-gray-200 dark:border-gray-800"
                    type="button"
                    onClick={handleAbortStream}
                    tabIndex={-1}
                  >
                    <Spinner className="size-full" />
                  </button>
                ) : (
                  <button
                    className="primary-button push size-9 rounded-xl p-2"
                    type="button"
                    onClick={handleSubmit}
                    disabled={!hasContent}
                    tabIndex={-1}
                  >
                    <ArrowUpIcon className="size-4" />
                  </button>
                )}
              </TooltipButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

ChatArea.Memo = memo(ChatArea)

export default ChatArea
