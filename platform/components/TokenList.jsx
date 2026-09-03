'use client'

import ResourceList from '@/components/ResourceList'

export default function TokenList({
  kind = 'token',

  listRoute = '/api/v1/token/list',
  exportRoute = null, // '/api/v1/token/export',

  deleteRoute = '/api/v1/token/[id]/delete',

  instanceRoute = '/tokens/[id]',

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
