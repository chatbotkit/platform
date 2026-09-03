import Expando from '@/components/Expando'
import ObjectView from '@/components/ObjectView'

import clsx from 'clsx'

export function Meta({ className, meta, ...props }) {
  return (
    <ObjectView
      className={clsx('text-xs', className)}
      object={meta}
      {...props}
    />
  )
}

export default function MetaArea({ instance, meta = instance?.meta }) {
  if (meta === null || meta === undefined) {
    return (
      <div className="py-4 text-sm italic auto-text-gray-500">
        No metadata available.
      </div>
    )
  }

  return (
    <Expando titleClassName="default-link text-sm" title="Meta Details">
      <Meta object={meta} />
    </Expando>
  )
}
