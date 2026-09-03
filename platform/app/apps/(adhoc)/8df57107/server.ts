'use server'

import type { visibleLanguageModels } from '@/config/models'

import { appActionHandler } from '@/lib/app.action'
import { getSessionClient } from '@/lib/cbk.sdk'
import { errorToErrorResponse } from '@/lib/error'
import { throwUnprocessableEntity } from '@/lib/response'

import ConfigSchema from './config'
import { APP_NAME } from './const'

import { z } from 'zod'

/**
 * @action
 */
export const listBlueprints = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({}),
  async (_config, session, {}) => {
    const userClient = await getSessionClient(session)

    const { items: blueprints } = await userClient.blueprint.list().cache()

    return blueprints
  }
)

/**
 * @action
 */
export const createBlueprint = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    name: z.string(),
    description: z.string(),
  }),
  async (_config, session, { name, description }) => {
    const userClient = await getSessionClient(session)

    return await userClient.blueprint.create({
      name,
      description,
    })
  }
)

/**
 * @action
 */
export const updateBlueprint = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
  }),
  async (_config, session, { id, name, description }) => {
    const userClient = await getSessionClient(session)

    return await userClient.blueprint.update(id, {
      name,
      description,
    })
  }
)

/**
 * @action
 */
export const deleteBlueprint = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    id: z.string(),
  }),
  async (_config, session, { id }) => {
    const userClient = await getSessionClient(session)

    // @todo pass flag to delete all associated resources

    return await userClient.blueprint.delete(id)
  }
)

/**
 * @action
 */
export const fetchBlueprint = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    id: z.string(),
  }),
  async (_config, session, { id }) => {
    const userClient = await getSessionClient(session)

    return await userClient.blueprint.fetch(id)
  }
)

/**
 * @action
 */
export const listBots = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    blueprintId: z.string(),
  }),
  async (_config, session, { blueprintId }) => {
    const userClient = await getSessionClient(session)

    const { resources } = await userClient.blueprint.listResources(blueprintId)

    const bots = resources.bot || []

    return bots
  }
)

/**
 * @action
 */
export const createBot = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    blueprintId: z.string(),
    name: z.string(),
    description: z.string(),
    backstory: z.string().optional(),
    model: z.string().optional(),
    privacy: z.boolean().optional(),
    moderation: z.boolean().optional(),
  }),
  async (
    _config,
    session,
    { blueprintId, name, description, backstory, model, privacy, moderation }
  ) => {
    const userClient = await getSessionClient(session)

    return await userClient.bot.create({
      blueprintId,
      name,
      description,
      backstory,
      model,
      privacy,
      moderation,
    })
  }
)

/**
 * @action
 */
export const updateBot = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    id: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    backstory: z.string().optional(),
    model: z.string().optional(),
    privacy: z.boolean().optional(),
    moderation: z.boolean().optional(),
    datasetId: z.string().optional(),
  }),
  async (
    _config,
    session,
    { id, name, description, backstory, model, privacy, moderation, datasetId }
  ) => {
    const userClient = await getSessionClient(session)

    return await userClient.bot.update(id, {
      name,
      description,
      backstory,
      model,
      privacy,
      moderation,
      datasetId,
    })
  }
)

/**
 * @action
 */
export const deleteBot = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    id: z.string(),
  }),
  async (_config, session, { id }) => {
    const userClient = await getSessionClient(session)

    return await userClient.bot.delete(id)
  }
)

/**
 * @action
 */
export const listDatasets = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    blueprintId: z.string(),
  }),
  async (_config, session, { blueprintId }) => {
    const userClient = await getSessionClient(session)

    const { resources } = await userClient.blueprint.listResources(blueprintId)

    const datasets = resources.dataset || []

    return datasets
  }
)

/**
 * @action
 */
export const createDataset = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    blueprintId: z.string(),
    name: z.string(),
    description: z.string(),
  }),
  async (_config, session, { blueprintId, name, description }) => {
    const userClient = await getSessionClient(session)

    return await userClient.dataset.create({
      blueprintId,
      name,
      description,
    })
  }
)

/**
 * @action
 */
export const updateDataset = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
  }),
  async (_config, session, { id, name, description }) => {
    const userClient = await getSessionClient(session)

    return await userClient.dataset.update(id, {
      name,
      description,
    })
  }
)

/**
 * @action
 */
export const deleteDataset = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    id: z.string(),
  }),
  async (_config, session, { id }) => {
    const userClient = await getSessionClient(session)

    return await userClient.dataset.delete(id)
  }
)

/**
 * @action
 */
export const listFiles = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    datasetId: z.string(),
  }),
  async (_config, session, { datasetId }) => {
    const userClient = await getSessionClient(session)

    const { items: files } = await userClient.dataset.file
      .list(datasetId)
      .cache()

    return files
  }
)

/**
 * @action
 */
export const uploadFile = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    datasetId: z.string(),
    name: z.string(),
    type: z.string(),
    data: z.string(),
  }),
  async (_config, session, { datasetId, name, type, data }) => {
    const userClient = await getSessionClient(session)

    const fileResult = await userClient.file.create({ name, description: '' })

    await userClient.file.upload(fileResult.id, { name, type, data })

    await userClient.dataset.file.attach(datasetId, fileResult.id, {})

    return fileResult
  }
)

/**
 * @action
 */
export const deleteFile = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    datasetId: z.string(),
    fileId: z.string(),
  }),
  async (_config, session, { datasetId, fileId }) => {
    const userClient = await getSessionClient(session)

    await userClient.dataset.file.detach(datasetId, fileId, {})

    return await userClient.file.delete(fileId)
  }
)

/**
 * @action
 */
export const listWidgets = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    blueprintId: z.string(),
  }),
  async (_config, session, { blueprintId }) => {
    const userClient = await getSessionClient(session)

    const { resources } = await userClient.blueprint.listResources(blueprintId)

    const widgets = resources.widgetIntegration || []

    return widgets
  }
)

/**
 * @action
 */
export const createWidget = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    blueprintId: z.string(),
    name: z.string(),
    description: z.string(),
    botId: z.string().optional(),
  }),
  async (_config, session, { blueprintId, name, description, botId }) => {
    const userClient = await getSessionClient(session)

    return await userClient.integration.widget.create({
      blueprintId,
      name,
      description,
      botId,
    })
  }
)

/**
 * @action
 */
export const updateWidget = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    botId: z.string().optional(),
  }),
  async (_config, session, { id, name, description, botId }) => {
    const userClient = await getSessionClient(session)

    return await userClient.integration.widget.update(id, {
      name,
      description,
      botId,
    })
  }
)

/**
 * @action
 */
export const deleteWidget = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    id: z.string(),
  }),
  async (_config, session, { id }) => {
    const userClient = await getSessionClient(session)

    return await userClient.integration.widget.delete(id)
  }
)

/**
 * @action
 */
export const listSitemaps = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    blueprintId: z.string(),
  }),
  async (_config, session, { blueprintId }) => {
    const userClient = await getSessionClient(session)

    const { resources } = await userClient.blueprint.listResources(blueprintId)

    const sitemaps = resources.sitemapIntegration || []

    return sitemaps
  }
)

/**
 * @action
 */
export const createSitemap = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    blueprintId: z.string(),
    name: z.string(),
    description: z.string(),
    datasetId: z.string().optional(),
    url: z.string(),
  }),
  async (
    _config,
    session,
    { blueprintId, name, description, datasetId, url }
  ) => {
    const userClient = await getSessionClient(session)

    return await userClient.integration.sitemap.create({
      blueprintId,
      name,
      description,
      datasetId,
      url,
    })
  }
)

/**
 * @action
 */
export const updateSitemap = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    datasetId: z.string().optional(),
    url: z.string(),
  }),
  async (_config, session, { id, name, description, datasetId, url }) => {
    const userClient = await getSessionClient(session)

    return await userClient.integration.sitemap.update(id, {
      name,
      description,
      datasetId,
      url,
    })
  }
)

/**
 * @action
 */
export const deleteSitemap = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    id: z.string(),
  }),
  async (_config, session, { id }) => {
    const userClient = await getSessionClient(session)

    return await userClient.integration.sitemap.delete(id)
  }
)

/**
 * @action
 */
export const syncSitemap = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    id: z.string(),
  }),
  async (_config, session, { id }) => {
    const userClient = await getSessionClient(session)

    return await userClient.integration.sitemap.sync(id)
  }
)

/**
 * @action
 */
export const getBlueprint = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    id: z.string(),
  }),
  async (_config, session, { id }) => {
    const userClient = await getSessionClient(session)

    return await userClient.blueprint.fetch(id)
  }
)

/**
 * @action
 */
export const listModels = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({}),
  async (_config, _session, {}) => {
    const allowedModels = [
      'gpt-4o',
      'gpt-4o-mini',
      'claude-4.5-sonnet',
      'claude-4.5-haiku',
    ] as const satisfies ReadonlyArray<keyof typeof visibleLanguageModels>

    return {
      allowedModels,
    }
  }
)

/**
 * @action
 */
export const initializeBlueprintResources = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    blueprintId: z.string(),
  }),
  async (_config, session, { blueprintId }) => {
    const userClient = await getSessionClient(session)

    // Get blueprint
    const blueprint = await userClient.blueprint.fetch(blueprintId)

    // Get all resources
    const { resources } = await userClient.blueprint.listResources(blueprintId)

    const bots = (resources.bot || []) as Array<{
      id: string
      name?: string
      description?: string
      datasetId?: string
    }>
    const datasets = (resources.dataset || []) as Array<{
      id: string
      name?: string
      description?: string
    }>
    const widgets = (resources.widgetIntegration || []) as Array<{
      id: string
      name?: string
      description?: string
    }>

    // Get or create agent (single instance)
    let bot

    if (bots.length > 0) {
      // Fetch full bot details (listResources only returns partial data)
      bot = await userClient.bot.fetch(bots[0].id)
    } else {
      bot = await userClient.bot.create({
        blueprintId,
        name: `${blueprint.name} Agent`,
        description: 'Customer support agent',
        backstory: 'You are a helpful customer support assistant.',
        model: 'gpt-4o',
      })
    }

    // Get or create dataset (single instance)
    let dataset

    if (datasets.length > 0) {
      dataset = datasets[0]
    } else {
      dataset = await userClient.dataset.create({
        blueprintId,
        name: `${blueprint.name} Knowledge Base`,
        description: 'Knowledge base for the support agent',
      })
    }

    // Link dataset to agent if not already linked
    if (bot && dataset && !bot.datasetId) {
      bot = await userClient.bot.update(bot.id, {
        datasetId: dataset.id,
      })
    }

    // Get or create widget (single instance)
    let widget

    if (widgets.length > 0) {
      widget = widgets[0]
    } else {
      widget = await userClient.integration.widget.create({
        blueprintId,
        name: `${blueprint.name} Widget`,
        description: 'Chat widget for customer support',
        botId: bot.id,
      })
    }

    const allowedModels = [
      'gpt-4o',
      'gpt-4o-mini',
      'claude-4.5-sonnet',
      'claude-4.5-haiku',
    ] as const satisfies ReadonlyArray<keyof typeof visibleLanguageModels>

    return {
      blueprint,
      bot,
      dataset,
      widget,
      allowedModels,
    }
  }
)

/**
 * @action
 */
export const listAll = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({}),
  async (_config, _session, {}) => {
    const blueprints = await listBlueprints({})

    if (!blueprints) {
      return throwUnprocessableEntity('Unexpected action result')
    }

    if ('error' in blueprints) {
      throw errorToErrorResponse(blueprints.error)
    }

    return { blueprints }
  }
)
