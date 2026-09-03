import type { NextApiResponse } from 'next'

import { CACHE_PRESETS, applyCacheHeaders } from '@/lib/cdn'
import { isProduction } from '@/lib/env'

interface Context {
  res: NextApiResponse

  [key: string]: unknown
}

type ImageHandlerFunction = (
  context: Context,

  ...args: unknown[]
) => Promise<Buffer | null>

type NotFoundResponse = {
  notFound: true
}

type PropsResponse = {
  props: Record<string, unknown>
}

/**
 * Higher-order function that wraps an image handler with proper response headers
 * and caching configuration.
 */
export function withImageResponse(
  fn: ImageHandlerFunction
): (
  context: Context,
  ...args: unknown[]
) => Promise<NotFoundResponse | PropsResponse> {
  return async function (context: Context, ...args: unknown[]) {
    const image = await fn(context, ...args)

    if (!image) {
      return {
        notFound: true, // @todo return a 404 image
      }
    }

    context.res.setHeader('Content-Type', 'image/png')

    if (isProduction) {
      applyCacheHeaders(context.res, CACHE_PRESETS.CARD)
    }

    context.res.write(image)
    context.res.end()

    return {
      props: {},
    }
  }
}
