'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import {
  LuAtSign,
  LuBoxes,
  LuCheck,
  LuCircleOff,
  LuFolderOpen,
  LuFrame,
  LuHardDrive,
  LuPlus,
  LuZap,
} from 'react-icons/lu'

import DynamicIcon from '@/components/DynamicIcon'

import Mention from '@tiptap/extension-mention'
import { PluginKey } from '@tiptap/pm/state'
import { ReactRenderer } from '@tiptap/react'

import clsx from 'clsx'
import tippy from 'tippy.js'

export const GenericMentionList = forwardRef(function GenericMentionList(
  { title, description, className, children, ...props },
  ref
) {
  return (
    <div
      {...props}
      ref={ref}
      className={clsx(
        'items',
        'scroll-p-2',
        'auto-bg-white auto-text-black',
        'border auto-border-gray-200',
        'rounded-2xl',
        'p-4 mt-1',
        'max-h-[20rem]',
        'overflow-auto',
        'flex flex-col gap-0.5',
        'overscroll-contain no-scrollbar',
        'shadow-md',
        className
      )}
    >
      {title || description ? (
        <div className="mb-3 border-b auto-border-gray-200 pb-3">
          {title ? <h1 className="text-base font-semibold">{title}</h1> : null}
          {description ? (
            <p className="text-xs auto-text-gray-500">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  )
})

export const GenericMentionButton = forwardRef(function GenericMentionButton(
  {
    selected,

    highlighted,

    className,

    children,

    ...props
  },
  ref
) {
  const localRef = useRef(null)

  useImperativeHandle(ref, () => localRef.current)

  useEffect(() => {
    if (!localRef.current) {
      return
    }

    if (!selected && !highlighted) {
      return
    }

    localRef.current.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    })
  }, [selected, highlighted])

  return (
    <div {...props} ref={localRef} className={clsx(className)}>
      <div
        className={clsx(
          'h-full w-full p-2 flex items-center gap-2 truncate max-w-full rounded-xl text-sm',
          {
            'auto-bg-gray-100 auto-text-black': !!selected,
            'group-hover:bg-gray-100/60 dark:group-hover:bg-gray-800/40 dark:group-hover:text-white':
              !selected,
            'bg-gray-100/60 dark:bg-gray-800/40 dark:text-white':
              !selected && !!highlighted,
          }
        )}
      >
        {children}
      </div>
    </div>
  )
})

export const SelectionIndicator = ({ selected }) => (
  <div
    className={clsx(
      'shrink-0 ml-auto size-6 flex items-center justify-center rounded-full',
      {
        'bg-teal-400/20 text-teal-500': selected,
        'auto-bg-gray-100 text-black dark:text-white': !selected,
      }
    )}
  >
    {selected ? (
      <LuCheck className="size-3 text-teal-500" />
    ) : (
      <LuPlus className="size-3" />
    )}
  </div>
)

export const BotSelectorList = ({
  bots,

  onSelectBot,

  selectedBot,

  selectedIndex = bots.findIndex((b) => b.id === selectedBot?.id),

  highlightedIndex = -1,

  title = 'Select an agent',
  description = 'Choose an agent to use for new messages.',
}) => {
  return (
    <GenericMentionList title={title} description={description}>
      {bots.length ? (
        bots.map((bot, index) => {
          const isSelected = index === selectedIndex

          const isHighlighted = index === highlightedIndex

          return (
            <GenericMentionButton
              key={bot.id || bot.nick}
              className="item group flex w-full text-left cursor-pointer auto-text-black"
              onClick={() => onSelectBot(bot, index)}
              selected={isSelected}
              highlighted={isHighlighted}
            >
              {bot.icon ? (
                <div className="shrink-0 size-8 rounded-xl overflow-hidden flex items-center justify-center">
                  <DynamicIcon className="size-full" icon={bot.icon} />
                </div>
              ) : (
                <div className="shrink-0 size-8 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-indigo-500 dark:from-gray-800 to-indigo-200 dark:to-gray-900">
                  <LuAtSign className="size-4 text-white" />
                </div>
              )}
              <div className="truncate">{bot.name || bot.nick}</div>
              <SelectionIndicator selected={isSelected} />
            </GenericMentionButton>
          )
        })
      ) : (
        <div className="text-center text-sm flex items-center justify-center gap-2 py-2">
          <LuCircleOff className="size-3" />
          <span>No agents found.</span>
        </div>
      )}
    </GenericMentionList>
  )
}

export const ModelSelectorList = ({
  models,

  onSelectModel,

  selectedModel,

  selectedIndex = models.findIndex((b) => b.id === selectedModel?.id),

  highlightedIndex = -1,

  title = 'Select a model',
  description = 'Choose a model to use for new messages.',
}) => {
  return (
    <GenericMentionList title={title} description={description}>
      {models.length ? (
        models.map((model, index) => {
          const isSelected = index === selectedIndex

          const isHighlighted = index === highlightedIndex

          return (
            <GenericMentionButton
              key={model.id}
              className="item group flex w-full text-left cursor-pointer auto-text-black"
              onClick={() => onSelectModel(model, index)}
              selected={isSelected}
              highlighted={isHighlighted}
            >
              {model.icon ? (
                <div className="shrink-0 size-8 rounded-xl overflow-hidden flex items-center justify-center">
                  <DynamicIcon className="size-full" icon={model.icon} />
                </div>
              ) : (
                <div className="shrink-0 size-8 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-purple-500 dark:from-gray-800 to-purple-200 dark:to-gray-900">
                  <LuZap className="size-4 text-white" />
                </div>
              )}
              <div className="truncate">{model.name || model.id}</div>
              <SelectionIndicator selected={isSelected} />
            </GenericMentionButton>
          )
        })
      ) : (
        <div className="text-center text-sm flex items-center justify-center gap-2 py-2">
          <LuCircleOff className="size-3" />
          <span>No models found.</span>
        </div>
      )}
    </GenericMentionList>
  )
}

export const SourceSelectorList = ({
  sources,

  onSelectSource,

  selectedSources = [],

  highlightedIndex = -1,

  title = 'Select sources',
  description = 'Choose sources to use for new messages.',
}) => {
  return (
    <GenericMentionList title={title} description={description}>
      {sources.length ? (
        sources.map((source, index) => {
          const isSelected =
            selectedSources.some((s) => s.id === source.id) ||
            (selectedSources.length === 0 ? !!source.default : false)

          const isHighlighted = index === highlightedIndex

          return (
            <GenericMentionButton
              key={source.id}
              className="item group flex w-full text-left cursor-pointer auto-text-black"
              onClick={() => onSelectSource(source, index)}
              selected={isSelected}
              highlighted={isHighlighted}
            >
              {source.icon ? (
                <div className="shrink-0 size-8 rounded-xl overflow-hidden flex items-center justify-center">
                  {source.icon?.startsWith?.('@heroicons/') ||
                  source.icon?.startsWith?.('@lucide/') ? (
                    <div className="shrink-0 size-8 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-green-500 dark:from-gray-800 to-green-200 dark:to-gray-900">
                      <DynamicIcon
                        className="size-4 invert"
                        icon={source.icon}
                      />
                    </div>
                  ) : (
                    <DynamicIcon className="size-full" icon={source.icon} />
                  )}
                </div>
              ) : source.type === 'dataset' ? (
                <div className="shrink-0 size-8 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-green-500 dark:from-gray-800 to-green-200 dark:to-gray-900">
                  <LuHardDrive className="size-4 text-white" />
                </div>
              ) : source.type === 'skillset' ? (
                <div className="shrink-0 size-8 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-green-500 dark:from-gray-800 to-green-200 dark:to-gray-900">
                  <LuBoxes className="size-4 text-white" />
                </div>
              ) : source.type === 'space' ? (
                <div className="shrink-0 size-8 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-500 dark:from-gray-800 to-blue-200 dark:to-gray-900">
                  <LuFolderOpen className="size-4 text-white" />
                </div>
              ) : (
                <div className="shrink-0 size-8 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-green-500 dark:from-gray-800 to-green-200 dark:to-gray-900">
                  <LuFrame className="size-4 text-white" />
                </div>
              )}
              <div className="truncate">{source.name || source.nick}</div>
              <SelectionIndicator selected={isSelected} />
            </GenericMentionButton>
          )
        })
      ) : (
        <div className="text-center text-sm flex items-center justify-center gap-2 py-2">
          <LuCircleOff className="size-3" />
          <span>No sources found.</span>
        </div>
      )}
    </GenericMentionList>
  )
}

export const CommandMentionList = forwardRef(
  function CommandMentionList(props, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0)

    const { command, items } = props

    const selectItem = useCallback(
      (index) => {
        const item = items[index]

        if (item) {
          command({ id: item.id })
        }
      },
      [command, items]
    )

    const upHandler = useCallback(() => {
      setSelectedIndex(
        (selectedIndex) => (selectedIndex + items.length - 1) % items.length
      )
    }, [items.length])

    const downHandler = useCallback(() => {
      setSelectedIndex((selectedIndex) => (selectedIndex + 1) % items.length)
    }, [items.length])

    const enterHandler = useCallback(() => {
      selectItem(selectedIndex)
    }, [selectItem, selectedIndex])

    useEffect(() => setSelectedIndex(0), [props.items])

    useImperativeHandle(
      ref,
      () => ({
        onKeyDown: ({ event }) => {
          if (event.key === 'ArrowUp') {
            upHandler()

            return true
          }

          if (event.key === 'ArrowDown') {
            downHandler()

            return true
          }

          if (event.key === 'Enter') {
            enterHandler()

            return true
          }

          if (event.key === 'Tab') {
            enterHandler()

            return true
          }

          return false
        },
      }),
      [downHandler, enterHandler, upHandler]
    )

    return (
      <GenericMentionList>
        <p className="text-xs text-gray-500 mb-2">Commands</p>
        {props.items.length ? (
          props.items.map((item, index) => {
            const isSelected = index === selectedIndex

            return (
              <GenericMentionButton
                key={index}
                className="item group flex w-full text-left cursor-pointer auto-text-black"
                onClick={() => selectItem(index)}
                selected={isSelected}
              >
                <div className="truncate">{item.name || item.id}</div>
                <div className="shrink-0 text-[0.6rem] bg-gray-200 dark:bg-gray-800 rounded-full py-0.5 px-2 ml-auto">
                  TAB
                </div>
              </GenericMentionButton>
            )
          })
        ) : (
          <div className="text-center text-sm flex items-center justify-center gap-2 py-2">
            <LuCircleOff className="size-3" />
            <span>No commands found.</span>
          </div>
        )}
      </GenericMentionList>
    )
  }
)

export const CommandMentionSuggestion = {
  char: '/',

  pluginKey: new PluginKey('commandMention'),

  items({ query }) {
    const lowerQuery = query.toLowerCase()

    return [
      {
        id: 'new',
        name: 'New conversation',
      },
      {
        id: 'delete',
        name: 'Delete conversation',
      },
      {
        id: 'refresh',
        name: 'Refresh the list of resources',
      },
      {
        id: 'task',
        name: 'Create a new task',
      },
    ].filter(
      (item) =>
        item.id.toLowerCase().startsWith(lowerQuery) ||
        item.name.toLowerCase().startsWith(lowerQuery)
    )
  },

  render() {
    let component
    let popup

    return {
      onStart(props) {
        component = new ReactRenderer(CommandMentionList, {
          props,
          editor: props.editor,
        })

        if (!props.clientRect) {
          return
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
          arrow: false,
          theme: 'go-away',
          popperOptions: {
            strategy: 'fixed', // @note ensures tooltip uses fixed positioning
          },
        })
      },

      onUpdate(props) {
        component?.updateProps(props)

        if (!props.clientRect) {
          return
        }

        popup?.[0]?.setProps({
          getReferenceClientRect: props.clientRect,
        })
      },

      onKeyDown(props) {
        if (props.event.key === 'Escape') {
          popup?.[0]?.hide()

          return true
        }

        return component?.ref?.onKeyDown(props)
      },

      onExit() {
        popup?.[0]?.destroy()
        component?.destroy()
      },
    }
  },
}

export const CommandMentionHandler = Mention.extend({
  name: 'commandMention',
}).configure({
  HTMLAttributes: {
    class:
      'mention font-normal text-[inherit] align-baseline inline-flex justify-center items-center cursor-crosshair bg-gray-500/10 dark:bg-white/10 text-black dark:text-white rounded-lg box-decoration-clone px-2',
  },

  suggestion: CommandMentionSuggestion,
})

export const BotMentionList = forwardRef(function MentionList(props, ref) {
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const { command, items } = props

  const selectItem = useCallback(
    (index) => {
      const item = items[index]

      if (item) {
        command({ label: item.name, id: item.nick }) // @note is the nick
      }
    },
    [command, items]
  )

  const upHandler = useCallback(() => {
    setHighlightedIndex(
      (highlightedIndex) => (highlightedIndex + items.length - 1) % items.length
    )
  }, [items.length])

  const downHandler = useCallback(() => {
    setHighlightedIndex(
      (highlightedIndex) => (highlightedIndex + 1) % items.length
    )
  }, [items.length])

  const enterHandler = useCallback(() => {
    selectItem(highlightedIndex)
  }, [highlightedIndex, selectItem])

  useEffect(() => setHighlightedIndex(0), [props.items])

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          upHandler()

          return true
        }

        if (event.key === 'ArrowDown') {
          downHandler()

          return true
        }

        if (event.key === 'Enter') {
          enterHandler()

          return true
        }

        if (event.key === 'Tab') {
          enterHandler()

          return true
        }

        return false
      },
    }),
    [downHandler, enterHandler, upHandler]
  )

  return (
    <BotSelectorList
      bots={props.items}
      onSelectBot={(_bot, index) => selectItem(index)}
      highlightedIndex={highlightedIndex}
      title="Select an agent"
      description="You can reference an agent by (@)name in the chat input or select one here."
    />
  )
})

export const BotMentionSuggestion = {
  char: '@',

  pluginKey: new PluginKey('botMention'),

  items({ editor, query }) {
    return editor.options.ref.current.bots.filter((item) =>
      item.nick.toLowerCase().startsWith(query.toLowerCase())
    )
  },

  render() {
    let component
    let popup

    return {
      onStart(props) {
        component = new ReactRenderer(BotMentionList, {
          props,
          editor: props.editor,
        })

        if (!props.clientRect) {
          return
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
          arrow: false,
          theme: 'go-away',
          popperOptions: {
            strategy: 'fixed', // @note ensures tooltip uses fixed positioning
          },
        })
      },

      onUpdate(props) {
        component?.updateProps(props)

        if (!props.clientRect) {
          return
        }

        popup?.[0]?.setProps({
          getReferenceClientRect: props.clientRect,
        })
      },

      onKeyDown(props) {
        if (props.event.key === 'Escape') {
          popup?.[0]?.hide()

          return true
        }

        return component?.ref?.onKeyDown(props)
      },

      onExit() {
        popup?.[0]?.destroy()
        component?.destroy()
      },
    }
  },
}

export const BotMentionHandler = Mention.extend({
  name: 'botMention',
}).configure({
  HTMLAttributes: {
    class:
      'mention font-normal text-[inherit] align-baseline inline-flex justify-center items-center cursor-crosshair bg-indigo-500/10 dark:bg-white/10 text-indigo-500 dark:text-white rounded-full box-decoration-clone px-2',
  },

  suggestion: BotMentionSuggestion,
})

export const ModelMentionList = forwardRef(
  function ModelMentionList(props, ref) {
    const [highlightedIndex, setHighlightedIndex] = useState(0)

    const { command, items } = props

    const selectItem = useCallback(
      (index) => {
        const item = items[index]

        if (item) {
          command({ label: item.name, id: item.nick }) // @note is the nick
        }
      },
      [command, items]
    )

    const upHandler = useCallback(() => {
      setHighlightedIndex(
        (highlightedIndex) =>
          (highlightedIndex + items.length - 1) % items.length
      )
    }, [items.length])

    const downHandler = useCallback(() => {
      setHighlightedIndex(
        (highlightedIndex) => (highlightedIndex + 1) % items.length
      )
    }, [items.length])

    const enterHandler = useCallback(() => {
      selectItem(highlightedIndex)
    }, [highlightedIndex, selectItem])

    useEffect(() => setHighlightedIndex(0), [items])

    useImperativeHandle(
      ref,
      () => ({
        onKeyDown: ({ event }) => {
          if (event.key === 'ArrowUp') {
            upHandler()

            return true
          }

          if (event.key === 'ArrowDown') {
            downHandler()

            return true
          }

          if (event.key === 'Enter') {
            enterHandler()

            return true
          }

          if (event.key === 'Tab') {
            enterHandler()

            return true
          }

          return false
        },
      }),
      [downHandler, enterHandler, upHandler]
    )

    return (
      <ModelSelectorList
        models={props.items}
        onSelectModel={(_model, index) => selectItem(index)}
        highlightedIndex={highlightedIndex}
        title="Select a model"
        description="You can reference a model by (^)name in the chat input or select one here."
      />
    )
  }
)

export const ModelMentionSuggestion = {
  char: '^',

  pluginKey: new PluginKey('modelMention'),

  items({ editor, query }) {
    return editor.options.ref.current.models.filter((item) =>
      item.name.toLowerCase().includes(query.toLowerCase())
    )
  },

  render() {
    let component
    let popup

    return {
      onStart(props) {
        component = new ReactRenderer(ModelMentionList, {
          props,
          editor: props.editor,
        })

        if (!props.clientRect) {
          return
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
          arrow: false,
          theme: 'go-away',
          popperOptions: {
            strategy: 'fixed', // @note ensures tooltip uses fixed positioning
          },
        })
      },

      onUpdate(props) {
        component?.updateProps(props)

        if (!props.clientRect) {
          return
        }

        popup?.[0]?.setProps({
          getReferenceClientRect: props.clientRect,
        })
      },

      onKeyDown(props) {
        if (props.event.key === 'Escape') {
          popup?.[0]?.hide()

          return true
        }

        return component?.ref?.onKeyDown(props)
      },

      onExit() {
        popup?.[0]?.destroy()
        component?.destroy()
      },
    }
  },
}

export const ModelMentionHandler = Mention.extend({
  name: 'modelMention',
}).configure({
  HTMLAttributes: {
    class:
      'mention font-normal text-[inherit] align-baseline inline-flex justify-center items-center cursor-crosshair bg-purple-500/10 dark:bg-white/10 text-purple-500 dark:text-white rounded-lg box-decoration-clone px-2',
  },

  suggestion: ModelMentionSuggestion,
})

export const SourceMentionList = forwardRef(
  function SourceMentionList(props, ref) {
    const [highlightedIndex, setHighlightedIndex] = useState(0)

    const { command, items } = props

    const selectItem = useCallback(
      (index) => {
        const item = items[index]

        if (item) {
          command({ label: item.name, id: item.nick }) // @note is the nick
        }
      },
      [command, items]
    )

    const upHandler = useCallback(() => {
      setHighlightedIndex(
        (highlightedIndex) =>
          (highlightedIndex + items.length - 1) % items.length
      )
    }, [items.length])

    const downHandler = useCallback(() => {
      setHighlightedIndex(
        (highlightedIndex) => (highlightedIndex + 1) % items.length
      )
    }, [items.length])

    const enterHandler = useCallback(() => {
      selectItem(highlightedIndex)
    }, [highlightedIndex, selectItem])

    useEffect(() => setHighlightedIndex(0), [items]) // @note reset when items change

    useImperativeHandle(
      ref,
      () => ({
        onKeyDown: ({ event }) => {
          if (event.key === 'ArrowUp') {
            upHandler()

            return true
          }

          if (event.key === 'ArrowDown') {
            downHandler()

            return true
          }

          if (event.key === 'Enter') {
            enterHandler()

            return true
          }

          if (event.key === 'Tab') {
            enterHandler()

            return true
          }

          return false
        },
      }),
      [downHandler, enterHandler, upHandler]
    )

    return (
      <SourceSelectorList
        sources={props.items}
        onSelectSource={(_source, index) => selectItem(index)}
        highlightedIndex={highlightedIndex}
        title="Select a source"
        description="You can reference a source by (#)name in the chat input or select one here."
      />
    )
  }
)

export const SourceMentionSuggestion = {
  char: '#',

  pluginKey: new PluginKey('sourceMention'),

  items({ editor, query }) {
    return editor.options.ref.current.sources.filter((item) =>
      item.nick.toLowerCase().startsWith(query.toLowerCase())
    )
  },

  render() {
    let component
    let popup

    return {
      onStart(props) {
        component = new ReactRenderer(SourceMentionList, {
          props,
          editor: props.editor,
        })

        if (!props.clientRect) {
          return
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
          arrow: false,
          theme: 'go-away',
          popperOptions: {
            strategy: 'fixed', // @note ensures tooltip uses fixed positioning
          },
        })
      },

      onUpdate(props) {
        component?.updateProps(props)

        if (!props.clientRect) {
          return
        }

        popup?.[0]?.setProps({
          getReferenceClientRect: props.clientRect,
        })
      },

      onKeyDown(props) {
        if (props.event.key === 'Escape') {
          popup?.[0]?.hide()

          return true
        }

        return component?.ref?.onKeyDown(props)
      },

      onExit() {
        popup?.[0]?.destroy()
        component?.destroy()
      },
    }
  },
}

export const SourceMentionHandler = Mention.extend({
  name: 'sourceMention',
}).configure({
  HTMLAttributes: {
    class:
      'mention font-normal text-[inherit] align-baseline inline-flex justify-center items-center cursor-crosshair bg-gray-500/10 dark:bg-white/10 text-black dark:text-white rounded-lg box-decoration-clone px-2',
  },

  suggestion: SourceMentionSuggestion,
})
