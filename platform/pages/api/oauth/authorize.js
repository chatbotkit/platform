// @ts-check
import debug from '@/lib/debug'
import { captureException } from '@/lib/error'
import oauth, {
  Request,
  Response,
  errorToResponse,
  getValidatedRedirectUri,
  responseToResponse,
} from '@/lib/oauth.server'
import { getSoftSession } from '@/lib/session.get'

/**
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 * @returns {Promise<void>}
 */
export default async function handler(req, res) {
  const session = await getSoftSession(req, res)

  if (!session) {
    res.status(302)
    res.setHeader(
      'location',
      `/signin?callbackUrl=${encodeURIComponent(req.url || '')}`
    )
    res.end()

    return
  }

  if (req.method !== 'POST') {
    res.status(302)
    res.setHeader(
      'location',
      `/oauth/consent?${new URLSearchParams(Object(req.query)).toString()}`
    )
    res.end()

    return
  }

  if (!req.body.approval) {
    res.status(302)
    res.setHeader(
      'location',
      `/oauth/consent?${new URLSearchParams(Object(req.query)).toString()}`
    )
    res.end()

    return
  }

  if (req.body.approval !== 'granted') {
    const clientId = Array.isArray(req.query.client_id)
      ? req.query.client_id[0]
      : req.query.client_id

    const redirectUri = Array.isArray(req.query.redirect_uri)
      ? req.query.redirect_uri[0]
      : req.query.redirect_uri

    // @note the denial redirect bypasses the registered-client validation the
    // grant path performs, so it must validate the redirect URI itself -
    // otherwise it is an open redirect

    const validatedRedirectUri = await getValidatedRedirectUri(
      clientId,
      redirectUri
    )

    if (!validatedRedirectUri) {
      res.status(400)
      res.setHeader('content-type', 'application/json')
      res.end(
        JSON.stringify({
          error: 'invalid_request',
          error_description:
            'The redirect_uri is not registered for this client',
        })
      )

      return
    }

    const url = new URL(validatedRedirectUri)

    url.searchParams.set('error', 'access_denied')
    url.searchParams.set(
      'error_description',
      'The resource owner denied the request'
    )

    res.status(302)
    res.setHeader('location', url.href)
    res.end()

    return
  }

  const request = new Request(req)
  const response = new Response(res)

  try {
    const result = await oauth.authorize(request, response, {
      authenticateHandler: {
        handle: async () => {
          return session.user
        },
      },
    })

    debug(`oauth authorize result`, { result })

    await responseToResponse(response, res)
  } catch (e) {
    await captureException(e)

    await errorToResponse(e, res, { request, response })
  }
}
