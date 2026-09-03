'use client'

import { useMemo } from 'react'

import Confirm from '@/components/Confirm'

import {
  BlueprintProvider,
  Canvas,
  MODE_PUBLIC_PREVIEW,
  ResourcesContext,
  buildAbilityResources,
  buildAllResources,
  buildNodeTypes,
  buildSecretResources,
} from '@/pages/blueprints/[blueprintId]/designer'

import { ReactFlowProvider } from '@xyflow/react'

export default function Viewer({
  blueprint,
  platformAbilitiesData = {},
  platformSecretsData = {},
}) {
  const abilityResources = useMemo(
    () => buildAbilityResources(platformAbilitiesData, platformSecretsData),
    [platformAbilitiesData, platformSecretsData]
  )

  const secretResources = useMemo(
    () => buildSecretResources(platformSecretsData),
    [platformSecretsData]
  )

  const allResources = useMemo(
    () => buildAllResources(abilityResources, secretResources),
    [abilityResources, secretResources]
  )

  const nodeTypes = useMemo(
    () => buildNodeTypes(allResources, abilityResources, secretResources),
    [allResources, abilityResources, secretResources]
  )

  const resourcesContext = useMemo(
    () => ({
      allResources,
      abilityResources,
      secretResources,
      nodeTypes,
      mode: MODE_PUBLIC_PREVIEW,
    }),
    [allResources, abilityResources, secretResources, nodeTypes]
  )

  return (
    <Confirm>
      <ReactFlowProvider>
        <ResourcesContext.Provider value={resourcesContext}>
          <BlueprintProvider blueprint={blueprint} disabled={true}>
            <Canvas className="w-full h-full" disabled={true} />
          </BlueprintProvider>
        </ResourcesContext.Provider>
      </ReactFlowProvider>
    </Confirm>
  )
}
