import { ONE_DAY_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import cuid from '@/lib/cuid'
import debug from '@/lib/debug'
import memcache from '@/lib/memcache'
import type { Session } from '@/lib/session.get'
import { createHmacHexDigest } from '@/lib/webcrypto'

// @note generally this approach works with one minor issues and that is that
// it is difficult to invalidate signed Urls when the session is invalidated

export const KEY_PREFIX = 'signature:url:'

export interface SignatureSession {
  user: {
    id: string
  }
  options: Session['options']
  payload: Session['payload']
}

/**
 * @todo accept req instead
 */
export async function sign(url: URL | string, session: Session): Promise<URL> {
  debug(`sign`, { url, session }).log('signature.sign')

  const key = cuid()
  const secret = cuid()

  const algorithm = 'sha256'

  const now = Date.now()

  // @note should we use the session.expires for this this?

  const expires = now + ONE_DAY_IN_MILLISECONDS

  if (isNaN(expires)) {
    throw new Error('Invalid session expiration date')
  }

  if (expires < now) {
    throw new Error('Session has already expired')
  }

  await memcache.set(
    KEY_PREFIX + key,
    {
      secret: secret,
      session: {
        user: {
          id: session.user.id,
        },
        options: {
          ...session.options,
        },
        payload: {
          ...session.payload,
        },
      } as SignatureSession,
    },
    {
      ex: Math.ceil((expires - now) / 1000),
    }
  )

  const urlObject = new URL(url)

  urlObject.searchParams.append('_key', key)
  urlObject.searchParams.append('_algorithm', algorithm)
  urlObject.searchParams.append('_expires', expires.toString())

  const sortedParams = [...urlObject.searchParams.entries()].sort(
    ([keyA], [keyB]) => keyA.localeCompare(keyB)
  )

  const sortedQueryString = new URLSearchParams(sortedParams).toString()

  urlObject.search = sortedQueryString

  const signature = await createHmacHexDigest(
    algorithm,
    secret,
    urlObject.toString()
  )

  urlObject.searchParams.append('_signature', signature)

  return urlObject
}

/**
 * @todo accept req instead
 */
export async function trySign(
  url: URL | string,
  session: Session
): Promise<URL | null> {
  debug(`trySign`, { url, session }).log('signature.trySign')

  try {
    return await sign(url, session)
  } catch (error) {
    debug(`error`, { error }).log('signature.trySign.error')

    return null
  }
}

/**
 * @todo accept req instead
 */
export async function verify(
  url: URL | string
): Promise<SignatureSession | null> {
  debug(`verify`, { url }).log('signature.verify')

  const urlObject = new URL(url)

  const key = urlObject.searchParams.get('_key')
  const algorithm = urlObject.searchParams.get('_algorithm')
  const expires = urlObject.searchParams.get('_expires')
  const signature = urlObject.searchParams.get('_signature')

  if (!key || !algorithm || !expires || !signature) {
    return null
  }

  if (algorithm !== 'sha256') {
    return null
  }

  const record = await memcache.get<{
    secret: string
    session: SignatureSession
  }>(KEY_PREFIX + key)

  if (!record) {
    return null
  }

  const secret = record.secret

  const expiresAt = Number(expires)

  if (expiresAt < Date.now()) {
    return null
  }

  const urlObjectWithoutSignature = new URL(urlObject.toString())

  urlObjectWithoutSignature.searchParams.delete('_signature')

  const sortedParams = [
    ...urlObjectWithoutSignature.searchParams.entries(),
  ].sort(([keyA], [keyB]) => keyA.localeCompare(keyB))

  const sortedQueryString = new URLSearchParams(sortedParams).toString()

  urlObjectWithoutSignature.search = sortedQueryString

  const signatureToVerify = await createHmacHexDigest(
    algorithm,
    secret,
    urlObjectWithoutSignature.toString()
  )

  if (signatureToVerify !== signature) {
    return null
  }

  return record.session
}

export async function tryVerify(
  url: URL | string
): Promise<SignatureSession | null> {
  debug(`tryVerify`, { url }).log('signature.tryVerify')

  try {
    return await verify(url)
  } catch (error) {
    debug(`error`, { error }).log('signature.tryVerify.error')

    return null
  }
}
