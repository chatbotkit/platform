// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'

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
  withSessionLimits(
    ['database/integration'],
    withSchema(bodySchema, async function (_req, session, body) {
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

      const { id } = await prisma.oAuthConnection.create({
        data: {
          userId: session.user.id,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          // resource specific

          issuer: issuer?.trim() ? issuer : null,
          clientId: clientId?.trim() ? clientId : null,
          clientSecret: clientSecret?.trim() ? clientSecret : null,

          scopes: scopes ?? 'openid email profile',

          allowedDomains: allowedDomains ?? null,
          requiredClaims: requiredClaims ?? null,

          // meta and others

          meta,
        },

        select: {
          id: true,
        },
      })

      return ok({ id })
    })
  )
)
