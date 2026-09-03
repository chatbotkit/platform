// @note pulls this implementation's schema from the spec. The spec does not
// know who implements it - the dependency arrow points this way on purpose.
import { derive, renderSqlite } from '@chatbotkit-dev/db-spec/derive'

import path from 'node:path'
import url from 'node:url'

await derive({
  prismaDir: path.join(
    path.dirname(url.fileURLToPath(import.meta.url)),
    '..',
    'prisma'
  ),

  render: renderSqlite,
})
