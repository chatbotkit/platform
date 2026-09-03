// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { detectContentAbuse } from '@/lib/moderation'
import { requiredUrlParam } from '@/lib/query.get'
import { badRequest, notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { joinTrimmedNotEmpty } from '@/lib/string'
import { isVip } from '@/lib/user.type'

import descriptionSchema from '@/schemas/description2'
import iconSchema from '@/schemas/icon'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name2'
import { optionalSlug as slugSchema } from '@/schemas/slug'

export const bodySchema = schema.object({
  name: nameSchema,
  description: descriptionSchema,

  icon: iconSchema,

  meta: metaSchema,

  // experimental

  slug: slugSchema,
})

export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const {
        name,
        description,

        icon,

        meta,

        // experimental

        slug,
      } = body

      const widget = await prisma.widgetIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'widgetId')
      )

      if (!widget) {
        return notFound()
      }

      if (widget.userId !== session.user.id) {
        return notAuthorized()
      }

      // @note content abuse detection is performed when publishing to the hub
      const { flagged, categories } = await detectContentAbuse(
        joinTrimmedNotEmpty(
          [name || widget.name, description || widget.description],
          '\n\n'
        )
      )

      if (flagged) {
        return badRequest(
          `Improper entry violating categories: ${categories.join(', ')}`
        )
      }

      const { id } = await prisma.hubWidgetPage.upsert({
        where: {
          widgetId: widget.id,
        },

        create: {
          // resource linking

          userId: session.user.id,
          widgetId: widget.id,

          // basic information

          name: name || widget.name,
          description: description || widget.description,

          // resource specific

          icon,

          // meta and others

          meta,

          // experimental

          slug,

          rank: isVip(session.user) ? 1000 : 0,
        },

        update: {
          // basic information

          name: name || widget.name,
          description: description || widget.description,

          // resource specific

          icon,

          // meta and others

          meta,

          // experimental

          slug,

          rank: isVip(session.user) ? 1000 : 0,
        },

        select: {
          id: true,
        },
      })

      return ok({ id: id, widgetId: widget.id })
    })
  )
)
