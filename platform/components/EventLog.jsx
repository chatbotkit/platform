'use client'

import { useCallback, useMemo } from 'react'

import availableEvents from '@/lib/event'
import { revalue } from '@/lib/object'

import { GlobalRootPortal } from '@/components/GlobalRoot'
import ObjectView from '@/components/ObjectView'
import ResourceList from '@/components/ResourceList'

import useInitial from '@/hooks/useInitial'
import usePopup from '@/hooks/usePopup'

import clsx from 'clsx'

export default function EventLog({
  listRoute: _listRoute,
  exportRoute: _exportRoute,

  eventTypes: _contextTypes = [],
  contextFilters: _contextFilters = {},

  filter = false,

  export: _export = true,

  ...props
}) {
  const eventTypes = useInitial(() => _contextTypes)
  const contextFilters = useInitial(() => _contextFilters)

  const { listRoute, exportRoute } = useMemo(() => {
    // @note build the list route URL with filters applied

    let listRoute = '/api/v1/event/log/list'
    let exportRoute = '/api/v1/event/log/export'

    const searchParams = new URLSearchParams()

    if (eventTypes.length) {
      searchParams.append('type', eventTypes.join(','))
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
  }, [_listRoute, _exportRoute, eventTypes, contextFilters])

  const extraTags = useCallback((item) => {
    return (
      <>
        <span
          className={clsx('tag', {
            warning: item.type.endsWith('.warning'),
            error: item.type.endsWith('.error'),
          })}
        >
          {item.type}
        </span>
      </>
    )
  }, [])

  const nameMapper = useCallback((item) => {
    if (item.name) {
      return item.name
    }

    const name = availableEvents.find((event) => event.type === item.type)?.name

    if (name) {
      return name
    }

    return item.id
  }, [])

  const descriptionMapper = useCallback((item) => {
    if (item.description) {
      return item.description
    }

    const description = availableEvents.find(
      (event) => event.type === item.type
    )?.description

    if (description) {
      return description
    }

    return <span className="italic">Event log entry without description</span>
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
        kind="event log"
        listRoute={listRoute}
        exportRoute={_export ? exportRoute : null}
        deleteRoute={null}
        instanceRoute={null}
        extraTags={extraTags}
        nameMapper={nameMapper}
        descriptionMapper={descriptionMapper}
        onItemClick={handleItemClick}
        filter={filter}
        refreshInterval={60_000}
      />
    </>
  )
}
