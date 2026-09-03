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

const SECRET_SELECT_QUERY = `
  query SecretSelectSecrets(
    $first: Int
    $last: Int
    $after: ID
    $before: ID
    $order: ListOrder
    $blueprintIds: [ID!]
  ) {
    secrets(
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

function SelectPopup({ secrets, currentSecret, onSelect }) {
  const [search, setSearch] = useState('')

  const debouncedSearch = useDebounce(search, 300)

  const filteredSecrets = useMemo(() => {
    if (!debouncedSearch) {
      return secrets
    }

    const searchLower = debouncedSearch.toLowerCase()

    return secrets.filter((secret) => {
      return [secret.id, secret.name, secret.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(searchLower)
    })
  }, [secrets, debouncedSearch])

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Select a secret from the list below or create a new one.
      </p>
      <input
        className="default-input w-full"
        type="search"
        placeholder="Search secrets..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="max-h-[500px] h-screen flex flex-col overflow-auto">
        <List>
          {filteredSecrets
            .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))
            .map((secret) => {
              return (
                <List.Item
                  key={secret.id}
                  selected={secret.id === currentSecret}
                  title={secret.name || secret.id}
                  body={
                    secret.description || (
                      <span className="italic">
                        A secret without description
                      </span>
                    )
                  }
                  timestamp={secret.createdAt}
                  onClick={() => onSelect(secret.id)}
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
          Type any name to recognize the secret from others. This information is
          not used as part of your chatbot conversations.
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
          Type description to inform what this secret is about. This information
          is not used as part of your chatbot conversations.
        </p>
      </div>
    </div>
  )
}

export default function SecretSelect({
  wrapperClassName,
  containerClassName,

  secrets: _secrets = DEFAULT_LIST,

  defaultValue,
  value: _value,
  onChange,

  name,

  disabled,

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
    query: SECRET_SELECT_QUERY,
    connection: 'secrets',
    variables,
  })

  const [secrets, setSecrets] = useState(_secrets)
  const [listLoading, setListLoading] = useState(false)

  useEffect(() => {
    setSecrets(_secrets)
  }, [_secrets])

  useEffect(() => {
    if (!hydrated || _secrets.length > 0) {
      return
    }

    let canceled = false

    async function fetchItems() {
      setSecrets([])
      setListLoading(true)

      try {
        const { items } = await graphqlListRoute({ take: 100 })

        if (!canceled) {
          setSecrets(items)
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
  }, [_secrets, graphqlListRoute, hydrated])

  const [value, setValue] = useState(_value || defaultValue || '')

  const { popup, openPopup, closePopup, setDisabled } = usePopup()

  function handleSecretSelect(selectedSecret) {
    setValue(selectedSecret)

    if (onChange) {
      onChange({ target: { value: selectedSecret } })
    }

    closePopup()
  }

  function handleInputClick() {
    if (disabled || loading || listLoading) {
      return
    }

    openPopup(
      <SelectPopup
        secrets={secrets}
        currentSecret={value}
        onSelect={handleSecretSelect}
      />,
      {
        closePopupOnClickOutside: true,
        title: 'Select Secret',
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
                title: 'Create New Secret',
                actions: {
                  Create: {
                    default: true,

                    fn: async (data) => {
                      setDisabled(true)

                      const { error: createError, data: createData } =
                        await fetch(`/api/v1/secret/create`, {
                          data: scopeCreateData(data),
                        })

                      setDisabled(false)

                      if (!createError) {
                        setSecrets([{ ...data, id: createData.id }, ...secrets])

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

  // @note find the secret name for display

  const displayName =
    secrets.find((s) => s.id === value)?.name ||
    value ||
    'Please choose a secret...'

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
        {value ? (
          <Link href={`/secrets/${value}`} target="_blank">
            <BiLinkExternal
              className={clsx('h-5 w-5 default-link', { disabled: disabled })}
            />
          </Link>
        ) : null}
      </div>
    </div>
  )
}
