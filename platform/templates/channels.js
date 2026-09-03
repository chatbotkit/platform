// @ts-check
import botsConfig from '@/config/bots'

import { icons } from '@/lib/integration.items'

import { createBotIntegration } from './messaging'

/**
 * Builds a use-case template for a single messaging channel. Unlike the generic
 * messaging template, the channel is fixed up-front (so the channel-picker step
 * is skipped) and, once created, the user is sent straight to the integration
 * configuration page for that channel.
 *
 * @param {object} config
 * @param {string} config.templateId
 * @param {string} config.integration - the integration key understood by `createBotIntegration`
 * @param {string} config.icon - emoji fallback used where a component icon cannot render
 * @param {any} config.Icon - brand icon component rendered in the template gallery
 * @param {string} config.templateName
 * @param {string} config.templateDescription
 * @returns {import('./index').Template}
 */
function createChannelTemplate({
  templateId,
  integration,
  icon,
  Icon,
  templateName,
  templateDescription,
}) {
  return {
    templateId,
    icon,
    Icon,
    templateName,
    templateDescription,

    steps: ['/new', '/new/details'],

    options: {},

    values: {
      integration,
    },

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

      const { error: createBotError, data: createBotData } = await fetch(
        `/api/v1/bot/create`,
        {
          data: {
            blueprintId: blueprintData.id,

            name: values.name,
            description: values.description,

            backstory: botsConfig.defaultBackstory,

            skillsetId: createSkillsetData.id,
          },
          loadingMessage: 'Creating bot...',
          failureMessage: true,
        }
      )

      if (createBotError) {
        throw new Error(createBotError)
      }

      const result = await createBotIntegration(fetch, {
        ...values,

        blueprintId: blueprintData.id,

        botId: createBotData.id,
      })

      return {
        ...result,

        createdBlueprintId: blueprintData.id,
        createdBlueprintName: values.name || 'Untitled',
      }
    },
  }
}

export const slack = createChannelTemplate({
  templateId: 'slack-agent',
  integration: 'slack',
  icon: '💬',
  Icon: icons.slack,
  templateName: 'Slack Agent',
  templateDescription:
    'Bring an AI agent into your Slack workspace to answer questions and automate tasks for your team.',
})

export const telegram = createChannelTemplate({
  templateId: 'telegram-agent',
  integration: 'telegram',
  icon: '✈️',
  Icon: icons.telegram,
  templateName: 'Telegram Agent',
  templateDescription:
    'Set up a personal AI agent on Telegram that you can chat with one-on-one to get answers, capture ideas, and handle tasks on the go.',
})

export const whatsapp = createChannelTemplate({
  templateId: 'whatsapp-agent',
  integration: 'whatsapp',
  icon: '📱',
  Icon: icons.whatsapp,
  templateName: 'WhatsApp Agent',
  templateDescription:
    'Put an AI agent on WhatsApp to engage customers and resolve conversations on the channel they already use.',
})

export const googlechat = createChannelTemplate({
  templateId: 'googlechat-agent',
  integration: 'googlechat',
  icon: '💬',
  Icon: icons.googlechat,
  templateName: 'Google Chat Agent',
  templateDescription:
    'Bring an AI agent into Google Chat to answer questions and automate tasks across your Google Workspace.',
})
