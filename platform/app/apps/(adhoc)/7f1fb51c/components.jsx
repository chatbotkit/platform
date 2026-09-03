'use client'

import 'swagger-ui-react/swagger-ui.css'

import dynamic from 'next/dynamic'

import { AppScene } from '@/layouts/App'

import manifest from './app.manifest'

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false })

export function Main() {
  // @todo use better ui for the api spec viewer

  return (
    <AppScene
      name={null}
      headline={manifest.name}
      description={manifest.description}
      className="py-6"
    >
      <div className="w-full [&_.information-container]:hidden">
        <SwaggerUI url="/api/v1/spec" />
      </div>
    </AppScene>
  )
}
