import type { ReactNode } from 'react'

import { useMemo } from 'react'

interface ChildrenProps {
  children: ReactNode | ((props: Record<string, unknown>) => ReactNode)
  [key: string]: unknown
}

export default function Children({
  children: _children,
  ...props
}: ChildrenProps): ReactNode {
  const render = useMemo(() => {
    return typeof _children === 'function' ? _children : () => _children
  }, [_children])

  return render(props)
}
