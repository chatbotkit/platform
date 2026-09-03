import { authenticatedHandler } from '@/lib/auxiliary.handler'
import { getSessionClient } from '@/lib/cbk.sdk'
import debug from '@/lib/debug'

import { z } from 'zod'

const schema = z.object({
  datasetId: z.string().min(1),
  recordId: z.string().min(1),
})

export default authenticatedHandler(
  schema,
  async function (session, parameters, headers) {
    debug(`chatbotkit/dataset/record/delete`, {
      session,
      parameters,
      headers,
    }).log(
      'auxiliary.skillset.ability.chatbotkit.dataset.record.delete.handler'
    )

    const { datasetId, recordId } = parameters

    const client = await getSessionClient(session)

    const response = await client.dataset.record.delete(datasetId, recordId)

    return response
  }
)
