import { authenticatedMultiHandler } from '@/lib/auxiliary.handler'
import type { Session } from '@/lib/session.handler'
import call, { getCallError } from '@/lib/call'
import debug from '@/lib/debug'
import type { Field } from '@/lib/field'
import { extractFields } from '@/lib/field'
import { throwNotAuthenticated } from '@/lib/response'
import { stringify as stringifyYaml } from '@/lib/yaml'

import { z } from 'zod'

// --- Handler Names ---

export const DOCUMENT_CREATE_HANDLER_NAME = 'document/create' as const
export const DOCUMENT_APPEND_HANDLER_NAME = 'document/append' as const
export const DOCUMENT_PREPEND_HANDLER_NAME = 'document/prepend' as const
export const DOCUMENT_UPDATE_HANDLER_NAME = 'document/update' as const
export const COMMENT_LIST_HANDLER_NAME = 'comment/list' as const
export const COMMENT_CREATE_HANDLER_NAME = 'comment/create' as const
export const COMMENT_RESOLVE_HANDLER_NAME = 'comment/resolve' as const
export const COMMENT_DELETE_HANDLER_NAME = 'comment/delete' as const
export const COMMENT_REPLY_CREATE_HANDLER_NAME = 'comment/reply/create' as const
export const COMMENT_REPLY_DELETE_HANDLER_NAME = 'comment/reply/delete' as const

// --- Schemas ---

export const documentCreateSchema = z.intersection(
  z.object({
    title: z.string(),
  }),
  z.union([
    z.object({
      text: z.string(),
    }),
    z.object({
      documentId: z.string(),
      fields: z.record(z.any()),
    }),
  ])
)

export type DocumentCreateSchema = z.infer<typeof documentCreateSchema>

export const documentAppendSchema = z.object({
  documentId: z.string().optional(),
  text: z.string(),
})

export type DocumentAppendSchema = z.infer<typeof documentAppendSchema>

export const documentPrependSchema = z.object({
  documentId: z.string().optional(),
  text: z.string(),
})

export type DocumentPrependSchema = z.infer<typeof documentPrependSchema>

export const documentUpdateSchema = z.object({
  documentId: z.string(),
  text: z.string(),
})

export type DocumentUpdateSchema = z.infer<typeof documentUpdateSchema>

export const commentListSchema = z.object({
  documentId: z.string(),
  includeDeleted: z.boolean().optional(),
})

export type CommentListSchema = z.infer<typeof commentListSchema>

export const commentCreateSchema = z.object({
  documentId: z.string(),
  content: z.string(),
})

export type CommentCreateSchema = z.infer<typeof commentCreateSchema>

export const commentResolveSchema = z.object({
  documentId: z.string(),
  commentId: z.string(),
})

export type CommentResolveSchema = z.infer<typeof commentResolveSchema>

export const commentDeleteSchema = z.object({
  documentId: z.string(),
  commentId: z.string(),
})

export type CommentDeleteSchema = z.infer<typeof commentDeleteSchema>

export const commentReplyCreateSchema = z.object({
  documentId: z.string(),
  commentId: z.string(),
  content: z.string(),
})

export type CommentReplyCreateSchema = z.infer<typeof commentReplyCreateSchema>

export const commentReplyDeleteSchema = z.object({
  documentId: z.string(),
  commentId: z.string(),
  replyId: z.string(),
})

export type CommentReplyDeleteSchema = z.infer<typeof commentReplyDeleteSchema>

// --- Handlers ---

async function documentCreateHandler(
  _session: Session,
  parameters: DocumentCreateSchema,
  headers: Headers
) {
  debug(`google/docs/document/create`, { parameters, headers })

  const { title } = parameters

  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  if ('text' in parameters) {
    const { text } = parameters

    // create a new document

    let newDocumentId: string

    {
      const url = new URL('https://docs.googleapis.com/v1/documents')

      const response = await call(url.href, {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
        }),
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const data = await response.json()

      debug(`data`, { data })

      newDocumentId = data.documentId
    }

    // append text to the new document

    const url = new URL(
      `https://docs.googleapis.com/v1/documents/${newDocumentId}:batchUpdate`
    )

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              text,
              location: {
                index: 1,
              },
            },
          },
        ],
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const data = await response.json()

    debug(`data`, { data })

    // return the new document id

    return {
      documentId: newDocumentId,
    }
  } else {
    const { documentId, fields } = parameters

    // check for documentId existence and throw if fields are missing

    let extractedFields: Field[]

    {
      const url = new URL(
        `https://docs.googleapis.com/v1/documents/${documentId}`
      )

      const response = await call(url.href, {
        headers: {
          Authorization: token,
        },
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const data = await response.json()

      debug(`data`, { data })

      const { body } = data

      const text = stringifyYaml(body)

      extractedFields = extractFields(text)

      const missingFields = Object.keys(fields).filter(
        (field) => !extractedFields.some(({ name }) => name === field)
      )

      if (missingFields.length > 0) {
        throw new Error(
          `Fields are missing in the document: ${missingFields.join(
            ', '
          )}. The following fields are available: ${extractedFields
            .map(({ name }) => name)
            .join(', ')}`
        )
      }
    }

    // make a copy of the document

    let newDocumentId: string

    {
      const url = new URL(
        `https://www.googleapis.com/drive/v3/files/${documentId}/copy`
      )

      const response = await call(url.href, {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: title,
        }),
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const data = await response.json()

      debug(`data`, { data })

      newDocumentId = data.id
    }

    // replace fields in the new document

    const response = await call(
      `https://docs.googleapis.com/v1/documents/${newDocumentId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: extractedFields.map(({ name, exact }) => {
            return {
              replaceAllText: {
                containsText: {
                  text: exact,
                  matchCase: true,
                },
                replaceText: fields[name],
              },
            }
          }),
        }),
      }
    )

    if (!response.ok) {
      throw await getCallError(response)
    }

    const data = await response.json()

    debug(`data`, { data })

    // return the new document id

    return {
      documentId: newDocumentId,
    }
  }
}

async function documentAppendHandler(
  _session: Session,
  parameters: DocumentAppendSchema,
  headers: Headers
) {
  debug(`google/docs/document/append`, { parameters, headers })

  const { documentId, text } = parameters

  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  // fetch the document first to get its size

  let endIndex: number

  {
    const url = new URL(
      `https://docs.googleapis.com/v1/documents/${documentId}`
    )

    const docResponse = await call(url.href, {
      headers: {
        Authorization: token,
      },
    })

    const docData = await docResponse.json()

    endIndex = docData.body.content[docData.body.content.length - 1].endIndex
  }

  // append text to the document

  const url = new URL(
    `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`
  )

  const response = await call(url.href, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            text,
            location: {
              index: endIndex,
            },
          },
        },
      ],
    }),
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data })

  return {
    documentId,
  }
}

async function documentPrependHandler(
  _session: Session,
  parameters: DocumentPrependSchema,
  headers: Headers
) {
  debug(`google/docs/document/prepend`, { parameters, headers })

  const { documentId, text } = parameters

  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  // prepend text at the beginning of the document

  const url = new URL(
    `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`
  )

  const response = await call(url.href, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            text,
            location: {
              index: 1,
            },
          },
        },
      ],
    }),
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data })

  return {
    documentId,
  }
}

async function documentUpdateHandler(
  _session: Session,
  parameters: DocumentUpdateSchema,
  headers: Headers
) {
  debug(`google/docs/document/update`, { parameters, headers })

  const { documentId, text } = parameters

  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  // fetch the document first to get its size

  let endIndex: number

  {
    const url = new URL(
      `https://docs.googleapis.com/v1/documents/${documentId}`
    )

    const docResponse = await call(url.href, {
      headers: {
        Authorization: token,
      },
    })

    const docData = await docResponse.json()

    endIndex = docData.body.content[docData.body.content.length - 1].endIndex
  }

  // replace the entire document content

  const url = new URL(
    `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`
  )

  const response = await call(url.href, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          deleteContentRange: {
            range: {
              startIndex: 1,
              endIndex: endIndex - 1,
            },
          },
        },
        {
          insertText: {
            text,
            location: {
              index: 1,
            },
          },
        },
      ],
    }),
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data })

  return {
    documentId,
  }
}

async function commentListHandler(
  _session: Session,
  parameters: CommentListSchema,
  headers: Headers
) {
  debug(`google/docs/comment/list`, { parameters, headers })

  const { documentId, includeDeleted } = parameters

  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  const url = new URL(
    `https://www.googleapis.com/drive/v3/files/${documentId}/comments`
  )

  url.searchParams.set(
    'fields',
    'comments(id,content,author,createdTime,modifiedTime,resolved,replies(id,content,author,createdTime,modifiedTime,deleted))'
  )

  if (includeDeleted) {
    url.searchParams.set('includeDeleted', 'true')
  }

  const response = await call(url.href, {
    headers: {
      Authorization: token,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data })

  return data.comments ?? []
}

async function commentCreateHandler(
  _session: Session,
  parameters: CommentCreateSchema,
  headers: Headers
) {
  debug(`google/docs/comment/create`, { parameters, headers })

  const { documentId, content } = parameters

  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  const url = new URL(
    `https://www.googleapis.com/drive/v3/files/${documentId}/comments`
  )

  url.searchParams.set('fields', 'id,content,author,createdTime,resolved')

  const response = await call(url.href, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data })

  return data
}

async function commentResolveHandler(
  _session: Session,
  parameters: CommentResolveSchema,
  headers: Headers
) {
  debug(`google/docs/comment/resolve`, { parameters, headers })

  const { documentId, commentId } = parameters

  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  const url = new URL(
    `https://www.googleapis.com/drive/v3/files/${documentId}/comments/${commentId}`
  )

  url.searchParams.set('fields', 'id,content,resolved')

  const response = await call(url.href, {
    method: 'PATCH',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ resolved: true }),
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data })

  return data
}

async function commentDeleteHandler(
  _session: Session,
  parameters: CommentDeleteSchema,
  headers: Headers
) {
  debug(`google/docs/comment/delete`, { parameters, headers })

  const { documentId, commentId } = parameters

  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  const url = new URL(
    `https://www.googleapis.com/drive/v3/files/${documentId}/comments/${commentId}`
  )

  const response = await call(url.href, {
    method: 'DELETE',
    headers: {
      Authorization: token,
    },
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  debug(`deleted comment`, { documentId, commentId })

  return { commentId }
}

async function commentReplyCreateHandler(
  _session: Session,
  parameters: CommentReplyCreateSchema,
  headers: Headers
) {
  debug(`google/docs/comment/reply/create`, { parameters, headers })

  const { documentId, commentId, content } = parameters

  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  const url = new URL(
    `https://www.googleapis.com/drive/v3/files/${documentId}/comments/${commentId}/replies`
  )

  url.searchParams.set('fields', 'id,content,author,createdTime')

  const response = await call(url.href, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data })

  return data
}

async function commentReplyDeleteHandler(
  _session: Session,
  parameters: CommentReplyDeleteSchema,
  headers: Headers
) {
  debug(`google/docs/comment/reply/delete`, { parameters, headers })

  const { documentId, commentId, replyId } = parameters

  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  const url = new URL(
    `https://www.googleapis.com/drive/v3/files/${documentId}/comments/${commentId}/replies/${replyId}`
  )

  const response = await call(url.href, {
    method: 'DELETE',
    headers: {
      Authorization: token,
    },
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  debug(`deleted reply`, { documentId, commentId, replyId })

  return { replyId }
}

// --- Export Multi Handler ---

export default authenticatedMultiHandler({
  [DOCUMENT_CREATE_HANDLER_NAME]: {
    schema: documentCreateSchema,
    fn: documentCreateHandler,
  },
  [DOCUMENT_APPEND_HANDLER_NAME]: {
    schema: documentAppendSchema,
    fn: documentAppendHandler,
  },
  [DOCUMENT_PREPEND_HANDLER_NAME]: {
    schema: documentPrependSchema,
    fn: documentPrependHandler,
  },
  [DOCUMENT_UPDATE_HANDLER_NAME]: {
    schema: documentUpdateSchema,
    fn: documentUpdateHandler,
  },
  [COMMENT_LIST_HANDLER_NAME]: {
    schema: commentListSchema,
    fn: commentListHandler,
  },
  [COMMENT_CREATE_HANDLER_NAME]: {
    schema: commentCreateSchema,
    fn: commentCreateHandler,
  },
  [COMMENT_RESOLVE_HANDLER_NAME]: {
    schema: commentResolveSchema,
    fn: commentResolveHandler,
  },
  [COMMENT_DELETE_HANDLER_NAME]: {
    schema: commentDeleteSchema,
    fn: commentDeleteHandler,
  },
  [COMMENT_REPLY_CREATE_HANDLER_NAME]: {
    schema: commentReplyCreateSchema,
    fn: commentReplyCreateHandler,
  },
  [COMMENT_REPLY_DELETE_HANDLER_NAME]: {
    schema: commentReplyDeleteSchema,
    fn: commentReplyDeleteHandler,
  },
})
