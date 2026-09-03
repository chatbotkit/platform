'use server'

import { appContactActionHandler } from '@/lib/app.action'
import { getSessionClient } from '@/lib/cbk.sdk'
import { z } from '@/lib/zod.schema'

import ConfigSchema from './config'
import { APP_NAME, CONTACT_NAMESPACE } from './const'

export const fetchContact = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({}),
  async (_config, session, contact) => {
    const userClient = await getSessionClient(session)

    const fetchedContact = await userClient.contact.fetch(contact.id)

    return fetchedContact
  }
)

export const updateProfile = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    preferences: z.string().optional(),
  }),
  async (_config, session, contact, { name, description, preferences }) => {
    const userClient = await getSessionClient(session)

    const updatedContact = await userClient.contact.update(contact.id, {
      name: name?.trim(),
      description: description?.trim(),
      // @ts-ignore because preferences is not exported in the SDK types
      preferences: preferences?.trim(),
    })

    return updatedContact
  }
)
