import {
  array,
  createAuxiliaryTemplate,
  createFetchTemplate,
  createFileAppendTemplate,
  createFileReadTemplate,
  createFileWriteTemplate,
  createMcpTemplate,
  createPackTemplate,
  createSkillsetTemplate,
  field,
  file,
  object,
  secret,
  space,
} from '@/lib/ability.template'

describe('ability.template.dsl', () => {
  describe('field', () => {
    it('should create a field marker with name', () => {
      const result = field({ name: 'query' })

      expect(result.name).toBe('query')
      expect(result.type).toBe('string')
      expect(result.required).toBe(true)
    })

    it('should create a field marker with all options', () => {
      const result = field({
        name: 'limit',
        description: 'Maximum results',
        type: 'number',
        optional: true,
        enum: ['10', '20', '50'],
        default: 10,
      })

      expect(result.name).toBe('limit')
      expect(result.description).toBe('Maximum results')
      expect(result.type).toBe('number')
      expect(result.required).toBe(false)
      expect(result.enum).toEqual(['10', '20', '50'])
      expect(result.default).toBe(10)
    })

    it('should default required to true', () => {
      const result = field({ name: 'test' })

      expect(result.required).toBe(true)
    })

    it('should default type to string', () => {
      const result = field({ name: 'test' })

      expect(result.type).toBe('string')
    })

    it('should support placeholder option', () => {
      const result = field({ name: 'userInput', placeholder: true })

      expect(result.placeholder).toBe(true)
    })

    it('should default placeholder fields to required', () => {
      const result = field({ name: 'userInput', placeholder: true })

      expect(result.required).toBe(true)
    })

    it('should allow placeholder fields to be optional when explicitly set', () => {
      const result = field({
        name: 'userInput',
        placeholder: true,
        optional: true,
      })

      expect(result.placeholder).toBe(true)
      expect(result.required).toBe(false)
    })
  })

  describe('secret', () => {
    it('should create a secret marker with default name', () => {
      const result = secret()

      expect(result.name).toBe('DEFAULT')
    })

    it('should create a secret marker with custom name', () => {
      const result = secret('COINAPI')

      expect(result.name).toBe('COINAPI')
    })
  })

  describe('file', () => {
    it('should create a file marker with default name', () => {
      const result = file()

      expect(result.name).toBe('DEFAULT')
    })

    it('should create a file marker with custom name', () => {
      const result = file('CUSTOM')

      expect(result.name).toBe('CUSTOM')
    })
  })

  describe('space', () => {
    it('should create a space marker with default name', () => {
      const result = space()

      expect(result.name).toBe('DEFAULT')
    })

    it('should create a space marker with custom name', () => {
      const result = space('CUSTOM')

      expect(result.name).toBe('CUSTOM')
    })
  })

  describe('array', () => {
    it('should create an array marker with items', () => {
      const items = field({ name: 'tag' })
      const result = array({ items })

      expect(result.items).toBe(items)
    })

    it('should support minItems and maxItems', () => {
      const result = array({
        items: field({ name: 'item' }),
        minItems: 1,
        maxItems: 10,
      })

      expect(result.minItems).toBe(1)
      expect(result.maxItems).toBe(10)
    })

    it('should support name and description', () => {
      const result = array({
        items: field({ name: 'item' }),
        name: 'tags',
        description: 'List of tags',
      })

      expect(result.name).toBe('tags')
      expect(result.description).toBe('List of tags')
    })

    it('should support optional property', () => {
      const result = array({
        items: field({ name: 'item' }),
        optional: true,
      })

      expect(result.optional).toBe(true)
    })

    it('should default optional to undefined when not specified', () => {
      const result = array({
        items: field({ name: 'item' }),
      })

      expect(result.optional).toBeUndefined()
    })
  })

  describe('object', () => {
    it('should create an object marker with shape', () => {
      const shape = {
        name: field({ name: 'userName' }),
        email: field({ name: 'userEmail' }),
      }
      const result = object({ shape })

      expect(result.shape).toBe(shape)
    })

    it('should support name and description', () => {
      const result = object({
        shape: { id: field({ name: 'id' }) },
        name: 'user',
        description: 'User object',
      })

      expect(result.name).toBe('user')
      expect(result.description).toBe('User object')
    })

    it('should support optional property', () => {
      const result = object({
        shape: { id: field({ name: 'id' }) },
        optional: true,
      })

      expect(result.optional).toBe(true)
    })

    it('should default optional to undefined when not specified', () => {
      const result = object({
        shape: { id: field({ name: 'id' }) },
      })

      expect(result.optional).toBeUndefined()
    })
  })

  describe('createFetchTemplate', () => {
    it('should create a basic fetch template', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test API',
        description: 'Test description',
        tags: ['test'],
        instruction: {
          method: 'GET',
          url: 'https://api.test.com',
        },
      })

      expect(result.provider).toBe('test')
      expect(result.icon).toBe('@logo/test.com')
      expect(result.name).toBe('Test API')
      expect(result.description).toBe('Test description')
      expect(result.tags).toEqual(['test'])
      expect(result.instruction).toContain('!fetch')
      expect(result.instruction).toContain('method: GET')
      expect(result.instruction).toContain('url: https://api.test.com')
      expect(result.instruction).toContain('_internal:')
      expect(result.instruction).toContain('template: true')
    })

    it('should preserve existing fetch options when adding internal template metadata', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test API',
        description: 'Test description',
        tags: ['test'],
        instruction: {
          method: 'GET',
          url: 'https://api.test.com',
          options: {
            format: 'json',
            debug: true,
          },
        },
      })

      expect(result.instruction).toContain('format: json')
      expect(result.instruction).toContain('debug: true')
      expect(result.instruction).toContain('_internal:')
      expect(result.instruction).toContain('template: true')
    })

    it('should include secret in output when provided', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        secret: '@test/secret',
        instruction: {
          url: 'https://api.test.com',
        },
      })

      expect(result.secret).toBe('@test/secret')
    })

    it('should include commentary when provided', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        commentary: 'Some commentary',
        instruction: {
          url: 'https://api.test.com',
        },
      })

      expect(result.commentary).toBe('Some commentary')
    })

    it('should not include secret when not provided', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        instruction: {
          url: 'https://api.test.com',
        },
      })

      expect(result.secret).toBeUndefined()
    })

    it('should handle path arrays with static and dynamic values', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        instruction: {
          method: 'GET',
          url: 'https://api.test.com',
          path: [
            '/v1/items/',
            field({ name: 'itemId', description: 'Item ID' }),
          ],
        },
      })

      expect(result.instruction).toContain('path:')
      expect(result.instruction).toContain('- /v1/items/')
      expect(result.instruction).toContain('!string')
      expect(result.instruction).toContain('name: itemId')
      expect(result.instruction).toContain('description: Item ID')
    })

    it('should handle query parameters with fields', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        instruction: {
          method: 'GET',
          url: 'https://api.test.com',
          query: {
            q: field({ name: 'query', description: 'Search query' }),
            limit: 10,
          },
        },
      })

      expect(result.instruction).toContain('query:')
      expect(result.instruction).toContain('!string')
      expect(result.instruction).toContain('name: query')
      expect(result.instruction).toContain('description: Search query')
      expect(result.instruction).toContain('limit: 10')
    })

    it('should handle headers with secrets', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        instruction: {
          method: 'GET',
          url: 'https://api.test.com',
          headers: {
            Authorization: secret(),
            'Content-Type': 'application/json',
          },
        },
      })

      expect(result.instruction).toContain('headers:')
      expect(result.instruction).toContain(
        'Authorization: !reference SECRET_DEFAULT'
      )
      expect(result.instruction).toContain('Content-Type: application/json')
    })

    it('should handle named secrets', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        instruction: {
          method: 'GET',
          url: 'https://api.test.com',
          headers: {
            'X-API-Key': secret('CUSTOM'),
          },
        },
      })

      expect(result.instruction).toContain(
        'X-API-Key: !reference SECRET_CUSTOM'
      )
    })

    it('should handle object headers with top-level fetch authorization', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        instruction: {
          method: 'POST',
          url: 'https://api.test.com',
          headers: object({
            name: 'headers',
            description: 'Additional headers',
            optional: true,
            shape: {},
          }),
          authorization: secret(),
        },
      })

      expect(result.instruction).toContain('headers: !object')
      expect(result.instruction).toContain('name: headers')
      expect(result.instruction).toContain('description: Additional headers')
      expect(result.instruction).toContain('optional: true')
      expect(result.instruction).toContain('properties: {}')
      expect(result.instruction).not.toContain('contentType')
      expect(result.instruction).toContain(
        'authorization: !reference SECRET_DEFAULT'
      )
    })

    it('should handle body with nested objects', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        instruction: {
          method: 'POST',
          url: 'https://api.test.com',
          body: {
            user: {
              name: field({ name: 'userName', description: 'User name' }),
              email: field({ name: 'userEmail', description: 'User email' }),
            },
          },
        },
      })

      expect(result.instruction).toContain('body:')
      expect(result.instruction).toContain('user:')
      expect(result.instruction).toContain('!string')
      expect(result.instruction).toContain('name: userName')
      expect(result.instruction).toContain('description: User name')
      expect(result.instruction).toContain('name: userEmail')
      expect(result.instruction).toContain('description: User email')
    })

    it('should handle array marker in body', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        instruction: {
          method: 'POST',
          url: 'https://api.test.com',
          body: {
            tags: array({
              items: field({ name: 'tag', description: 'A tag' }),
            }),
          },
        },
      })

      expect(result.instruction).toContain('tags:')
      expect(result.instruction).toContain('!array')
      expect(result.instruction).toContain('name: tag')
      expect(result.instruction).toContain('description: A tag')
    })

    it('should use parent object key as array field name when no explicit name is provided', () => {
      // @note this was a bug where array() without an explicit name would default
      // to 'items' as the ArrayField name, causing ArrayField.substitute() to look
      // for fieldValues['items'] instead of fieldValues['tags'] (the YAML key)
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        instruction: {
          method: 'POST',
          url: 'https://api.test.com',
          body: {
            tags: array({
              items: field({ name: 'tag', description: 'A tag' }),
            }),
          },
        },
      })

      // @note the array's name in the generated instruction should be 'tags'
      // (the parent object key), not 'items' (the old default)
      expect(result.instruction).toContain('name: tags')
      expect(result.instruction).not.toContain('name: items')
    })

    it('should handle object marker in body', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        instruction: {
          method: 'POST',
          url: 'https://api.test.com',
          body: {
            user: object({
              shape: {
                id: field({ name: 'userId' }),
                role: 'user',
              },
            }),
          },
        },
      })

      expect(result.instruction).toContain('user:')
      expect(result.instruction).toContain('!object')
      expect(result.instruction).toContain('name: userId')
      expect(result.instruction).toContain('role: user')
    })

    it('should handle array of objects (nested markers)', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        instruction: {
          method: 'POST',
          url: 'https://api.test.com',
          body: {
            messages: array({
              items: object({
                shape: {
                  role: field({ name: 'role', enum: ['user', 'assistant'] }),
                  content: field({ name: 'content', description: 'Message' }),
                },
              }),
            }),
          },
        },
      })

      expect(result.instruction).toContain('messages:')
      expect(result.instruction).toContain('!array')
      expect(result.instruction).toContain('!object')
      expect(result.instruction).toContain('name: role')
      expect(result.instruction).toContain('name: content')
      expect(result.instruction).toContain('description: Message')
    })

    it('should handle field with enum', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        instruction: {
          method: 'GET',
          url: 'https://api.test.com',
          query: {
            format: field({ name: 'format', enum: ['json', 'xml', 'csv'] }),
          },
        },
      })

      expect(result.instruction).toContain('!string')
      expect(result.instruction).toContain('name: format')
      expect(result.instruction).toContain('enum:')
    })

    it('should handle field with default value', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        instruction: {
          method: 'GET',
          url: 'https://api.test.com',
          query: {
            limit: field({ name: 'limit', type: 'number', default: 10 }),
          },
        },
      })

      expect(result.instruction).toContain('!number')
      expect(result.instruction).toContain('name: limit')
      expect(result.instruction).toContain('default: 10')
    })

    it('should handle optional field (required: false)', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        instruction: {
          method: 'GET',
          url: 'https://api.test.com',
          query: {
            filter: field({
              name: 'filter',
              optional: true,
              description: 'Optional filter',
            }),
          },
        },
      })

      // @note optional fields have optional: true in the structured format

      expect(result.instruction).toContain('!string')
      expect(result.instruction).toContain('name: filter')
      expect(result.instruction).toContain('description: Optional filter')
      expect(result.instruction).toContain('optional: true')
    })

    it('should handle placeholder field', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        instruction: {
          method: 'GET',
          url: 'https://api.test.com',
          query: {
            userInput: field({
              name: 'input',
              placeholder: true,
              description: 'User provided',
            }),
          },
        },
      })

      // @note placeholder fields have placeholder: true in the structured format
      expect(result.instruction).toContain('!string')
      expect(result.instruction).toContain('name: input')
      expect(result.instruction).toContain('description: User provided')
      expect(result.instruction).toContain('placeholder: true')
    })

    it('should handle optional placeholder field', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        instruction: {
          method: 'GET',
          url: 'https://api.test.com',
          query: {
            userInput: field({
              name: 'input',
              placeholder: true,
              optional: true,
              description: 'Optional user input',
            }),
          },
        },
      })

      // @note optional placeholder fields have both optional: true and placeholder: true
      expect(result.instruction).toContain('!string')
      expect(result.instruction).toContain('name: input')
      expect(result.instruction).toContain('description: Optional user input')
      expect(result.instruction).toContain('optional: true')
      expect(result.instruction).toContain('placeholder: true')
    })

    it('should handle options in instruction', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        instruction: {
          method: 'GET',
          url: 'https://api.test.com',
          options: {
            format: 'markdown',
            selectors: '.content',
          },
        },
      })

      expect(result.instruction).toContain('options:')
      expect(result.instruction).toContain('format: markdown')
      expect(result.instruction).toContain('selectors: .content')
    })

    it('should handle multiline jmespath in options correctly', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        instruction: {
          method: 'GET',
          url: 'https://api.test.com',
          options: {
            error: {
              jsonpath: '$.ok',
            },
            jmespath: `items[*].{
  id: id,
  name: name,
  status: status
}`,
          },
        },
      })

      // @note the jmespath should be properly formatted as a YAML block scalar
      // so that the multiline content doesn't break the YAML structure
      expect(result.instruction).toContain('jmespath:')
      // @note verify it uses block scalar notation (|, |-, >) or proper quoting
      expect(result.instruction).toMatch(/jmespath: (\|[-+]?|>[-+]?|"|')/)
    })

    it('should handle options with error jsonpath', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        instruction: {
          method: 'GET',
          url: 'https://api.test.com',
          options: {
            error: {
              jsonpath: '$.ok',
            },
          },
        },
      })

      expect(result.instruction).toContain('options:')
      expect(result.instruction).toContain('error:')
      expect(result.instruction).toContain('jsonpath: $.ok')
    })
  })

  describe('real-world examples', () => {
    it('should generate correct output for CoinAPI example', () => {
      const result = createFetchTemplate({
        provider: 'coinapi',
        icon: '@logo/coinapi.io',
        name: 'Get Cryptocurrency Information with CoinAPI',
        description:
          'Fetch cryptocurrency data such as price, market cap, and volume',
        tags: ['cryptocurrency', 'coinapi'],
        secret: '@coinapi',
        instruction: {
          method: 'GET',
          url: 'https://rest.coinapi.io',
          path: [
            '/v1/assets/',
            field({ name: 'crypto', description: 'cryptocurrency symbol' }),
          ],
          query: {
            apikey: secret(),
          },
        },
      })

      expect(result.provider).toBe('coinapi')
      expect(result.secret).toBe('@coinapi')
      expect(result.instruction).toContain('method: GET')
      expect(result.instruction).toContain('url: https://rest.coinapi.io')
      expect(result.instruction).toContain('- /v1/assets/')
      expect(result.instruction).toContain('!string')
      expect(result.instruction).toContain('name: crypto')
      expect(result.instruction).toContain('description: cryptocurrency symbol')
      expect(result.instruction).toContain('apikey: !reference SECRET_DEFAULT')
    })

    it('should generate correct output for Brave Search example', () => {
      const result = createFetchTemplate({
        provider: 'brave',
        icon: '@logo/brave.com',
        name: 'Web Search',
        description: 'Search the web using Brave Search',
        tags: ['brave', 'search'],
        secret: '@brave/search',
        instruction: {
          method: 'GET',
          url: 'https://api.search.brave.com/res/v1/web/search',
          query: {
            q: field({ name: 'query', description: 'Search query' }),
          },
          headers: {
            'X-Subscription-Token': secret(),
            Accept: 'application/json',
          },
        },
      })

      expect(result.provider).toBe('brave')
      expect(result.secret).toBe('@brave/search')
      expect(result.instruction).toContain('!string')
      expect(result.instruction).toContain('name: query')
      expect(result.instruction).toContain('description: Search query')
      expect(result.instruction).toContain(
        'X-Subscription-Token: !reference SECRET_DEFAULT'
      )
      expect(result.instruction).toContain('Accept: application/json')
    })

    it('should generate correct output for OpenAI Chat example', () => {
      const result = createFetchTemplate({
        provider: 'openai',
        icon: '@logo/openai.com',
        name: 'Chat Completion',
        description: 'Send messages to OpenAI',
        tags: ['openai', 'chat'],
        secret: '@openai',
        instruction: {
          method: 'POST',
          url: 'https://api.openai.com/v1/chat/completions',
          headers: {
            Authorization: secret(),
            'Content-Type': 'application/json',
          },
          body: {
            model: 'gpt-4',
            messages: array({
              items: object({
                shape: {
                  role: field({
                    name: 'role',
                    enum: ['user', 'assistant', 'system'],
                  }),
                  content: field({
                    name: 'content',
                    description: 'Message content',
                  }),
                },
              }),
            }),
            temperature: field({
              name: 'temperature',
              type: 'number',
              default: 0.7,
              optional: true,
            }),
          },
        },
      })

      expect(result.provider).toBe('openai')
      expect(result.instruction).toContain('method: POST')
      expect(result.instruction).toContain('model: gpt-4')
      expect(result.instruction).toContain('messages:')
      expect(result.instruction).toContain('!array')
      expect(result.instruction).toContain('!object')
      expect(result.instruction).toContain('name: role')
      expect(result.instruction).toContain('name: content')
      expect(result.instruction).toContain('description: Message content')
      expect(result.instruction).toContain('!number')
      expect(result.instruction).toContain('name: temperature')
      expect(result.instruction).toContain('optional: true')
    })
  })

  describe('createFileReadTemplate', () => {
    it('should create a basic file read template with file marker', () => {
      const result = createFileReadTemplate({
        provider: 'cbk',
        icon: '@logo/chatbotkit.com',
        name: 'Read File',
        description: 'Read the content of a file',
        tags: ['file', 'read'],
        file: '@file',
        instruction: {
          id: file(),
        },
      })

      expect(result.provider).toBe('cbk')
      expect(result.name).toBe('Read File')
      expect(result.file).toBe('@file')
      expect(result.instruction).toContain('!file.read')
      expect(result.instruction).toContain('id: !reference FILE_DEFAULT')
      // trailing code block removed - structured format has no closing marker
    })

    it('should create file read template with placeholder field', () => {
      const result = createFileReadTemplate({
        provider: 'cbk',
        icon: '@logo/chatbotkit.com',
        name: 'Read File',
        description: 'Read the content of a file',
        tags: ['file', 'read'],
        file: '@file',
        instruction: {
          fileId: field({
            name: 'fileId',
            description: 'the file ID to read',
            placeholder: true,
          }),
        },
      })

      expect(result.instruction).toContain('!file.read')
      expect(result.instruction).toContain('!string')
      expect(result.instruction).toContain('name: fileId')
      expect(result.instruction).toContain('description: the file ID to read')
      expect(result.instruction).toContain('placeholder: true')
    })

    it('should create file read template with custom file marker name', () => {
      const result = createFileReadTemplate({
        provider: 'cbk',
        icon: '@logo/chatbotkit.com',
        name: 'Read Custom File',
        description: 'Read a custom file',
        tags: ['file', 'read'],
        file: '@file',
        instruction: {
          id: file('CUSTOM'),
        },
      })

      expect(result.instruction).toContain('id: !reference FILE_CUSTOM')
    })
  })

  describe('createFileWriteTemplate', () => {
    it('should create a basic file write template', () => {
      const result = createFileWriteTemplate({
        provider: 'cbk',
        icon: '@logo/chatbotkit.com',
        name: 'Write File',
        description: 'Write content to a file',
        tags: ['file', 'write'],
        file: '@file',
        instruction: {
          id: file(),
          text: field({
            name: 'content',
            description: 'content to write',
          }),
        },
      })

      expect(result.provider).toBe('cbk')
      expect(result.name).toBe('Write File')
      expect(result.file).toBe('@file')
      expect(result.instruction).toContain('!file.write')
      expect(result.instruction).toContain('id: !reference FILE_DEFAULT')
      expect(result.instruction).toContain('!string')
      expect(result.instruction).toContain('name: content')
      expect(result.instruction).toContain('description: content to write')
      // trailing code block removed - structured format has no closing marker
    })

    it('should create file write template with placeholder fileId', () => {
      const result = createFileWriteTemplate({
        provider: 'cbk',
        icon: '@logo/chatbotkit.com',
        name: 'Write File',
        description: 'Write content to a file',
        tags: ['file', 'write'],
        file: '@file',
        instruction: {
          fileId: field({
            name: 'fileId',
            description: 'the file ID to write to',
            placeholder: true,
          }),
          text: field({
            name: 'content',
            description: 'content to write',
          }),
        },
      })

      expect(result.instruction).toContain('!string')
      expect(result.instruction).toContain('name: fileId')
      expect(result.instruction).toContain('placeholder: true')
      expect(result.instruction).toContain('name: content')
      expect(result.instruction).toContain('description: content to write')
    })
  })

  describe('createFileAppendTemplate', () => {
    it('should create a basic file append template', () => {
      const result = createFileAppendTemplate({
        provider: 'cbk',
        icon: '@logo/chatbotkit.com',
        name: 'Append to File',
        description: 'Append content to a file',
        tags: ['file', 'append'],
        file: '@file',
        instruction: {
          id: file(),
          text: field({
            name: 'content',
            description: 'content to append',
          }),
        },
      })

      expect(result.provider).toBe('cbk')
      expect(result.name).toBe('Append to File')
      expect(result.file).toBe('@file')
      expect(result.instruction).toContain('!file.append')
      expect(result.instruction).toContain('id: !reference FILE_DEFAULT')
      expect(result.instruction).toContain('!string')
      expect(result.instruction).toContain('name: content')
      expect(result.instruction).toContain('description: content to append')
      // trailing code block removed - structured format has no closing marker
    })

    it('should create file append template with placeholder fileId', () => {
      const result = createFileAppendTemplate({
        provider: 'cbk',
        icon: '@logo/chatbotkit.com',
        name: 'Append to File',
        description: 'Append content to a file',
        tags: ['file', 'append'],
        file: '@file',
        instruction: {
          fileId: field({
            name: 'fileId',
            description: 'the file ID to append to',
            placeholder: true,
          }),
          text: field({
            name: 'content',
            description: 'content to append',
          }),
        },
      })

      expect(result.instruction).toContain('!string')
      expect(result.instruction).toContain('name: fileId')
      expect(result.instruction).toContain('placeholder: true')
      expect(result.instruction).toContain('name: content')
      expect(result.instruction).toContain('description: content to append')
    })
  })

  describe('file marker in fetch template', () => {
    it('should handle file marker in fetch body', () => {
      const result = createFetchTemplate({
        provider: 'cbk',
        icon: '@logo/chatbotkit.com',
        name: 'Query File with SQL',
        description: 'Execute SQL queries on files',
        tags: ['file', 'sql'],
        instruction: {
          method: 'POST',
          url: '/api/auxiliary/skillset/ability/chatbotkit/file/sql',
          headers: {
            'content-type': 'application/json',
            authorization: secret(),
          },
          body: {
            sql: field({
              name: 'sql',
              description: 'the SQL query',
            }),
            tables: {
              table1: {
                fileId: file(),
              },
            },
          },
        },
      })

      expect(result.instruction).toContain('!string')
      expect(result.instruction).toContain('name: sql')
      expect(result.instruction).toContain('description: the SQL query')
      expect(result.instruction).toContain('fileId: !reference FILE_DEFAULT')
      expect(result.instruction).toContain(
        'authorization: !reference SECRET_DEFAULT'
      )
    })

    it('should handle custom file marker name in fetch body', () => {
      const result = createFetchTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        instruction: {
          method: 'POST',
          url: 'https://api.test.com',
          body: {
            sourceFile: file('SOURCE'),
            targetFile: file('TARGET'),
          },
        },
      })

      expect(result.instruction).toContain('sourceFile: !reference FILE_SOURCE')
      expect(result.instruction).toContain('targetFile: !reference FILE_TARGET')
    })
  })

  describe('createSkillsetTemplate', () => {
    it('should create a basic skillset template', () => {
      const result = createSkillsetTemplate({
        provider: 'cbk',
        icon: '@logo/chatbotkit.com',
        name: 'Install Skillset',
        description: 'Bring a skillset into context',
        tags: ['skillset'],
        operation: 'install',
        instruction: {
          skillsetId: field({
            name: 'skillsetId',
            description: 'the skillset ID',
          }),
        },
      })

      expect(result.provider).toBe('cbk')
      expect(result.icon).toBe('@logo/chatbotkit.com')
      expect(result.name).toBe('Install Skillset')
      expect(result.instruction).toContain('!skillset.install')
      expect(result.instruction).toContain('!string')
      expect(result.instruction).toContain('name: skillsetId')
      expect(result.instruction).toContain('description: the skillset ID')
    })

    it('should handle placeholder fields', () => {
      const result = createSkillsetTemplate({
        provider: 'cbk',
        icon: '@logo/chatbotkit.com',
        name: 'Install Skillset',
        description: 'Bring a skillset into context',
        tags: ['skillset'],
        operation: 'install',
        instruction: {
          skillsetId: field({
            name: 'skillsetId',
            description: 'the skillset ID to install',
            placeholder: true,
          }),
        },
      })

      // @note placeholder fields have placeholder: true in the structured format
      expect(result.instruction).toContain('!string')
      expect(result.instruction).toContain('name: skillsetId')
      expect(result.instruction).toContain('placeholder: true')
    })

    it('should support activate operation', () => {
      const result = createSkillsetTemplate({
        provider: 'cbk',
        icon: '@logo/chatbotkit.com',
        name: 'Activate Skillset',
        description: 'Activate a skillset',
        tags: ['skillset'],
        operation: 'activate',
        instruction: {
          skillsetId: field({ name: 'skillsetId' }),
        },
      })

      expect(result.instruction).toContain('!skillset.activate')
    })

    it('should support load operation', () => {
      const result = createSkillsetTemplate({
        provider: 'cbk',
        icon: '@logo/chatbotkit.com',
        name: 'Load Skillset',
        description: 'Load a skillset',
        tags: ['skillset'],
        operation: 'load',
        instruction: {
          skillsetId: field({ name: 'skillsetId' }),
        },
      })

      expect(result.instruction).toContain('!skillset.load')
    })

    it('should handle optional prefix field', () => {
      const result = createSkillsetTemplate({
        provider: 'cbk',
        icon: '@logo/chatbotkit.com',
        name: 'Install Skillset',
        description: 'Install with prefix',
        tags: ['skillset'],
        operation: 'install',
        instruction: {
          skillsetId: field({ name: 'skillsetId' }),
          prefix: 'my_prefix',
        },
      })

      expect(result.instruction).toContain('prefix: my_prefix')
    })

    it('should include commentary when provided', () => {
      const result = createSkillsetTemplate({
        provider: 'cbk',
        icon: '@logo/chatbotkit.com',
        name: 'Install Skillset',
        description: 'Test',
        tags: [],
        commentary: 'Some commentary',
        operation: 'install',
        instruction: {
          skillsetId: field({ name: 'skillsetId' }),
        },
      })

      expect(result.commentary).toBe('Some commentary')
    })
  })

  describe('createMcpTemplate', () => {
    it('should create a basic MCP template', () => {
      const result = createMcpTemplate({
        provider: 'mcp',
        icon: '@logo/mcp.io',
        name: 'Install MCP Server',
        description: 'Install an MCP server',
        tags: ['mcp'],
        operation: 'install',
        instruction: {
          url: field({ name: 'serverUrl', description: 'MCP server URL' }),
        },
      })

      expect(result.provider).toBe('mcp')
      expect(result.instruction).toContain('!mcp.install')
      expect(result.instruction).toContain('!string')
      expect(result.instruction).toContain('name: serverUrl')
      expect(result.instruction).toContain('description: MCP server URL')
    })

    it('should handle headers with secrets', () => {
      const result = createMcpTemplate({
        provider: 'mcp',
        icon: '@logo/mcp.io',
        name: 'Install MCP Server',
        description: 'Install an MCP server',
        tags: ['mcp'],
        operation: 'install',
        instruction: {
          url: 'https://mcp.example.com',
          headers: {
            Authorization: secret(),
          },
        },
      })

      expect(result.instruction).toContain('url: https://mcp.example.com')
      expect(result.instruction).toContain(
        'Authorization: !reference SECRET_DEFAULT'
      )
    })

    it('should support tools field', () => {
      const result = createMcpTemplate({
        provider: 'mcp',
        icon: '@logo/mcp.io',
        name: 'Install MCP Server',
        description: 'Install an MCP server',
        tags: ['mcp'],
        operation: 'install',
        instruction: {
          url: 'https://mcp.example.com',
          tools: 'tool1,tool2',
        },
      })

      expect(result.instruction).toContain('tools: tool1,tool2')
    })

    it('should support prefix field', () => {
      const result = createMcpTemplate({
        provider: 'mcp',
        icon: '@logo/mcp.io',
        name: 'Install MCP Server',
        description: 'Install an MCP server',
        tags: ['mcp'],
        operation: 'install',
        instruction: {
          url: 'https://mcp.example.com',
          prefix: 'my_mcp',
        },
      })

      expect(result.instruction).toContain('prefix: my_mcp')
    })

    it('should support activate operation', () => {
      const result = createMcpTemplate({
        provider: 'mcp',
        icon: '@logo/mcp.io',
        name: 'Activate MCP',
        description: 'Activate',
        tags: [],
        operation: 'activate',
        instruction: {
          url: 'https://mcp.example.com',
        },
      })

      expect(result.instruction).toContain('!mcp.activate')
    })

    it('should support load operation', () => {
      const result = createMcpTemplate({
        provider: 'mcp',
        icon: '@logo/mcp.io',
        name: 'Load MCP',
        description: 'Load',
        tags: [],
        operation: 'load',
        instruction: {
          url: 'https://mcp.example.com',
        },
      })

      expect(result.instruction).toContain('!mcp.load')
    })

    it('should include secret in output when provided', () => {
      const result = createMcpTemplate({
        provider: 'mcp',
        icon: '@logo/mcp.io',
        name: 'Install MCP Server',
        description: 'Install an MCP server',
        tags: ['mcp'],
        operation: 'install',
        secret: '@notion[mcp]',
        instruction: {
          url: 'https://mcp.notion.com/mcp',
          headers: {
            Authorization: secret(),
          },
        },
      })

      expect(result.secret).toBe('@notion[mcp]')
      expect(result.instruction).toContain(
        'Authorization: !reference SECRET_DEFAULT'
      )
    })

    it('should not include secret when not provided', () => {
      const result = createMcpTemplate({
        provider: 'mcp',
        icon: '@logo/mcp.io',
        name: 'Install MCP Server',
        description: 'Install an MCP server',
        tags: ['mcp'],
        operation: 'install',
        instruction: {
          url: 'https://mcp.example.com',
        },
      })

      expect(result.secret).toBeUndefined()
    })
  })

  describe('createPackTemplate', () => {
    it('should create a basic pack template', () => {
      const result = createPackTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test Pack',
        description: 'Test pack ability',
        tags: ['test', 'pack'],
        instruction: {
          abilities: ['ability1', 'ability2'],
        },
      })

      expect(result.provider).toBe('test')
      expect(result.icon).toBe('@logo/test.com')
      expect(result.name).toBe('Test Pack')
      expect(result.description).toBe('Test pack ability')
      expect(result.tags).toEqual(['test', 'pack'])
      expect(result.instruction).toContain('!pack.install')
      expect(result.instruction).toContain('abilities:')
      expect(result.instruction).toContain('- ability1')
      expect(result.instruction).toContain('- ability2')
    })

    it('should include secret in output when provided', () => {
      const result = createPackTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test Pack',
        description: 'Test',
        tags: [],
        secret: '@test/secret',
        instruction: {
          abilities: [],
        },
      })

      expect(result.secret).toBe('@test/secret')
    })

    it('should include commentary when provided', () => {
      const result = createPackTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test Pack',
        description: 'Test',
        tags: [],
        commentary: 'Some commentary about this pack',
        instruction: {
          abilities: [],
        },
      })

      expect(result.commentary).toBe('Some commentary about this pack')
    })

    it('should not include secret when not provided', () => {
      const result = createPackTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test Pack',
        description: 'Test',
        tags: [],
        instruction: {
          abilities: [],
        },
      })

      expect(result.secret).toBeUndefined()
    })

    it('should handle prefix option', () => {
      const result = createPackTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test Pack',
        description: 'Test',
        tags: [],
        instruction: {
          abilities: ['ability1'],
          prefix: 'myPrefix',
        },
      })

      expect(result.instruction).toContain('!pack.install')
      expect(result.instruction).toContain('prefix: myPrefix')
      expect(result.instruction).toContain('- ability1')
    })

    it('should handle abilities array with multiple items', () => {
      const result = createPackTemplate({
        provider: 'airtable',
        icon: '@logo/airtable.com',
        name: 'Airtable Pack',
        description: 'Interact with Airtable',
        tags: ['airtable', 'pack'],
        instruction: {
          abilities: [
            'airtable/base/list',
            'airtable/table/list',
            'airtable/record/create',
            'airtable/record/update',
            'airtable/record/delete',
          ],
        },
      })

      expect(result.instruction).toContain('abilities:')
      expect(result.instruction).toContain('- airtable/base/list')
      expect(result.instruction).toContain('- airtable/table/list')
      expect(result.instruction).toContain('- airtable/record/create')
      expect(result.instruction).toContain('- airtable/record/update')
      expect(result.instruction).toContain('- airtable/record/delete')
    })

    it('should handle empty abilities array', () => {
      const result = createPackTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test Pack',
        description: 'Test',
        tags: [],
        instruction: {
          abilities: [],
        },
      })

      expect(result.instruction).toContain('abilities: []')
    })

    it('should handle prefix with field marker', () => {
      const result = createPackTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test Pack',
        description: 'Test',
        tags: [],
        instruction: {
          abilities: ['ability1'],
          prefix: field({
            name: 'customPrefix',
            description: 'a prefix for the tools',
            placeholder: true,
          }),
        },
      })

      expect(result.instruction).toContain('!string')
      expect(result.instruction).toContain('name: customPrefix')
      expect(result.instruction).toContain(
        'description: a prefix for the tools'
      )
      expect(result.instruction).toContain('placeholder: true')
    })

    it('should handle abilities with inline objects', () => {
      const result = createPackTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test Pack',
        description: 'Test',
        tags: [],
        instruction: {
          abilities: [
            'ability1',
            {
              name: 'custom-ability',
              description: 'A custom inline ability',
              instruction: 'Do something custom',
            },
          ],
        },
      })

      expect(result.instruction).toContain('- ability1')
      expect(result.instruction).toContain('name: custom-ability')
      expect(result.instruction).toContain(
        'description: A custom inline ability'
      )
    })

    it('should generate correct output for real-world Airtable pack example', () => {
      const result = createPackTemplate({
        provider: 'airtable',
        icon: '@logo/airtable.com',
        name: 'Install Airtable Tools',
        description:
          'Install Airtable abilities to interact with bases, tables, and records',
        tags: ['airtable', 'pack', 'beta'],
        secret: '@airtable',
        instruction: {
          abilities: [
            'airtable/base/list',
            'airtable/table/list',
            'airtable/record/create',
            'airtable/record/update',
            'airtable/record/delete',
          ],
        },
      })

      expect(result.provider).toBe('airtable')
      expect(result.icon).toBe('@logo/airtable.com')
      expect(result.name).toBe('Install Airtable Tools')
      expect(result.secret).toBe('@airtable')
      expect(result.tags).toContain('pack')
      expect(result.tags).toContain('beta')
      expect(result.instruction).toContain('!pack.install')
      expect(result.instruction).toContain('- airtable/base/list')
    })
  })

  describe('createAuxiliaryTemplate', () => {
    it('should create a basic auxiliary template', () => {
      const result = createAuxiliaryTemplate({
        provider: 'cbk',
        icon: '@logo/chatbotkit.com',
        name: 'Test Auxiliary',
        description: 'Test auxiliary ability',
        tags: ['test'],
        path: '/api/auxiliary/skillset/ability/test',
        instruction: {
          input: field({
            name: 'input',
            description: 'Input value',
            placeholder: true,
          }),
        },
      })

      expect(result.provider).toBe('cbk')
      expect(result.instruction).toContain('!fetch')
      expect(result.instruction).toContain('method: POST')
      expect(result.instruction).toContain(
        'url: /api/auxiliary/skillset/ability/test'
      )
      expect(result.instruction).toContain('Content-Type: application/json')
      expect(result.instruction).toContain('!string')
      expect(result.instruction).toContain('name: input')
      expect(result.instruction).toContain('description: Input value')
      expect(result.instruction).toContain('placeholder: true')
    })

    it('should include handler header when provided', () => {
      const result = createAuxiliaryTemplate({
        provider: 'cbk',
        icon: '@logo/chatbotkit.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        path: '/api/auxiliary/skillset/ability/test',
        handler: 'myHandler',
        instruction: {
          data: field({ name: 'data', placeholder: true }),
        },
      })

      expect(result.instruction).toContain(
        'x-chatbotkit-handler-name: myHandler'
      )
    })

    it('should include secret header when provided', () => {
      const result = createAuxiliaryTemplate({
        provider: 'cbk',
        icon: '@logo/chatbotkit.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        path: '/api/auxiliary/skillset/ability/test',
        secret: '@test/secret',
        instruction: {
          data: field({ name: 'data', placeholder: true }),
        },
      })

      expect(result.secret).toBe('@test/secret')
      expect(result.instruction).toContain(
        'X-Access-Token: !reference SECRET_DEFAULT'
      )
    })

    it('should handle nested body with multiple fields', () => {
      const result = createAuxiliaryTemplate({
        provider: 'cbk',
        icon: '@logo/chatbotkit.com',
        name: 'Git File',
        description: 'Fetch git file',
        tags: ['git'],
        path: '/api/auxiliary/skillset/ability/chatbotkit/url/git',
        handler: 'file',
        instruction: {
          url: field({
            name: 'url',
            description: 'Git repository URL',
            placeholder: true,
          }),
          ref: field({
            name: 'ref',
            description: 'Git reference',
            placeholder: true,
            default: 'main',
          }),
          filePath: field({
            name: 'filePath',
            description: 'Path to file',
            placeholder: true,
          }),
        },
      })

      expect(result.instruction).toContain('body:')
      expect(result.instruction).toContain('!string')
      expect(result.instruction).toContain('name: url')
      expect(result.instruction).toContain('description: Git repository URL')
      expect(result.instruction).toContain('placeholder: true')
      expect(result.instruction).toContain('name: ref')
      expect(result.instruction).toContain('description: Git reference')
      expect(result.instruction).toContain('default: main')
      expect(result.instruction).toContain('name: filePath')
      expect(result.instruction).toContain('description: Path to file')
    })

    it('should handle array fields in body', () => {
      const result = createAuxiliaryTemplate({
        provider: 'cbk',
        icon: '@logo/chatbotkit.com',
        name: 'Git Tree',
        description: 'Fetch git tree',
        tags: ['git'],
        path: '/api/auxiliary/skillset/ability/chatbotkit/url/git',
        handler: 'tree',
        instruction: {
          url: field({ name: 'url', placeholder: true }),
          excludePatterns: array({
            items: field({ name: 'pattern', placeholder: true }),
          }),
        },
      })

      expect(result.instruction).toContain('excludePatterns:')
      expect(result.instruction).toContain('!array')
      expect(result.instruction).toContain('name: pattern')
      expect(result.instruction).toContain('placeholder: true')
    })

    it('should include commentary when provided', () => {
      const result = createAuxiliaryTemplate({
        provider: 'cbk',
        icon: '@logo/chatbotkit.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        commentary: 'Some commentary',
        path: '/api/auxiliary/skillset/ability/test',
        instruction: {
          data: field({ name: 'data', placeholder: true }),
        },
      })

      expect(result.commentary).toBe('Some commentary')
    })

    it('should include file property when provided', () => {
      const result = createAuxiliaryTemplate({
        provider: 'cbk',
        icon: '@logo/chatbotkit.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        path: '/api/auxiliary/skillset/ability/test',
        file: '@file',
        instruction: {
          id: file(),
        },
      })

      expect(result.file).toBe('@file')
      expect(result.instruction).toContain('id: !reference FILE_DEFAULT')
    })

    it('should handle file marker in nested body structure', () => {
      const result = createAuxiliaryTemplate({
        provider: 'cbk',
        icon: '@logo/chatbotkit.com',
        name: 'Query File with SQL',
        description: 'Execute SQL queries',
        tags: ['file', 'sql'],
        file: '@file',
        path: '/api/auxiliary/skillset/ability/chatbotkit/file/sql',
        instruction: {
          sql: field({
            name: 'sql',
            description: 'the SQL query to execute',
          }),
          tables: {
            table1: {
              fileId: file(),
            },
          },
        },
      })

      expect(result.file).toBe('@file')
      expect(result.instruction).toContain('!string')
      expect(result.instruction).toContain('name: sql')
      expect(result.instruction).toContain(
        'description: the SQL query to execute'
      )
      expect(result.instruction).toContain('tables:')
      expect(result.instruction).toContain('table1:')
      expect(result.instruction).toContain('fileId: !reference FILE_DEFAULT')
    })
  })

  describe('space marker', () => {
    it('should handle space marker in auxiliary body', () => {
      const result = createAuxiliaryTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        path: '/api/auxiliary/test',
        space: '@space',
        instruction: {
          spaceId: space(),
        },
      })

      expect(result.space).toBe('@space')
      expect(result.instruction).toContain('spaceId: !reference SPACE_DEFAULT')
    })

    it('should handle custom space marker name', () => {
      const result = createAuxiliaryTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        path: '/api/auxiliary/test',
        space: '@space',
        instruction: {
          spaceId: space('CUSTOM'),
        },
      })

      expect(result.space).toBe('@space')
      expect(result.instruction).toContain('spaceId: !reference SPACE_CUSTOM')
    })

    it('should handle space in pack template', () => {
      const result = createPackTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test Pack',
        description: 'Test',
        tags: [],
        space: '@space',
        instruction: {
          backstory: 'You are a test assistant',
          task: field({
            name: 'task',
            description: 'the task to perform',
            placeholder: true,
          }),
          abilities: ['test/ability'],
        },
      })

      expect(result.space).toBe('@space')
    })

    it('should handle space in auxiliary template', () => {
      const result = createAuxiliaryTemplate({
        provider: 'test',
        icon: '@logo/test.com',
        name: 'Test',
        description: 'Test',
        tags: [],
        path: '/api/auxiliary/skillset/ability/test',
        space: '@space',
        instruction: {
          spaceId: space(),
        },
      })

      expect(result.space).toBe('@space')
      expect(result.instruction).toContain('spaceId: !reference SPACE_DEFAULT')
    })
  })
})
