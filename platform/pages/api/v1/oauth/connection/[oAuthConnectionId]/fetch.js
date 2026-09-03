// @ts-check
import prisma from '@/prisma/client'

import { maskModelCredentials } from '@/lib/credential.mask'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

export default withGet(
  withSession(async function (req, session) {
    const oAuthConnection = await prisma.oAuthConnection.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'oAuthConnectionId'),
      {
        select: {
          // identifiers

          id: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          userId: true,

          blueprintId: true,

          // resource specific

          issuer: true,
          clientId: true,
          clientSecret: true, // masked below - see lib/credential.policy.ts

          scopes: true,

          allowedDomains: true,
          requiredClaims: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      }
    )

    if (!oAuthConnection) {
      return notFound()
    }

    if (oAuthConnection.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (oAuthConnection).userId)

    // @note the client secret is returned as '********' when configured and
    // null otherwise, for every audience; update accepts the sentinel as
    // "keep the stored value" - see lib/credential.mask.ts
    return ok(makeJsonSafe(maskModelCredentials('OAuthConnection', oAuthConnection)))
  })
)
