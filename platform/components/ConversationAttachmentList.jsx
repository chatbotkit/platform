'use client'

import { useMemo } from 'react'

import ResourceList from '@/components/ResourceList'

export default function ConversationAttachmentList({
  kind = 'attachment',

  conversationId,

  listRoute: _listRoute,

  exportRoute = null,

  deleteRoute = null,

  instanceRoute = null,

  filter = false,

  extraLinks: _extraLinks,
  extraTags: _extraTags,

  ...props
}) {
  const listRoute = useMemo(() => {
    return (
      _listRoute || `/api/v1/conversation/${conversationId}/attachment/list`
    )
  }, [_listRoute, conversationId])

  const extraLinks = useMemo(() => {
    return (
      _extraLinks ||
      (({ name }) => ({
        Download: `/api/v1/conversation/${conversationId}/attachment/${encodeURIComponent(
          name
        )}/download`,
      }))
    )
  }, [_extraLinks, conversationId])

  const extraTags = useMemo(() => {
    return (
      _extraTags ||
      (({ type, size }) => (
        <>
          {type ? <div className="tag">{type}</div> : null}
          {typeof size === 'number' ? (
            <div className="tag">{size.toLocaleString()} bytes</div>
          ) : null}
        </>
      ))
    )
  }, [_extraTags])

  return (
    <ResourceList
      {...props}
      kind={kind}
      listRoute={listRoute}
      exportRoute={exportRoute}
      deleteRoute={deleteRoute}
      instanceRoute={instanceRoute}
      filter={filter}
      nameMapper={({ name, id }) => name || id}
      extraLinks={extraLinks}
      extraTags={extraTags}
    />
  )
}
