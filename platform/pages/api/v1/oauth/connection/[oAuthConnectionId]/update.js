// @ts-check
import prisma from '@/prisma/client'

import { isMaskSentinel } from '@/lib/credential.mask'
import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import blueprintIdSchema from '@/schemas/blueprintId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  issuer: schema.string().uri().optional().allow('', null),
  clientId: schema.string().optional().allow('', null),
  clientSecret: schema.string().optional().allow('', null),

  scopes: schema.string().optional(),

  allowedDomains: schema.string().optional().allow('', null),
  requiredClaims: schema.object().optional().allow(null),

  meta: metaSchema,
})

export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const {
        name,
        description,

        blueprintId: blueprint,

        issuer,
        clientId,
        clientSecret,

        scopes,

        allowedDomains,
        requiredClaims,

        meta,
      } = body

      const oAuthConnection =
        await prisma.oAuthConnection.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'oAuthConnectionId')
        )

      if (!oAuthConnection) {
        return notFound()
      }

      if (oAuthConnection.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.oAuthConnection.update({
        where: {
          id: oAuthConnection.id,
        },

        data: {
          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          // resource specific

          issuer: issuer?.trim() ? issuer : null,
          clientId: clientId?.trim() ? clientId : null,
          // @note fetch masks the secret; the sentinel coming back means
          // "keep what is stored", a blank means clear
          clientSecret: isMaskSentinel(clientSecret)
            ? undefined
            : clientSecret?.trim()
              ? clientSecret
              : null,

          scopes,

          allowedDomains,
          requiredClaims,

          // meta and others

          meta: getMeta(meta, oAuthConnection.meta),
        },
      })

      return ok({ id: oAuthConnection.id })
    })
  )
)
