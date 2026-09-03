'use client'

import NavHeader from '@/components/NavHeader'

import manifest from '../app.manifest'
import { APP_NAME } from '../const'
import Viewer from './viewer'

export function BlueprintDetail({
  blueprint,
  platformAbilitiesData,
  platformSecretsData,
}) {
  return (
    <div className="space-y-6">
      <NavHeader
        link={`/apps/${APP_NAME}`}
        caption={manifest.name.toLowerCase()}
        title={blueprint.name || blueprint.id}
      >
        <div>{blueprint.description || 'No description'}</div>
      </NavHeader>
      <div className="w-full h-[70vh] overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 md:w-[110%] md:ml-[-5%]">
        <Viewer
          blueprint={blueprint}
          platformAbilitiesData={platformAbilitiesData}
          platformSecretsData={platformSecretsData}
        />
      </div>
    </div>
  )
}
