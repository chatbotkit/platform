// @ts-check
import botsConfig from '@/config/bots'
import datasetsConfig from '@/config/datasets'

import { nameToType } from '@/lib/mime2'

/**
 * @param {function} fetch
 * @param {Record<string,any>} values
 * @returns {Promise<{ datasetId?: string }>}
 */
async function createDataset(fetch, values) {
  const { error: datasetCreateError, data: datasetCreateData } = await fetch(
    '/api/v1/dataset/create',
    {
      data: {
        name: values.name,
        description: values.description,
      },

      loadingMessage: 'Creating dataset...',
      failureMessage: true,
    }
  )

  if (datasetCreateError) {
    throw new Error(datasetCreateError)
  }

  const { id: datasetId } = datasetCreateData

  // file attachments

  if (Array.isArray(values.files)) {
    for (const file of values.files) {
      const { error: fileCreateError, data: fileCreateData } = await fetch(
        `/api/v1/file/create`,
        {
          data: {
            name: file.name,
          },

          loadingMessage: `Creating file ${file.name}...`,
          failureMessage: true,
        }
      )

      if (fileCreateError) {
        throw new Error(fileCreateError)
      }

      const { id: fileId } = fileCreateData

      const { error: fileUploadError, data: fileUploadData } = await fetch(
        `/api/v1/file/${fileId}/upload`,
        {
          data: {
            file: {
              name: file.name,
              type: file.type || nameToType(file.name),
              size: file.size,
            },
          },

          loadingMessage: `Creating file upload...`,
          failureMessage: true,
        }
      )

      if (fileUploadError) {
        throw new Error(fileUploadError)
      }

      await fetch(fileUploadData.uploadRequest.url, {
        method: fileUploadData.uploadRequest.method,
        headers: fileUploadData.uploadRequest.headers,
        body: await file.arrayBuffer(),
        dataType: 'body',

        loadingMessage: 'Uploading file...',
        failureMessage: true,

        showProgress: true,
      })

      const { error: datasetFileAttachError } = await fetch(
        `/api/v1/dataset/${datasetId}/file/${fileId}/attach`,
        {
          data: {
            type: 'source',
          },

          loadingMessage: `Attaching file ${file.name}...`,
          failureMessage: true,
        }
      )

      if (datasetFileAttachError) {
        throw new Error(datasetFileAttachError)
      }

      const { error: fileSyncError } = await fetch(
        `/api/v1/file/${fileId}/sync`,
        {
          data: {},

          loadingMessage: `Syncing file ${file.name}...`,
          failureMessage: true,
        }
      )

      if (fileSyncError) {
        throw new Error(fileSyncError)
      }
    }
  }

  // sitemap integration

  if (values.websiteURL) {
    const { error: sitemapCreateError, data: sitemapCreateData } = await fetch(
      '/api/v1/integration/sitemap/create',
      {
        data: {
          name: values.name,
          description: values.description,

          datasetId: datasetId,

          url: values.websiteURL,
        },

        loadingMessage: 'Creating sitemap integration...',
        failureMessage: true,
      }
    )

    if (sitemapCreateError) {
      throw new Error(sitemapCreateError)
    }

    const { id: sitemapId } = sitemapCreateData

    const { error: sitemapSyncError } = await fetch(
      `/api/v1/integration/sitemap/${sitemapId}/sync`,
      {
        data: {},

        loadingMessage: 'Syncing your website...',
        failureMessage: true,
      }
    )

    if (sitemapSyncError) {
      throw new Error(sitemapSyncError)
    }

    // @todo show a permanent toast with a message to that the website is
    // in the process of syncing and that we are going to send them an email
    // once this process is complete
  }

  return { datasetId }
}

/**
 * @param {function} fetch
 * @param {Record<string,any>} values
 * @returns {Promise<{ successMessage: string, successButtonAction: string, successButtonCaption: string }>}
 */
async function createBotIntegration(fetch, values) {
  const apiUrl = {
    widget: '/api/v1/integration/widget/create',
    slack: '/api/v1/integration/slack/create',
    discord: '/api/v1/integration/discord/create',
    whatsapp: '/api/v1/integration/whatsapp/create',
    messenger: '/api/v1/integration/messenger/create',
    telegram: '/api/v1/integration/telegram/create',
    email: '/api/v1/integration/email/create',
    trigger: '/api/v1/integration/trigger/create',
    bot: '/api/v1/bot/create',
  }[values.integration]

  if (!apiUrl) {
    throw new Error(`Unsupported integration ${values.integration}`)
  }

  const successMessage = {
    widget: 'Go ahead and click the button below to go to your widget.',
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
    email:
      'Go ahead and click the button below to complete the setup of your Email bot.',
    trigger:
      'Go ahead and click the button below to complete the setup of your Trigger bot.',
    bot: 'Go ahead and click the button below to go to your bot.',
  }[values.integration]

  const successButtonAction = {
    widget: '/integrations/widget/',
    slack: '/integrations/slack/',
    discord: '/integrations/discord/',
    whatsapp: '/integrations/whatsapp/',
    messenger: '/integrations/messenger/',
    telegram: '/integrations/telegram/',
    email: '/integrations/email/',
    trigger: '/integrations/trigger/',
    bot: '/bots/',
  }[values.integration]

  const successButtonCaption = {
    widget: 'Continue to your Widget',
    slack: 'Continue to your Slack Bot',
    discord: 'Continue to your Discord Bot',
    whatsapp: 'Continue to your WhatsApp Bot',
    messenger: 'Continue to your Messenger Bot',
    telegram: 'Continue to your Telegram Bot',
    email: 'Continue to your Email Bot',
    trigger: 'Continue to your Trigger Bot',
    bot: 'Continue to your Bot',
  }[values.integration]

  const {
    name,
    description,

    botId,

    backstory,

    model,

    datasetId,
    skillsetId,

    meta,
  } = values

  const { error, data } = await fetch(apiUrl, {
    data: {
      name,
      description,

      botId,

      backstory,

      model,

      datasetId,
      skillsetId,

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
 * @type {Array<import('./index').Template>}
 */
export const templates = [
  {
    templateId: 'site-gpt',
    icon: '🌐',
    templateName: 'Site GPT',
    templateDescription: 'Create an AI chatbot from any website.',

    steps: ['/new', '/new/details', '/new/website'],

    options: {},

    values: {},

    task: async ({ setOptions, values, fetch }) => {
      const { datasetId } = await createDataset(fetch, { ...values })

      const { error: botCreateError, data: botCreateData } = await fetch(
        `/api/v1/bot/create`,
        {
          data: {
            name: values.name,
            description: values.description,

            backstory: datasetsConfig.defaultTestBackstory,

            model: datasetsConfig.defaultTestModel,

            datasetId: datasetId,
          },

          loadingMessage: 'Creating your bot...',
          failureMessage: true,
        }
      )

      if (botCreateError) {
        throw new Error(botCreateError)
      }

      const { id: botId } = botCreateData

      setOptions({
        successButtonAction: `/bots/${botId}#chat-with-this-bot`,
        successButtonCaption: 'Continue to your website bot',
      })
    },
  },

  {
    templateId: 'doc-gpt',
    icon: '📄',
    templateName: 'Doc GPT',
    templateDescription: 'Create an AI chatbot from any document.',

    steps: ['/new', '/new/details', '/new/docs'],

    options: {},

    values: {},

    task: async ({ setOptions, values, fetch }) => {
      const { datasetId } = await createDataset(fetch, { ...values })

      const { error: botCreateError, data: botCreateData } = await fetch(
        `/api/v1/bot/create`,
        {
          data: {
            name: values.name,
            description: values.description,

            backstory: datasetsConfig.defaultTestBackstory,

            model: datasetsConfig.defaultTestModel,

            datasetId: datasetId,
          },

          loadingMessage: 'Creating your bot...',
          failureMessage: true,
        }
      )

      if (botCreateError) {
        throw new Error(botCreateError)
      }

      const { id: botId } = botCreateData

      setOptions({
        successButtonAction: `/bots/${botId}#chat-with-this-bot`,
        successButtonCaption: 'Continue to your website bot',
      })
    },
  },

  {
    templateId: 'customer-support',
    icon: '🤝',
    templateName: 'Customer Support',
    templateDescription:
      'A chatbot designed to assist users with customer service inquiries and support.',

    steps: ['/new', '/new/details', '/new/docs', '/new/integrations'],

    options: {
      model: 'gpt-5.4-mini',
    },

    values: {},

    task: async ({ options, setOptions, values, setValues, fetch }) => {
      const { datasetId } = await createDataset(fetch, { ...values })

      setValues({ ...values, datasetId })

      const { successMessage, successButtonAction, successButtonCaption } =
        await createBotIntegration(fetch, {
          ...options,
          ...values,

          backstory: botsConfig.defaultBackstory,

          datasetId,
        })

      setOptions({
        ...options,
        successMessage,
        successButtonAction,
        successButtonCaption,
      })
    },
  },

  {
    templateId: 'question-answer',
    icon: '🤔',
    templateName: 'Question & Answer',
    templateDescription:
      'A chatbot designed to assist users with finding answers to common questions on a particular topic or set of documents.',

    steps: ['/new', '/new/details', '/new/docs', '/new/integrations'],

    options: {
      backstory: datasetsConfig.defaultTestBackstory,

      model: datasetsConfig.defaultTestModel,
    },

    values: {},

    task: async ({ options, setOptions, values, setValues, fetch }) => {
      const { datasetId } = await createDataset(fetch, { ...values })

      setValues({ ...values, datasetId })

      const { successMessage, successButtonAction, successButtonCaption } =
        await createBotIntegration(fetch, { ...options, ...values, datasetId })

      setOptions({
        ...options,
        successMessage,
        successButtonAction,
        successButtonCaption,
      })
    },
  },
]

export default templates
