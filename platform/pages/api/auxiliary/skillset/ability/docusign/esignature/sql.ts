import type { Column } from '@chatbotkit-dev/sql/driver'
import { GenericDriver } from '@chatbotkit-dev/sql/driver'
import type { WhereStatement } from '@chatbotkit-dev/sql/parse'
import { getTableName, getWhereProperties } from '@chatbotkit-dev/sql/parse'

import handler from '@/lib/auxiliary.sql'
import call, { getCallError } from '@/lib/call'
import { throwNotAuthenticated } from '@/lib/response'

import { z } from 'zod'

const schema = z.object({
  sql: z.string(),
})

export type Schema = z.infer<typeof schema>

// @note DocuSign API defaults and limits
const DEFAULT_ENVELOPE_LOOKBACK_MONTHS = 1
const DEFAULT_RESULT_LIMIT = 100

interface EnvelopeRow {
  envelopeId: string
  [key: string]: unknown
}

interface TemplateRow {
  templateId: string
  [key: string]: unknown
}

/**
 * Driver for DocuSign envelopes.
 *
 * @see https://developers.docusign.com/docs/esign-rest-api/reference/envelopes/envelopes/
 */
class DocuSignEnvelopeDriver extends GenericDriver<EnvelopeRow> {
  #token: string
  #baseUri: string
  #accountId: string

  constructor({
    token,
    baseUri,
    accountId,
  }: {
    token: string
    baseUri: string
    accountId: string
  }) {
    super()

    this.#token = token
    this.#baseUri = baseUri
    this.#accountId = accountId
  }

  async describeColumns(): Promise<Column[]> {
    return [
      { type: 'string', name: 'envelopeId', readOnly: true },
      { type: 'string', name: 'status', readOnly: true },
      { type: 'string', name: 'emailSubject', readOnly: true },
      { type: 'string', name: 'emailBlurb', readOnly: true },
      { type: 'string', name: 'sentDateTime', readOnly: true },
      { type: 'string', name: 'createdDateTime', readOnly: true },
      { type: 'string', name: 'completedDateTime', readOnly: true },
      { type: 'string', name: 'statusChangedDateTime', readOnly: true },
      { type: 'string', name: 'deliveredDateTime', readOnly: true },
      { type: 'string', name: 'declinedDateTime', readOnly: true },
      { type: 'string', name: 'voidedDateTime', readOnly: true },
      { type: 'string', name: 'voidedReason', readOnly: true },
      { type: 'string', name: 'envelopeUri', readOnly: true },
    ]
  }

  async doSelect(_columns: string[], where?: WhereStatement) {
    const properties = where ? getWhereProperties(where) : {}

    // @note if envelopeId is specified, fetch single envelope directly
    if (properties['envelopeId']) {
      const url = new URL(
        `https://${this.#baseUri}/restapi/v2.1/accounts/${
          this.#accountId
        }/envelopes/${properties['envelopeId']}`
      )

      const response = await call(url.href, {
        headers: {
          Authorization: this.#token,
        },
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const result = await response.json()

      return [{ row: result }]
    }

    // @note list envelopes with optional status filter
    const url = new URL(
      `https://${this.#baseUri}/restapi/v2.1/accounts/${
        this.#accountId
      }/envelopes`
    )

    // @note DocuSign requires from_date parameter for listing - use configurable lookback
    const fromDate = new Date()

    fromDate.setMonth(fromDate.getMonth() - DEFAULT_ENVELOPE_LOOKBACK_MONTHS)
    url.searchParams.set('from_date', fromDate.toISOString())

    if (properties['status']) {
      url.searchParams.set('status', String(properties['status']))
    }

    url.searchParams.set('count', String(DEFAULT_RESULT_LIMIT))

    const response = await call(url.href, {
      headers: {
        Authorization: this.#token,
      },
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const { envelopes } = (await response.json()) as {
      envelopes?: EnvelopeRow[]
    }

    return (envelopes || []).map((envelope) => ({ row: envelope }))
  }

  // @note DocuSign envelopes are created via templates, not direct insert
  async doInsert(_parameters: Record<string, unknown>) {
    throw new Error(
      'Direct envelope creation is not supported. Use templates to create envelopes.'
    )
  }

  // @note envelope updates are limited to status changes
  async doUpdate(
    { row }: { row: EnvelopeRow },
    parameters: Record<string, unknown>
  ) {
    const url = new URL(
      `https://${this.#baseUri}/restapi/v2.1/accounts/${
        this.#accountId
      }/envelopes/${row.envelopeId}`
    )

    const response = await call(url.href, {
      method: 'PUT',
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(parameters),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }

  // @note envelopes cannot be deleted, only voided
  async doDelete(_options: { row: EnvelopeRow }) {
    throw new Error(
      'Envelopes cannot be deleted. Use UPDATE to void an envelope instead.'
    )
  }
}

/**
 * Driver for DocuSign templates.
 *
 * @see https://developers.docusign.com/docs/esign-rest-api/reference/templates/
 */
class DocuSignTemplateDriver extends GenericDriver<TemplateRow> {
  #token: string
  #baseUri: string
  #accountId: string

  constructor({
    token,
    baseUri,
    accountId,
  }: {
    token: string
    baseUri: string
    accountId: string
  }) {
    super()

    this.#token = token
    this.#baseUri = baseUri
    this.#accountId = accountId
  }

  async describeColumns(): Promise<Column[]> {
    return [
      { type: 'string', name: 'templateId', readOnly: true },
      { type: 'string', name: 'name', readOnly: true },
      { type: 'string', name: 'description', readOnly: true },
      { type: 'string', name: 'shared', readOnly: true },
      { type: 'string', name: 'created', readOnly: true },
      { type: 'string', name: 'lastModified', readOnly: true },
      { type: 'string', name: 'folderId', readOnly: true },
      { type: 'string', name: 'folderName', readOnly: true },
      { type: 'string', name: 'uri', readOnly: true },
    ]
  }

  async doSelect(_columns: string[], where?: WhereStatement) {
    const properties = where ? getWhereProperties(where) : {}

    // @note if templateId is specified, fetch single template directly
    if (properties['templateId']) {
      const url = new URL(
        `https://${this.#baseUri}/restapi/v2.1/accounts/${
          this.#accountId
        }/templates/${properties['templateId']}`
      )

      const response = await call(url.href, {
        headers: {
          Authorization: this.#token,
        },
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const result = await response.json()

      return [{ row: result }]
    }

    // @note list templates
    const url = new URL(
      `https://${this.#baseUri}/restapi/v2.1/accounts/${
        this.#accountId
      }/templates`
    )

    url.searchParams.set('count', '100')

    if (properties['name']) {
      url.searchParams.set('search_text', String(properties['name']))
    }

    const response = await call(url.href, {
      headers: {
        Authorization: this.#token,
      },
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const { envelopeTemplates } = (await response.json()) as {
      envelopeTemplates?: TemplateRow[]
    }

    return (envelopeTemplates || []).map((template) => ({ row: template }))
  }

  // @note template creation is complex and should be done via DocuSign UI
  async doInsert(_parameters: Record<string, unknown>) {
    throw new Error(
      'Template creation via SQL is not supported. Use DocuSign UI to create templates.'
    )
  }

  async doUpdate(_options: { row: TemplateRow }, _parameters: unknown) {
    throw new Error(
      'Template updates via SQL are not supported. Use DocuSign UI to update templates.'
    )
  }

  async doDelete(_options: { row: TemplateRow }) {
    throw new Error(
      'Template deletion via SQL is not supported. Use DocuSign UI to delete templates.'
    )
  }
}

/**
 * Parses DocuSign userinfo response to extract base URI and account ID.
 */
async function getDocuSignAccountInfo(token: string): Promise<{
  baseUri: string
  accountId: string
}> {
  const url = new URL('https://account.docusign.com/oauth/userinfo')

  const response = await call(url.href, {
    headers: {
      Authorization: token,
    },
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const userInfo = (await response.json()) as {
    accounts?: {
      account_id: string
      base_uri: string
      is_default: boolean
    }[]
  }

  // @note use the default account or first available
  const account =
    userInfo.accounts?.find((a) => a.is_default) || userInfo.accounts?.[0]

  if (!account?.account_id || !account?.base_uri) {
    throw new Error('No DocuSign account found for this user')
  }

  // @note base_uri comes as full URL like https://na1.docusign.net
  const baseUri = account.base_uri.replace(/^https?:\/\//, '')

  return {
    baseUri,
    accountId: account.account_id,
  }
}

export default handler(
  schema,
  [
    {
      database: 'docusign',
      name: 'envelopes',
    },
    {
      database: 'docusign',
      name: 'templates',
    },
  ],
  async (table, _parameters, headers) => {
    const token = headers.get('x-access-token')

    if (!token) {
      return throwNotAuthenticated()
    }

    const { baseUri, accountId } = await getDocuSignAccountInfo(token)

    const tableName = getTableName(table)

    switch (tableName) {
      case 'docusign.envelopes': {
        return new DocuSignEnvelopeDriver({ token, baseUri, accountId })
      }

      case 'docusign.templates': {
        return new DocuSignTemplateDriver({ token, baseUri, accountId })
      }
    }

    throw new Error(`No driver found for table ${tableName}`)
  }
)
