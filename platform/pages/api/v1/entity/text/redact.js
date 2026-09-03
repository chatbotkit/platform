// @ts-check
import { withPost } from '@/lib/method'
import { detectPiiEntities, getSafeTextAndEntities } from '@/lib/pii'
import { parseRequestJson } from '@/lib/request'
import { badRequest, ok } from '@/lib/response'
import { withSubscription } from '@/lib/billing.handler'

export async function redactText(text) {
  const entities = await detectPiiEntities(text)

  // @todo record use of this

  const { safeText, safeEntities } = getSafeTextAndEntities(text, entities)

  return { text: safeText, entities: safeEntities }
}

export default withPost(
  withSubscription(async function (req) {
    const { text } = await parseRequestJson(req)

    if (typeof text !== 'string' || !text) {
      return badRequest('Invalid text')
    }

    const { text: safeText, entities } = await redactText(text)

    return ok({ text: safeText, entities: entities })
  })
)
