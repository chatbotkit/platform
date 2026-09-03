'use client'

import { useMemo } from 'react'

import { useApp } from '@/layouts/App'

import { AppList, Scene } from './components'

export default function Page() {
  const { config } = useApp()

  const apps = useMemo(() => {
    if (config?.apps) {
      return Object.entries(config.apps)
        .filter(([, { hidden = false }]) => !hidden)
        .map(([slug, { name, description, icon, logo, banner, order }]) => {
          return {
            id: slug,
            slug: slug,
            name: name,
            description: description,
            icon: icon,
            logo: logo,
            banner: banner,
            order: order,
          }
        })
    } else {
      return undefined
    }
  }, [config])

  return (
    <div className="main-page main-page-3xl">
      <Scene collapsed={false} />
      <AppList apps={apps} />
    </div>
  )
}
