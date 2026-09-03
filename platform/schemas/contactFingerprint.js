import { isExtendedTrustedAudience } from '@/lib/audience.helpers'
import { throwNotAuthenticated, throwNotAuthorized } from '@/lib/response'

import dbStringSchema from '@/schemas/dbString'

export const contactFingerprint = dbStringSchema
  .allow(null, '')
  .external(async function (value, helpers) {
    if (value) {
      value = value.trim()
    }

    if (!value) {
      return
    }

    if (value.length < 16) {
      throw new Error('Fingerprint is too short')
    }

    const { user, payload } = helpers?.prefs?.context?.session || {}

    if (!user) {
      return throwNotAuthenticated()
    }

    if (!payload) {
      return throwNotAuthenticated()
    }

    if (!isExtendedTrustedAudience(payload.aud)) {
      return throwNotAuthorized(
        `Cannot use fingerprint with aud "${payload.aud}"`
      )
    }

    return value
  }, 'fingerprint')

export default contactFingerprint
