'use client'

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

import { timeAgo } from '@chatbotkit-dev/time'

import { getLast } from '@/lib/array'
import { captureError, captureException } from '@/lib/error'
import { revalue } from '@/lib/object'

import { useConfirmDeleteWithOptions } from '@/components/Confirm'
import DotsLoader from '@/components/DotsLoader'
import DynamicIcon from '@/components/DynamicIcon'
import ExportLink from '@/components/ExportLink'
import { GlobalRootPortal } from '@/components/GlobalRoot'
import List from '@/components/List'
import LoadMoreButton from '@/components/LoadMoreButton'
import ObjectView from '@/components/ObjectView'
import ResourceFilterButton from '@/components/ResourceFilterButton'

import useControlledState from '@/hooks/useControlledState'
import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'
import { usePublishResourceDeleted } from '@/hooks/useProjectScope'
import useRouter from '@/hooks/useRouter'
import useSession from '@/hooks/useSession'

import clsx from 'clsx'
import pluralize from 'pluralize'

export default function ResourceList({
  kind = 'item',

  listRoute,
  exportRoute,

  deleteRoute,

  // @note optional toggles shown in the delete confirmation dialog. Each is
  // `{ name, label, description?, default? }`; the selected values are merged
  // into the delete request body (or the deleteRoute function arguments).
  deleteOptions,

  instanceRoute,

  prefetch,
  forcePrefetch,
  forcePrefetchInterval,

  refreshInterval,

  // @note the page size for every load; both the REST list endpoints and the
  // GraphQL connections cap at 100 server-side
  take = 100,

  defaultItems: _defaultItems = [],
  items: _items,
  setItems: _setItems,

  defaultCursor: _defaultCursor = null,
  cursor: _cursor,
  setCursor: _setCursor,

  defaultSelectedItem: _defaultSelectedItem,
  selectedItem: _selectedItem,
  setSelectedItem: _setSelectedItem,

  filter = (_defaultItems?.length || _items?.length || 0) > 0,

  filterOptions,

  actions,

  trailingActions,

  autoLoad = false,

  // @note pass 'auto' to load the next page when the trigger scrolls into
  // view (the resource index pages do), true for an explicit button, or
  // false to disable pagination
  loadMore = true,

  loading: _loading = false,

  defaultTotalCount: _defaultTotalCount = null,
  totalCount: _totalCount,
  setTotalCount: _setTotalCount,

  defaultHasMore: _defaultHasMore = true,
  hasMore: _hasMore,
  setHasMore: _setHasMore,

  rememberSelection,

  onItemClick,

  apiRef,

  scrollContainerRef,

  deleteCaption = 'Delete',

  extraLinks,

  extraButtons,

  extraTags,

  extraGlobalRoot,

  // @note extra content and actions for the quick access popup, so a list can
  // let the reader act on what the row is telling them rather than sending them
  // to the instance page for it. Both take the item and may return nothing.
  extraQuickAccessContent,
  extraQuickAccessActions,

  iconMapper,
  nameMapper,
  descriptionMapper,

  quickAccess,

  openInNewWindow = false,

  ...props
}) {
  const router = useRouter()

  const { data: session } = useSession()

  const isAuthenticated = !!session?.user

  const confirmDelete = useConfirmDeleteWithOptions()

  const [items, setItems] = useControlledState(_defaultItems, _items, _setItems)

  const [totalCount, setTotalCount] = useControlledState(
    _defaultTotalCount,
    _totalCount,
    _setTotalCount
  )

  const [cursor, setCursor] = useControlledState(
    _defaultCursor,
    _cursor,
    _setCursor
  )

  const [selectedItem, setSelectedItem] = useControlledState(
    _defaultSelectedItem,
    _selectedItem,
    _setSelectedItem
  )

  const [hasMore, setHasMore] = useControlledState(
    _defaultHasMore,
    _hasMore,
    _setHasMore
  )

  // @note a short page implies exhaustion only for pages we fetched - the
  // fetch handlers below infer that. Default items from props may be an
  // intentionally small server prefetch, so their length says nothing about
  // the total.
  useEffect(() => {
    if (!hasMore) {
      setTotalCount(items.length)
    }
  }, [hasMore, items, setTotalCount])

  const cursorRef = useRef(null)

  {
    useEffect(() => {
      cursorRef.current = getLast(items)?.id
    }, [items])
  }

  const { fetch, loading, reportError } = useFetch({
    loadingMessage: false,
    failureMessage: true,
  })

  const publishResourceDeleted = usePublishResourceDeleted()

  const [functionLoading, setFunctionLoading] = useState(false)
  const [functionError, setFunctionError] = useState(null)

  const isLoading =
    !!_loading ||
    loading ||
    functionLoading ||
    (autoLoad && isAuthenticated && !items.length && hasMore && !functionError)

  const getLocationRoute = useCallback((route, item) => {
    if (!route) {
      return ''
    }

    return (
      typeof route === 'object' && route !== null
        ? route.fn?.(item) || ''
        : route
    ).replace?.('[id]', item?.id || '')
  }, [])

  const handleDelete = useCallback(
    async (itemId) => {
      if (!isAuthenticated) {
        return
      }

      const deleteValues = await confirmDelete(
        `Do you really want to ${deleteCaption.toLowerCase()} this ${kind}?`,
        deleteOptions ? { options: deleteOptions } : undefined
      )

      if (!deleteValues) {
        return
      }

      const oldTotalCount = totalCount
      const oldItems = items?.slice?.()

      if (oldTotalCount) {
        setTotalCount(oldTotalCount - 1)
      }

      if (oldItems) {
        setItems(oldItems.filter((item) => item.id !== itemId))
      }

      if (typeof deleteRoute === 'function') {
        try {
          await deleteRoute({ id: itemId, ...deleteValues })

          publishResourceDeleted({ kind, id: itemId })
        } catch (e) {
          await captureException(e)

          setTotalCount(oldTotalCount)
          setItems(oldItems)
        }
      } else {
        const { error } = await fetch(
          getLocationRoute(
            deleteRoute,
            items.find((item) => item.id === itemId) || { id: itemId }
          ),
          {
            data: { ...deleteValues },
          }
        )

        if (error) {
          await captureError(error)

          setTotalCount(oldTotalCount)
          setItems(oldItems)
        } else {
          publishResourceDeleted({ kind, id: itemId })
        }
      }
    },
    [
      isAuthenticated,
      confirmDelete,
      deleteCaption,
      deleteOptions,
      kind,
      totalCount,
      items,
      setTotalCount,
      setItems,
      deleteRoute,
      fetch,
      getLocationRoute,
      publishResourceDeleted,
    ]
  )

  const handleLoadMore = useCallback(async () => {
    if (!isAuthenticated) {
      return
    }

    const effectiveCursor = cursor || cursorRef.current

    if (typeof listRoute === 'function') {
      setFunctionError(null)
      setFunctionLoading(true)

      try {
        const response = await listRoute({
          cursor: effectiveCursor,
          take,
          order: 'desc',
        })

        const newItems = Array.isArray(response)
          ? response
          : response?.items || []
        const hasResponseCursor =
          !Array.isArray(response) && 'cursor' in (response || {})

        if (hasResponseCursor) {
          const nextCursor = response.cursor || null

          setCursor(nextCursor)

          if (!nextCursor) {
            setHasMore(false)
          }
        } else if (newItems.length < take) {
          // @note without a cursor in the response the page size is the only
          // exhaustion signal - a short page means nothing is left. When the
          // response carries a cursor, the cursor is authoritative
          setHasMore(false)
        }

        setItems((prev) => [
          ...prev,
          ...newItems.filter(
            (item) => !prev.some((existing) => existing.id === item.id)
          ),
        ])
      } catch (e) {
        await captureException(e)
        await reportError(e)
        setFunctionError(e)
      } finally {
        setFunctionLoading(false)
      }
    } else {
      const url = new URL(getLocationRoute(listRoute), 'https://chatbotkit.com')

      if (effectiveCursor) {
        url.searchParams.append('cursor', effectiveCursor)
      }

      url.searchParams.append('take', String(take))
      url.searchParams.append('order', 'desc')

      const { error, data } = await fetch(url.pathname + url.search)

      if (!error) {
        const { items: newItems } = data

        const hasResponseCursor = 'cursor' in (data || {})

        if (hasResponseCursor) {
          const nextCursor = data.cursor || null

          setCursor(nextCursor)

          if (!nextCursor) {
            setHasMore(false)
          }
        } else if (newItems.length < take) {
          // @note without a cursor in the response the page size is the only
          // exhaustion signal - a short page means nothing is left. When the
          // response carries a cursor, the cursor is authoritative
          setHasMore(false)
        }

        setItems((prev) => [
          ...prev,
          ...newItems.filter(
            (item) => !prev.some((existing) => existing.id === item.id)
          ),
        ])
      }
    }
  }, [
    listRoute,
    cursor,
    setCursor,
    setHasMore,
    setItems,
    isAuthenticated,
    getLocationRoute,
    fetch,
    reportError,
    take,
  ])

  useImperativeHandle(apiRef, () => {
    const api = {
      async reset() {
        if (!isAuthenticated) {
          return
        }

        if (typeof listRoute === 'function') {
          setFunctionError(null)
          setFunctionLoading(true)

          try {
            const response = await listRoute({
              take,
              order: 'desc',
            })

            const items = Array.isArray(response)
              ? response
              : response?.items || []

            const hasResponseCursor =
              !Array.isArray(response) && 'cursor' in (response || {})
            const nextCursor = hasResponseCursor
              ? response.cursor || null
              : null

            setCursor(nextCursor)
            setHasMore(hasResponseCursor ? !!nextCursor : items.length >= take)
            setItems(items)
          } catch (e) {
            await captureException(e)
            await reportError(e)

            setFunctionError(e)
          } finally {
            setFunctionLoading(false)
          }
        } else {
          const url = new URL(listRoute, 'https://chatbotkit.com')

          url.searchParams.append('take', String(take))
          url.searchParams.append('order', 'desc')

          const { error, data } = await fetch(url.pathname + url.search)

          if (!error) {
            const { items } = data

            const hasResponseCursor = 'cursor' in (data || {})
            const nextCursor = hasResponseCursor ? data.cursor || null : null

            setCursor(nextCursor)
            setHasMore(hasResponseCursor ? !!nextCursor : items.length >= take)
            setItems(items)
          }
        }
      },
    }

    // @note store internal reference for refresh interval

    apiRefInternal.current = api

    return api
  }, [
    listRoute,
    isAuthenticated,
    fetch,
    reportError,
    setItems,
    setHasMore,
    setCursor,
    take,
  ])

  // @note autoLoad should only trigger initial load once. We track success via
  // items.length rather than a ref, so we retry if auth wasn't ready initially.
  // We use a ref to prevent concurrent autoLoad calls during the same render.

  const autoLoadingRef = useRef(false)

  useEffect(() => {
    if (!autoLoad) {
      return
    }

    // Already have items - no need to auto-load

    if (items.length > 0) {
      return
    }

    // Wait for authentication before attempting to load

    if (!isAuthenticated) {
      return
    }

    // Prevent concurrent auto-load calls

    if (autoLoadingRef.current) {
      return
    }

    autoLoadingRef.current = true

    handleLoadMore().finally(() => {
      autoLoadingRef.current = false
    })
  }, [autoLoad, handleLoadMore, items.length, isAuthenticated])

  const apiRefInternal = useRef()

  useEffect(() => {
    if (!refreshInterval || !apiRefInternal.current) {
      return
    }

    const intervalId = setInterval(() => {
      apiRefInternal.current.reset()
    }, refreshInterval)

    return () => clearInterval(intervalId)
  }, [refreshInterval])

  const { popup, openPopup } = usePopup()

  const handleQuickAccess = useCallback(
    (item) => {
      const extraContent = extraQuickAccessContent?.(item)

      const extraActions = extraQuickAccessActions?.(item)

      const actions = {
        ...(deleteRoute
          ? {
              [deleteCaption]: {
                fn: async (_, { close }) => {
                  await handleDelete(item.id)

                  close()
                },
                danger: true,
              },
            }
          : null),

        ...extraActions,

        ...(instanceRoute
          ? {
              Open: {
                fn: async (_, { close }) => {
                  if (typeof instanceRoute === 'function') {
                    await instanceRoute(item)
                  } else if (openInNewWindow) {
                    window.open(getLocationRoute(instanceRoute, item), '_blank')
                  } else {
                    router.push(getLocationRoute(instanceRoute, item))
                  }

                  close()
                },
                default: true,
              },
            }
          : null),
      }

      const objectView = (
        <ObjectView className="text-xs max-h-96" object={revalue(item, null)} />
      )

      openPopup(
        extraContent ? (
          <div className="space-y-4">
            {extraContent}
            {objectView}
          </div>
        ) : (
          objectView
        ),
        {
          title: nameMapper?.(item) || item.name || item.id,
          description: descriptionMapper?.(item) || item.description,

          cancelButtonCaption: 'Close',

          actions: Object.keys(actions).length ? actions : undefined,
        }
      )
    },
    [
      openPopup,

      nameMapper,
      descriptionMapper,

      deleteCaption,

      instanceRoute,
      deleteRoute,

      extraQuickAccessContent,
      extraQuickAccessActions,

      handleDelete,

      getLocationRoute,

      router,

      openInNewWindow,
    ]
  )

  return (
    <>
      <GlobalRootPortal>
        {popup}
        {extraGlobalRoot}
      </GlobalRootPortal>
      <List
        {...props}
        emptyMessage={
          functionError ? (
            <span>
              Unable to load {pluralize(kind, 2)}.
              <button
                className="default-link ml-1"
                type="button"
                onClick={handleLoadMore}
              >
                Try again
              </button>
            </span>
          ) : isLoading ? (
            `Loading...`
          ) : (
            `You do not have any ${pluralize(kind, 2)} yet.`
          )
        }
        leadingActions={actions}
        actions={
          trailingActions || filter || exportRoute ? (
            <>
              {trailingActions}
              {filter ? (
                <ResourceFilterButton filterOptions={filterOptions} />
              ) : null}
              {exportRoute ? (
                <ExportLink
                  className="text-sm default-link"
                  path={getLocationRoute(exportRoute)}
                  title={`Export ${pluralize(kind, 2)}`}
                  description={`Export all ${pluralize(
                    kind,
                    2
                  )} using one of the available formats below.`}
                  name={pluralize(kind, 2)}
                />
              ) : null}
            </>
          ) : null
        }
      >
        {items?.map((item) => {
          const {
            id,
            icon,
            name,
            description,
            backstory,
            createdAt,
            expiresAt,
            meta,
          } = item

          // @note apply custom mappers if provided, otherwise use original values

          const displayIcon = iconMapper ? iconMapper(item) : icon

          const displayName = nameMapper
            ? nameMapper(item)
            : name || backstory || id

          const displayDescription = descriptionMapper
            ? descriptionMapper(item)
            : description || (
                <span className="italic">A {kind} without description</span>
              )

          return (
            <List.Item
              key={id}
              className={clsx({
                selected: selectedItem === item.id,
              })}
              link={
                onItemClick ||
                !instanceRoute ||
                typeof instanceRoute === 'function' ||
                quickAccess
                  ? null
                  : getLocationRoute(instanceRoute, item)
              }
              prefetch={prefetch}
              forcePrefetch={forcePrefetch}
              forcePrefetchInterval={forcePrefetchInterval}
              icon={
                displayIcon ? (
                  <DynamicIcon
                    className="w-12 h-12 rounded-md"
                    icon={displayIcon}
                  />
                ) : null
              }
              title={displayName}
              body={displayDescription}
              timestamp={createdAt}
              onClick={
                rememberSelection ||
                onItemClick ||
                quickAccess ||
                typeof instanceRoute === 'function'
                  ? (event) => {
                      if (rememberSelection) {
                        setSelectedItem(item.id)
                      }

                      if (onItemClick) {
                        onItemClick(item)
                      }

                      if (typeof instanceRoute === 'function') {
                        event.preventDefault()
                        event.stopPropagation()

                        instanceRoute(item)

                        return
                      }

                      if (quickAccess) {
                        event.preventDefault()
                        event.stopPropagation()

                        handleQuickAccess(item)

                        return
                      }
                    }
                  : undefined
              }
              actions={{
                // extra links

                ...(typeof extraLinks === 'function'
                  ? extraLinks(item)
                  : Object.entries(extraLinks || {}).reduce(
                      (acc, [name, href]) => {
                        if (typeof href === 'function') {
                          href = href(item)
                        }

                        if (!href) {
                          return acc
                        }

                        acc[name] = () => {
                          switch (true) {
                            case typeof href === 'string': {
                              if (/^https?:\/\/|\//i.test(href)) {
                                window.open(href.replace('[id]', id), '_blank')
                              }

                              break
                            }

                            case typeof href === 'function': {
                              href(item)

                              break
                            }
                          }
                        }

                        return acc
                      },
                      {}
                    )),

                // extra buttons

                ...(typeof extraButtons === 'function'
                  ? extraButtons(item)
                  : Object.entries(extraButtons || {}).reduce(
                      (acc, [name, button]) => {
                        if (typeof button === 'function') {
                          button = button(item)
                        }

                        if (!button) {
                          return acc
                        }

                        acc[name] = button

                        return acc
                      },
                      {}
                    )),

                // edit

                ...(instanceRoute
                  ? {
                      Edit: () => {
                        if (typeof instanceRoute === 'function') {
                          instanceRoute(item)
                        } else if (openInNewWindow) {
                          window.open(
                            getLocationRoute(instanceRoute, item),
                            '_blank'
                          )
                        } else {
                          window.location.href = getLocationRoute(
                            instanceRoute,
                            item
                          )
                        }
                      },
                    }
                  : undefined),

                // delete

                ...(deleteRoute
                  ? { [deleteCaption]: () => handleDelete(id) }
                  : undefined),
              }}
            >
              {/* app */}
              {meta?.app ? <div className="tag">{meta.app}</div> : null}
              {/* moderation */}
              {meta?.abuse?.flagged ? (
                meta.abuse.categories?.length ? (
                  meta.abuse.categories.map((category) => (
                    <div className="tag warning" key={category}>
                      {category}
                    </div>
                  ))
                ) : (
                  <div className="tag">flagged</div>
                )
              ) : null}
              {/* extract integration */}
              {meta?.integrations?.extract ? (
                meta?.integrations?.extract.flagged ? (
                  <div className="tag">
                    {meta.integrations.extract.flagged === true
                      ? 'flagged'
                      : meta.integrations.extract.flagged}
                  </div>
                ) : null
              ) : null}
              {/* expiry - generic across any resource that carries an
              expiresAt (task, memory, conversation, dataset record, ...) */}
              {expiresAt ? (
                <div className="tag" title={`Expires ${timeAgo(expiresAt)}`}>
                  expires {timeAgo(expiresAt)}
                </div>
              ) : null}
              {/* extra tags */}
              {typeof extraTags === 'function'
                ? extraTags(item)
                : typeof extraTags === 'object' && extraTags !== null
                  ? Object.entries(extraTags).map(([name, value]) => (
                      <div className="tag" key={name}>
                        {typeof value === 'function' ? value(item) : value}
                      </div>
                    ))
                  : extraTags}
            </List.Item>
          )
        })}
      </List>
      <div className="flex flex-row text-sm items-center gap-2">
        {totalCount ? (
          <div className="tag">
            <span className="font-semibold">{totalCount}</span>&nbsp;
            {pluralize(kind, totalCount)} in total
          </div>
        ) : null}
        <div className="flex-1" />
        {loadMore &&
        items.length &&
        (totalCount ? items.length < totalCount : items.length >= take) ? (
          <LoadMoreButton
            className="default-link text-sm"
            loadingClassName="!no-underline"
            hasMore={hasMore}
            loadMore={handleLoadMore}
            autoLoad={loadMore === 'auto'}
            scrollContainerRef={scrollContainerRef}
          >
            {({ isLoading }) => (
              <span
                className={clsx({
                  'animation-pulse': isLoading,
                })}
              >
                {isLoading ? <DotsLoader /> : 'Load more'}
              </span>
            )}
          </LoadMoreButton>
        ) : null}
      </div>
    </>
  )
}
