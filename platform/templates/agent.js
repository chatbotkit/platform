// @ts-check
import { MdAccountTree } from 'react-icons/md'

// @ts-ignore
import examplesData from '@/examples/catalogue/blueprints.yaml?lookupKey=slug&lookupValue=blueprint-starter'

const starterExample = examplesData[0]

/**
 * @type {import('./index').Template}
 */
export const template = {
  templateId: 'ai-agent',
  icon: '🧩',
  Icon: MdAccountTree,
  templateName: 'Multi-Agent System',
  templateDescription:
    'Design a general-purpose, multi-agent system on a visual blueprint - compose agents, tools, and data, then wire them together in the designer.',

  steps: ['/new', '/new/details'],

  options: {},

  values: {},

  task: async ({ values, fetch }) => {
    const { error: cloneError, data: cloneData } = await fetch(
      `/api/v1/platform/example/${starterExample.slug}/clone`,
      {
        data: {},

        loadingMessage: 'Creating your multi-agent system...',
        failureMessage: true,
      }
    )

    if (cloneError) {
      return
    }

    if (cloneData.resources.blueprint?.[0]) {
      const blueprintId = cloneData.resources.blueprint[0].id

      if (values.name || values.description) {
        await fetch(`/api/v1/blueprint/${blueprintId}/update`, {
          data: {
            name: values.name || starterExample.title,
            description: values.description || starterExample.description,
          },

          loadingMessage: 'Updating blueprint details...',
        })
      }

      return {
        createdBlueprintId: blueprintId,
        createdBlueprintName:
          values.name ||
          cloneData.resources.blueprint[0].name ||
          starterExample.title,

        // @note the designer is a platform experience surface. The builder
        // experience never reaches it: pages/new/success.jsx redirects any
        // template that created a project to the project-scoped overview.
        successButtonAction: `/blueprints/${blueprintId}/designer`,
        successButtonCaption: 'Continue to your blueprint',
      }
    }
  },

  hidden: true,
}

export default template
