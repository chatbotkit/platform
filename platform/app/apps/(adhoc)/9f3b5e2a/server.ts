'use server'

import { appContactActionHandler } from '@/lib/app.action'
import { getSessionClient } from '@/lib/cbk.sdk'
import { z } from '@/lib/zod.schema'

import ConfigSchema from './config'
import { APP_NAME, CONTACT_NAMESPACE } from './const'

interface Space {
  id: string
  contactId: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

export const listSpaces = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({}),
  async (_config, session, contact) => {
    const userClient = await getSessionClient(session)

    const { items } = await userClient.clientFetch<
      { items: Space[] },
      undefined
    >(`/api/v1/contact/${contact.id}/space/list`)

    return { spaces: items }
  }
)

export const createSpace = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    name: z.string(),
    description: z.string().optional(),
  }),
  async (
    _config,
    session,
    contact,
    { name, description }
  ): Promise<{ id: string }> => {
    const userClient = await getSessionClient(session)

    const space = await userClient.space.create({
      contactId: contact.id,
      name: name,
      description: description,
    })

    return space
  }
)

export const updateSpace = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
  }),
  async (
    _config,
    session,
    contact,
    { id, name, description }
  ): Promise<{ id: string }> => {
    const userClient = await getSessionClient(session)

    const existingSpace = await userClient.space.fetch(id)

    if (existingSpace.contactId !== contact.id) {
      throw new Error('Space not found')
    }

    const space = await userClient.space.update(id, {
      name,
      description,
    })

    return space
  }
)

export const deleteSpace = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    id: z.string(),
  }),
  async (_config, session, contact, { id }): Promise<{ id: string }> => {
    const userClient = await getSessionClient(session)

    const existingSpace = await userClient.space.fetch(id)

    if (existingSpace.contactId !== contact.id) {
      throw new Error('Space not found')
    }

    await userClient.space.delete(id)

    return { id }
  }
)
