import {
  createAuxiliaryTemplate,
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

import type {
  FILE_EXPORT_HANDLER_NAME,
  FILE_FETCH_HANDLER_NAME,
  FILE_LIST_HANDLER_NAME,
  FileExportSchema,
  FileFetchSchema,
  FileListSchema,
} from '@/pages/api/auxiliary/skillset/ability/google/drive'

// --- Path Constants ---

const DRIVE_API_PATH = '/api/auxiliary/skillset/ability/google/drive'

/**
 * Catalogue of Google Drive abilities.
 */
const abilities = {
  // --- File Search Abilities ---

  'google/drive/file/search': createAuxiliaryTemplate<FileListSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Search Google Drive Files',
    description: 'Search for files in Google Drive.',
    tags: ['google', 'drive', 'files', 'search'],
    path: DRIVE_API_PATH,
    handler: 'file/list' satisfies typeof FILE_LIST_HANDLER_NAME,
    secret: '@platform/google/drive',
    instruction: {
      search: field({
        name: 'search',
        description: 'the search phrase to search for',
        placeholder: true,
      }),
      searchScope: field({
        name: 'searchScope',
        description: 'the scope to search in',
        placeholder: true,
        enum: ['all', 'shared'],
        default: 'all',
      }),
      excerpts: 1,
      flat: true,
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/drive/file/search[ranked]': createAuxiliaryTemplate<FileListSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Search Google Drive Files (Ranked)',
    description:
      'Search for files in Google Drive and rerank them based on relevance.',
    tags: ['google', 'drive', 'files', 'search', 'ranked'],
    path: DRIVE_API_PATH,
    handler: 'file/list' satisfies typeof FILE_LIST_HANDLER_NAME,
    secret: '@platform/google/drive',
    instruction: {
      search: field({
        name: 'search',
        description: 'the search phrase to search for',
        placeholder: true,
      }),
      searchScope: field({
        name: 'searchScope',
        description: 'the scope to search in',
        placeholder: true,
        enum: ['all', 'shared'],
        default: 'all',
      }),
      excerpts: 1,
      flat: true,
    },
    options: {
      auth: 'internal',
    },
  }),

  // --- File List Ability ---

  'google/drive/file/list': createAuxiliaryTemplate<FileListSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'List Google Drive Files',
    description: 'List files in Google Drive by some order.',
    tags: ['google', 'drive', 'files', 'list'],
    path: DRIVE_API_PATH,
    handler: 'file/list' satisfies typeof FILE_LIST_HANDLER_NAME,
    secret: '@platform/google/docs',
    instruction: {},
    options: {
      auth: 'internal',
    },
  }),

  // --- File Fetch Ability ---

  'google/drive/file/fetch': createAuxiliaryTemplate<FileFetchSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Fetch Google Drive File',
    description:
      'Fetch the content of a Google Drive file in a text format. Supports optional line range to read specific sections. For efficiency, prefer reading larger chunks rather than many small sequential reads. Supports parallel reads of different sections when needed upfront.',
    tags: ['google', 'drive', 'files', 'fetch'],
    path: DRIVE_API_PATH,
    handler: 'file/fetch' satisfies typeof FILE_FETCH_HANDLER_NAME,
    secret: '@platform/google/docs',
    instruction: {
      documentId: field({
        name: 'documentId',
        description: 'the document ID',
        placeholder: true,
      }),
      startLine: field({
        name: 'startLine',
        description:
          'the line number to start reading from (0-indexed, line 0 is the first line)',
        type: 'number',
        min: 1,
      }),
      endLine: field({
        name: 'endLine',
        description:
          'the exclusive line number to end reading at (0-indexed). Prefer reading at least 100 lines or more per request to minimize round trips',
        type: 'number',
        min: 1,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  // --- File Export Ability ---

  'google/drive/file/export': createAuxiliaryTemplate<FileExportSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Export Google Drive File',
    description:
      'Creates a download link for a Google Drive file in a specific format. Suitable for email attachments.',
    tags: ['google', 'drive', 'files', 'export'],
    path: DRIVE_API_PATH,
    handler: 'file/export' satisfies typeof FILE_EXPORT_HANDLER_NAME,
    secret: '@platform/google/docs',
    instruction: {
      documentId: field({
        name: 'documentId',
        description: 'the document ID',
        placeholder: true,
      }),
      format: field({
        name: 'format',
        description:
          'the format of the document, i.e. application/pdf, text/plain, etc',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  // --- File Delete Ability ---

  'google/drive/file/delete': createFetchTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Delete Google Drive File',
    description: 'Delete a specific Google Drive file by id.',
    tags: ['google', 'drive', 'files', 'delete'],
    secret: '@platform/google/docs',
    instruction: {
      method: 'DELETE',
      url: 'https://www.googleapis.com/drive/v3',
      path: [
        '/files/',
        field({ name: 'documentId', description: 'document id' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'pack/google/drive': createPackTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Install Google Drive Tools',
    description:
      'Installs Google Drive tools into the conversation. You can search, list, fetch, export, and delete files.',
    tags: ['google', 'drive', 'pack', 'beta'],
    secret: '@platform/google/drive',
    instruction: {
      abilities: [
        'google/drive/file/search',
        'google/drive/file/list',
        'google/drive/file/fetch',
        'google/drive/file/export',
        'google/drive/file/delete',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/google/drive[read-only]': createPackTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Install Google Drive Search Tools',
    description:
      'Installs read-only Google Drive tools into the conversation. You can search, list, and fetch files without modification.',
    tags: ['google', 'drive', 'pack', 'beta'],
    secret: '@platform/google/drive',
    instruction: {
      abilities: [
        'google/drive/file/search',
        'google/drive/file/list',
        'google/drive/file/fetch',
        'google/drive/file/export',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
