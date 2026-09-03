'use server'

import { appActionHandler } from '@/lib/app.action'
import { getSessionClient } from '@/lib/cbk.sdk'
import { z } from '@/lib/zod.schema'

import ConfigSchema from './config'
import { APP_NAME } from './const'

export const listDatasets = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({}),
  async (_config, session) => {
    const userClient = await getSessionClient(session)

    const { items } = await userClient.dataset.list()

    return { datasets: items }
  }
)

export const fetchDataset = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    id: z.string(),
  }),
  async (_config, session, { id }) => {
    const userClient = await getSessionClient(session)

    const dataset = await userClient.dataset.fetch(id)

    return { dataset }
  }
)

export const listDatasetFiles = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    datasetId: z.string(),
  }),
  async (_config, session, { datasetId }) => {
    const userClient = await getSessionClient(session)

    const { items } = await userClient.dataset.file.list(datasetId)

    return { files: items }
  }
)

export const attachDatasetFile = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    datasetId: z.string(),
    fileId: z.string(),
  }),
  async (_config, session, { datasetId, fileId }) => {
    const userClient = await getSessionClient(session)

    await userClient.clientFetch(
      `/api/v1/dataset/${datasetId}/file/${fileId}/attach`,
      {
        method: 'POST',
        record: {
          type: 'source',
        },
      }
    )

    return { success: true }
  }
)

export const detachDatasetFile = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    datasetId: z.string(),
    fileId: z.string(),
    deleteRecords: z.boolean().optional(),
  }),
  async (_config, session, { datasetId, fileId, deleteRecords = false }) => {
    const userClient = await getSessionClient(session)

    await userClient.clientFetch(
      `/api/v1/dataset/${datasetId}/file/${fileId}/detach`,
      {
        method: 'POST',
        record: {
          deleteRecords,
        },
      }
    )

    return { success: true }
  }
)

export const syncDatasetFile = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    datasetId: z.string(),
    fileId: z.string(),
  }),
  async (_config, session, { datasetId, fileId }) => {
    const userClient = await getSessionClient(session)

    await userClient.clientFetch(
      `/api/v1/dataset/${datasetId}/file/${fileId}/sync`,
      {
        method: 'POST',
        record: {},
      }
    )

    return { success: true }
  }
)

export const createFile = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    name: z.string(),
  }),
  async (_config, session, { name }) => {
    const userClient = await getSessionClient(session)

    const file = await userClient.file.create({
      name,
    })

    return file
  }
)

export const uploadFile = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    fileId: z.string(),
    file: z.object({
      size: z.number(),
      type: z.string(),
      name: z.string(),
    }),
  }),
  async (_config, session, { fileId, file }) => {
    const userClient = await getSessionClient(session)

    const uploadData = await userClient.clientFetch(
      `/api/v1/file/${fileId}/upload`,
      {
        method: 'POST',
        record: {
          file,
        },
      }
    )

    return uploadData
  }
)

export const deleteFile = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    fileId: z.string(),
  }),
  async (_config, session, { fileId }) => {
    const userClient = await getSessionClient(session)

    await userClient.file.delete(fileId)

    return { success: true }
  }
)
