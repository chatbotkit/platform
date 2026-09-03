// @note the declared surface of ./index.js. It is hand written because the
// implementation is JavaScript - see the note at the top of that file for why -
// and because a consumer resolving this package through node_modules would
// otherwise infer nothing from it.
import type { Partners } from '@chatbotkit-dev/partners-spec'

export type * from '@chatbotkit-dev/partners-spec'

declare const partners: Partners

export default partners
