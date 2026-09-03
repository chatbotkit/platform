import {
  createSpaceSiteHandler,
  getRootMountBaseHref,
} from '@/app/apps/static/lib'
import type { SpaceSiteRouteProps } from '@/app/apps/static/lib'

// @note portal root mount for the Static app. Requests to a portal that are
// not claimed by a more specific app route (e.g. `/about.html`, `/css/app.css`)
// land here. This is what makes absolute resource paths resolve: a site authored
// for a root deployment references `/css/app.css`, which resolves against the
// space root via this catch-all rather than 404ing as an unknown app.
//
// When the portal has the Static app configured the matching
// space storage file is served publicly from the portal root. When it does not,
// the resolved config has no `spaceId` and a 404 is returned.
//
// @note this is a catch-all and therefore only matches paths that no other
// `/apps/*` route claims; named apps keep their own routes and the bare `/apps`
// root keeps the `(index)` launcher.
const handler = createSpaceSiteHandler({ getBaseHref: getRootMountBaseHref })

export async function GET(req: Request, props: SpaceSiteRouteProps) {
  return handler(req, { params: await props.params })
}

export async function HEAD(req: Request, props: SpaceSiteRouteProps) {
  return handler(req, { params: await props.params }, true)
}

export const dynamic = 'force-dynamic'
