import { useEffect, useMemo, useState } from 'react'
import { IoIosOptions } from 'react-icons/io'

import { captureException } from '@/lib/error'

import AutoTextarea from '@/components/AutoTextarea'
import BackstoryInput from '@/components/BackstoryInput'
import LanguageModelSelect from '@/components/LanguageModelSelect'
import List from '@/components/List'

import useDebounce from '@/hooks/useDebounce'
import useFetch from '@/hooks/useFetch'
import useGraphQLConnectionListRoute from '@/hooks/useGraphQLConnectionListRoute'
import usePopup from '@/hooks/usePopup'
import useProjectScope from '@/hooks/useProjectScope'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import clsx from 'clsx'

export const DEFAULT_LIST = []

const BOT_SELECT_QUERY = `
  query BotSelectBots(
    $first: Int
    $last: Int
    $after: ID
    $before: ID
    $order: ListOrder
    $blueprintIds: [ID!]
  ) {
    bots(
      first: $first
      last: $last
      after: $after
      before: $before
      order: $order
      blueprintIds: $blueprintIds
    ) {
      edges {
        node {
          id
          name
          description
          createdAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

function SelectPopup({ bots, currentBot, onSelect }) {
  const [search, setSearch] = useState('')

  const debouncedSearch = useDebounce(search, 300)

  const filteredBots = useMemo(() => {
    if (!debouncedSearch) {
      return bots
    }

    const searchLower = debouncedSearch.toLowerCase()

    return bots.filter((bot) => {
      return [bot.id, bot.name, bot.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(searchLower)
    })
  }, [bots, debouncedSearch])

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Select a bot from the list below or create a new one.
      </p>
      <input
        className="default-input w-full"
        type="search"
        placeholder="Search bots..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="max-h-[500px] h-screen flex flex-col overflow-auto">
        <List>
          {filteredBots
            .sort((a, b) => {
              if (a.createdAt && b.createdAt) {
                return (
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime()
                )
              }

              return (a.name || a.id).localeCompare(b.name || b.id)
            })
            .map((bot) => {
              return (
                <List.Item
                  key={bot.id}
                  selected={bot.id === currentBot}
                  title={bot.name || bot.id}
                  body={
                    bot.description || (
                      <span className="italic">A bot without description</span>
                    )
                  }
                  timestamp={bot.createdAt}
                  onClick={() => onSelect(bot.id)}
                />
              )
            })}
        </List>
      </div>
    </div>
  )
}

export function ConfigPopup({ bot = {} }) {
  return (
    <div className="mt-6 space-y-6">
      {/* name */}
      <div>
        <label className="default-label" htmlFor="name">
          Name
        </label>
        <div className="mt-1">
          <input
            className="default-input w-full"
            name="name"
            type="text"
            defaultValue={bot.name}
            autoFocus
          />
        </div>
        <p className="input-description">
          Type any name to recognize the bot from others. This information is
          not used as part of your chatbot conversations.
        </p>
      </div>
      {/* description */}
      <div>
        <label className="default-label" htmlFor="description">
          Description
        </label>
        <div className="mt-1">
          <AutoTextarea
            className="default-input w-full"
            name="description"
            defaultValue={bot.description}
          />
        </div>
        <p className="input-description">
          Type description to inform what this bot is about. This information is
          not used as part of your chatbot conversations.
        </p>
      </div>
      {/* backstory */}
      <div>
        <label className="default-label" htmlFor="backstory">
          Backstory
        </label>
        <div className="mt-1">
          <BackstoryInput
            className="default-input w-full"
            name="backstory"
            defaultValue={bot.backstory}
          />
        </div>
        <p className="input-description">
          Write the chat bot backstory to define its behavior.
        </p>
      </div>
      {/* model */}
      <div>
        <label className="default-label" htmlFor="model">
          Model
        </label>
        <div className="mt-1">
          <LanguageModelSelect
            className="default-input w-full max-w-xs"
            name="model"
            defaultValue={bot.model}
          />
        </div>
        <p className="input-description">The model to use for this bot.</p>
      </div>
    </div>
  )
}

export default function BotSelect({
  wrapperClassName,
  containerClassName,

  bots: _bots = DEFAULT_LIST,

  defaultValue,
  value: _value,
  onChange,

  name,

  disabled,

  refLink = true,

  allowCreate = true,

  ...props
}) {
  const { loading, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  const scopeCreateData = useScopedCreateData()

  const { hydrated, scope } = useProjectScope()

  const variables = useMemo(
    () => ({
      blueprintIds: scope ? [scope.id] : undefined,
    }),
    [scope]
  )

  const graphqlListRoute = useGraphQLConnectionListRoute({
    query: BOT_SELECT_QUERY,
    connection: 'bots',
    variables,
  })

  const [bots, setBots] = useState(_bots)

  const [listLoading, setListLoading] = useState(false)

  useEffect(() => {
    setBots(_bots)
  }, [_bots])

  useEffect(() => {
    if (!hydrated || _bots.length > 0) {
      return
    }

    let canceled = false

    async function fetchItems() {
      setBots([])
      setListLoading(true)

      try {
        const { items } = await graphqlListRoute({ take: 100 })

        if (!canceled) {
          setBots(items)
        }
      } catch (error) {
        await captureException(error)
      } finally {
        if (!canceled) {
          setListLoading(false)
        }
      }
    }

    fetchItems()

    return () => {
      canceled = true
    }
  }, [_bots, graphqlListRoute, hydrated])

  const [value, setValue] = useState(_value || defaultValue || '')

  const { popup, openPopup, closePopup, setDisabled } = usePopup()

  function handleBotSelect(selectedBot) {
    setValue(selectedBot)

    if (onChange) {
      onChange({ target: { value: selectedBot } })
    }

    closePopup()
  }

  function handleInputClick() {
    if (disabled || loading || listLoading) {
      return
    }

    openPopup(
      <SelectPopup bots={bots} currentBot={value} onSelect={handleBotSelect} />,
      {
        closePopupOnClickOutside: true,
        title: 'Select Bot',
        actions: {
          ...(value
            ? {
                Clear: {
                  fn: () => {
                    setValue('')

                    if (onChange) {
                      onChange({ target: { value: '' } })
                    }

                    closePopup()
                  },
                },
              }
            : {}),
          ...(allowCreate
            ? {
                'Create New': {
                  fn: () => {
                    closePopup()

                    openPopup(<ConfigPopup />, {
                      closePopupOnClickOutside: true,
                      title: 'Create New Bot',
                      dialogClassName: 'sm:max-w-2xl',
                      actions: {
                        Create: {
                          default: true,

                          fn: async (data) => {
                            setDisabled(true)

                            const { error: createError, data: createData } =
                              await fetch(`/api/v1/bot/create`, {
                                data: scopeCreateData(data),
                              })

                            setDisabled(false)

                            if (!createError) {
                              setBots([{ ...data, id: createData.id }, ...bots])

                              setValue(createData.id)

                              if (onChange) {
                                onChange({ target: { value: createData.id } })
                              }

                              closePopup()
                            }
                          },
                        },
                      },
                    })
                  },
                },
              }
            : {}),
        },
      }
    )
  }

  async function handleQuickEditClick() {
    if (disabled || loading || listLoading || !value) {
      return
    }

    const { error: fetchError, data: bot } = await fetch(
      `/api/v1/bot/${value}/fetch`
    )

    if (fetchError) {
      return
    }

    openPopup(<ConfigPopup bot={bot} />, {
      closePopupOnClickOutside: false,
      title: 'Quick Edit Bot',
      dialogClassName: 'sm:max-w-2xl',
      actions: {
        Open: {
          fn: () => {
            window.open(`/bots/${value}`, '_blank')
          },
        },
        Save: {
          default: true,

          fn: async (data) => {
            setDisabled(true)

            const { error: updateError } = await fetch(
              `/api/v1/bot/${value}/update`,
              {
                data,

                successMessage: 'Bot updated.',
              }
            )

            setDisabled(false)

            if (!updateError) {
              setBots((bots) =>
                bots.map((bot) =>
                  bot.id === value ? { ...bot, ...data } : bot
                )
              )

              closePopup()
            }
          },
        },
      },
    })
  }

  // @note find the bot name for display

  const displayName =
    bots.find((b) => b.id === value)?.name || value || 'Please choose a bot...'

  return (
    <div className={wrapperClassName}>
      {popup}
      <div
        className={clsx('flex flex-row gap-2 items-center', containerClassName)}
      >
        <input
          className="hidden"
          name={name}
          type="text"
          value={value}
          onChange={() => {}} // no handler
        />
        <input
          {...props}
          type="text"
          value={displayName}
          onClick={handleInputClick}
          readOnly
          disabled={disabled || loading || listLoading}
          className={clsx(
            'cursor-pointer',
            props.className,
            (disabled || loading || listLoading) && 'cursor-not-allowed'
          )}
          spellCheck={false}
          autoComplete="off"
        />
        {value && refLink ? (
          <IoIosOptions
            className={clsx('h-5 w-5 default-link', { disabled: disabled })}
            onClick={handleQuickEditClick}
          />
        ) : null}
      </div>
    </div>
  )
}
