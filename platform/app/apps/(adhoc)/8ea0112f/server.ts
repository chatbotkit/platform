'use server'

import { appContactActionHandler } from '@/lib/app.action'
import { getSessionClient } from '@/lib/cbk.sdk'
import { z } from '@/lib/zod.schema'

import ConfigSchema from './config'
import { APP_NAME, CONTACT_NAMESPACE } from './const'

export const listMemories = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({}),
  async (_config, session, contact) => {
    const userClient = await getSessionClient(session)

    const { items } = await userClient.memory.list({
      contactId: contact.id,
    })

    return { memories: items }
  }
)

export const createMemory = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    text: z.string(),
  }),
  async (_config, session, contact, { text }): Promise<{ id: string }> => {
    const userClient = await getSessionClient(session)

    const memory = await userClient.memory.create({
      contactId: contact.id,
      text: text,
    })

    return memory
  }
)

export const updateMemory = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    id: z.string(),
    text: z.string(),
  }),
  async (_config, session, contact, { id, text }): Promise<{ id: string }> => {
    const userClient = await getSessionClient(session)

    const existingMemory = await userClient.memory.fetch(id)

    if (existingMemory.contactId !== contact.id) {
      throw new Error('Memory not found')
    }

    const memory = await userClient.memory.update(id, { text })

    return memory
  }
)

export const deleteMemory = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    id: z.string(),
  }),
  async (_config, session, contact, { id }): Promise<{ id: string }> => {
    const userClient = await getSessionClient(session)

    const existingMemory = await userClient.memory.fetch(id)

    if (existingMemory.contactId !== contact.id) {
      throw new Error('Memory not found')
    }

    await userClient.memory.delete(id)

    return { id }
  }
)
