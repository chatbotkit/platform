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

        visibility,

        meta,
      } = body

      const avatarIntegration =
        await prisma.avatarIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'avatarIntegrationId')
        )

      if (!avatarIntegration) {
        return notFound()
      }

      if (avatarIntegration.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.avatarIntegration.update({
        where: {
          id: avatarIntegration.id,
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

          visibility,

          // meta and others

          meta: getMeta(meta, avatarIntegration.meta),
        },
      })

      return ok({ id: avatarIntegration.id })
    })
  )
)
