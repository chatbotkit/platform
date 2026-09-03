'use server'

import { appContactActionHandler } from '@/lib/app.action'
import { getSessionClient } from '@/lib/cbk.sdk'
import { z } from '@/lib/zod.schema'

import ConfigSchema from '../config'
import { APP_NAME, CONTACT_NAMESPACE } from '../const'

interface Space {
  id: string
  contactId: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

export type StorageItem = {
  path: string
  size: number
  updatedAt: number
  isDirectory: boolean
}

export const getSpace = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    id: z.string(),
  }),
  async (_config, session, contact, { id }) => {
    const userClient = await getSessionClient(session)

    const space = await userClient.clientFetch<Space, undefined>(
      `/api/v1/space/${id}/fetch`
    )

    if (space.contactId !== contact.id) {
      throw new Error('Space not found')
    }

    return { space }
  }
)

export const listFiles = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    spaceId: z.string(),
  }),
  async (_config, session, contact, { spaceId }) => {
    const userClient = await getSessionClient(session)

    const space = await userClient.clientFetch<Space, undefined>(
      `/api/v1/space/${spaceId}/fetch`
    )

    if (space.contactId !== contact.id) {
      throw new Error('Space not found')
    }

    const data = await userClient.space.storage.list(spaceId)

    return { items: data.items as StorageItem[] }
  }
)

export const getUploadUrl = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    spaceId: z.string(),
    path: z.string(),
    file: z.object({
      type: z.string(),
      size: z.number(),
    }),
  }),
  async (_config, session, contact, { spaceId, path, file }) => {
    const userClient = await getSessionClient(session)

    const space = await userClient.clientFetch<Space, undefined>(
      `/api/v1/space/${spaceId}/fetch`
    )

    if (space.contactId !== contact.id) {
      throw new Error('Space not found')
    }

    const data = await userClient.space.storage.upload(spaceId, path, {
      file: {
        type: file.type || 'application/octet-stream',
        size: file.size,
      },
    })

    return {
      path: data.path,
      uploadRequest: data.uploadRequest,
    }
  }
)

export const getDownloadUrl = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    spaceId: z.string(),
    path: z.string(),
  }),
  async (_config, session, contact, { spaceId, path }) => {
    const userClient = await getSessionClient(session)

    const space = await userClient.clientFetch<Space, undefined>(
      `/api/v1/space/${spaceId}/fetch`
    )

    if (space.contactId !== contact.id) {
      throw new Error('Space not found')
    }

    const data = await userClient.space.storage.download(spaceId, path)

    return { downloadUrl: data.url }
  }
)

export const deleteFile = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    spaceId: z.string(),
    path: z.string(),
  }),
  async (_config, session, contact, { spaceId, path }) => {
    const userClient = await getSessionClient(session)

    const space = await userClient.clientFetch<Space, undefined>(
      `/api/v1/space/${spaceId}/fetch`
    )

    if (space.contactId !== contact.id) {
      throw new Error('Space not found')
    }

    await userClient.space.storage.delete(spaceId, path, {
      recursive: false,
    })
  }
)
