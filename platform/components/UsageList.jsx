'use client'

import { useCallback, useMemo } from 'react'

import { revalue } from '@/lib/object'

import { GlobalRootPortal } from '@/components/GlobalRoot'
import ObjectView from '@/components/ObjectView'
import ResourceList from '@/components/ResourceList'

import useInitial from '@/hooks/useInitial'
import usePopup from '@/hooks/usePopup'

export default function UsageList({
  listRoute: _listRoute,
  exportRoute: _exportRoute,

  usageTypes: _usageTypes = [],
  contextFilters: _contextFilters = {},

  filter = false,

  export: _export = true,

  ...props
}) {
  const usageTypes = useInitial(() => _usageTypes)
  const contextFilters = useInitial(() => _contextFilters)

  const { listRoute, exportRoute } = useMemo(() => {
    // @note build the list route URL with filters applied

    let listRoute = '/api/v1/usage/list'
    let exportRoute = '/api/v1/usage/export'

    const searchParams = new URLSearchParams()

    if (usageTypes.length) {
      searchParams.append('type', usageTypes.join(','))
    }

    Object.entries(contextFilters).forEach(([field, value]) => {
      searchParams.append(field, value)
    })

    if (searchParams.toString()) {
      listRoute += '?' + searchParams.toString()
      exportRoute += '?' + searchParams.toString()
    }

    return {
      listRoute: _listRoute || listRoute,
      exportRoute: _exportRoute || exportRoute,
    }
  }, [_listRoute, _exportRoute, usageTypes, contextFilters])

  const extraTags = useCallback((item) => {
    return (
      <>
        <span className="tag">count: {item.count}</span>
        {item.meta?.reason ? (
          <span className="tag">{item.meta.reason}</span>
        ) : null}
        {item.meta?.ipAddress ? (
          <span className="tag">{item.meta.ipAddress}</span>
        ) : null}
      </>
    )
  }, [])

  const nameMapper = useCallback((item) => {
    if (item.name) {
      return item.name
    }

    return item.type
  }, [])

  const descriptionMapper = useCallback((item) => {
    if (item.description) {
      return item.description
    }

    return <span className="italic">Usage record without description</span>
  }, [])

  const { popup, openPopup } = usePopup()

  const handleItemClick = useCallback(
    (item) => {
      openPopup(
        <ObjectView
          className="text-xs max-h-96"
          object={revalue(item, null)}
        />,
        {
          title: nameMapper(item),
          description: descriptionMapper(item),
          cancelButtonCaption: 'Close',
        }
      )
    },
    [openPopup, nameMapper, descriptionMapper]
  )

  return (
    <>
      <GlobalRootPortal>{popup}</GlobalRootPortal>
      <ResourceList
        {...props}
        kind="usage record"
        listRoute={listRoute}
        exportRoute={_export ? exportRoute : null}
        deleteRoute={null}
        instanceRoute={null}
        extraTags={extraTags}
        nameMapper={nameMapper}
        descriptionMapper={descriptionMapper}
        onItemClick={handleItemClick}
        filter={filter}
        autoLoad
        refreshInterval={60_000}
      />
    </>
  )
}
