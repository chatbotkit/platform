// @ts-check
import botsConfig from '@/config/bots'

import { icons } from '@/lib/integration.items'

/**
 * @type {import('./index').Template}
 */
export const template = {
  templateId: 'widget-agent',
  icon: '🌐',
  Icon: icons.sitemap,
  templateName: 'Website Agent',
  templateDescription:
    'Deploy an AI agent on your website that learns from your content and answers visitor questions through an embeddable chat widget.',

  steps: ['/new', '/new/details', '/new/website'],

  options: {
    website: {
      optional: true,
    },
  },

  values: {},

  task: async ({ values, fetch }) => {
    const { error: blueprintError, data: blueprintData } = await fetch(
      `/api/v1/blueprint/create`,
      {
        data: {
          name: values.name,
          description: values.description,
        },
        loadingMessage: 'Creating blueprint...',
        failureMessage: true,
      }
    )

    if (blueprintError) {
      throw new Error(blueprintError)
    }

    const { error: createSkillsetError, data: createSkillsetData } =
      await fetch(`/api/v1/skillset/create`, {
        data: {
          blueprintId: blueprintData.id,

          name: values.name,
          description: values.description,
        },
        loadingMessage: 'Creating skillset...',
        failureMessage: true,
      })

    if (createSkillsetError) {
      throw new Error(createSkillsetError)
    }

    // @note the website step is optional - without a URL there is nothing to
    // crawl, so the knowledge base is left out and the agent ships with its
    // skillset alone
    let datasetId

    if (values.websiteURL) {
      const { error: createDatasetError, data: createDatasetData } =
        await fetch(`/api/v1/dataset/create`, {
          data: {
            blueprintId: blueprintData.id,

            name: values.name,
            description: values.description,
          },
          loadingMessage: 'Creating dataset...',
          failureMessage: true,
        })

      if (createDatasetError) {
        throw new Error(createDatasetError)
      }

      const {
        error: createSitemapIntegrationError,
        data: createSitemapIntegrationData,
      } = await fetch(`/api/v1/integration/sitemap/create`, {
        data: {
          blueprintId: blueprintData.id,

          name: values.name,
          description: values.description,

          datasetId: createDatasetData.id,
          url: values.websiteURL,
        },
        loadingMessage: 'Creating sitemap integration...',
        failureMessage: true,
      })

      if (createSitemapIntegrationError) {
        throw new Error(createSitemapIntegrationError)
      }

      const { error: syncSitemapIntegrationError } = await fetch(
        `/api/v1/integration/sitemap/${createSitemapIntegrationData.id}/sync`,
        {
          data: {},
          loadingMessage: 'Syncing sitemap...',
          failureMessage: true,
        }
      )

      if (syncSitemapIntegrationError) {
        throw new Error(syncSitemapIntegrationError)
      }

      datasetId = createDatasetData.id
    }

    const { error: createBotError, data: createBotData } = await fetch(
      `/api/v1/bot/create`,
      {
        data: {
          blueprintId: blueprintData.id,

          name: values.name,
          description: values.description,

          backstory: botsConfig.defaultBackstory,

          datasetId: datasetId,
          skillsetId: createSkillsetData.id,
        },
        loadingMessage: 'Creating bot...',
        failureMessage: true,
      }
    )

    if (createBotError) {
      throw new Error(createBotError)
    }

    const { error: widgetIntegrationError, data: widgetIntegrationData } =
      await fetch(`/api/v1/integration/widget/create`, {
        data: {
          blueprintId: blueprintData.id,

          name: values.name,
          description: values.description,

          botId: createBotData.id,

          theme: '@examples/ai-answers', // @todo add proper types to this name
        },
        loadingMessage: 'Creating widget integration...',
        failureMessage: true,
      })

    if (widgetIntegrationError) {
      throw new Error(widgetIntegrationError)
    }

    return {
      createdBlueprintId: blueprintData.id,
      createdBlueprintName: values.name || 'Untitled',

      successMessage:
        'Go ahead and click the button below to complete the setup and configuration of your Website Agent.',
      successButtonAction: `/integrations/widget/${widgetIntegrationData.id}`,
      successButtonCaption: 'Continue to your Website Agent',
    }
  },
}

export default template
