'use client'

import ResourceList from '@/components/ResourceList'

export default function WebhookList({
  kind = 'webhook',

  listRoute = '/api/v1/webhook/list',
  exportRoute = null, // '/api/v1/webhook/export',

  deleteRoute = '/api/v1/webhook/[id]/delete',

  instanceRoute = '/webhooks/[id]',

  filter = false,

  ...props
}) {
  return (
    <ResourceList
      {...props}
      kind={kind}
      listRoute={listRoute}
      exportRoute={exportRoute}
      deleteRoute={deleteRoute}
      instanceRoute={instanceRoute}
      filter={filter}
    />
  )
}
