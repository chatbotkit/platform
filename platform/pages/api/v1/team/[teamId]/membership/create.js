// @ts-check
import prisma from '@/prisma/client'

import {
  getContextFrontendHost,
  getContextRequestHost,
} from '@/lib/context.store'
import { captureException } from '@/lib/error'
import schema, { withSchema } from '@/lib/joi.handler'
import { withLimits } from '@/lib/limit.handler'
import { logAudit } from '@/lib/log'
import { withPost } from '@/lib/method'
import { notifyTeamInvitation } from '@/lib/notify'
import {
  getPartnerByHostname,
  partnerToEmailBranding,
} from '@/lib/partner.helpers'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withUserSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  name: nameSchema,
  description: descriptionSchema,

  email: schema.string().email({ tlds: false }).required(),

  meta: metaSchema,
})

// @note method not exposed for security reasons
// @todo decide if we should expose this method later

export default withPost(
  withUserSession(
    withLimits(
      ['database/teamMember'],
      withSchema(bodySchema, async function (req, session, body) {
        const { name, description, email, meta } = body

        const team = await prisma.team.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'teamId')
        )

        if (!team) {
          return notFound()
        }

        if (team.userId !== session.user.id) {
          return notAuthorized()
        }

        const teamMembership = await prisma.teamMembership.upsert({
          where: {
            teamId_email: {
              teamId: team.id,
              email: email,
            },
          },

          create: {
            teamId: team.id,

            // basic information

            name,
            description,

            // resource specific

            email,

            // meta and others

            meta,
          },

          update: {
            name,
            description,

            meta,
          },
        })

        await logAudit({
          user: session.user,
          action: 'CREATE',
          oldValues: undefined,
          newValues: { name, description, email },
          relations: {},
          meta: {
            resource: 'teamMembership',
            teamId: team.id,
            teamMembershipId: teamMembership.id,
          },
        })

        try {
          const host =
            getContextFrontendHost() || getContextRequestHost() || undefined

          const partner = host
            ? ((await getPartnerByHostname(host)) ?? undefined)
            : undefined

          // @note a partner carries the transport that sends as its own
          // identity, so there is no vendor to name here

          const transport = partner?.email

          await notifyTeamInvitation({
            user: { id: `team[${team.id}]:member[${email}]`, email: email },

            teamName: team.name,
            teamDescription: team.description,

            branding: partner ? partnerToEmailBranding(partner) : undefined,

            transport,
          })
        } catch (error) {
          await captureException(error)
        }

        return ok(makeJsonSafe({ id: teamMembership.id }))
      })
    )
  )
)
