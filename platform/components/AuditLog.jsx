'use client'

import { useCallback, useMemo } from 'react'

import { revalue } from '@/lib/object'

import { GlobalRootPortal } from '@/components/GlobalRoot'
import ObjectView from '@/components/ObjectView'
import ResourceList from '@/components/ResourceList'

import useInitial from '@/hooks/useInitial'
import usePopup from '@/hooks/usePopup'

export default function AuditLog({
  listRoute: _listRoute,
  exportRoute: _exportRoute,

  auditActions: _auditActions = [],
  contextFilters: _contextFilters = {},

  filter = false,

  export: _export = true,

  ...props
}) {
  const auditActions = useInitial(() => _auditActions)
  const contextFilters = useInitial(() => _contextFilters)

  const { listRoute, exportRoute } = useMemo(() => {
    // @note build the list route URL with filters applied

    let listRoute = '/api/v1/audit/log/list'
    let exportRoute = '/api/v1/audit/log/export'

    const searchParams = new URLSearchParams()

    if (auditActions.length) {
      searchParams.append('action', auditActions.join(','))
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
  }, [_listRoute, _exportRoute, auditActions, contextFilters])

  const extraTags = useCallback((item) => {
    return <span className="tag">{item.action}</span>
  }, [])

  const nameMapper = useCallback((item) => {
    if (item.name) {
      return item.name
    }

    return item.id
  }, [])

  const descriptionMapper = useCallback((item) => {
    if (item.description) {
      return item.description
    }

    return <span className="italic">Audit log entry without description</span>
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
        kind="audit log"
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
