// @note the platform's key-value store.
//
// A re-export of `@chatbotkit-dev/memcache`, which pnpm resolves to either the
// in-memory community default or this deployment's implementation. The module
// stays here, rather than every caller importing the package directly, because
// fifty-two modules import it and none of them needs to know which of the two
// it got.

import memcache from '@chatbotkit-dev/memcache'

export type * from '@chatbotkit-dev/memcache-spec'

export { memcache }

export default memcache
