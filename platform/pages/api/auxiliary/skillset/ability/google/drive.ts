import { timePlusDays } from '@chatbotkit-dev/time'

import { distributed } from '@/lib/array'
import { NONE_AUDIENCE } from '@/lib/audience.consts'
import { authenticatedMultiHandler } from '@/lib/auxiliary.handler'
import type { Session } from '@/lib/session.handler'
import { callPlusPlus as call, getCallError } from '@/lib/call'
import debug from '@/lib/debug'
import { chunkFile, isSupportedContentType } from '@/lib/dsd2'
import { getExternalAPIHostURL } from '@/lib/host'
import { raceTasks, runTasksMap } from '@/lib/job'
import { sleep } from '@/lib/promise'
import { throwNotAuthenticated } from '@/lib/response'
import { getShortURL } from '@/lib/short'
import { sign } from '@/lib/signature.url'
import { getRandomId } from '@/lib/string'
import { z } from '@/lib/zod.schema'

// --- Handler Names ---

export const FILE_LIST_HANDLER_NAME = 'file/list' as const
export const FILE_FETCH_HANDLER_NAME = 'file/fetch' as const
export const FILE_EXPORT_HANDLER_NAME = 'file/export' as const

// --- Constants ---

const DEFAULT_PAGE_SIZE = 10

const MAX_CONCURRENT_WORKER = 10

const DOCUMENT_SIZE_LIMIT_IN_BYTES = 4_194_304

const DEFAULT_CHUNK_SIZE = 256

const DEFAULT_CHUNK_OVERLAP = Math.round(DEFAULT_CHUNK_SIZE * 0.2)

const MAX_CHUNK_WAIT = 10_000

/**
 * @note this list was extracted from Google's documentation
 * @see https://developers.google.com/drive/api/guides/ref-export-formats
 */
const supportedTypes = [
  {
    category: 'Documents',
    formats: [
      {
        name: 'Microsoft Word',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extension: '.docx',
      },
      {
        name: 'OpenDocument',
        mime: 'application/vnd.oasis.opendocument.text',
        extension: '.odt',
      },
      { name: 'Rich Text', mime: 'application/rtf', extension: '.rtf' },
      { name: 'PDF', mime: 'application/pdf', extension: '.pdf' },
      { name: 'Plain Text', mime: 'text/plain', extension: '.txt' },
      { name: 'Web Page (HTML)', mime: 'application/zip', extension: '.zip' },
      { name: 'EPUB', mime: 'application/epub+zip', extension: '.epub' },
      { name: 'Markdown', mime: 'text/markdown', extension: '.md' },
    ],
  },
  {
    category: 'Spreadsheets',
    formats: [
      {
        name: 'Microsoft Excel',
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extension: '.xlsx',
      },
      {
        name: 'OpenDocument',
        mime: 'application/x-vnd.oasis.opendocument.spreadsheet',
        extension: '.ods',
      },
      { name: 'PDF', mime: 'application/pdf', extension: '.pdf' },
      { name: 'Web Page (HTML)', mime: 'application/zip', extension: '.zip' },
      {
        name: 'Comma Separated Values (first-sheet only)',
        mime: 'text/csv',
        extension: '.csv',
      },
      {
        name: 'Tab Separated Values (first-sheet only)',
        mime: 'text/tab-separated-values',
        extension: '.tsv',
      },
    ],
  },
  {
    category: 'Presentations',
    formats: [
      {
        name: 'Microsoft PowerPoint',
        mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        extension: '.pptx',
      },
      {
        name: 'ODP',
        mime: 'application/vnd.oasis.opendocument.presentation',
        extension: '.odp',
      },
      { name: 'PDF', mime: 'application/pdf', extension: '.pdf' },
      { name: 'Plain Text', mime: 'text/plain', extension: '.txt' },
      {
        name: 'JPEG (first-slide only)',
        mime: 'image/jpeg',
        extension: '.jpg',
      },
      { name: 'PNG (first-slide only)', mime: 'image/png', extension: '.png' },
      {
        name: 'Scalable Vector Graphics (first-slide only)',
        mime: 'image/svg+xml',
        extension: '.svg',
      },
    ],
  },
  {
    category: 'Drawings',
    formats: [
      { name: 'PDF', mime: 'application/pdf', extension: '.pdf' },
      { name: 'JPEG', mime: 'image/jpeg', extension: '.jpg' },
      { name: 'PNG', mime: 'image/png', extension: '.png' },
      {
        name: 'Scalable Vector Graphics',
        mime: 'image/svg+xml',
        extension: '.svg',
      },
    ],
  },
  {
    category: 'Apps Script',
    formats: [
      {
        name: 'JSON',
        mime: 'application/vnd.google-apps.script+json',
        extension: '.json',
      },
    ],
  },
  {
    category: 'Google Vids',
    formats: [
      {
        name: 'MP4',
        mime: 'application/vnd.google-apps.vid',
        extension: '.mp4',
      },
    ],
  },
]

/**
 * @note this list was extracted from Google's documentation
 */
const supportedMimes: string[] = supportedTypes.flatMap(({ formats }) =>
  formats.map(({ mime }) => mime)
)

/**
 * Map of Google Apps file types to their supported text export MIME types.
 *
 * @note Not all Google Apps file types support text export. For those that
 * don't, we return null and the caller should handle it gracefully.
 * @see https://developers.google.com/drive/api/guides/ref-export-formats
 */
const googleAppsExportMimeTypes: Record<string, string | null> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
  'application/vnd.google-apps.drawing': null, // no text export support
  'application/vnd.google-apps.form': null, // no text export support
  'application/vnd.google-apps.site': null, // no text export support
  'application/vnd.google-apps.map': null, // no text export support
  'application/vnd.google-apps.script': null, // JSON only, not text
  'application/vnd.google-apps.shortcut': null, // shortcuts have no content
  'application/vnd.google-apps.folder': null, // folders have no content
  'application/vnd.google-apps.fusiontable': null, // deprecated
  'application/vnd.google-apps.jam': null, // Jamboard - no text export
  'application/vnd.google-apps.vid': null, // Google Vids - video content
}

/**
 * Get the appropriate export MIME type for a given Google Apps file type.
 *
 * @param mimeType - The MIME type of the file (e.g., 'application/vnd.google-apps.document')
 * @returns The export MIME type to use (e.g., 'text/plain'), or null if text export is not supported
 */
export function getExportMimeType(mimeType: string): string | null {
  // only handle Google Apps files

  if (!mimeType.startsWith('application/vnd.google-apps.')) {
    return null
  }

  // return the mapped export type, or null if not in the map (unknown type)

  return googleAppsExportMimeTypes[mimeType] ?? null
}

// --- Schemas ---

export const fileListSchema = z.object({
  search: z.string().optional(),
  searchScope: z.enum(['all', 'shared']).optional(),
  owner: z.string().optional(),
  excerpts: z.number().optional(),
  flat: z.boolean().optional(),
  pageSize: z.coerce.number().optional().default(DEFAULT_PAGE_SIZE),
})

export type FileListSchema = z.infer<typeof fileListSchema>

export const fileFetchSchema = z.object({
  documentId: z.string(),
  startLine: z.coerce.number(),
  endLine: z.coerce.number(),
})

export type FileFetchSchema = z.infer<typeof fileFetchSchema>

export const fileExportSchema = z.object({
  documentId: z.string(),
  format: z.enum(supportedMimes as [string, ...string[]]),
})

export type FileExportSchema = z.infer<typeof fileExportSchema>

// --- Helper Functions ---

/**
 * Get access token from headers or throw authentication error
 *
 * @throws {Error} if not authenticated
 */
function getAccessToken(headers: Headers): string {
  const token = headers.get('x-access-token')

  debug(`token`, { hasToken: !!token }).log(
    'auxiliary.skillset.ability.google.drive.getAccessToken'
  )

  if (!token) {
    return throwNotAuthenticated()
  }

  return token
}

/**
 * Download file content from Google Drive
 */
export async function downloadFileContent({
  token,
  documentId,
}: {
  token: string
  documentId: string
}): Promise<{
  content: string
  fileName: string
  mimeType: string
}> {
  // @todo implement caching

  // first, get file metadata to check its MIME type

  const metadataUrl = new URL(
    `https://www.googleapis.com/drive/v3/files/${documentId}`
  )

  metadataUrl.searchParams.set('supportsAllDrives', 'true')

  const metadataResponse = await call(metadataUrl.href, {
    headers: {
      Authorization: token,
    },
  })

  if (!metadataResponse.ok) {
    throw await getCallError(metadataResponse)
  }

  const { mimeType, name: fileName } = await metadataResponse.json()

  debug(`file type`, { mimeType, fileName }).log(
    'auxiliary.skillset.ability.google.drive.downloadFileContent'
  )

  // check if it's a Google Docs Editors file

  const isGoogleDocsFile = mimeType.startsWith('application/vnd.google-apps.')

  let content

  if (isGoogleDocsFile) {
    // for Google Apps files, check if text export is supported

    const exportMimeType = getExportMimeType(mimeType)

    if (exportMimeType) {
      // use the export API with the appropriate format

      const exportUrl = new URL(
        `https://www.googleapis.com/drive/v3/files/${documentId}/export`
      )

      exportUrl.searchParams.set('mimeType', exportMimeType)

      const exportResponse = await call(exportUrl.href, {
        headers: {
          Authorization: token,
          Accept: exportMimeType,
        },
      })

      if (!exportResponse.ok) {
        throw await getCallError(exportResponse)
      }

      content = await exportResponse.text()
    } else {
      // file type doesn't support text export, return empty content

      debug(`unsupported Google Apps type for text export`, { mimeType }).log(
        'auxiliary.skillset.ability.google.drive.downloadFileContent'
      )

      content = ''
    }
  } else {
    // for non-Google Docs files, download directly

    if (isSupportedContentType(mimeType)) {
      const downloadUrl = new URL(
        `https://www.googleapis.com/drive/v3/files/${documentId}`
      )

      downloadUrl.searchParams.set('supportsAllDrives', 'true')
      downloadUrl.searchParams.set('alt', 'media')

      const downloadResponse = await call(downloadUrl.href, {
        headers: {
          Authorization: token,
        },
      })

      if (!downloadResponse.ok) {
        throw await getCallError(downloadResponse)
      }

      const blob = await downloadResponse.blob()

      const result = await chunkFile(blob, {
        size: Number.MAX_SAFE_INTEGER,
        overlap: 0,
      })

      content = result.items.map(({ text }) => text).join('\n\n')
    } else {
      content = ''
    }
  }

  debug(`content`, { content }).log(
    'auxiliary.skillset.ability.google.drive.downloadFileContent'
  )

  return {
    content,

    fileName,

    mimeType,
  }
}

// --- File List Handler ---

async function fileListHandler(_session: Session, parameters: FileListSchema, headers: Headers) {
  debug(`google/drive/file/list`, { parameters, headers }).log(
    'auxiliary.skillset.ability.google.drive.fileListHandler'
  )

  const { search, searchScope, owner, excerpts, flat, pageSize } = parameters

  const token = getAccessToken(headers)

  let q = ''

  {
    function sq(input: string): string {
      input = input
        .replace(/[^a-zA-Z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      return `'${input}'`
    }

    const parts: string[] = []

    if (search) {
      parts.push(
        `(name contains ${sq(search)} OR fullText contains ${sq(search)})`
      )
    }

    if (owner) {
      parts.push(`${sq(owner)} in owners`)
    }

    q = parts.join(' AND ')
  }

  debug(`using`, { q }).log(
    'auxiliary.skillset.ability.google.drive.fileListHandler'
  )

  const searchUrl = new URL('https://www.googleapis.com/drive/v3/files')

  switch (searchScope) {
    case 'shared': {
      searchUrl.searchParams.set('corpora', 'user')

      break
    }

    default: {
      searchUrl.searchParams.set('corpora', 'allDrives')
      searchUrl.searchParams.set('supportsAllDrives', 'true')
      searchUrl.searchParams.set('includeItemsFromAllDrives', 'true')

      break
    }
  }

  searchUrl.searchParams.set('includeLabels', 'true') // @todo make it configurable

  // @note we used to support orderBy but it was removed because apparently the
  // api does not support ordering when used with fullText search

  if (q) {
    searchUrl.searchParams.set('q', q)
  }

  if (pageSize) {
    searchUrl.searchParams.set('pageSize', pageSize.toString())
  }

  const response = await call(searchUrl.href, {
    method: 'GET',
    headers: {
      Authorization: token,
    },
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data }).log(
    'auxiliary.skillset.ability.google.drive.fileListHandler'
  )

  // @todo use a it/batch for better performance

  const files = await runTasksMap(
    MAX_CONCURRENT_WORKER,
    data.files,
    async (file: { id: string; name: string }) => {
      try {
        const detailsUrl = new URL(
          `https://www.googleapis.com/drive/v3/files/${file.id}`
        )

        detailsUrl.searchParams.set(
          'fields',
          'id,name,description,mimeType,webViewLink,createdTime,modifiedTime,owners,size'
        )
        detailsUrl.searchParams.set('supportsAllDrives', 'true')

        const detailsResponse = await call(detailsUrl.href, {
          method: 'GET',
          headers: {
            Authorization: token,
          },
        })

        if (!detailsResponse.ok) {
          throw await getCallError(detailsResponse)
        }

        const fileDetails = await detailsResponse.json()

        interface Info {
          id: string
          name: string
          description: string | null

          link: string

          type: string

          createdTime: string
          modifiedTime: string

          ownerName: string | null

          excerpts: string[] | undefined
        }

        const info: Info = {
          id: fileDetails.id,
          name: fileDetails.name,
          description: fileDetails.description || null,

          link: fileDetails.webViewLink,

          type: fileDetails.mimeType,

          createdTime: fileDetails.createdTime,
          modifiedTime: fileDetails.modifiedTime,

          ownerName:
            fileDetails.owners && fileDetails.owners.length > 0
              ? fileDetails.owners[0].displayName
              : null,

          excerpts: undefined,
        }

        const fileSize = parseInt(fileDetails.size || 0, 10)

        if (
          excerpts &&
          fileSize > 0 &&
          fileSize < DOCUMENT_SIZE_LIMIT_IN_BYTES
        ) {
          try {
            const size = DEFAULT_CHUNK_SIZE
            const overlap = DEFAULT_CHUNK_OVERLAP

            const result = await raceTasks([
              async () => {
                if (info.type.startsWith('application/vnd.google-apps.')) {
                  // @note this is a google apps file, check if it supports text export
                  const exportMimeType = getExportMimeType(info.type)

                  if (!exportMimeType) {
                    // file type doesn't support text export, return empty result
                    return {
                      request: {
                        size: size,
                        overlap: overlap,
                      },
                      items: [],
                    }
                  }

                  const exportUrl = new URL(
                    `https://www.googleapis.com/drive/v3/files/${file.id}/export`
                  )

                  exportUrl.searchParams.set('mimeType', exportMimeType)

                  const response = await call(exportUrl.href, {
                    method: 'GET',
                    headers: {
                      Authorization: token,
                      Accept: exportMimeType,
                    },
                  })

                  if (!response.ok) {
                    throw await getCallError(response)
                  }

                  const blob = await response.blob()

                  return await chunkFile(blob, { size, overlap })
                } else {
                  // @note this is a regular file that can be downloaded

                  if (isSupportedContentType(info.type)) {
                    const downloadUrl = new URL(
                      `https://www.googleapis.com/drive/v3/files/${file.id}`
                    )

                    downloadUrl.searchParams.set('supportsAllDrives', 'true')
                    downloadUrl.searchParams.set('alt', 'media')

                    const downloadResponse = await call(downloadUrl.href, {
                      headers: {
                        Authorization: token,
                      },
                    })

                    if (!downloadResponse.ok) {
                      throw await getCallError(downloadResponse)
                    }

                    const blob = await downloadResponse.blob()

                    return await chunkFile(blob, { size, overlap })
                  } else {
                    return {
                      request: {
                        size: size,
                        overlap: overlap,
                      },
                      items: [],
                    }
                  }
                }
              },

              async () => {
                await sleep(MAX_CHUNK_WAIT)

                return {
                  request: {
                    size: size,
                    overlap: overlap,
                  },
                  items: [],
                }
              },
            ])

            const chunks =
              result?.items.map(({ text }, id) => ({
                id: `${id}`,
                text: text,
              })) || []

            info.excerpts = distributed(
              chunks.map(({ text }) => text),
              excerpts
            )
          } catch (e) {
            debug(`couldn't chunk file content`, { file: file, error: e }).log(
              'auxiliary.skillset.ability.google.drive.fileListHandler'
            )
          }
        }

        return info
      } catch (e) {
        debug(`couldn't fetch file info`, { file: file, error: e }).log(
          'auxiliary.skillset.ability.google.drive.fileListHandler'
        )

        return {
          id: file.id,
          name: file.name,
        }
      }
    }
  )

  const result = {
    files,
  }

  if (excerpts && flat) {
    result.files = result.files
      .map((file) => {
        if (file && 'excerpts' in file && file.excerpts) {
          return file.excerpts.map((excerpt) => ({
            ...file,

            excerpt,
          }))
        } else {
          return [file]
        }
      })
      .flat()
  }

  result.files = result.files.filter(Boolean)

  debug(`result`, { result }).log(
    'auxiliary.skillset.ability.google.drive.fileListHandler'
  )

  return result
}

// --- File Fetch Handler ---

// @todo introduce caching at a later stage to avoid re-fetching the same file
// content when reading multiple ranges from the same document

async function fileFetchHandler(_session: Session, parameters: FileFetchSchema, headers: Headers) {
  debug(`google/drive/file/fetch`, { parameters, headers }).log(
    'auxiliary.skillset.ability.google.drive.fileFetchHandler'
  )

  const { documentId, startLine, endLine } = parameters

  const token = getAccessToken(headers)

  const { content, fileName, mimeType } = await downloadFileContent({
    token,
    documentId,
  })

  // extract lines based on range
  // @note line numbers are 0-indexed (line 0 is the first line)
  // @note endLine is exclusive (if endLine is 50, lines 0-49 are returned)

  const lines = content.split('\n')
  const totalLines = lines.length

  const start = Math.max(0, startLine)
  const end = Math.min(lines.length, endLine)

  const outputContent = lines.slice(start, end).join('\n')

  return {
    documentId,

    content: outputContent,

    fileName,
    mimeType,

    totalLines,
    startLine,
    endLine,
  }
}

// --- File Export Handler ---

async function fileExportHandler(
  _session: Session,
  parameters: FileExportSchema,
  headers: Headers
) {
  debug(`google/drive/file/export`, { parameters, headers }).log(
    'auxiliary.skillset.ability.google.drive.fileExportHandler'
  )

  const { documentId, format } = parameters

  const token = getAccessToken(headers)

  // check the document exists

  let name: string

  {
    const url = new URL(
      `https://www.googleapis.com/drive/v3/files/${documentId}`
    )

    const response = await call(url.href, {
      method: 'GET',
      headers: {
        Authorization: token,
      },
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const data = await response.json()

    debug(`data`, { data }).log(
      'auxiliary.skillset.ability.google.drive.fileExportHandler'
    )

    name = data.title
  }

  // generate a short URL to the document

  const url = await getShortURL(
    (
      await sign(
        getExternalAPIHostURL(
          '/api/auxiliary/skillset/ability/google/drive/file/link'
        ),
        {
          id: getRandomId('session-'),

          user: {
            id: getRandomId('user-'),
            email: `user@user`,
          },

          options: {
            token,
            documentId,
            format,
            name,
          },

          payload: {
            aud: NONE_AUDIENCE,
          },

          expires: timePlusDays(1).toISOString(),
        }
      )
    ).href
  )

  debug(`url`, { url }).log(
    'auxiliary.skillset.ability.google.drive.fileExportHandler'
  )

  // return the short URL

  return {
    url: url,
  }
}

// --- Export Multi Handler ---

export default authenticatedMultiHandler({
  [FILE_LIST_HANDLER_NAME]: {
    schema: fileListSchema,
    fn: fileListHandler,
  },
  [FILE_FETCH_HANDLER_NAME]: {
    schema: fileFetchSchema,
    fn: fileFetchHandler,
  },
  [FILE_EXPORT_HANDLER_NAME]: {
    schema: fileExportSchema,
    fn: fileExportHandler,
  },
})
