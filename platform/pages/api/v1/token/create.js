// @ts-check
import prisma from '@/prisma/client'

import { digestCredential } from '@/lib/credential.digest'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { withUserSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

import crypto from 'crypto'

export const bodySchema = schema.object({
  name: nameSchema,
  description: descriptionSchema,

  config: schema.object().allow(null), // @todo validate the shape

  meta: metaSchema,
})

export default withPost(
  withUserSession(
    withSchema(bodySchema, async function (_req, session, body) {
      const {
        name,
        description,

        config,

        meta,
      } = body

      const token = `sk-${crypto.randomBytes(32).toString('hex')}`
      const tokenDigest = await digestCredential(token)

      const { id, createdAt } = await prisma.token.create({
        data: {
          userId: session.user.id,

          // basic information

          name,
          description,

          // resource specific

          config,

          token: tokenDigest, // @todo move token minting into a dedicated library

          // meta and others

          meta,
        },

        select: {
          id: true,

          createdAt: true,
        },
      })

      return ok(makeJsonSafe({ id, token, createdAt }))
    })
  )
)

// @note this API route is not public - no documentation available
