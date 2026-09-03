'use server'

import prisma from '@/prisma/client'

import { appActionHandler, appContactActionHandler } from '@/lib/app.action'
import { digestCredential } from '@/lib/credential.digest'
import { makeJsonSafe } from '@/lib/struct'
import { z } from '@/lib/zod.schema'

import ConfigSchema from './config'
import {
  APP_NAME,
  CONTACT_NAMESPACE,
  TOKEN_ALLOWED_ROUTES,
  TOKEN_META_APP,
} from './const'

import crypto from 'crypto'

/**
 * List the coding tokens minted by this app. Only tokens tagged with
 * `meta.app === 'code'` are returned so the app never lists or touches tokens
 * created elsewhere.
 *
 * @action
 */
export const listTokens = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({}),
  async (_config, session) => {
    const tokens = await prisma.token.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const codeTokens = tokens.filter(
      (token) => token.meta?.app === TOKEN_META_APP
    )

    return { tokens: makeJsonSafe(codeTokens) }
  }
)

/**
 * Mint a new coding token. The token is a normal secret key scoped to the
 * stateless `conversation/complete` endpoint and tagged with `meta.app` so it
 * surfaces in this app's list.
 *
 * The token is bound to the user's app contact: we pick the contact from the
 * session (`ensureContact`) and store its id in `config.contactId`. When the
 * token is used, the session loader propagates that id into the session payload
 * so `conversation/complete` attributes every completion to the contact without
 * the caller having to pass `contactId`. @see @/lib/session.get and
 * @/schemas/contactId
 *
 * @action
 */
export const createToken = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    name: z.string(),
    description: z.string().optional(),
  }),
  async (_config, session, contact, { name, description }) => {
    const token = `sk-${crypto.randomBytes(32).toString('hex')}`

    const result = await prisma.token.create({
      data: {
        userId: session.user.id,
        name: name,
        description: description || '',
        token: await digestCredential(token), // @todo move token minting into a dedicated library @see @/lib/token.ts
        config: { allowedRoutes: TOKEN_ALLOWED_ROUTES, contactId: contact.id },
        meta: { app: TOKEN_META_APP },
      },
      select: {
        id: true,
        name: true,
        description: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return makeJsonSafe({ ...result, token })
  }
)

/**
 * Revoke a previously minted coding token. The token must belong to the user
 * and have been minted by this app.
 *
 * @action
 */
export const deleteToken = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    tokenId: z.string(),
  }),
  async (_config, session, { tokenId }) => {
    const token = await prisma.token.findUnique({
      where: {
        id: tokenId,
      },
      select: {
        id: true,
        userId: true,
        meta: true,
      },
    })

    if (
      !token ||
      token.userId !== session.user.id ||
      token.meta?.app !== TOKEN_META_APP
    ) {
      throw new Error('Token not found or access denied')
    }

    await prisma.token.delete({
      where: {
        id: tokenId,
      },
    })

    return { id: tokenId }
  }
)
