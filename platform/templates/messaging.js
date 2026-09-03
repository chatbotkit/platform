// @ts-check
import botsConfig from '@/config/bots'

/**
 * @param {function} fetch
 * @param {Record<string,any>} values
 * @returns {Promise<{ successMessage: string, successButtonAction: string, successButtonCaption: string }>}
 */
export async function createBotIntegration(fetch, values) {
  const apiUrl = {
    slack: '/api/v1/integration/slack/create',
    discord: '/api/v1/integration/discord/create',
    whatsapp: '/api/v1/integration/whatsapp/create',
    messenger: '/api/v1/integration/messenger/create',
    telegram: '/api/v1/integration/telegram/create',
    googlechat: '/api/v1/integration/googlechat/create',
  }[values.integration]

  if (!apiUrl) {
    throw new Error(`Unsupported integration ${values.integration}`)
  }

  const successMessage = {
    slack:
      'Go ahead and click the button below to go to complete the setup of your Slack Bot.',
    discord:
      'Go ahead and click the button below to complete the setup of your Discord bot.',
    whatsapp:
      'Go ahead and click the button below to complete the setup of your WhatsApp bot.',
    messenger:
      'Go ahead and click the button below to complete the setup of your Messenger bot.',
    telegram:
      'Go ahead and click the button below to complete the setup of your Telegram bot.',
    googlechat:
      'Go ahead and click the button below to complete the setup of your Google Chat bot.',
  }[values.integration]

  const successButtonAction = {
    slack: '/integrations/slack/',
    discord: '/integrations/discord/',
    whatsapp: '/integrations/whatsapp/',
    messenger: '/integrations/messenger/',
    telegram: '/integrations/telegram/',
    googlechat: '/integrations/googlechat/',
  }[values.integration]

  const successButtonCaption = {
    slack: 'Continue to your Slack Agent',
    discord: 'Continue to your Discord Agent',
    whatsapp: 'Continue to your WhatsApp Agent',
    messenger: 'Continue to your Messenger Agent',
    telegram: 'Continue to your Telegram Agent',
    googlechat: 'Continue to your Google Chat Agent',
  }[values.integration]

  const {
    blueprintId,

    name,
    description,

    botId: _botId,

    backstory,

    model,

    datasetId,
    skillsetId,

    meta,
  } = values

  let botId = _botId

  if (!botId) {
    const { error, data } = await fetch(`/api/v1/bot/create`, {
      data: {
        blueprintId,

        name,
        description,

        backstory,

        model,

        datasetId,
        skillsetId,

        meta,
      },
    })

    if (error) {
      throw new Error(error)
    }

    botId = data.id
  }

  const { error, data } = await fetch(apiUrl, {
    data: {
      blueprintId,

      name,
      description,

      botId,

      // @note every channel above carries the sender identity, so contacts are
      // recorded from that identity rather than by asking the user mid
      // conversation, and every one of them accepts file uploads - both are
      // wins out of the box, so the wizard turns them on and lets the user opt
      // out on the integration page
      contactCollection: true,
      attachments: true,

      meta,
    },
    loadingMessage: `Creating ${values.integration} integration...`,
    failureMessage: true,
  })

  if (error) {
    throw new Error(error)
  }

  return {
    successMessage: successMessage,

    successButtonAction: successButtonAction + data.id,

    successButtonCaption: successButtonCaption,
  }
}

/**
 * @type {import('./index').Template}
 */
export const template = {
  templateId: 'ai-messaging-bot',
  icon: '💬',
  templateName: 'AI Messaging Bot',
  templateDescription:
    'An AI messaging bot that handles responses and tasks for you or your customers.',

  steps: ['/new', '/new/details', '/new/messaging'],

  options: {},

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

  // @note hidden because the channel-specific templates (Slack, Telegram,
  // WhatsApp) now cover the common cases directly. This generic multi-channel
  // flow remains reachable via `/new?template=ai-messaging-bot` and still
  // exposes the less common channels (Discord, Messenger).
  hidden: true,
}

export default template
