import { authenticatedMultiHandler } from '@/lib/auxiliary.handler'
import type { Session } from '@/lib/session.handler'
import call, { getCallError } from '@/lib/call'
import debug from '@/lib/debug'
import { throwNotAuthenticated } from '@/lib/response'

import { z } from 'zod'

// @note agents often send stringified JSON arrays for the values field
function coerceJsonArray(val: unknown) {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val)
    } catch {
      return val
    }
  }

  return val
}

// --- Handler Names ---

export const SPREADSHEET_CREATE_HANDLER_NAME = 'spreadsheet/create' as const
export const SPREADSHEET_FETCH_HANDLER_NAME = 'spreadsheet/fetch' as const
export const VALUES_READ_HANDLER_NAME = 'values/read' as const
export const VALUES_UPDATE_HANDLER_NAME = 'values/update' as const
export const VALUES_APPEND_HANDLER_NAME = 'values/append' as const
export const VALUES_CLEAR_HANDLER_NAME = 'values/clear' as const
export const SHEET_CREATE_HANDLER_NAME = 'sheet/create' as const
export const SHEET_DELETE_HANDLER_NAME = 'sheet/delete' as const

// --- Schemas ---

export const spreadsheetCreateSchema = z.object({
  title: z.string(),
  sheetTitles: z.string().optional(),
})

export type SpreadsheetCreateSchema = z.infer<typeof spreadsheetCreateSchema>

export const spreadsheetFetchSchema = z.object({
  spreadsheetId: z.string(),
})

export type SpreadsheetFetchSchema = z.infer<typeof spreadsheetFetchSchema>

export const valuesReadSchema = z.object({
  spreadsheetId: z.string(),
  range: z.string(),
})

export type ValuesReadSchema = z.infer<typeof valuesReadSchema>

export const valuesUpdateSchema = z.object({
  spreadsheetId: z.string(),
  range: z.string(),
  values: z.preprocess(coerceJsonArray, z.array(z.array(z.any()))),
})

export type ValuesUpdateSchema = z.infer<typeof valuesUpdateSchema>

export const valuesAppendSchema = z.object({
  spreadsheetId: z.string(),
  range: z.string(),
  values: z.preprocess(coerceJsonArray, z.array(z.array(z.any()))),
})

export type ValuesAppendSchema = z.infer<typeof valuesAppendSchema>

export const valuesClearSchema = z.object({
  spreadsheetId: z.string(),
  range: z.string(),
})

export type ValuesClearSchema = z.infer<typeof valuesClearSchema>

export const sheetCreateSchema = z.object({
  spreadsheetId: z.string(),
  title: z.string(),
})

export type SheetCreateSchema = z.infer<typeof sheetCreateSchema>

export const sheetDeleteSchema = z.object({
  spreadsheetId: z.string(),
  sheetId: z.number(),
})

export type SheetDeleteSchema = z.infer<typeof sheetDeleteSchema>

// --- Handlers ---

async function spreadsheetCreateHandler(
  _session: Session,
  parameters: SpreadsheetCreateSchema,
  headers: Headers
) {
  debug(`google/sheets/spreadsheet/create`, { parameters, headers })

  const { title, sheetTitles } = parameters

  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  const sheets = sheetTitles
    ? sheetTitles.split(',').map((t) => ({
        properties: { title: t.trim() },
      }))
    : undefined

  const url = new URL('https://sheets.googleapis.com/v4/spreadsheets')

  const response = await call(url.href, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets,
    }),
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data })

  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl,
    title: data.properties.title,
    sheets: data.sheets.map(
      (s: { properties: { sheetId: number; title: string } }) => ({
        sheetId: s.properties.sheetId,
        title: s.properties.title,
      })
    ),
  }
}

async function spreadsheetFetchHandler(
  _session: Session,
  parameters: SpreadsheetFetchSchema,
  headers: Headers
) {
  debug(`google/sheets/spreadsheet/fetch`, { parameters, headers })

  const { spreadsheetId } = parameters

  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`
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

  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl,
    title: data.properties.title,
    locale: data.properties.locale,
    sheets: data.sheets.map(
      (s: {
        properties: {
          sheetId: number
          title: string
          sheetType: string
          gridProperties: { rowCount: number; columnCount: number }
        }
      }) => ({
        sheetId: s.properties.sheetId,
        title: s.properties.title,
        type: s.properties.sheetType,
        rowCount: s.properties.gridProperties?.rowCount,
        columnCount: s.properties.gridProperties?.columnCount,
      })
    ),
  }
}

async function valuesReadHandler(
  _session: Session,
  parameters: ValuesReadSchema,
  headers: Headers
) {
  debug(`google/sheets/values/read`, { parameters, headers })

  const { spreadsheetId, range } = parameters

  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`
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

  return {
    range: data.range,
    majorDimension: data.majorDimension,
    values: data.values || [],
  }
}

async function valuesUpdateHandler(
  _session: Session,
  parameters: ValuesUpdateSchema,
  headers: Headers
) {
  debug(`google/sheets/values/update`, { parameters, headers })

  const { spreadsheetId, range, values } = parameters

  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`
  )

  url.searchParams.set('valueInputOption', 'USER_ENTERED')

  const response = await call(url.href, {
    method: 'PUT',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values,
    }),
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data })

  return {
    spreadsheetId: data.spreadsheetId,
    updatedRange: data.updatedRange,
    updatedRows: data.updatedRows,
    updatedColumns: data.updatedColumns,
    updatedCells: data.updatedCells,
  }
}

async function valuesAppendHandler(
  _session: Session,
  parameters: ValuesAppendSchema,
  headers: Headers
) {
  debug(`google/sheets/values/append`, { parameters, headers })

  const { spreadsheetId, range, values } = parameters

  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append`
  )

  url.searchParams.set('valueInputOption', 'USER_ENTERED')
  url.searchParams.set('insertDataOption', 'INSERT_ROWS')

  const response = await call(url.href, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values,
    }),
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data })

  return {
    spreadsheetId: data.spreadsheetId,
    updatedRange: data.updates?.updatedRange,
    updatedRows: data.updates?.updatedRows,
    updatedColumns: data.updates?.updatedColumns,
    updatedCells: data.updates?.updatedCells,
  }
}

async function valuesClearHandler(
  _session: Session,
  parameters: ValuesClearSchema,
  headers: Headers
) {
  debug(`google/sheets/values/clear`, { parameters, headers })

  const { spreadsheetId, range } = parameters

  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:clear`
  )

  const response = await call(url.href, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data })

  return {
    spreadsheetId: data.spreadsheetId,
    clearedRange: data.clearedRange,
  }
}

async function sheetCreateHandler(
  _session: Session,
  parameters: SheetCreateSchema,
  headers: Headers
) {
  debug(`google/sheets/sheet/create`, { parameters, headers })

  const { spreadsheetId, title } = parameters

  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`
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
          addSheet: {
            properties: {
              title,
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

  const addedSheet = data.replies?.[0]?.addSheet

  return {
    sheetId: addedSheet?.properties?.sheetId,
    title: addedSheet?.properties?.title,
  }
}

async function sheetDeleteHandler(
  _session: Session,
  parameters: SheetDeleteSchema,
  headers: Headers
) {
  debug(`google/sheets/sheet/delete`, { parameters, headers })

  const { spreadsheetId, sheetId } = parameters

  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`
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
          deleteSheet: {
            sheetId,
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
    sheetId,
  }
}

// --- Export Multi Handler ---

export default authenticatedMultiHandler({
  [SPREADSHEET_CREATE_HANDLER_NAME]: {
    schema: spreadsheetCreateSchema,
    fn: spreadsheetCreateHandler,
  },
  [SPREADSHEET_FETCH_HANDLER_NAME]: {
    schema: spreadsheetFetchSchema,
    fn: spreadsheetFetchHandler,
  },
  [VALUES_READ_HANDLER_NAME]: {
    schema: valuesReadSchema,
    fn: valuesReadHandler,
  },
  [VALUES_UPDATE_HANDLER_NAME]: {
    schema: valuesUpdateSchema,
    fn: valuesUpdateHandler,
  },
  [VALUES_APPEND_HANDLER_NAME]: {
    schema: valuesAppendSchema,
    fn: valuesAppendHandler,
  },
  [VALUES_CLEAR_HANDLER_NAME]: {
    schema: valuesClearSchema,
    fn: valuesClearHandler,
  },
  [SHEET_CREATE_HANDLER_NAME]: {
    schema: sheetCreateSchema,
    fn: sheetCreateHandler,
  },
  [SHEET_DELETE_HANDLER_NAME]: {
    schema: sheetDeleteSchema,
    fn: sheetDeleteHandler,
  },
})
