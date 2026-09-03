'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MdOutlineInsertLink } from 'react-icons/md'

import AutoTextarea from '@/components/AutoTextarea'
import Link from '@/components/Link'
import ResourceList from '@/components/ResourceList'
import TokenAutoTextarea from '@/components/TokenAutoTextarea'

import useDebounce from '@/hooks/useDebounce'
import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'
import useTextCompletion from '@/hooks/useTextCompletion'

function QuickEdit({ text, maxTokens }) {
  const { onKeyDown: onKeyDownTextComplete } = useTextCompletion()

  return (
    <div>
      <label className="default-label" htmlFor="text">
        Text
      </label>
      <div className="mt-1">
        <TokenAutoTextarea
          className="default-input max-h-[400px] !overflow-auto"
          name="text"
          defaultValue={text}
          maxTokens={maxTokens}
          onKeyDown={onKeyDownTextComplete}
        />
      </div>
      <p className="input-description">
        The text define the contents for the record. It can be any arbitrary
        text that will provide context for the bot during a conversation.
      </p>
      <p className="input-description">
        It is not recommended to edit this record by hand if you are also using
        a dataset integration. The integration will override any changes you
        make to this record. <strong>Create a new record instead.</strong>
      </p>
    </div>
  )
}

export default function DatasetRecordList({
  datasetId,

  kind = 'record',

  listRoute: _listRoute,
  searchRoute: _searchRoute,
  exportRoute: _exportRoute,
  deleteRoute: _deleteRoute,
  instanceRoute: _instanceRoute,

  createLink,
  createTitle = 'Create record',
  searchPlaceholder = 'Ask a specific question in natural language to filter the records',

  defaultItems: _defaultItems,
  defaultCursor = null,
  defaultTotalCount = null,
  defaultHasMore = true,

  recordMaxTokens = 4096,

  loadMore = true,
  filter = false,
  searchEnabled = true,

  ...props
}) {
  const listRoute = useMemo(() => {
    return _listRoute || `/api/v1/dataset/${datasetId}/record/list`
  }, [_listRoute, datasetId])

  const searchRoute = useMemo(() => {
    return _searchRoute || `/api/v1/dataset/${datasetId}/search`
  }, [_searchRoute, datasetId])

  const exportRoute = useMemo(() => {
    return _exportRoute || `/api/v1/dataset/${datasetId}/record/export`
  }, [_exportRoute, datasetId])

  const deleteRoute = useMemo(() => {
    return _deleteRoute || `/api/v1/dataset/${datasetId}/record/[id]/delete`
  }, [_deleteRoute, datasetId])

  const instanceRoute = useMemo(() => {
    return _instanceRoute || `/datasets/${datasetId}/records/[id]`
  }, [_instanceRoute, datasetId])

  const [items, setItems] = useState(_defaultItems || [])

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 1000)
  const normalizedSearch = debouncedSearch.trim()

  const { fetch } = useFetch({
    loadingMessage: false,
    failureMessage: true,
  })

  const apiRef = useRef(null)

  const previousSearchRef = useRef(normalizedSearch)

  useEffect(() => {
    if (previousSearchRef.current === normalizedSearch) {
      return
    }

    previousSearchRef.current = normalizedSearch

    apiRef.current?.reset?.()
  }, [normalizedSearch])

  const listRouteFn = useCallback(
    async ({ cursor, take = 10, order = 'desc' }) => {
      if (normalizedSearch) {
        const { error, data } = await fetch(searchRoute, {
          data: {
            search: normalizedSearch,
          },
        })

        if (error) {
          return []
        }

        return data?.records || []
      }

      const url = new URL(listRoute, 'https://chatbotkit.com')

      if (cursor) {
        url.searchParams.append('cursor', cursor)
      }

      url.searchParams.append('take', String(take))
      url.searchParams.append('order', order)

      const { error, data } = await fetch(url.pathname + url.search)

      if (error) {
        return {
          items: [],
          cursor: null,
        }
      }

      return {
        items: data?.items || [],
        cursor: 'cursor' in (data || {}) ? data.cursor || null : null,
      }
    },
    [normalizedSearch, fetch, searchRoute, listRoute]
  )

  const { popup, openPopup } = usePopup()

  const extraButtons = useMemo(() => {
    return {
      'Quick Edit':
        ({ id, text }) =>
        () => {
          openPopup(<QuickEdit text={text} maxTokens={recordMaxTokens} />, {
            title: 'Quick Edit',
            actions: {
              Save: {
                default: true,
                async fn(options) {
                  const { error } = await fetch(
                    `/api/v1/dataset/${datasetId}/record/${id}/update`,
                    {
                      data: {
                        ...options,
                      },
                    }
                  )

                  if (error) {
                    return
                  }

                  setItems((previousItems) => {
                    return previousItems.map((item) => {
                      if (item.id === id) {
                        return {
                          ...item,
                          text: options.text,
                        }
                      }

                      return item
                    })
                  })
                },
              },
            },
          })
        },
    }
  }, [openPopup, recordMaxTokens, fetch, datasetId])

  const nameMapper = useCallback((item) => {
    return item.id
  }, [])

  const descriptionMapper = useCallback((item) => {
    return item?.text ? (
      <span className="notranslate line-clamp-6">{item.text}</span>
    ) : (
      <span className="italic">A record without text</span>
    )
  }, [])

  const extraTags = useCallback((item) => {
    return (
      <>
        {/* @note expiry is rendered generically by ResourceList */}
        {item?.meta?.integration ? (
          <div className="tag">{item.meta.integration}</div>
        ) : null}
        {item?.source ? (
          <div title={`Source: ${item.source}`}>
            {/^https?:\/\//i.test(item.source) ? (
              <Link href={item.source} target="_blank" rel="noreferrer">
                <MdOutlineInsertLink className="w-5 h-5 default-link" />
              </Link>
            ) : (
              <span className="pointer-none">
                <MdOutlineInsertLink className="w-5 h-5" />
              </span>
            )}
          </div>
        ) : null}
      </>
    )
  }, [])

  const effectiveCreateLink = useMemo(() => {
    return createLink || `/datasets/${datasetId}/records/new`
  }, [createLink, datasetId])

  return (
    <div className="space-y-3">
      {searchEnabled ? (
        <AutoTextarea
          className="default-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
        />
      ) : null}
      <ResourceList
        {...props}
        apiRef={apiRef}
        kind={kind}
        listRoute={listRouteFn}
        exportRoute={exportRoute}
        deleteRoute={deleteRoute}
        instanceRoute={instanceRoute}
        filter={filter}
        loadMore={normalizedSearch ? false : loadMore}
        trailingActions={
          effectiveCreateLink ? (
            <Link className="text-sm default-link" href={effectiveCreateLink}>
              {createTitle}
            </Link>
          ) : null
        }
        defaultItems={_defaultItems || []}
        items={items}
        setItems={setItems}
        defaultCursor={defaultCursor}
        defaultTotalCount={defaultTotalCount}
        defaultHasMore={defaultHasMore}
        nameMapper={nameMapper}
        descriptionMapper={descriptionMapper}
        extraButtons={extraButtons}
        extraTags={extraTags}
        extraGlobalRoot={popup}
      />
    </div>
  )
}
