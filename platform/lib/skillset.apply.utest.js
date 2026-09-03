import { executeAction } from '@/lib/action.exec.all'
import * as errorModule from '@/lib/error'
import { SafeError } from '@/lib/error'
import { TimeoutError } from '@/lib/fetch'
import { execPrompt } from '@/lib/prompt'
import { applySkillset } from '@/lib/skillset.apply'
import * as chunkModule from '@/lib/skillset.chunk'

// @note transform functions use real implementations while external action and
// prompt execution are mocked

jest.mock('@/lib/action.exec.all', () => ({
  executeAction: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  ...jest.requireActual('@/lib/error'),
  captureObservation: jest.fn(),
}))

jest.mock('@/lib/prompt', () => ({
  execPrompt: jest.fn(),
}))

jest.mock('@/lib/skillset.chunk', () => ({
  ...jest.requireActual('@/lib/skillset.chunk'),
  storeChunkedResponse: jest.fn(),
}))

describe('applySkillset', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // @note default mock for executeAction - returns the text as result

    executeAction.mockImplementation((name, text) => {
      return Promise.resolve({ result: text })
    })

    execPrompt.mockResolvedValue({
      completion: `\`\`\`echo
POST https://chatbotkit.com/api/v1/contact/create HTTP/1.1
Content-Type: application/json

{
  "name": "John"
}
\`\`\``,
      tokensUsed: 1,
      modelUsed: 'base',
    })

    // @note mock storeChunkedResponse to return chunked metadata
    chunkModule.storeChunkedResponse.mockImplementation(async (content) => ({
      isChunked: true,
      totalChunks: 1,
      totalLength: content.length,
      preview: content.slice(0, 500),
      chunks: [{ id: 'test-chunk-id', index: 0, length: content.length }],
    }))
  })

  describe('basic functionality', () => {
    it('should return usage and generic error message when ability is missing', async () => {
      const skillset = {
        abilities: [],
      }

      const name = 'missingAbility'
      const input = 'some input'
      const options = {}

      const result = await applySkillset(
        'userId',
        skillset,
        name,
        input,
        options
      )

      expect(result.usage.token).toEqual(0)
      expect(result.error).toBeUndefined()
      expect(result.result).toBeNull()
      expect(result.messages.length).toBeGreaterThan(0)
    })

    it('should return transformed response when instruction is complex', async () => {
      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'complexAbility',
            instruction: `Transform based on the following:

\`\`\`echo
POST https://chatbotkit.com/api/v1/contact/create HTTP/1.1
Content-Type: application/json

{
  "name": "\$[name]"
}
          `,
          },
        ],
      }

      const name = 'complexAbility'
      const input = 'name: John'
      const options = {}

      const result = await applySkillset(
        'userId',
        skillset,
        name,
        input,
        options
      )

      expect(execPrompt).toHaveBeenCalledTimes(1)
      expect(result.usage.token).toBeGreaterThan(0)

      expect(result).toEqual({
        usage: result.usage,
        error: undefined,
        result: `POST https://chatbotkit.com/api/v1/contact/create HTTP/1.1
Content-Type: application/json

{
  "name": "John"
}`,
        messages: [],
        meta: {
          skillset: {
            action: {
              input: 'name: John',
              name: 'complexAbility',
            },
            id: '123',
          },
        },
      })
    })

    it('should return substituted response when instruction is simple', async () => {
      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'simpleAbility',
            instruction: `\`\`\`echo
POST https://chatbotkit.com/api/v1/contact/create HTTP/1.1
Content-Type: application/json

{
  "name": "\$[name]"
}
\`\`\``,
          },
        ],
      }

      const name = 'simpleAbility'
      const input = 'name: John'
      const options = {}

      const result = await applySkillset(
        'userId',
        skillset,
        name,
        input,
        options
      )

      expect(result.usage.token).toEqual(0)
      expect(result).toEqual({
        usage: result.usage,
        error: undefined,
        result: `POST https://chatbotkit.com/api/v1/contact/create HTTP/1.1
Content-Type: application/json

{
  "name": "John"
}`,
        messages: [],
        meta: {
          skillset: {
            action: {
              input: 'name: John',
              name: 'simpleAbility',
            },
            id: '123',
          },
        },
      })
    })
  })

  describe('options.substitutions', () => {
    // @note options.substitutions are now passed INTO transform functions,
    // so they are applied during transformation rather than after

    it('should apply external substitutions to square bracket fields', async () => {
      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'simpleAbility',
            instruction: `\`\`\`echo
GET https://api.example.com/users/\$[userId]/data
\`\`\``,
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'simpleAbility',
        '',
        {
          substitutions: { userId: 'user-42' },
        }
      )

      expect(result.result).toBe(
        'GET https://api.example.com/users/user-42/data'
      )
    })

    it('should apply external substitutions to curly bracket fields', async () => {
      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'simpleAbility',
            instruction: `\`\`\`echo
GET https://api.example.com/data
Authorization: Bearer \${TOKEN}
\`\`\``,
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'simpleAbility',
        '',
        {
          substitutions: { TOKEN: 'secret-token-123' },
        }
      )

      expect(result.result).toContain('Authorization: Bearer secret-token-123')
    })

    it('should apply substitutions to both bracket types in same instruction', async () => {
      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'mixedAbility',
            instruction: `\`\`\`echo
GET https://api.example.com/\$[endpoint]/data
Authorization: Bearer \${API_KEY}
X-User-Id: \$[requesterId]
\`\`\``,
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'mixedAbility',
        '',
        {
          substitutions: {
            endpoint: 'users',
            API_KEY: 'key-abc',
            requesterId: 'req-999',
          },
        }
      )

      expect(result.result).toContain('GET https://api.example.com/users/data')
      expect(result.result).toContain('Authorization: Bearer key-abc')
      expect(result.result).toContain('X-User-Id: req-999')
    })

    it('should let substitutions override input-derived values', async () => {
      // @note when both input and substitutions provide a value for the same
      // field, substitutions take precedence

      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'simpleAbility',
            instruction: `\`\`\`echo
GET https://api.example.com/search?q=\$[query]
\`\`\``,
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'simpleAbility',
        'query: from-input',
        {
          substitutions: { query: 'from-substitutions' },
        }
      )

      expect(result.result).toBe(
        'GET https://api.example.com/search?q=from-substitutions'
      )
    })

    it('should substitute CONVERSATION_ID in fetch body from conversation context', async () => {
      // @note this test verifies that special fields like CONVERSATION_ID are
      // substituted when a value is provided via options.substitutions - this
      // mimics how conversation.engine.js passes conversation context

      const conversationId = 'conv-test-12345'

      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'fetchWithConversation',
            instruction: `\`\`\`echo
url: https://api.example.com/webhook
method: POST
headers:
  Content-Type: application/json
body:
  conversation_id: \${CONVERSATION_ID}
  required_fields: "data"
\`\`\``,
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'fetchWithConversation',
        '',
        {
          // @note this mimics what getSubstitutions() in conversation.engine.js does:
          // flatten({ id: conversation.id, ... }, 'conversation_', '_')
          // then uppercase all keys
          substitutions: {
            CONVERSATION_ID: conversationId,
          },
        }
      )

      // @note when substitution is provided, special field should be replaced
      expect(result.result).toContain(`conversation_id: ${conversationId}`)
      expect(result.result).not.toContain('${CONVERSATION_ID}')
    })

    it('should substitute multiple conversation fields in fetch instruction', async () => {
      // @note tests that all conversation-related fields are substituted
      // when values are provided via substitutions

      const conversationId = 'conv-abc-789'
      const conversationName = 'Test Conversation'

      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'fetchWithMultipleFields',
            instruction: `\`\`\`echo
url: https://api.example.com/data
method: POST
headers:
  Content-Type: application/json
  X-Conversation-Id: \${CONVERSATION_ID}
body:
  id: \${CONVERSATION_ID}
  name: \${CONVERSATION_NAME}
\`\`\``,
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'fetchWithMultipleFields',
        '',
        {
          substitutions: {
            CONVERSATION_ID: conversationId,
            CONVERSATION_NAME: conversationName,
          },
        }
      )

      // @note all special fields should be replaced when substitutions provided
      expect(result.result).toContain(`X-Conversation-Id: ${conversationId}`)
      expect(result.result).toContain(`id: ${conversationId}`)
      expect(result.result).toContain(`name: ${conversationName}`)
      expect(result.result).not.toContain('${CONVERSATION_ID}')
      expect(result.result).not.toContain('${CONVERSATION_NAME}')
    })
  })

  describe('remaining fields cleanup', () => {
    it('should replace unfilled square bracket fields with empty strings', async () => {
      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'simpleAbility',
            instruction: `\`\`\`echo
GET https://api.example.com/search?q=\$[query]&filter=\$[filter]
\`\`\``,
          },
        ],
      }

      // @note only providing query, not filter - filter should become empty

      const result = await applySkillset(
        'userId',
        skillset,
        'simpleAbility',
        'query: hello',
        {}
      )

      expect(result.result).toBe(
        'GET https://api.example.com/search?q=hello&filter='
      )
    })

    it('should replace unfilled curly bracket fields with empty strings', async () => {
      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'simpleAbility',
            instruction: `\`\`\`echo
GET https://api.example.com/data
Authorization: Bearer \${MISSING_TOKEN}
\`\`\``,
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'simpleAbility',
        '',
        {}
      )

      expect(result.result).toContain('Authorization: Bearer')
      expect(result.result).not.toContain('${MISSING_TOKEN}')
    })

    it('should not replace special curly bracket fields', async () => {
      // @note special fields like USER_EMAIL, CONVERSATION_ID etc. are
      // preserved for later resolution by the action executor

      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'simpleAbility',
            instruction: `\`\`\`echo
GET https://api.example.com/data
X-User: \${USER_EMAIL}
\`\`\``,
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'simpleAbility',
        '',
        {}
      )

      // @note special fields should be preserved for later resolution
      expect(result.result).toContain('${USER_EMAIL}')
    })
  })

  describe('template instructions', () => {
    // @note template instructions hit real template lookups and execute actions
    // that make HTTP requests - these are integration-level tests. For testing
    // special field preservation specifically, see instruction.transform.template.utest.js

    it('should detect template instruction type and handle errors', async () => {
      // @note this verifies that template instructions are correctly identified
      // and routed to the template transform path - when template is not found
      // it should abort gracefully

      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'templateAbility',
            instruction: `template: nonexistent/template
params:
  someParam: value`,
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'templateAbility',
        '',
        {}
      )

      // @note template not found triggers abort() which returns null result
      // and a problem message (no error field is set on abort)

      expect(result.result).toBeNull()
      expect(result.messages.length).toBeGreaterThan(0)
      expect(result.messages[0].text).toContain('problem')
    })

    // @todo add tests with mocked transformTemplateInstruction for special field
    // preservation without hitting real template resolution and action execution
  })

  describe('google/drive/file/search template integration', () => {
    // @note these tests verify the full transformation pipeline from applySkillset
    // through to executeAction (fetch), ensuring the search parameter is correctly
    // passed through the template transformation
    // @note the top-level beforeEach already sets up the real transformTemplateInstruction

    it('should pass search term to fetch action body when provided in input', async () => {
      // @note this test verifies that when using the google/drive/file/search
      // template with a search parameter in the input, the search term is
      // correctly passed through to the fetch action

      const skillset = {
        id: 'skillset-123',
        abilities: [
          {
            id: 'ability-456',
            name: 'searchDriveFiles',
            instruction: `template: google/drive/file/search
parameters:
  search: ''`,
          },
        ],
      }

      const input = JSON.stringify({ search: 'quarterly report' })

      await applySkillset('userId', skillset, 'searchDriveFiles', input, {})

      // @note verify executeAction was called with 'fetch' action and correct body
      expect(executeAction).toHaveBeenCalledWith(
        'fetch',
        expect.stringContaining('search: "quarterly report"'),
        expect.any(Object),
        expect.any(Object)
      )
    })

    it('should pass predefined search term to fetch action when input is empty', async () => {
      // @note this test verifies that a predefined search parameter in the
      // template instruction is passed through to the fetch action

      const skillset = {
        id: 'skillset-123',
        abilities: [
          {
            id: 'ability-456',
            name: 'searchDriveFiles',
            instruction: `template: google/drive/file/search
parameters:
  search: 'predefined search query'`,
          },
        ],
      }

      const input = JSON.stringify({})

      await applySkillset('userId', skillset, 'searchDriveFiles', input, {})

      expect(executeAction).toHaveBeenCalledWith(
        'fetch',
        expect.stringContaining('search: "predefined search query"'),
        expect.any(Object),
        expect.any(Object)
      )
    })

    it('should use template defaults when no some parameters provided', async () => {
      const skillset = {
        id: 'skillset-123',
        abilities: [
          {
            id: 'ability-456',
            name: 'searchDriveFiles',
            instruction: `template: google/drive/file/search`,
          },
        ],
      }

      const input = JSON.stringify({ search: 'test' })

      await applySkillset('userId', skillset, 'searchDriveFiles', input, {})

      // provided
      expect(executeAction).toHaveBeenCalledWith(
        'fetch',
        expect.stringContaining('search: "test"'),
        expect.any(Object),
        expect.any(Object)
      )
      // default
      expect(executeAction).toHaveBeenCalledWith(
        'fetch',
        expect.stringContaining('searchScope: "all"'),
        expect.any(Object),
        expect.any(Object)
      )
    })

    // @note this test works correctly when both search and searchScope are provided
    // in the input - the bug only manifests when searchScope is NOT provided
    it('should pass both search and searchScope to fetch action', async () => {
      // @note this test verifies that both search and searchScope parameters
      // are correctly passed through to the fetch action body

      const skillset = {
        id: 'skillset-123',
        abilities: [
          {
            id: 'ability-456',
            name: 'searchDriveFiles',
            instruction: `template: google/drive/file/search
parameters:
  search: ''
  searchScope: ''`,
          },
        ],
      }

      const input = JSON.stringify({
        search: 'budget spreadsheet',
        searchScope: 'shared',
      })

      await applySkillset('userId', skillset, 'searchDriveFiles', input, {})

      expect(executeAction).toHaveBeenCalledWith(
        'fetch',
        expect.stringContaining('search: "budget spreadsheet"'),
        expect.any(Object),
        expect.any(Object)
      )
      expect(executeAction).toHaveBeenCalledWith(
        'fetch',
        expect.stringContaining('searchScope: "shared"'),
        expect.any(Object),
        expect.any(Object)
      )
    })

    // @note when searchScope is not provided in input, the system uses LLM to
    // extract the default value from the field definition
    it('should include correct API path and handler in fetch action', async () => {
      // @note this test verifies that the fetch action is called with the
      // correct Google Drive auxiliary API path and handler name

      const skillset = {
        id: 'skillset-123',
        abilities: [
          {
            id: 'ability-456',
            name: 'searchDriveFiles',
            instruction: `template: google/drive/file/search
parameters:
  search: 'test'`,
          },
        ],
      }

      const input = JSON.stringify({})

      await applySkillset('userId', skillset, 'searchDriveFiles', input, {})

      // @note verify the fetch action was called
      expect(executeAction).toHaveBeenCalled()

      // @note get the actual call arguments
      const [actionName, actionInput] = executeAction.mock.calls[0]

      expect(actionName).toBe('fetch')
      expect(actionInput).toContain(
        '/api/auxiliary/skillset/ability/google/drive'
      )
      expect(actionInput).toContain('x-chatbotkit-handler-name: "file/list"')
    })

    // @note verifies that auth placeholder is preserved during template transformation
    it('should preserve SECRET_DEFAULT in fetch action for authentication', async () => {
      // @note this test verifies that the ${SECRET_DEFAULT} placeholder is
      // preserved in the fetch action for later secret resolution

      const skillset = {
        id: 'skillset-123',
        abilities: [
          {
            id: 'ability-456',
            name: 'searchDriveFiles',
            instruction: `template: google/drive/file/search
parameters:
  search: 'documents'`,
          },
        ],
      }

      const input = JSON.stringify({})

      await applySkillset('userId', skillset, 'searchDriveFiles', input, {})

      expect(executeAction).toHaveBeenCalledWith(
        'fetch',
        expect.stringContaining('${SECRET_DEFAULT}'),
        expect.any(Object),
        expect.any(Object)
      )
    })

    // @note empty string is a valid search value and should be handled correctly
    it('should handle empty string search in input', async () => {
      // @note this test verifies behavior when search is an empty string
      // in the input - empty string should be accepted as a valid value

      const skillset = {
        id: 'skillset-123',
        abilities: [
          {
            id: 'ability-456',
            name: 'searchDriveFiles',
            instruction: `template: google/drive/file/search
parameters:
  search: ''`,
          },
        ],
      }

      const input = JSON.stringify({ search: '' })

      await applySkillset('userId', skillset, 'searchDriveFiles', input, {})

      // @note empty string is valid - executeAction should be called
      expect(executeAction).toHaveBeenCalledWith(
        'fetch',
        expect.stringContaining('method: "POST"'),
        expect.any(Object),
        expect.any(Object)
      )
    })

    it('should handle null search in input by throwing error', async () => {
      // @note this test verifies that null search value is treated as missing

      const skillset = {
        id: 'skillset-123',
        abilities: [
          {
            id: 'ability-456',
            name: 'searchDriveFiles',
            instruction: `template: google/drive/file/search
parameters:
  search: ''`,
          },
        ],
      }

      const input = JSON.stringify({ search: null })

      const result = await applySkillset(
        'userId',
        skillset,
        'searchDriveFiles',
        input,
        {}
      )

      expect(result.result).toBeNull()
      expect(result.messages.length).toBeGreaterThan(0)
    })

    // @note resources are passed through the entire transformation pipeline
    it('should pass linkedResources and contextResources to executeAction', async () => {
      // @note this test verifies that linkedResources (linkedSecretId) and
      // contextResources (skillsetId, abilityId) are correctly passed through to the fetch action

      const skillset = {
        id: 'skillset-789',
        abilities: [
          {
            id: 'ability-abc',
            name: 'searchDriveFiles',
            linkedSecretId: 'secret-xyz',
            instruction: `template: google/drive/file/search
parameters:
  search: 'test files'`,
          },
        ],
      }

      const input = JSON.stringify({})

      await applySkillset('userId', skillset, 'searchDriveFiles', input, {})

      expect(executeAction).toHaveBeenCalledWith(
        'fetch',
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          linkedResources: expect.objectContaining({
            secretId: 'secret-xyz',
          }),
          contextResources: expect.objectContaining({
            skillsetId: 'skillset-789',
            abilityId: 'ability-abc',
          }),
        })
      )
    })

    it('should pass linkedSpaceId through as linkedResources.spaceId', async () => {
      // @note inline shell abilities scope the sandbox to a space via
      // linkedSpaceId; the runtime bag is keyed by the unprefixed name

      const skillset = {
        id: 'skillset-789',
        abilities: [
          {
            id: 'ability-abc',
            name: 'searchDriveFiles',
            linkedSpaceId: 'space-xyz',
            instruction: `template: google/drive/file/search
parameters:
  search: 'test files'`,
          },
        ],
      }

      await applySkillset(
        'userId',
        skillset,
        'searchDriveFiles',
        JSON.stringify({}),
        {}
      )

      expect(executeAction).toHaveBeenCalledWith(
        'fetch',
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          linkedResources: expect.objectContaining({
            spaceId: 'space-xyz',
          }),
        })
      )
    })

    describe('searchScope field resolution', () => {
      // @note these tests verify that the searchScope field placeholder is
      // correctly resolved via LLM extraction when not provided in input

      // @note when searchScope is not provided in the user's ability instruction
      // parameters, the template transformation correctly uses the LLM to
      // extract/infer the default value from the field definition
      it('should resolve searchScope default value when not provided in input', async () => {
        const skillset = {
          id: 'skillset-123',
          abilities: [
            {
              id: 'ability-456',
              name: 'searchDriveFiles',
              instruction: `template: google/drive/file/search
parameters:
  search: 'test query'`,
            },
          ],
        }

        const input = JSON.stringify({})

        await applySkillset('userId', skillset, 'searchDriveFiles', input, {})

        // @note expected: searchScope should resolve to default "all"
        // actual: searchScope contains literal placeholder string causing enum validation error
        expect(executeAction).toHaveBeenCalled()

        const [, actionInput] = executeAction.mock.calls[0]

        expect(actionInput).toContain('searchScope: "all"')
        expect(actionInput).not.toContain('((!searchScope')
      })

      // @note when searchScope is explicitly provided as empty string in template
      // parameters but user provides a value in input, the input value takes precedence
      it('should override empty searchScope parameter with input value', async () => {
        const skillset = {
          id: 'skillset-123',
          abilities: [
            {
              id: 'ability-456',
              name: 'searchDriveFiles',
              instruction: `template: google/drive/file/search
parameters:
  search: 'documents'
  searchScope: ''`,
            },
          ],
        }

        const input = JSON.stringify({ searchScope: 'shared' })

        await applySkillset('userId', skillset, 'searchDriveFiles', input, {})

        expect(executeAction).toHaveBeenCalled()

        const [, actionInput] = executeAction.mock.calls[0]

        // @note should contain the actual value, not the placeholder
        expect(actionInput).toContain('searchScope: "shared"')
        expect(actionInput).not.toContain('enum<all,shared>')
      })
    })
  })

  describe('fetch/text/get template integration', () => {
    it('should propagate url to fetch action', async () => {
      const skillset = {
        id: 'skillset-123',
        abilities: [
          {
            id: 'ability-456',
            name: 'fetchPage',
            instruction: `template: "fetch/text/get"
parameters:
  url: ((!url ys|the url of the page to fetch, including https:// prefix))`,
          },
        ],
      }

      const input = JSON.stringify({ url: 'https://example.com' })

      await applySkillset('userId', skillset, 'fetchPage', input, {})

      expect(executeAction).toHaveBeenCalledWith(
        'fetch',
        expect.stringContaining('https://example.com'),
        expect.any(Object),
        expect.any(Object)
      )
    })

    it('should return error when required url is null', async () => {
      const skillset = {
        id: 'skillset-123',
        abilities: [
          {
            id: 'ability-456',
            name: 'fetchPage',
            instruction: `template: "fetch/text/get"`,
          },
        ],
      }

      const input = JSON.stringify({ url: null })

      const result = await applySkillset(
        'userId',
        skillset,
        'fetchPage',
        input,
        {}
      )

      expect(result.result).toBeNull()
      expect(result.messages.length).toBeGreaterThan(0)
      expect(result.messages[0].text).toContain(
        "Required field 'url' was not provided"
      )
    })

    it('should return error when required url is not provided', async () => {
      const skillset = {
        id: 'skillset-123',
        abilities: [
          {
            id: 'ability-456',
            name: 'fetchPage',
            instruction: `template: "fetch/text/get"`,
          },
        ],
      }

      const input = JSON.stringify({})

      const result = await applySkillset(
        'userId',
        skillset,
        'fetchPage',
        input,
        {}
      )

      expect(result.result).toBeNull()
      expect(result.messages.length).toBeGreaterThan(0)
      expect(result.messages[0].text).toContain(
        'Required field "url" missing in the input.'
      )
    })
  })

  describe('ability lookup', () => {
    it('should find ability by exact name', async () => {
      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'My Test Ability',
            instruction: `\`\`\`echo
test
\`\`\``,
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'My Test Ability',
        '',
        {}
      )

      expect(result.result).toBe('test')
    })

    it('should find ability by function name (normalized)', async () => {
      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'My Test Ability',
            instruction: `\`\`\`echo
test
\`\`\``,
          },
        ],
      }

      // @note getAbilityFunctionName normalizes the name

      const result = await applySkillset(
        'userId',
        skillset,
        'my_test_ability',
        '',
        {}
      )

      expect(result.result).toBe('test')
    })
  })

  describe('_instruction meta field', () => {
    it('should use _instruction from meta if available', async () => {
      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'metaAbility',
            instruction: `\`\`\`echo
original instruction
\`\`\``,
            meta: {
              _instruction: `\`\`\`echo
preprocessed instruction
\`\`\``,
            },
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'metaAbility',
        '',
        {}
      )

      expect(result.result).toBe('preprocessed instruction')
    })

    it('should fall back to instruction when _instruction is not set', async () => {
      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'noMetaAbility',
            instruction: `\`\`\`echo
original instruction
\`\`\``,
            meta: {},
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'noMetaAbility',
        '',
        {}
      )

      expect(result.result).toBe('original instruction')
    })
  })

  describe('error handling', () => {
    it('should return abort message when no action is found after transform', async () => {
      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'noActionAbility',
            instruction: 'This has no action blocks at all',
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'noActionAbility',
        '',
        {}
      )

      expect(result.result).toBeNull()
      expect(result.messages.length).toBeGreaterThan(0)
      expect(result.messages[0].text).toContain('problem fulfilling')
    })
  })

  describe('executeAction error handling', () => {
    it('should return generic error message for non-SafeError exceptions', async () => {
      executeAction.mockRejectedValueOnce(new Error('Internal server error'))

      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'simpleAbility',
            instruction: `\`\`\`echo
test
\`\`\``,
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'simpleAbility',
        '',
        {}
      )

      // @note generic errors are hidden from users
      expect(result.error).toBe('An unexpected error occurred.')
    })

    it('should return SafeError message to users', async () => {
      executeAction.mockRejectedValueOnce(
        new SafeError('This error is safe to show')
      )

      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'simpleAbility',
            instruction: `\`\`\`echo
test
\`\`\``,
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'simpleAbility',
        '',
        {}
      )

      // @note SafeError messages are shown to users
      expect(result.error).toBe('This error is safe to show')
    })

    it('should return full error message when debug mode is enabled', async () => {
      executeAction.mockRejectedValueOnce(
        new Error('Detailed internal error for debugging')
      )

      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'simpleAbility',
            instruction: `\`\`\`echo
test
\`\`\``,
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'simpleAbility',
        '',
        { debug: true }
      )

      // @note in debug mode, full error messages are returned
      expect(result.error).toBe('Detailed internal error for debugging')
    })

    it('should return user-friendly message for TimeoutError', async () => {
      executeAction.mockRejectedValueOnce(
        new TimeoutError('Operation timed out')
      )

      // @note this used to dispatch a ```browser ability. That action was
      // removed, so the instruction no longer resolved and executeAction was
      // never reached - the rejection this case exists to classify never
      // happened, and `result.error` came back undefined. The classification
      // being tested is not specific to any one action type.

      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'simpleAbility',
            instruction: `\`\`\`echo
test
\`\`\``,
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'simpleAbility',
        '',
        {}
      )

      // @note TimeoutError should be treated as a safe error with user-friendly message
      expect(result.error).toBe(
        'The operation timed out. Please try again or contact support if the issue persists.'
      )
    })

    it('should abort when executeAction returns null/undefined', async () => {
      executeAction.mockResolvedValueOnce(null)

      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'simpleAbility',
            instruction: `\`\`\`echo
test
\`\`\``,
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'simpleAbility',
        '',
        {}
      )

      // @note null return triggers abort()
      expect(result.result).toBeNull()
      expect(result.messages.length).toBeGreaterThan(0)
    })
  })

  describe('linkedResources ref() helper', () => {
    it('should pass valid resource IDs to executeAction', async () => {
      const skillset = {
        id: 'skillset-123',
        blueprintId: 'blueprint-456',
        abilities: [
          {
            id: 'ability-789',
            name: 'simpleAbility',
            instruction: `\`\`\`echo
test
\`\`\``,
            linkedSecretId: 'secret-abc',
            linkedFileId: 'file-def',
            linkedBotId: 'bot-ghi',
          },
        ],
      }

      await applySkillset('userId', skillset, 'simpleAbility', '', {})

      expect(executeAction).toHaveBeenCalledWith(
        'echo',
        'test',
        expect.any(Object),
        expect.objectContaining({
          linkedResources: {
            secretId: 'secret-abc',
            fileId: 'file-def',
            botId: 'bot-ghi',
            spaceId: undefined,
          },
          contextResources: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-123',
            abilityId: 'ability-789',
          },
        })
      )
    })

    it('should filter out temp- prefixed IDs', async () => {
      const skillset = {
        id: 'temp-skillset-123',
        blueprintId: 'temp-blueprint-456',
        abilities: [
          {
            id: 'temp-ability-789',
            name: 'simpleAbility',
            instruction: `\`\`\`echo
test
\`\`\``,
            linkedSecretId: 'temp-secret-abc',
            linkedFileId: null,
            linkedBotId: undefined,
          },
        ],
      }

      await applySkillset('userId', skillset, 'simpleAbility', '', {})

      expect(executeAction).toHaveBeenCalledWith(
        'echo',
        'test',
        expect.any(Object),
        expect.objectContaining({
          linkedResources: {
            secretId: undefined,
            fileId: undefined,
            botId: undefined,
            spaceId: undefined,
          },
          contextResources: {
            blueprintId: undefined,
            skillsetId: undefined,
            abilityId: undefined,
          },
        })
      )
    })

    it('should filter out tmp- prefixed IDs', async () => {
      const skillset = {
        id: 'tmp-skillset-123',
        abilities: [
          {
            id: 'tmp-ability-789',
            name: 'simpleAbility',
            instruction: `\`\`\`echo
test
\`\`\``,
          },
        ],
      }

      await applySkillset('userId', skillset, 'simpleAbility', '', {})

      expect(executeAction).toHaveBeenCalledWith(
        'echo',
        'test',
        expect.any(Object),
        expect.objectContaining({
          contextResources: expect.objectContaining({
            skillsetId: undefined,
            abilityId: undefined,
          }),
        })
      )
    })

    it('should filter out dash-only IDs', async () => {
      const skillset = {
        id: '-',
        abilities: [
          {
            id: '-',
            name: 'simpleAbility',
            instruction: `\`\`\`echo
test
\`\`\``,
          },
        ],
      }

      await applySkillset('userId', skillset, 'simpleAbility', '', {})

      expect(executeAction).toHaveBeenCalledWith(
        'echo',
        'test',
        expect.any(Object),
        expect.objectContaining({
          contextResources: expect.objectContaining({
            skillsetId: undefined,
            abilityId: undefined,
          }),
        })
      )
    })
  })

  describe('inlineSecrets', () => {
    it('should pass inlineSecrets to executeAction', async () => {
      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'simpleAbility',
            instruction: `\`\`\`echo
test
\`\`\``,
            inlineSecrets: {
              API_KEY: { value: 'secret-api-key' },
              DB_PASSWORD: { value: 'secret-db-pass' },
            },
          },
        ],
      }

      await applySkillset('userId', skillset, 'simpleAbility', '', {})

      expect(executeAction).toHaveBeenCalledWith(
        'echo',
        'test',
        expect.any(Object),
        expect.objectContaining({
          inlineSecrets: {
            API_KEY: { value: 'secret-api-key' },
            DB_PASSWORD: { value: 'secret-db-pass' },
          },
        })
      )
    })
  })

  describe('action messages handling', () => {
    it('should include action messages in result', async () => {
      executeAction.mockResolvedValueOnce({
        result: 'test',
        messages: [
          { type: 'context', text: 'Action message 1' },
          { type: 'context', text: 'Action message 2' },
        ],
      })

      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'simpleAbility',
            instruction: `\`\`\`echo
test
\`\`\``,
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'simpleAbility',
        '',
        {}
      )

      expect(result.messages).toHaveLength(2)
      expect(result.messages[0].text).toBe('Action message 1')
      expect(result.messages[1].text).toBe('Action message 2')
      // @note messages should have skillset meta added
      expect(result.messages[0].meta.skillset.id).toBe('123')
    })

    it('should include hintMessages in result', async () => {
      executeAction.mockResolvedValueOnce({
        result: 'test',
        hintMessages: [{ type: 'context', text: 'Hint message' }],
      })

      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'simpleAbility',
            instruction: `\`\`\`echo
test
\`\`\``,
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'simpleAbility',
        '',
        {}
      )

      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].text).toBe('Hint message')
    })

    it('should combine messages and hintMessages', async () => {
      executeAction.mockResolvedValueOnce({
        result: 'test',
        messages: [{ type: 'context', text: 'Regular message' }],
        hintMessages: [{ type: 'context', text: 'Hint message' }],
      })

      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'simpleAbility',
            instruction: `\`\`\`echo
test
\`\`\``,
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'simpleAbility',
        '',
        {}
      )

      expect(result.messages).toHaveLength(2)
    })
  })

  describe('options.messages', () => {
    it('should pass messages to executeAction', async () => {
      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'simpleAbility',
            instruction: `\`\`\`echo
test
\`\`\``,
          },
        ],
      }

      const existingMessages = [
        { type: 'user', text: 'Hello' },
        { type: 'bot', text: 'Hi there' },
      ]

      await applySkillset('userId', skillset, 'simpleAbility', '', {
        messages: existingMessages,
      })

      expect(executeAction).toHaveBeenCalledWith(
        'echo',
        'test',
        expect.any(Object),
        expect.objectContaining({
          messages: existingMessages,
        })
      )
    })
  })

  describe('options.usageMeta', () => {
    it('should pass usageMeta to executeAction', async () => {
      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'simpleAbility',
            instruction: `\`\`\`echo
test
\`\`\``,
          },
        ],
      }

      const usageMeta = {
        conversationId: 'conv-123',
        botId: 'bot-456',
      }

      await applySkillset('userId', skillset, 'simpleAbility', '', {
        usageMeta,
      })

      expect(executeAction).toHaveBeenCalledWith(
        'echo',
        'test',
        expect.any(Object),
        expect.objectContaining({
          usageMeta,
        })
      )
    })
  })

  describe('usage tracking', () => {
    it('should track zero usage from simple transform functions', async () => {
      // @note simple transforms are deterministic and don't use LLM, so usage is 0
      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'simpleAbility',
            instruction: `\`\`\`echo
test
\`\`\``,
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'simpleAbility',
        '',
        {}
      )

      // @note simple transforms have zero token usage
      expect(result.usage.token).toBe(0)
      expect(result.usage.model).toBe('base')
    })
  })

  describe('result meta', () => {
    it('should include skillset meta in result', async () => {
      const skillset = {
        id: 'skillset-xyz',
        abilities: [
          {
            name: 'testAbility',
            instruction: `\`\`\`echo
test
\`\`\``,
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'testAbility',
        'test input',
        {}
      )

      expect(result.meta).toEqual({
        skillset: {
          id: 'skillset-xyz',
          action: {
            name: 'testAbility',
            input: 'test input',
          },
        },
      })
    })
  })

  describe('structured instructions', () => {
    // @note structured instructions use YAML action tags like !string, !number,
    // !fetch, etc. They are detected by getInstructionType and processed via
    // transformStructuredInstruction using real implementations

    it('should process structured instruction with required field', async () => {
      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'structuredAbility',
            instruction: `!fetch
method: POST
url: /api/data
body:
  query: !string
    name: query
    required: true`,
          },
        ],
      }

      const input = JSON.stringify({ query: 'test search' })

      await applySkillset('userId', skillset, 'structuredAbility', input, {})

      // @note executeAction is called with resolved values from structured transform
      expect(executeAction).toHaveBeenCalledWith(
        'fetch',
        expect.stringContaining('query: "test search"'),
        expect.any(Object),
        expect.any(Object)
      )
    })

    it('should apply defaults for missing optional fields', async () => {
      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'structuredAbility',
            instruction: `!fetch
method: GET
url: /api/search
body:
  query: !string
    name: query
    required: true
  limit: !number
    name: limit
    default: 10`,
          },
        ],
      }

      const input = JSON.stringify({ query: 'test' })

      await applySkillset('userId', skillset, 'structuredAbility', input, {})

      // @note default value for limit should be applied
      expect(executeAction).toHaveBeenCalledWith(
        'fetch',
        expect.stringContaining('limit: 10'),
        expect.any(Object),
        expect.any(Object)
      )
    })

    it('should preserve special substitution fields for later resolution', async () => {
      // @note special fields like ${CONVERSATION_ID} are preserved for later
      // resolution by the action executor, not substituted by the transform
      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'structuredAbility',
            instruction: `!fetch
method: POST
url: /api/webhook
body:
  id: \${CONVERSATION_ID}`,
          },
        ],
      }

      await applySkillset('userId', skillset, 'structuredAbility', '', {
        substitutions: { CONVERSATION_ID: 'conv-123' },
      })

      // @note special fields are preserved, substitution happens later in action execution
      expect(executeAction).toHaveBeenCalledWith(
        'fetch',
        expect.stringContaining('${CONVERSATION_ID}'),
        expect.any(Object),
        expect.any(Object)
      )
    })

    it('should track zero usage from structured instruction transform', async () => {
      // @note structured transforms without LLM calls have zero usage
      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'structuredAbility',
            instruction: `!fetch
method: GET
url: /api/data`,
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'structuredAbility',
        '',
        {}
      )

      // @note usage should be zero for deterministic structured transforms
      expect(result.usage.token).toBe(0)
    })

    it('should execute fetch action from structured instruction', async () => {
      executeAction.mockResolvedValueOnce({ result: { data: 'response' } })

      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'fetchAbility',
            instruction: `!fetch
method: GET
url: https://api.example.com/data`,
          },
        ],
      }

      const result = await applySkillset(
        'userId',
        skillset,
        'fetchAbility',
        '',
        {}
      )

      expect(executeAction).toHaveBeenCalledWith(
        'fetch',
        expect.stringContaining('method: "GET"'),
        expect.any(Object),
        expect.any(Object)
      )
      expect(result.result).toEqual({ data: 'response' })
    })
  })

  describe('test harness', () => {
    it('test harness 001', async () => {
      const skillset = {
        id: '123',
        abilities: [
          {
            name: 'Search Memories',
            instruction: 'template: memory/search[contact]\nparameters: {}\n',
          },
        ],
      }

      await applySkillset(
        'userId',
        skillset,
        'Search Memories',
        '{"query":"banana"}',
        {}
      )

      expect(executeAction).toHaveBeenCalledWith(
        'memory',
        `"@scope": "contact"\nquery: "banana"`,
        { debug: undefined, search: true },
        expect.any(Object)
      )
    })
  })

  describe('large response observation', () => {
    it('should chunk and capture observation when chunking is enabled', async () => {
      expect(jest.isMockFunction(errorModule.captureObservation)).toBe(true)

      const skillset = {
        id: 'skillset-123',
        blueprintId: 'blueprint-456',
        abilities: [
          {
            id: 'ability-789',
            name: 'fetchAbility',
            instruction: `!fetch
method: GET
url: https://api.example.com/large-data`,
          },
        ],
      }

      // Create a large response that will exceed 10,000 tokens

      // @note repeated single chars compress well in tokenizers, so use varied
      // text 'test ' is 2 tokens, so 20000 repetitions = ~40000 tokens

      const largeResult = 'test '.repeat(20000)

      executeAction.mockResolvedValueOnce({ result: largeResult })

      const result = await applySkillset(
        'userId',
        skillset,
        'fetchAbility',
        '',
        { chunking: true }
      )

      // @note with chunking enabled, the result should be chunked
      // metadata instead of the original large string

      expect(result.result).toEqual(
        expect.objectContaining({
          isChunked: true,
          totalChunks: 1,
        })
      )

      expect(chunkModule.storeChunkedResponse).toHaveBeenCalledWith(largeResult)

      expect(errorModule.captureObservation).toHaveBeenCalledWith(
        'skillset action returned large response',
        expect.objectContaining({
          tokenCount: expect.any(Number),
          action: 'fetch',
          userId: 'userId',
          blueprintId: 'blueprint-456',
          skillsetId: 'skillset-123',
          abilityId: 'ability-789',
          chunked: true,
        })
      )

      // Verify the token count is greater than 10,000

      const callArgs = errorModule.captureObservation.mock.calls[0][1]

      expect(callArgs.tokenCount).toBeGreaterThan(10000)
    })

    it('should not chunk by default but still capture observation for large responses', async () => {
      const skillset = {
        id: 'skillset-123',
        blueprintId: 'blueprint-456',
        abilities: [
          {
            id: 'ability-789',
            name: 'fetchAbility',
            instruction: `!fetch
method: GET
url: https://api.example.com/large-data`,
          },
        ],
      }

      const largeResult = 'test '.repeat(20000)

      executeAction.mockResolvedValueOnce({ result: largeResult })

      const result = await applySkillset(
        'userId',
        skillset,
        'fetchAbility',
        '',
        {}
      )

      // @note with chunking disabled by default, the result should be the original string

      expect(result.result).toBe(largeResult)
      expect(chunkModule.storeChunkedResponse).not.toHaveBeenCalled()

      // @note observation should still be captured even when chunking is disabled

      expect(errorModule.captureObservation).toHaveBeenCalledWith(
        'skillset action returned large response',
        expect.objectContaining({
          tokenCount: expect.any(Number),
          chunked: false,
        })
      )
    })

    it('should not capture observation when response is under 10,000 tokens', async () => {
      const skillset = {
        id: 'skillset-123',
        blueprintId: 'blueprint-456',
        abilities: [
          {
            id: 'ability-789',
            name: 'fetchAbility',
            instruction: `!fetch
method: GET
url: https://api.example.com/small-data`,
          },
        ],
      }

      // Create a small response that will be under 10,000 tokens

      const smallResult = 'small response'

      executeAction.mockResolvedValueOnce({ result: smallResult })

      await applySkillset('userId', skillset, 'fetchAbility', '', {})

      expect(errorModule.captureObservation).not.toHaveBeenCalled()
    })

    it('should capture observation with correct action name', async () => {
      const skillset = {
        id: 'skillset-123',
        blueprintId: 'blueprint-456',
        abilities: [
          {
            id: 'ability-789',
            name: 'echoAbility',
            instruction: `\`\`\`echo
Hello World
\`\`\``,
          },
        ],
      }

      // Create a large response using varied text for proper token count
      // 'test ' is 2 tokens, so 20000 repetitions = ~40000 tokens

      const largeResult = 'test '.repeat(20000)

      executeAction.mockResolvedValueOnce({ result: largeResult })

      await applySkillset('userId', skillset, 'echoAbility', '', {})

      expect(errorModule.captureObservation).toHaveBeenCalledWith(
        'skillset action returned large response',
        expect.objectContaining({
          action: 'echo',
        })
      )
    })
  })
})
