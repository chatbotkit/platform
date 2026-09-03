// @ts-check
import { MdGridView } from 'react-icons/md'

/**
 * @type {import('./index').Template}
 */
export const template = {
  templateId: 'example',
  icon: '📚',
  Icon: MdGridView,
  templateName: 'Ready-Made Solution',
  templateDescription:
    'Start from a proven agent, assistant or blueprint and make it your own.',

  steps: ['/new', '/new/examples', '/new/example'],

  options: {},

  values: {},

  init: async ({ query }) => {
    // @note deep links preselect an example (?template=example&example=<slug>)
    // and land straight on the confirm step, skipping the browse step
    if (query.example) {
      return { nextStep: '/new/example' }
    }
  },

  async task({ options, fetch }) {
    /** @type {import('@/examples').Example} */
    const example = options.example

    if (!example) {
      throw new Error('No example selected')
    }

    const { error: cloneError, data: cloneData } = await fetch(
      `/api/v1/platform/example/${example.slug}/clone`,
      {
        data: {},

        loadingMessage: 'Creating your example resources...',
        failureMessage: true,
      }
    )

    if (cloneError) {
      return
    }

    let successButtonAction
    let successButtonCaption

    // @note widget examples are wrapped in a blueprint on clone, but the
    // widget remains the deliverable - land on the widget integration page
    if (!example.blueprint && cloneData.resources.widgetIntegration?.[0]) {
      const widgetId = cloneData.resources.widgetIntegration[0].id

      successButtonAction = `/integrations/widget/${widgetId}`
      successButtonCaption = 'Continue to your widget'
    } else if (cloneData.resources.blueprint?.[0]) {
      const blueprint = cloneData.resources.blueprint[0]
      const blueprintId = blueprint.id

      // @note the designer is a platform experience surface. The builder
      // experience never reaches it: pages/new/success.jsx redirects any
      // template that created a project to the project-scoped overview.
      successButtonAction = `/blueprints/${blueprintId}/designer`
      successButtonCaption = 'Continue to your blueprint'
    } else if (cloneData.resources.widgetIntegration?.[0]) {
      const widgetId = cloneData.resources.widgetIntegration[0].id

      successButtonAction = `/integrations/widget/${widgetId}`
      successButtonCaption = 'Continue to your widget'
    } else if (
      Object.keys(cloneData.resources).some((key) =>
        key.endsWith('Integration')
      )
    ) {
      const integrationKey = Object.keys(cloneData.resources).find((key) =>
        key.endsWith('Integration')
      )

      if (integrationKey) {
        const integration = cloneData.resources[integrationKey][0]
        const integrationType = integrationKey.replace(/Integration$/, '')

        successButtonAction = `/integrations/${integrationType}/${integration.id}`
        successButtonCaption = `Continue to your ${integrationType} integration`
      }
    } else if (cloneData.resources.bot?.[0]) {
      const botId = cloneData.resources.bot[0].id

      successButtonAction = `/bots/${botId}#chat-with-this-bot`
      successButtonCaption = 'Continue to your agent'
    }

    return {
      createdBlueprintId: cloneData.resources.blueprint?.[0]?.id,
      createdBlueprintName: cloneData.resources.blueprint?.[0]?.name,

      successButtonAction,
      successButtonCaption,
    }
  },
}

export default template
