'use client'

import { AppScene } from '@/layouts/App'

export function Main() {
  return (
    <AppScene
      name="Customize"
      headline="Customize Your Experience"
      description="Create agents, manage datasets, build skillsets, and configure settings to tailor your conversational AI experience."
      benefits={[
        {
          icon: '@lucide/bot',
          description: (
            <>
              <strong>Build custom AI agents</strong> with specific
              personalities, knowledge, and capabilities tailored to your needs.
            </>
          ),
        },
        {
          icon: '@lucide/database',
          description: (
            <>
              Upload and <strong>organize your data</strong> to enhance your AI
              agents with domain-specific knowledge.
            </>
          ),
        },
        {
          icon: '@lucide/box',
          description: (
            <>
              Create skillsets to <strong>extend your agents</strong> with
              custom functions, integrations, and specialized capabilities.
            </>
          ),
        },
        {
          icon: '@lucide/settings',
          description: (
            <>
              <strong>Configure models, parameters, and integrations</strong> to
              optimize your conversational AI experience.
            </>
          ),
        },
        {
          icon: '@lucide/layout-grid',
          description: (
            <>
              <strong>Deploy custom portals</strong> with your own branding to
              create tailored conversational AI experiences for your enterprise.
            </>
          ),
        },
      ]}
    />
  )
}
