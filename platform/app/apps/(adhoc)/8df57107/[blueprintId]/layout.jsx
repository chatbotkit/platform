'use client'

import { use, useEffect, useState } from 'react'

import toast from '@/lib/toast'

import { AppNavTitle, useApp } from '@/layouts/App'

import { initializeBlueprintResources } from '../server'
import { WidgetInfobar } from './components'
import { BlueprintContext } from './context'

export default function Layout(props) {
  const params = use(props.params)

  const { children } = props

  const { blueprintId } = params

  const { setSidebarItems } = useApp()

  const [resources, setResources] = useState(null)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadResources() {
      setLoading(true)

      try {
        const result = await initializeBlueprintResources({ blueprintId })

        if (!result) {
          toast.error('Failed to load resources')

          return
        }

        if ('error' in result) {
          toast.error(result.error.message)

          return
        }

        setResources(result)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to load resources'
        )
      } finally {
        setLoading(false)
      }
    }

    loadResources()
  }, [blueprintId])

  useEffect(() => {
    setSidebarItems([
      {
        title: 'Navigation',
        items: [
          {
            title: 'Projects',
            href: `/apps/8df57107`,
            icon: '@lucide/folder',
            exact: true,
          },
        ],
        expanded: true,
        collapsible: false,
      },
      {
        title: 'Configuration',
        items: [
          {
            title: 'Configuration',
            href: `/apps/8df57107/${blueprintId}`,
            icon: '@lucide/settings',
            exact: true,
          },
        ],
        expanded: true,
        collapsible: false,
      },
      {
        title: 'Sources',
        items: [
          {
            title: 'Files',
            href: `/apps/8df57107/${blueprintId}/files`,
            icon: '@lucide/file',
          },
          {
            title: 'Websites',
            href: `/apps/8df57107/${blueprintId}/sitemaps`,
            icon: '@lucide/globe',
          },
        ],
        expanded: true,
        collapsible: false,
      },
    ])
  }, [blueprintId, setSidebarItems])

  if (loading || !resources) {
    return null
  }

  const { blueprint, bot, dataset, widget, allowedModels } = resources

  return (
    <BlueprintContext.Provider
      value={{ blueprint, bot, dataset, widget, allowedModels }}
    >
      {blueprint?.name && <AppNavTitle>{blueprint.name}</AppNavTitle>}
      <WidgetInfobar widget={widget} />
      {children}
    </BlueprintContext.Provider>
  )
}
