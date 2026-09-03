// @ts-check
import prisma from '@/prisma/client'
import { Visibility } from '@/prisma/enums'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import botIdSchema from '@/schemas/botId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  botId: botIdSchema('use'),

  apiKey: schema.string().allow(null, ''),
  personaId: schema.string().allow(null, ''),

  visibility: schema.string().valid(...Object.keys(Visibility)),

  meta: metaSchema,
})

export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const {
        alias,

        name,
        description,

        blueprintId: blueprint,

        botId: bot,

        apiKey,
        personaId,

        visibility,

        meta,
      } = body

      const anamIntegration =
        await prisma.anamIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'anamIntegrationId')
        )

      if (!anamIntegration) {
        return notFound()
      }

      if (anamIntegration.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.anamIntegration.update({
        where: {
          id: anamIntegration.id,
        },

        data: {
          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,
          botId: bot?.id || bot,

          // resource specific

          apiKey,
          personaId,

          visibility,

          // meta and others

          meta: getMeta(meta, anamIntegration.meta),
        },
      })

      return ok({ id: anamIntegration.id })
    })
  )
)
