import { useEffect, useMemo, useState } from 'react'
import { BiLinkExternal } from 'react-icons/bi'

import AutoTextarea from '@/components/AutoTextarea'
import Link from '@/components/Link'
import List from '@/components/List'

import useDebounce from '@/hooks/useDebounce'
import useFetch from '@/hooks/useFetch'
import useGraphQLConnectionListRoute from '@/hooks/useGraphQLConnectionListRoute'
import usePopup from '@/hooks/usePopup'
import useProjectScope from '@/hooks/useProjectScope'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import { captureException } from '@/lib/error'

import clsx from 'clsx'

export const DEFAULT_LIST = []

const SKILLSET_SELECT_QUERY = `
  query SkillsetSelectSkillsets(
    $first: Int
    $last: Int
    $after: ID
    $before: ID
    $order: ListOrder
    $blueprintIds: [ID!]
  ) {
    skillsets(
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

function SelectPopup({ skillsets, currentSkillset, onSelect }) {
  const [search, setSearch] = useState('')

  const debouncedSearch = useDebounce(search, 300)

  const filteredSkillsets = useMemo(() => {
    if (!debouncedSearch) {
      return skillsets
    }

    const searchLower = debouncedSearch.toLowerCase()

    return skillsets.filter((skillset) => {
      return [skillset.id, skillset.name, skillset.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(searchLower)
    })
  }, [skillsets, debouncedSearch])

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Select a skillset from the list below or create a new one.
      </p>
      <input
        className="default-input w-full"
        type="search"
        placeholder="Search skillsets..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="max-h-[500px] h-screen flex flex-col overflow-auto">
        <List>
          {filteredSkillsets
            .sort((a, b) => {
              if (a.createdAt && b.createdAt) {
                return (
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime()
                )
              }

              return (a.name || a.id).localeCompare(b.name || b.id)
            })
            .map((skillset) => {
              return (
                <List.Item
                  key={skillset.id}
                  selected={skillset.id === currentSkillset}
                  title={skillset.name || skillset.id}
                  body={
                    skillset.description || (
                      <span className="italic">
                        A skillset without description
                      </span>
                    )
                  }
                  timestamp={skillset.createdAt}
                  onClick={() => onSelect(skillset.id)}
                />
              )
            })}
        </List>
      </div>
    </div>
  )
}

export function ConfigPopup() {
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
            autoFocus
          />
        </div>
        <p className="input-description">
          Type any name to recognize the skillset from others. This information
          is not used as part of your chatbot conversations.
        </p>
      </div>
      {/* description */}
      <div>
        <label className="default-label" htmlFor="description">
          Description
        </label>
        <div className="mt-1">
          <AutoTextarea className="default-input w-full" name="description" />
        </div>
        <p className="input-description">
          Type description to inform what this skillset is about. This
          information is not used as part of your chatbot conversations.
        </p>
      </div>
    </div>
  )
}

export default function SkillsetSelect({
  wrapperClassName,
  containerClassName,

  skillsets: _skillsets = DEFAULT_LIST,

  defaultValue,
  value: _value,
  onChange,

  name,

  disabled,

  refLink = true,

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
    query: SKILLSET_SELECT_QUERY,
    connection: 'skillsets',
    variables,
  })

  const [skillsets, setSkillsets] = useState(_skillsets)
  const [listLoading, setListLoading] = useState(false)

  useEffect(() => {
    setSkillsets(_skillsets)
  }, [_skillsets])

  useEffect(() => {
    if (!hydrated || _skillsets.length > 0) {
      return
    }

    let canceled = false

    async function fetchItems() {
      setSkillsets([])
      setListLoading(true)

      try {
        const { items } = await graphqlListRoute({ take: 100 })

        if (!canceled) {
          setSkillsets(items)
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
  }, [_skillsets, graphqlListRoute, hydrated])

  const [value, setValue] = useState(_value || defaultValue || '')

  const { popup, openPopup, closePopup, setDisabled } = usePopup()

  function handleSkillsetSelect(selectedSkillset) {
    setValue(selectedSkillset)

    if (onChange) {
      onChange({ target: { value: selectedSkillset } })
    }

    closePopup()
  }

  function handleInputClick() {
    if (disabled || loading || listLoading) {
      return
    }

    openPopup(
      <SelectPopup
        skillsets={skillsets}
        currentSkillset={value}
        onSelect={handleSkillsetSelect}
      />,
      {
        closePopupOnClickOutside: true,
        title: 'Select Skillset',
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
          'Create New': {
            fn: () => {
              closePopup()

              openPopup(<ConfigPopup />, {
                closePopupOnClickOutside: true,
                title: 'Create New Skillset',
                actions: {
                  Create: {
                    default: true,

                    fn: async (data) => {
                      setDisabled(true)

                      const { error: createError, data: createData } =
                        await fetch(`/api/v1/skillset/create`, {
                          data: scopeCreateData(data),
                        })

                      setDisabled(false)

                      if (!createError) {
                        setSkillsets([
                          { ...data, id: createData.id },
                          ...skillsets,
                        ])

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
        },
      }
    )
  }

  // @note find the skillset name for display

  const displayName =
    skillsets.find((s) => s.id === value)?.name ||
    value ||
    'Please choose a skillset...'

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
          <Link href={`/skillsets/${value}`} target="_blank">
            <BiLinkExternal
              className={clsx('h-5 w-5 default-link', { disabled: disabled })}
            />
          </Link>
        ) : null}
      </div>
    </div>
  )
}
