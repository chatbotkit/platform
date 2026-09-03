'use client'

import { AppScene } from '@/layouts/App'

import List from '@/components/List'

import manifest from './app.manifest'
import { APP_NAME } from './const'

export function Main({ blueprints }) {
  return (
    <AppScene
      name={null}
      headline="Blueprint"
      description={manifest.description}
      className="py-6"
    >
      <List emptyMessage="No blueprints found.">
        {blueprints.map((blueprint) => (
          <List.Item
            key={blueprint.id}
            link={`/apps/${APP_NAME}/${blueprint.id}`}
            title={blueprint.name || blueprint.id}
            body={blueprint.description || 'No description'}
            timestamp={blueprint.updatedAt || blueprint.createdAt}
            className="cursor-pointer"
          />
        ))}
      </List>
    </AppScene>
  )
}
