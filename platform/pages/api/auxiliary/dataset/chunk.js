// @ts-check
import { chunk } from '@chatbotkit-dev/file/index2'

import { parseDataURL } from '@/lib/dataurl.parse'
import debug from '@/lib/debug'
import { captureException } from '@/lib/error'
import fetch from '@/lib/egress.fetch'
import { getContentTypeHeader, getHeader } from '@/lib/header'
import { toaAsync } from '@/lib/it'
import schema, { schemaErrorToError } from '@/lib/joi.handler'
import { withAny } from '@/lib/method'
import { parseRequestJson } from '@/lib/request'
import {
  badRequest,
  methodNotAllowed,
  ok,
  respondFromError,
} from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { getUploadFile } from '@/lib/upload'

export const bodySchema = schema.object({
  file: schema.alternatives().try(schema.string().uri().required()),
  size: schema.number().integer().min(1),
  overlap: schema.number().integer().min(0),
  separators: schema.array().items(schema.string().allow('')),
  model: schema.string(),
})

// @note the chunker is a platform-owned compute helper; it requires an
// authenticated platform session (server-side callers mint a temporary user
// token, see lib/dsd2.ts) so that it is never a public unmetered service
export default withAny(
  withSession(async function (req, _session) {
    // @todo form upload is not working properly in production, investigate why

    const contentTypeHeader = getContentTypeHeader(
      req,
      'application/octet-stream'
    )

    if (req.method !== 'POST') {
      return methodNotAllowed() // @note we don't use withPost deliberately
    }

    let blob

    const options = {
      experimental: true,
    }

    switch (true) {
      case contentTypeHeader === 'application/json': {
        const body = await parseRequestJson(req)

        const { value, error } = bodySchema.validate(body)

        if (error) {
          return respondFromError(schemaErrorToError(error))
        }

        options.size = value.size
        options.overlap = value.overlap
        options.separators = value.separators
        options.model = value.model

        switch (true) {
          case /^https?:\/\//.test(value.file): {
            debug(`chunking file from URL`).log('auxiliary.dataset.chunk')

            const response = await fetch(value.file)

            if (!response.ok) {
              debug(`failed to fetch file from URL`, {
                url: value.file,
                status: response.status,
                statusText: response.statusText,
              }).log('auxiliary.dataset.chunk')

              return badRequest(
                `Failed to fetch file: ${response.status} ${response.statusText}`
              )
            }

            blob = await response.blob()

            break
          }

          case /^data:/.test(value.file): {
            debug(`parsing data URL`)

            const { data, type } = parseDataURL(value.file)

            blob = new Blob([new Uint8Array(data)], { type })

            break
          }

          default: {
            return badRequest()
          }
        }

        break
      }

      case contentTypeHeader === 'multipart/form-data': {
        debug(`obtaining incoming file stream`).log('auxiliary.dataset.chunk')

        const size = parseInt(getHeader(req, 'x-chunk-size') || '0', 10)
        const overlap = parseInt(getHeader(req, 'x-chunk-overlap') || '0', 10)

        if (!size || size < 1) {
          return badRequest('x-chunk-size header must be set and greater than 0')
        }

        if (!overlap || overlap < 0) {
          return badRequest(
            'x-chunk-overlap header must be set and greater than or equal to 0'
          )
        }

        options.size = size
        options.overlap = overlap

        const file = await getUploadFile(req)

        const data = await file.arrayBuffer()
        const type = file.type

        blob = new Blob([data], { type })

        break
      }

      default: {
        debug(`obtaining incoming file stream`).log('auxiliary.dataset.chunk')

        const size = parseInt(getHeader(req, 'x-chunk-size') || '0', 10)
        const overlap = parseInt(getHeader(req, 'x-chunk-overlap') || '0', 10)

        if (!size || size < 1) {
          return badRequest('x-chunk-size header must be set and greater than 0')
        }

        if (!overlap || overlap < 0) {
          return badRequest(
            'x-chunk-overlap header must be set and greater than or equal to 0'
          )
        }

        options.size = size
        options.overlap = overlap

        const data = await req.arrayBuffer()
        const type = contentTypeHeader

        blob = new Blob([data], { type })

        break
      }
    }

    let items

    try {
      items = await toaAsync(chunk(blob, options))
    } catch (e) {
      // @note unsupported content types are an expected user error, not a bug
      if (
        e instanceof Error &&
        e.message.startsWith('Unsupported content type')
      ) {
        return badRequest(e.message)
      }

      await captureException(e)

      items = []
    }

    return ok({ items })
  })
)

export const config = {
  api: {
    bodyParser: false,
  },
}
