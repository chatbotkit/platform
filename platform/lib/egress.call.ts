// `call` for destinations a user or a model chose - `@/lib/call` (the
// Pipedream-aware fetch) with the egress boundary applied. See
// `lib/egress.fetch.ts` for the rule on when to use it.

import baseCall from '@/lib/call'
import { withEgressDispatcher } from '@/lib/egress.core'

export function call(url: string | URL, init?: RequestInit): Promise<Response> {
  return baseCall(url, withEgressDispatcher(init))
}

export default call
