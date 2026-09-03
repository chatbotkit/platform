import { createSpaceSiteHandler, getAppMountBaseHref } from '../lib'
import type { SpaceSiteRouteProps } from '../lib'

// @note this route serves the configured space storage as a public static site
// under the app-prefixed mount (`/apps/static/...`, or the bare root on the
// app's own hostname). Absolute resource paths are served by `/apps/[...path]`.
const handler = createSpaceSiteHandler({ getBaseHref: getAppMountBaseHref })

export async function GET(req: Request, props: SpaceSiteRouteProps) {
  return handler(req, { params: await props.params })
}

export async function HEAD(req: Request, props: SpaceSiteRouteProps) {
  return handler(req, { params: await props.params }, true)
}

export const dynamic = 'force-dynamic'
