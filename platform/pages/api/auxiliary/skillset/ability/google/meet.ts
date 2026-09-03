import { authenticatedMultiHandler } from '@/lib/auxiliary.handler'
import type { Session } from '@/lib/session.handler'
import call, { getCallError } from '@/lib/call'
import debug from '@/lib/debug'
import { throwNotAuthenticated, throwNotFound } from '@/lib/response'

import { z } from 'zod'

// --- Handler Names ---

export const RECORDING_LIST_HANDLER_NAME = 'recording/list' as const
export const RECORDING_TRANSCRIPT_FETCH_HANDLER_NAME =
  'recording/transcript/fetch' as const

// --- Schemas ---

export const recordingListSchema = z.object({})

export type RecordingListSchema = z.infer<typeof recordingListSchema>

export const recordingTranscriptFetchSchema = z.object({
  id: z.string(),
})

export type RecordingTranscriptFetchSchema = z.infer<
  typeof recordingTranscriptFetchSchema
>

// --- Handlers ---

async function recordingListHandler(
  _session: Session,
  parameters: RecordingListSchema,
  headers: Headers
) {
  debug(`google/recording/list`, { parameters, headers })

  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  const conferenceRecords: {
    name: string
    startTime: string
    endTime: string
    expireTime: string
  }[] = []

  {
    const url = new URL(`https://meet.googleapis.com/v2/conferenceRecords`)

    debug(`url`, url)

    const response = await call(url.href, {
      headers: {
        Authorization: token,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const result = await response.json()

    debug(`result`, result)

    if (Array.isArray(result.conferenceRecords)) {
      conferenceRecords.push(...result.conferenceRecords)
    }
  }

  if (!conferenceRecords?.length) {
    throw new Error('Conference records not found')
  }

  debug(`conferenceRecords`, conferenceRecords)

  return conferenceRecords.map(({ name, startTime, endTime, expireTime }) => {
    return {
      id: name.split('/').pop(),
      startTime,
      endTime,
      expireTime,
    }
  })
}

async function recordingTranscriptFetchHandler(
  _session: Session,
  parameters: RecordingTranscriptFetchSchema,
  headers: Headers
) {
  debug(`google/recording/transcript/fetch`, { parameters, headers })

  const { id } = parameters

  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  const participants: {
    name: string
    signedinUser: {
      user: string
      displayName: string
    }
  }[] = []

  {
    const url = new URL(
      `https://meet.googleapis.com/v2/conferenceRecords/${id}/participants`
    )

    debug(`url`, url)

    const response = await call(url.href, {
      headers: {
        Authorization: token,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const result = await response.json()

    debug(`result`, result)

    if (Array.isArray(result.participants)) {
      participants.push(...result.participants)
    }
  }

  if (!participants?.length) {
    throwNotFound(`Participants not found`)
  }

  const transcripts: { name: string }[] = []

  {
    const url = new URL(
      `https://meet.googleapis.com/v2/conferenceRecords/${id}/transcripts`
    )

    debug(`url`, url)

    const response = await call(url.href, {
      headers: {
        Authorization: token,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const result = await response.json()

    debug(`result`, result)

    if (Array.isArray(result.transcripts)) {
      transcripts.push(...result.transcripts)
    }
  }

  if (!transcripts?.length) {
    throwNotFound(`Transcripts not found`)
  }

  debug(`transcripts`, transcripts)

  const transcriptEntries: {
    participant: string
    text: string
    startTime: string
    endTime: string
  }[] = []

  {
    for (const transcript of transcripts) {
      const transcriptId = transcript.name.split('/').pop()

      let pageToken: string | undefined

      while (true) {
        const url = new URL(
          `https://meet.googleapis.com/v2/conferenceRecords/${id}/transcripts/${transcriptId}/entries`
        )

        url.searchParams.set('pageSize', '100')

        if (pageToken) {
          url.searchParams.set('pageToken', pageToken)
        }

        debug(`url`, url)

        const response = await call(url.href, {
          headers: {
            Authorization: token,
            Accept: 'application/json',
          },
        })

        if (!response.ok) {
          continue
        }

        const result = await response.json()

        debug(`result`, result)

        if (Array.isArray(result.transcriptEntries)) {
          transcriptEntries.push(...result.transcriptEntries)
        }

        if (result.nextPageToken) {
          pageToken = result.nextPageToken
        } else {
          break
        }
      }
    }
  }

  return transcriptEntries.map(({ participant, text, startTime, endTime }) => {
    return {
      participant:
        participants.find(({ name }) => name === participant)?.signedinUser
          ?.displayName || participant,
      text,
      startTime,
      endTime,
    }
  })
}

// --- Export Multi Handler ---

export default authenticatedMultiHandler({
  [RECORDING_LIST_HANDLER_NAME]: {
    schema: recordingListSchema,
    fn: recordingListHandler,
  },
  [RECORDING_TRANSCRIPT_FETCH_HANDLER_NAME]: {
    schema: recordingTranscriptFetchSchema,
    fn: recordingTranscriptFetchHandler,
  },
})
