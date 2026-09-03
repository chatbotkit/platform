import { authenticatedHandler } from '@/lib/auxiliary.handler'
import { getSessionClient } from '@/lib/cbk.sdk'
import debug from '@/lib/debug'

import { z } from 'zod'

const schema = z.object({})

export default authenticatedHandler(
  schema,
  async function (session, parameters, headers) {
    debug(`chatbotkit/dataset/create`, {
      session,
      parameters,
      headers,
    }).log('auxiliary.skillset.ability.chatbotkit.dataset.create.handler')

    const {} = parameters

    const client = await getSessionClient(session)

    const response = await client.dataset.create({
      // @todo add default store
      // @todo add default reranker
    })

    return response
  }
)
