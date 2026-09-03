import {
  array,
  createAuxiliaryTemplate,
  createPackTemplate,
  field,
} from '@/lib/ability.template'

import type {
  SHEET_CREATE_HANDLER_NAME,
  SHEET_DELETE_HANDLER_NAME,
  SPREADSHEET_CREATE_HANDLER_NAME,
  SPREADSHEET_FETCH_HANDLER_NAME,
  SheetCreateSchema,
  SheetDeleteSchema,
  SpreadsheetCreateSchema,
  SpreadsheetFetchSchema,
  VALUES_APPEND_HANDLER_NAME,
  VALUES_CLEAR_HANDLER_NAME,
  VALUES_READ_HANDLER_NAME,
  VALUES_UPDATE_HANDLER_NAME,
  ValuesAppendSchema,
  ValuesClearSchema,
  ValuesReadSchema,
  ValuesUpdateSchema,
} from '@/pages/api/auxiliary/skillset/ability/google/sheets'

// --- Path Constants ---

const SHEETS_API_PATH = '/api/auxiliary/skillset/ability/google/sheets'

/**
 * Catalogue of Google Sheets abilities.
 */
const abilities = {
  // --- Spreadsheet Abilities ---

  'google/sheets/spreadsheet/create':
    createAuxiliaryTemplate<SpreadsheetCreateSchema>({
      provider: 'google',
      icon: '@logo/google.com',
      name: 'Create Google Spreadsheet',
      description: 'Create a new Google Spreadsheet with an optional title.',
      tags: ['google', 'sheets', 'spreadsheet', 'create'],
      path: SHEETS_API_PATH,
      handler:
        'spreadsheet/create' satisfies typeof SPREADSHEET_CREATE_HANDLER_NAME,
      secret: '@platform/google/sheets',
      instruction: {
        title: field({
          name: 'title',
          description: 'the title of the spreadsheet',
          placeholder: true,
        }),
        sheetTitles: field({
          name: 'sheetTitles',
          description:
            'comma-separated list of sheet tab titles to create within the spreadsheet',
          optional: true,
        }),
      },
      options: {
        auth: 'internal',
      },
    }),

  'google/sheets/spreadsheet/fetch':
    createAuxiliaryTemplate<SpreadsheetFetchSchema>({
      provider: 'google',
      icon: '@logo/google.com',
      name: 'Fetch Google Spreadsheet',
      description:
        'Fetch metadata for a Google Spreadsheet including its sheets, title, and locale.',
      tags: ['google', 'sheets', 'spreadsheet', 'fetch'],
      path: SHEETS_API_PATH,
      handler:
        'spreadsheet/fetch' satisfies typeof SPREADSHEET_FETCH_HANDLER_NAME,
      secret: '@platform/google/sheets',
      instruction: {
        spreadsheetId: field({
          name: 'spreadsheetId',
          description: 'the spreadsheet ID',
          placeholder: true,
        }),
      },
      options: {
        auth: 'internal',
      },
    }),

  // --- Values Abilities ---

  'google/sheets/values/read': createAuxiliaryTemplate<ValuesReadSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Read Google Sheets Values',
    description:
      'Read cell values from a range in a Google Spreadsheet (e.g. Sheet1!A1:D10).',
    tags: ['google', 'sheets', 'values', 'read'],
    path: SHEETS_API_PATH,
    handler: 'values/read' satisfies typeof VALUES_READ_HANDLER_NAME,
    secret: '@platform/google/sheets',
    instruction: {
      spreadsheetId: field({
        name: 'spreadsheetId',
        description: 'the spreadsheet ID',
        placeholder: true,
      }),
      range: field({
        name: 'range',
        description:
          'the A1 notation range to read (e.g. Sheet1!A1:D10 or Sheet1!A:A)',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/sheets/values/update': createAuxiliaryTemplate<ValuesUpdateSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Update Google Sheets Values',
    description:
      'Write values to a specific range in a Google Spreadsheet, overwriting existing data.',
    tags: ['google', 'sheets', 'values', 'update'],
    path: SHEETS_API_PATH,
    handler: 'values/update' satisfies typeof VALUES_UPDATE_HANDLER_NAME,
    secret: '@platform/google/sheets',
    instruction: {
      spreadsheetId: field({
        name: 'spreadsheetId',
        description: 'the spreadsheet ID',
        placeholder: true,
      }),
      range: field({
        name: 'range',
        description: 'the A1 notation range to write to (e.g. Sheet1!A1:C3)',
        placeholder: true,
      }),
      values: array({
        name: 'values',
        description:
          'a 2D array of values to write (e.g. [["Name","Age"],["Alice","30"]])',
        items: array({
          items: field({
            name: 'value',
            description: 'cell value',
          }),
        }),
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/sheets/values/append': createAuxiliaryTemplate<ValuesAppendSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Append Rows to Google Sheets',
    description:
      'Append new rows of data after the last row with content in a Google Spreadsheet.',
    tags: ['google', 'sheets', 'values', 'append'],
    path: SHEETS_API_PATH,
    handler: 'values/append' satisfies typeof VALUES_APPEND_HANDLER_NAME,
    secret: '@platform/google/sheets',
    instruction: {
      spreadsheetId: field({
        name: 'spreadsheetId',
        description: 'the spreadsheet ID',
        placeholder: true,
      }),
      range: field({
        name: 'range',
        description: 'the A1 notation range to append to (e.g. Sheet1!A:D)',
        placeholder: true,
      }),
      values: array({
        name: 'values',
        description:
          'a 2D array of row values to append (e.g. [["Alice","30"],["Bob","25"]])',
        items: array({
          items: field({
            name: 'value',
            description: 'cell value',
          }),
        }),
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/sheets/values/clear': createAuxiliaryTemplate<ValuesClearSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Clear Google Sheets Values',
    description:
      'Clear all values in a specific range of a Google Spreadsheet.',
    tags: ['google', 'sheets', 'values', 'clear'],
    path: SHEETS_API_PATH,
    handler: 'values/clear' satisfies typeof VALUES_CLEAR_HANDLER_NAME,
    secret: '@platform/google/sheets',
    instruction: {
      spreadsheetId: field({
        name: 'spreadsheetId',
        description: 'the spreadsheet ID',
        placeholder: true,
      }),
      range: field({
        name: 'range',
        description: 'the A1 notation range to clear (e.g. Sheet1!A1:D10)',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  // --- Sheet Tab Abilities ---

  'google/sheets/sheet/create': createAuxiliaryTemplate<SheetCreateSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Create Sheet Tab',
    description: 'Add a new sheet tab to an existing Google Spreadsheet.',
    tags: ['google', 'sheets', 'sheet', 'create'],
    path: SHEETS_API_PATH,
    handler: 'sheet/create' satisfies typeof SHEET_CREATE_HANDLER_NAME,
    secret: '@platform/google/sheets',
    instruction: {
      spreadsheetId: field({
        name: 'spreadsheetId',
        description: 'the spreadsheet ID',
        placeholder: true,
      }),
      title: field({
        name: 'title',
        description: 'the title of the new sheet tab',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/sheets/sheet/delete': createAuxiliaryTemplate<SheetDeleteSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Delete Sheet Tab',
    description: 'Remove a sheet tab from a Google Spreadsheet.',
    tags: ['google', 'sheets', 'sheet', 'delete'],
    path: SHEETS_API_PATH,
    handler: 'sheet/delete' satisfies typeof SHEET_DELETE_HANDLER_NAME,
    secret: '@platform/google/sheets',
    instruction: {
      spreadsheetId: field({
        name: 'spreadsheetId',
        description: 'the spreadsheet ID',
        placeholder: true,
      }),
      sheetId: field({
        name: 'sheetId',
        description: 'the numeric sheet ID of the tab to delete',
        placeholder: true,
        type: 'number',
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  // --- Pack Abilities ---

  'pack/google/sheets': createPackTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Install Google Sheets Tools',
    description:
      'Installs Google Sheets tools into the conversation. You can create and fetch spreadsheets, read and write cell values, append rows, and manage sheet tabs.',
    tags: ['google', 'sheets', 'pack'],
    secret: '@platform/google/sheets',
    instruction: {
      abilities: [
        'google/sheets/spreadsheet/create',
        'google/sheets/spreadsheet/fetch',
        'google/sheets/values/read',
        'google/sheets/values/update',
        'google/sheets/values/append',
        'google/sheets/values/clear',
        'google/sheets/sheet/create',
        'google/sheets/sheet/delete',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/google/sheets[readonly]': createPackTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Install Google Sheets Tools (Read Only)',
    description:
      'Installs read-only Google Sheets tools into the conversation. You can fetch spreadsheet metadata and read cell values.',
    tags: ['google', 'sheets', 'pack', 'readonly'],
    secret: '@platform/google/sheets',
    instruction: {
      abilities: [
        'google/sheets/spreadsheet/fetch',
        'google/sheets/values/read',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
