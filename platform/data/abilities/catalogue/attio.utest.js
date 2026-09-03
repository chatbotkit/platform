import { getAbilityFunctionParameters } from '@/lib/ability.function'
import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { buildTemplateInstruction } from '@/lib/instruction.template.parse'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import {
  createOpenApiHandlers,
  executeTemplate,
  setupServer,
} from '@/jest/utils/ability'

import templates from './attio'

jest.mock('@/lib/usage.record', () => ({
  recordFetchUsage: jest.fn(),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

jest.mock('@/lib/limit.core', () => {
  const originalModule = jest.requireActual('@/lib/limit.core')

  return {
    ...originalModule,

    accountLimitsOk: jest.fn(),
  }
})

jest.mock('@/lib/extract.data', () => ({
  extractDataFromInput: jest.fn(),
}))

jest.retryTimes(3)

const DEFINITION = 'https://api.attio.com/openapi/api'

const server = setupServer()

beforeAll(async () => {
  const { handlers } = await createOpenApiHandlers(DEFINITION)

  server.use(...handlers)

  server.listen()
})

afterAll(async () => {
  server.close()
})

describe('litmus tests', () => {
  it('should accept valid endpoints', async () => {
    const response = await fetch('https://api.attio.com/v2/objects', {
      headers: {
        Authorization: 'Bearer YOUR_ACCESS_TOKEN',
      },
    })

    expect(response.status).toBe(200)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch(
      'https://api.attio.com/v2/invalid-endpoint-that-does-not-exist',
      {
        headers: {
          Authorization: 'Bearer YOUR_ACCESS_TOKEN',
        },
      }
    )

    expect(response.status).not.toBe(200)
  })
})

describe('templates', () => {
  const user = {
    id: 'user-123',
  }

  beforeEach(() => {
    fastGetUserById.mockResolvedValue(user)
    accountLimitsOk.mockResolvedValue(true)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const untestableTemplates = ['attio/sql/exec', 'attio/api/call']

  const testableTemplates = Object.keys(templates).filter(
    (template) =>
      !template.startsWith('pack') && !untestableTemplates.includes(template)
  )

  it.each(testableTemplates)(`testing template %s`, async (template) => {
    const { error } = await executeTemplate(user, template)

    expect(error).toBeUndefined()

    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})

describe('template schemas', () => {
  async function getInputSchema(template) {
    const instruction = buildTemplateInstruction({
      template,
      params: {},
    })

    const parameters = await getAbilityFunctionParameters({ instruction })

    // @note the parameter schema is flat - fields live at the top level, so the
    // schema itself is the input schema (there is no `input` wrapper to unwrap)
    return parameters
  }

  it('should expose the Attio SQL ability with a required sql input', async () => {
    const sqlInput = await getInputSchema('attio/sql/exec')

    expect(sqlInput.required).toEqual(expect.arrayContaining(['sql']))
    expect(sqlInput.properties.sql.type).toBe('string')
    expect(templates['attio/sql/exec'].instruction).toContain(
      '/api/auxiliary/skillset/ability/attio/sql'
    )
  })

  it('should model Attio record payloads with object and array inputs', async () => {
    const recordListInput = await getInputSchema('attio/record/list')
    const recordCreateInput = await getInputSchema('attio/record/create')

    expect(recordListInput.properties.filter.type).toBe('object')
    expect(recordListInput.properties.sorts.type).toBe('array')
    expect(recordListInput.properties.filterViewId.type).toBe('string')
    expect(recordCreateInput.properties.values.type).toBe('object')
  })

  it('should model Attio note creation fields to match the API spec', async () => {
    const noteCreateInput = await getInputSchema('attio/note/create')

    expect(noteCreateInput.required).toEqual(
      expect.arrayContaining([
        'parentObject',
        'parentRecordId',
        'title',
        'format',
        'content',
      ])
    )

    expect(noteCreateInput.properties.format.enum).toEqual([
      'plaintext',
      'markdown',
    ])
    expect(noteCreateInput.properties.createdAt.type).toBe('string')
    expect(noteCreateInput.properties.meetingId.type).toBe('string')
  })

  it('should model Attio task create and update payloads to match the API spec', async () => {
    const taskCreateInput = await getInputSchema('attio/task/create')
    const taskUpdateInput = await getInputSchema('attio/task/update')
    const taskListInput = await getInputSchema('attio/task/list')

    expect(taskCreateInput.properties.format.enum).toEqual(['plaintext'])
    expect(taskCreateInput.properties.linkedRecords.type).toBe('array')
    expect(taskCreateInput.properties.assignees.type).toBe('array')
    expect(taskUpdateInput.properties.content).toBeUndefined()
    expect(taskUpdateInput.properties.linkedRecords.type).toBe('array')
    expect(taskUpdateInput.properties.assignees.type).toBe('array')
    expect(taskListInput.properties.sort.enum).toEqual([
      'created_at:asc',
      'created_at:desc',
    ])
  })

  it('should expose a live Attio attribute list ability', async () => {
    const attributeListInput = await getInputSchema('attio/attribute/list')

    expect(attributeListInput.required).toEqual(
      expect.arrayContaining(['target', 'identifier'])
    )
    expect(attributeListInput.properties.target.enum).toEqual([
      'objects',
      'lists',
    ])
    expect(attributeListInput.properties.identifier.type).toBe('string')
    expect(attributeListInput.properties.showArchived.type).toBe('boolean')
    expect(templates['attio/attribute/list'].instruction).toContain(
      '/attributes'
    )
  })

  it('should install the Attio attribute list ability before generic record mutation tools', () => {
    const packInstruction = templates['pack/attio'].instruction

    expect(packInstruction).toContain('attio/attribute/list')
    expect(packInstruction.indexOf('attio/attribute/list')).toBeLessThan(
      packInstruction.indexOf('attio/record/create')
    )
  })
})
