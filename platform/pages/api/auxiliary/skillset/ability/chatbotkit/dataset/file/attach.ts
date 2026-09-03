import { authenticatedHandler } from '@/lib/auxiliary.handler'
import { getSessionClient } from '@/lib/cbk.sdk'
import debug from '@/lib/debug'
import fetch from '@/lib/egress.fetch'
import { typeToFileName } from '@/lib/mime'

import { FetchError as SdkFetchError } from '@chatbotkit/fetch'

import { z } from 'zod'

const schema = z.object({
  datasetId: z.string().min(1),
  url: z.string().url(),
})

export default authenticatedHandler(
  schema,
  async function (session, parameters, headers) {
    debug(`chatbotkit/dataset/file/attach`, {
      session,
      parameters,
      headers,
    }).log('auxiliary.skillset.ability.chatbotkit.dataset.file.attach.handler')

    const { datasetId, url } = parameters

    const client = await getSessionClient(session)

    // @note validate the dataset before fetching the url and creating the
    // file — otherwise a bad datasetId (models routinely pass made-up ids)
    // leaks an orphaned file and surfaces an uncorrectable generic 404

    try {
      await client.dataset.fetch(datasetId)
    } catch (e) {
      if (
        e instanceof SdkFetchError &&
        (e as SdkFetchError & { status?: number }).status === 404
      ) {
        return {
          error: {
            message: `Dataset ${datasetId} not found`,
          },
        }
      }

      throw e
    }

    let blob: Blob

    {
      const response = await fetch(url)

      if (!response.ok) {
        return {
          error: {
            message: `Failed to fetch file from ${url}`,
          },
        }
      }

      blob = await response.blob()
    }

    const { id: fileId } = await client.file.create({})

    await client.file.upload(fileId, {
      data: await blob.arrayBuffer(),
      type: blob.type,
      name: typeToFileName(blob.type),
    })

    await client.dataset.file.attach(datasetId, fileId, {
      type: 'source',
    })

    await client.dataset.file.sync(datasetId, fileId, {})

    return {
      fileId,
    }
  }
)
