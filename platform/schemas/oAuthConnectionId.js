/* eslint-disable import/no-anonymous-default-export */
// @ts-check
import prisma from '@/prisma/client'

import schema from '@/lib/joi.schema'
import {
  throwNotAuthenticated,
  throwNotAuthorized,
  throwNotFound,
} from '@/lib/response'

export default schema
  .string()
  .allow(null, '')
  .external(async function (value, helpers) {
    if (value) {
      value = value.trim()
    }

    if (!value) {
      if (value === undefined) {
        return
      } else {
        return null
      }
    }

    const { user } = helpers?.prefs?.context?.session || {}

    if (!user) {
      return throwNotAuthenticated()
    }

    const oAuthConnection = await prisma.oAuthConnection.findUniqueByIdentifier(
      user,
      value
    )

    if (!oAuthConnection) {
      throw throwNotFound(`OAuth connection not found`)
    }

    if (oAuthConnection.userId !== user.id) {
      return throwNotAuthorized(
        'You are not authorized to use this OAuth connection'
      )
    }

    return oAuthConnection
  }, 'oAuthConnectionId')
