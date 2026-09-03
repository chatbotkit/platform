'use server'

import prisma from '@/prisma/client'

import { appActionHandler } from '@/lib/app.action'
import { digestCredential } from '@/lib/credential.digest'
import { makeJsonSafe } from '@/lib/struct'
import { z } from '@/lib/zod.schema'

import ConfigSchema from './config'
import { APP_NAME } from './const'

import crypto from 'crypto'

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

    return { tokens: makeJsonSafe(tokens) }
  }
)

export const createToken = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    name: z.string(),
    description: z.string().optional(),
  }),
  async (_config, session, { name, description }) => {
    const token = `sk-${crypto.randomBytes(32).toString('hex')}`

    const result = await prisma.token.create({
      data: {
        userId: session.user.id,
        name: name,
        description: description || '',
        token: await digestCredential(token), // @todo move token minting into a dedicated library @see @/lib/token.js
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

export const updateToken = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    tokenId: z.string(),
    name: z.string(),
    description: z.string().optional(),
  }),
  async (_config, session, { tokenId, name, description }) => {
    // First verify the token belongs to the user
    const token = await prisma.token.findUnique({
      where: {
        id: tokenId,
      },
      select: {
        id: true,
        userId: true,
      },
    })

    if (!token || token.userId !== session.user.id) {
      throw new Error('Token not found or access denied')
    }

    const result = await prisma.token.update({
      where: {
        id: tokenId,
      },
      data: {
        name: name,
        description: description || '',
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

    return makeJsonSafe(result)
  }
)

export const deleteToken = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    tokenId: z.string(),
  }),
  async (_config, session, { tokenId }) => {
    // First verify the token belongs to the user
    const token = await prisma.token.findUnique({
      where: {
        id: tokenId,
      },
      select: {
        id: true,
        userId: true,
      },
    })

    if (!token || token.userId !== session.user.id) {
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
