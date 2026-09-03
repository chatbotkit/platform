'use client'

import { use, useEffect, useState } from 'react'

import { useApp } from '@/layouts/App'

import { APP_NAME } from '../const'
import { getFactory } from '../server'

export default function Layout(props) {
  const params = use(props.params)

  const { children } = props

  const { factory } = params

  const { setSidebarItems } = useApp()

  const [name, setName] = useState(null)

  useEffect(() => {
    let live = true

    getFactory({ factory })
      .then((r) => {
        if (live && r && !('error' in r)) {
          setName(r.name)
        }
      })
      .catch(() => {})

    return () => {
      live = false
    }
  }, [factory])

  useEffect(() => {
    setSidebarItems([
      {
        title: 'All factories',
        href: `/apps/${APP_NAME}`,
        icon: '@lucide/grid-2x2',
        exact: true,
      },
      {
        title: name || 'Factory',
        items: [
          {
            title: 'Tasks',
            href: `/apps/${APP_NAME}/${factory}`,
            icon: '@lucide/list-checks',
            exact: true,
          },
          {
            title: 'Playbooks',
            href: `/apps/${APP_NAME}/${factory}/playbooks`,
            icon: '@lucide/book-open',
            exact: true,
          },
          {
            title: 'Settings',
            href: `/apps/${APP_NAME}/${factory}/settings`,
            icon: '@lucide/settings',
            exact: true,
          },
        ],
        expanded: true,
        collapsible: false,
      },
    ])
  }, [factory, name, setSidebarItems])

  return children
}
