/**
 * @jest-environment node
 */
import fs from 'node:fs'

import { CREDENTIAL_POLICY, getCredentialColumns } from './credential.policy'

const SCHEMA_PATH = require.resolve('@chatbotkit-dev/db/schema')

/**
 * What makes a column a credential column: its name is in this list and it is
 * a `String` column. The list is deliberately explicit rather than a regex so
 * that `Blueprint.config` or `Metric.value` cannot be swept in by accident -
 * and so that a new credential column under a new name has to be added here
 * (and then classified in `CREDENTIAL_POLICY`) on purpose.
 */
const CREDENTIAL_COLUMN_NAMES = [
  'clientSecret',
  'accessToken',
  'refreshToken',
  'access_token',
  'refresh_token',
  'id_token',
  'secret',
  'signingSecret',
  'botToken',
  'userToken',
  'botFrameworkAppSecret',
  'verifyToken',
  'appSecret',
  'authToken',
  'apiKey',
  'webhookSecret',
  'privateKey',
  'publicKey',
  'serviceAccountKey',
  'token',
  'value',
]

/**
 * The credential-bearing JSON columns. A JSON column is not a credential by
 * name; these are the ones known to carry one inside (see
 * `SECRET_CONFIG_CREDENTIAL_KEYS` in `credential.mask.ts`).
 */
const CREDENTIAL_JSON_COLUMNS = [['Secret', 'config']]

/**
 * Parse schema.prisma into `{ [model]: { [column]: type } }` for scalar
 * columns.
 */
function parseSchemaColumns() {
  const columns = {}

  let model = null

  for (const line of fs.readFileSync(SCHEMA_PATH, 'utf8').split('\n')) {
    const modelMatch = line.match(/^model\s+(\w+)\s*\{/)

    if (modelMatch) {
      model = modelMatch[1]
      columns[model] = {}

      continue
    }

    if (/^\}/.test(line)) {
      model = null

      continue
    }

    if (!model) {
      continue
    }

    const fieldMatch = line.match(/^\s+(\w+)\s+([A-Z]\w*)(\[\])?\??(\s|$)/)

    if (fieldMatch) {
      columns[model][fieldMatch[1]] = fieldMatch[2]
    }
  }

  return columns
}

function schemaCredentialColumns() {
  const columns = parseSchemaColumns()

  const found = []

  for (const [model, fields] of Object.entries(columns)) {
    for (const [column, type] of Object.entries(fields)) {
      if (type === 'String' && CREDENTIAL_COLUMN_NAMES.includes(column)) {
        found.push(`${model}.${column}`)
      }
    }
  }

  for (const [model, column] of CREDENTIAL_JSON_COLUMNS) {
    expect(columns[model]?.[column]).toBe('Json')

    found.push(`${model}.${column}`)
  }

  return found.sort()
}

function policyColumns() {
  return Object.entries(CREDENTIAL_POLICY)
    .flatMap(([model, fields]) =>
      Object.keys(fields).map((column) => `${model}.${column}`)
    )
    .sort()
}

describe('CREDENTIAL_POLICY', () => {
  it('classifies exactly the credential columns of schema.prisma', () => {
    // @note a failure here means a credential column was added, renamed or
    // removed without updating the policy table (or the name list above)
    expect(policyColumns()).toEqual(schemaCredentialColumns())
  })

  it('uses only the four documented classes', () => {
    for (const fields of Object.values(CREDENTIAL_POLICY)) {
      for (const policy of Object.values(fields)) {
        expect(['never', 'one-time', 'masked', 'reveal']).toContain(policy)
      }
    }
  })

  it('derives the columns of a class for a model', () => {
    expect(getCredentialColumns('GithubIntegration', 'masked')).toEqual([
      'privateKey',
    ])
    expect(getCredentialColumns('GithubIntegration', 'reveal')).toEqual([
      'webhookSecret',
    ])
    expect(getCredentialColumns('Nope', 'masked')).toEqual([])
  })
})
