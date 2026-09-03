// `fetch` for destinations a user or a model chose.
//
// Same signature as `@/lib/fetch`, so a call site opts into the egress
// boundary by changing one import. Every connection it opens is checked
// against `lib/egress.core.ts`: literal addresses in the connector, DNS
// answers at resolution, every redirect hop, non-public addresses refused.
// Use it - not the plain module - wherever the URL came from a request, a
// model, or a user's configuration. The platform's own calls to its
// operator-configured infrastructure stay on the plain module. For `call`,
// see `lib/egress.call.ts`.

import { withRetry, withTimeout } from '@chatbotkit-dev/fetch'

import { withEgressDispatcher } from '@/lib/egress.core'
import baseFetch from '@/lib/fetch'

export function fetch(url: string | URL, init?: RequestInit): Promise<Response> {
  return baseFetch(url, withEgressDispatcher(init))
}

export const fetchPlusPlus = withRetry(withTimeout(fetch))

export default fetch
