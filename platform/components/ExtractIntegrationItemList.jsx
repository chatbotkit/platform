'use client'

import { useCallback, useMemo } from 'react'

import { revalue } from '@/lib/object'

import { GlobalRootPortal } from '@/components/GlobalRoot'
import ObjectView from '@/components/ObjectView'
import ResourceList from '@/components/ResourceList'

import usePopup from '@/hooks/usePopup'

export default function ExtractIntegrationItemList({
  integrationId,
  ...props
}) {
  const { listRoute, exportRoute } = useMemo(() => {
    return {
      listRoute: `/api/v1/integration/extract/${integrationId}/item/list`,

      exportRoute: `/api/v1/integration/extract/${integrationId}/item/export`,
    }
  }, [integrationId])

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

    return (
      <span className="italic">
        Extract integration item entry without description
      </span>
    )
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
        kind="extract integration item"
        listRoute={listRoute}
        exportRoute={exportRoute}
        deleteRoute={null}
        instanceRoute={null}
        filter={false}
        nameMapper={nameMapper}
        descriptionMapper={descriptionMapper}
        onItemClick={handleItemClick}
      />
    </>
  )
}
