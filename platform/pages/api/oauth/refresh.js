// @ts-check
import {
  OAUTH_TOKEN_PER_CLIENT,
  OAUTH_TOKEN_PER_IP,
  TOO_MANY_ATTEMPTS_MESSAGE,
  checkAuthRate,
  getClientAddress,
} from '@/lib/auth.rate'
import { setupRequestContext } from '@/lib/context.setup'
import { runInContext } from '@/lib/context.store'
import debug from '@/lib/debug'
import { captureException } from '@/lib/error'
import oauth, {
  Request,
  Response,
  errorToResponse,
  responseToResponse,
} from '@/lib/oauth.server'

/**
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 * @returns {Promise<void>}
 */
async function handler(req, res) {
  setupRequestContext(req)

  if (req.method !== 'POST') {
    res.status(405)
    res.setHeader('Allow', 'POST')
    res.end()

    return
  }

  {
    const clientId =
      typeof req.body?.client_id === 'string' ? req.body.client_id : null

    const allowed = await checkAuthRate('oauth-token', [
      { identity: getClientAddress(req), limit: OAUTH_TOKEN_PER_IP },
      { identity: clientId, limit: OAUTH_TOKEN_PER_CLIENT },
    ])

    if (!allowed) {
      res.status(429).json({
        error: 'slow_down',
        error_description: TOO_MANY_ATTEMPTS_MESSAGE,
      })

      return
    }
  }

  const request = new Request(req)
  const response = new Response(res)

  try {
    const result = await oauth.token(request, response, {
      requireClientAuthentication: { refresh_token: false },
    })

    debug(`oauth refresh result`, { result })

    await responseToResponse(response, res)
  } catch (e) {
    await captureException(e)

    await errorToResponse(e, res, { request, response })
  }
}

export default runInContext(handler, { disableContextInheritance: true })
