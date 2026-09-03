import { authenticatedHandler } from '@/lib/auxiliary.handler'
import { getSessionClient } from '@/lib/cbk.sdk'
import debug from '@/lib/debug'

import { z } from 'zod'

const schema = z.object({
  datasetId: z.string().min(1),
  text: z.string().min(1),
})

export default authenticatedHandler(
  schema,
  async function (session, parameters, headers) {
    debug(`chatbotkit/dataset/search`, {
      session,
      parameters,
      headers,
    }).log('auxiliary.skillset.ability.chatbotkit.dataset.search.handler')

    const { datasetId, text } = parameters

    const client = await getSessionClient(session)

    // @todo this api is strange, we need to pass an object

    const response = await client.dataset.search(datasetId, text)

    return response
  }
)
