import { authenticatedHandler } from '@/lib/auxiliary.handler'
import debug from '@/lib/debug'

import { unfurlPage } from '@/pages/api/v1/url/unfurl'

import { z } from 'zod'

const schema = z.object({
  url: z.string().url(),
})

export default authenticatedHandler(
  schema,
  async function (_session, parameters, headers) {
    debug(`chatbotkit/url/unfurl`, { parameters, headers }).log(
      'auxiliary.skillset.ability.chatbotkit.url.unfurl.handler'
    )

    const { url } = parameters

    debug(`using`, {
      url,
    }).log('auxiliary.skillset.ability.chatbotkit.url.unfurl.handler')

    const data = await unfurlPage(url)

    return data
  }
)
