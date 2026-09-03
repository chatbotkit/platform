// @ts-check
import prisma from '@/prisma/client'

import { encodeUint8Array as encodeUint8ArrayAsB64 } from '@/lib/b64'
import debug from '@/lib/debug'
import { withFormDataPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { getUploadFile } from '@/lib/upload'
import { gzip } from '@/lib/zlib'

import { sendEvent } from '@/pages/api/v1/dataset/[datasetId]/queue'

export default withFormDataPost(
  withSession(async function (req, session) {
    const dataset = await prisma.dataset.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'datasetId'),
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )

    if (!dataset) {
      return notFound()
    }

    if (dataset.userId !== session.user.id) {
      return notAuthorized()
    }

    const file = await getUploadFile(req)

    debug(`received file`, { name: file.name, type: file.type })

    await sendEvent(dataset.id, {
      type: 'importBlob',
      payload: {
        dataZB64: encodeUint8ArrayAsB64(gzip(await file.arrayBuffer())),
        name: file.name,
        type: file.type,
      },
    })

    return ok({ id: dataset.id })
  })
)

export const config = {
  api: {
    bodyParser: false,
  },
}
