import prisma from '@/prisma/client'

import {
  getContextFrontendHost,
  getContextRequestHost,
} from '@/lib/context.store'
import { captureException } from '@/lib/error'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { notifyTeamInvitation } from '@/lib/notify'
import {
  getPartnerByHostname,
  partnerToEmailBranding,
} from '@/lib/partner.helpers'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withUserSession } from '@/lib/session.handler'

export const bodySchema = schema.object({})

// @note method not exposed for security reasons
// @todo decide if we should expose this method later

export default withPost(
  withUserSession(
    withSchema(bodySchema, async function (req, session) {
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

      const teamMembership = await prisma.teamMembership.findFirst({
        where: {
          id: requiredUrlParam(req, 'teamMembershipId'),
          teamId: team.id,
        },
      })

      if (!teamMembership) {
        return notFound()
      }

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
          user: {
            id: `team[${team.id}]:member[${teamMembership.email}]`,
            email: teamMembership.email,
          },

          teamName: team.name,
          teamDescription: team.description,

          branding: partner ? partnerToEmailBranding(partner) : undefined,

          transport,
        })
      } catch (error) {
        await captureException(error)
      }

      return ok({
        id: teamMembership.id,
      })
    })
  )
)
