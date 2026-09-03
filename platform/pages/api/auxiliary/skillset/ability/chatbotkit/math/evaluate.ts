import { authenticatedHandler } from '@/lib/auxiliary.handler'
import debug from '@/lib/debug'

import { evaluate } from 'mathjs'
import { z } from 'zod'

const schema = z.object({
  expression: z.string(),
})

export default authenticatedHandler(
  schema,
  async function (_session, parameters, headers) {
    debug(`chatbotkit/math/eval`, { parameters, headers }).log(
      'auxiliary.skillset.ability.chatbotkit.math.eval.handler'
    )

    const { expression } = parameters

    debug(`using`, {
      expression,
    }).log('auxiliary.skillset.ability.chatbotkit.math.eval.handler')

    const data = evaluate(expression)

    return data
  }
)
