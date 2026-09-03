// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { parseRequestJson } from '@/lib/request'
import { notAuthorized, notFound, ok, respondFromError } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import { sendEvent } from '@/pages/api/v1/dataset/[datasetId]/queue'

/**
 * Accepts the results of a batch runner and queues them.
 *
 * @note this exists so that a runner never has to hold a queue credential. It
 * used to be handed the platform's own QStash token and publish directly, which
 * meant a vendor's key travelling into a container the platform starts but does
 * not control, valid for everything that key can do rather than for this one
 * import.
 *
 * What it gets now is a URL and a short-lived token scoped to this route and
 * this dataset alone. The runner posts here, and the platform puts the work on
 * the dataset queue itself - which is where it was always going. The queue is
 * still what does the work; this is only the doorway.
 *
 * @note deliberately thin. `sendEvent` validates the payload against the schema
 * for its event type and enqueues it, so there is no second place where the
 * shape of an import event is described.
 */
export default withPost(
  withSession(async function (req, session) {
    const dataset = await prisma.dataset.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'datasetId')
    )

    if (!dataset) {
      return notFound()
    }

    if (dataset.userId !== session.user.id) {
      return notAuthorized()
    }

    const { type, payload } = await parseRequestJson(req)

    debug(`ingesting runner event`, { datasetId: dataset.id, type }).log(
      'dataset.ingest'
    )

    try {
      await sendEvent(
        dataset.id,
        /** @type {Parameters<typeof sendEvent>[1]} */ ({ type, payload })
      )

      return ok()
    } catch (e) {
      return respondFromError(e)
    }
  })
)

// @note do not generate manuals or docs for this internal endpoint
