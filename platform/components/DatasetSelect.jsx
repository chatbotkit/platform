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

const DATASET_SELECT_QUERY = `
  query DatasetSelectDatasets(
    $first: Int
    $last: Int
    $after: ID
    $before: ID
    $order: ListOrder
    $blueprintIds: [ID!]
  ) {
    datasets(
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

function SelectPopup({ datasets, currentDataset, onSelect }) {
  const [search, setSearch] = useState('')

  const debouncedSearch = useDebounce(search, 300)

  const filteredDatasets = useMemo(() => {
    if (!debouncedSearch) {
      return datasets
    }

    const searchLower = debouncedSearch.toLowerCase()

    return datasets.filter((dataset) => {
      return [dataset.id, dataset.name, dataset.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(searchLower)
    })
  }, [datasets, debouncedSearch])

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Select a dataset from the list below or create a new one.
      </p>
      <input
        className="default-input w-full"
        type="search"
        placeholder="Search datasets..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="max-h-[500px] h-screen flex flex-col overflow-auto">
        <List>
          {filteredDatasets
            .sort((a, b) => {
              if (a.createdAt && b.createdAt) {
                return (
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime()
                )
              }

              return (a.name || a.id).localeCompare(b.name || b.id)
            })
            .map((dataset) => {
              return (
                <List.Item
                  key={dataset.id}
                  selected={dataset.id === currentDataset}
                  title={dataset.name || dataset.id}
                  body={
                    dataset.description || (
                      <span className="italic">
                        A dataset without description
                      </span>
                    )
                  }
                  timestamp={dataset.createdAt}
                  onClick={() => onSelect(dataset.id)}
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
          Type any name to recognize the dataset from others. This information
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
          Type description to inform what this dataset is about. This
          information is not used as part of your chatbot conversations.
        </p>
      </div>
    </div>
  )
}

export default function DatasetSelect({
  wrapperClassName,
  containerClassName,

  datasets: _datasets = DEFAULT_LIST,

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
    query: DATASET_SELECT_QUERY,
    connection: 'datasets',
    variables,
  })

  const [datasets, setDatasets] = useState(_datasets)
  const [listLoading, setListLoading] = useState(false)

  useEffect(() => {
    setDatasets(_datasets)
  }, [_datasets])

  useEffect(() => {
    if (!hydrated || _datasets.length > 0) {
      return
    }

    let canceled = false

    async function fetchItems() {
      setDatasets([])
      setListLoading(true)

      try {
        const { items } = await graphqlListRoute({ take: 100 })

        if (!canceled) {
          setDatasets(items)
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
  }, [_datasets, graphqlListRoute, hydrated])

  const [value, setValue] = useState(_value || defaultValue || '')

  const { popup, openPopup, closePopup, setDisabled } = usePopup()

  function handleDatasetSelect(selectedDataset) {
    setValue(selectedDataset)

    if (onChange) {
      onChange({ target: { value: selectedDataset } })
    }

    closePopup()
  }

  function handleInputClick() {
    if (disabled || loading || listLoading) {
      return
    }

    openPopup(
      <SelectPopup
        datasets={datasets}
        currentDataset={value}
        onSelect={handleDatasetSelect}
      />,
      {
        closePopupOnClickOutside: true,
        title: 'Select Dataset',
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
                      title: 'Create New Dataset',
                      actions: {
                        Create: {
                          default: true,

                          fn: async (data) => {
                            setDisabled(true)

                            const { error: createError, data: createData } =
                              await fetch(`/api/v1/dataset/create`, {
                                data: scopeCreateData(data),
                              })

                            setDisabled(false)

                            if (!createError) {
                              setDatasets([
                                { ...data, id: createData.id },
                                ...datasets,
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
              }
            : {}),
        },
      }
    )
  }

  // @note find the dataset name for display

  const displayName =
    datasets.find((d) => d.id === value)?.name ||
    value ||
    'Please choose a dataset...'

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
          <Link href={`/datasets/${value}`} target="_blank">
            <BiLinkExternal
              className={clsx('h-5 w-5 default-link', { disabled: disabled })}
            />
          </Link>
        ) : null}
      </div>
    </div>
  )
}
