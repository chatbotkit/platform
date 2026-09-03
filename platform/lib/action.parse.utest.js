import { ActionName } from '@/lib/action.name'
import {
  escape,
  parseParams,
  parseText,
  stringifyAction,
  unescape,
} from '@/lib/action.parse'

describe('parseText', () => {
  it('must correctly parse action text', () => {
    expect(parseText('abc')).toEqual({
      stripped: 'abc',
      actions: [],
      original: 'abc',
    })

    expect(parseText('test\n```fetch/test=123\nhello\n```\n123')).toEqual({
      stripped: 'test\n\n123',
      actions: [{ name: 'fetch', params: { test: 123 }, text: 'hello' }],
      original: 'test\n```fetch/test=123\nhello\n```\n123',
    })

    expect(
      parseText(
        'Transform based on the following:\n\n```echo\nPOST https://endpoint HTTP/1.1\nContent-Type: application/json\n\n{\n  "name": "John"\n}'
      )
    ).toEqual({
      stripped: 'Transform based on the following:',
      actions: [
        {
          name: 'echo',
          params: {},
          text: 'POST https://endpoint HTTP/1.1\nContent-Type: application/json\n\n{\n  "name": "John"\n}',
        },
      ],
      original:
        'Transform based on the following:\n\n```echo\nPOST https://endpoint HTTP/1.1\nContent-Type: application/json\n\n{\n  "name": "John"\n}',
    })
  })

  it('must correctly parse text that has spaces in the parameters', () => {
    expect(parseText('```fetch/test=123 abc\nhello world\n```')).toEqual({
      stripped: '',
      actions: [
        { name: 'fetch', params: { test: '123 abc' }, text: 'hello world' },
      ],
      original: '```fetch/test=123 abc\nhello world\n```',
    })
  })

  it('must correctly parse text that has equal signs in the parameters', () => {
    expect(parseText('```fetch/test=123=abc\nhello=world\n```')).toEqual({
      stripped: '',
      actions: [
        { name: 'fetch', params: { test: '123=abc' }, text: 'hello=world' },
      ],
      original: '```fetch/test=123=abc\nhello=world\n```',
    })
  })

  it('must correctly parse text that has only an action', () => {
    expect(parseText('```fetch/test=123\nhello\n```')).toEqual({
      stripped: '',
      actions: [{ name: 'fetch', params: { test: 123 }, text: 'hello' }],
      original: '```fetch/test=123\nhello\n```',
    })

    expect(parseText('```search/datasetId=123\nhello\n```')).toEqual({
      stripped: '',
      actions: [{ name: 'search', params: { datasetId: 123 }, text: 'hello' }],
      original: '```search/datasetId=123\nhello\n```',
    })
  })

  it('must correctly parse jmespath expressions', () => {
    expect(
      parseText('```fetch/jmespath=data[].endereco_bairro | sort(@)\n```')
    ).toEqual({
      stripped: '',
      actions: [
        {
          name: 'fetch',
          params: { jmespath: 'data[].endereco_bairro | sort(@)' },
          text: '',
        },
      ],
      original: '```fetch/jmespath=data[].endereco_bairro | sort(@)\n```',
    })
  })

  it('must correctly parse complex jmespath expressions', () => {
    expect(
      parseText(
        "```fetch/jmespath=data[?endereco_bairro == '$[nomeDoBairro | o nome do bairro que o usuário deseja]'].{ titulo: titulo_anuncio, observacoes: observacoes }\n```"
      )
    ).toEqual({
      stripped: '',
      actions: [
        {
          name: 'fetch',
          params: {
            jmespath:
              "data[?endereco_bairro == '$[nomeDoBairro | o nome do bairro que o usuário deseja]'].{ titulo: titulo_anuncio, observacoes: observacoes }",
          },
          text: '',
        },
      ],
      original:
        "```fetch/jmespath=data[?endereco_bairro == '$[nomeDoBairro | o nome do bairro que o usuário deseja]'].{ titulo: titulo_anuncio, observacoes: observacoes }\n```",
    })
  })

  it('must correctly parse nested instruction inside packs', () => {
    const input = `\`\`\`pack
backstory: |
  Return the link to the document.
task: $[instruction! ys]
abilities:
  - name: get_the_document_link
    description: Get the document link
    instruction: |
      \`\`\`echo
      {
        "link": "https://example.com/document.pdf",
        "id": "cb35f054"
      }
      \`\`\`
\`\`\`
`

    const result = parseText(input)

    expect(result).toEqual({
      stripped: '',
      actions: [
        {
          name: 'pack',
          params: {},
          text: `backstory: |
  Return the link to the document.
task: $[instruction! ys]
abilities:
  - name: get_the_document_link
    description: Get the document link
    instruction: |
      \`\`\`echo
      {
        "link": "https://example.com/document.pdf",
        "id": "cb35f054"
      }
      \`\`\``,
        },
      ],
      original: input,
    })
  })
})

describe('stringifyAction', () => {
  test('should stringify action with string text and no params', () => {
    const action = {
      name: ActionName.bot,
      params: {},
      text: 'Hi there',
    }

    const result = stringifyAction(action)

    expect(result).toBe('```bot\nHi there\n```')
  })

  test('should stringify action with string text and params', () => {
    const action = {
      name: ActionName.bot,
      params: { call: '' },
      text: 'Hi there',
    }

    const result = stringifyAction(action)

    expect(result).toBe('```bot/call\nHi there\n```')
  })

  test('should escape forward slashes in params', () => {
    const action = {
      name: ActionName.bot,
      params: { path: 'src/lib/file.js' },
      text: 'Hi there',
    }

    const result = stringifyAction(action)

    expect(result).toBe('```bot/path=src%2Flib%2Ffile.js\nHi there\n```')
  })

  test('should stringify action with object text', () => {
    const action = {
      name: ActionName.bot,
      params: { id: 'contact' },
      text: {
        name: 'Contact Form',
        fields: ['name', 'email'],
      },
    }

    const result = stringifyAction(action)

    expect(result).toBe(
      '```bot/id=contact\nname: "Contact Form"\nfields:\n  - "name"\n  - "email"\n```'
    )
  })

  test('should handle field objects in text', () => {
    const action = {
      name: ActionName.bot,
      params: {},
      text: {
        botId: {
          $field: {
            type: 'string',
            name: 'id',
            description: 'The id of the bot',
            required: true,
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toBe('```bot\nbotId: $[!id ys|The id of the bot]\n```')
  })

  test('should handle field objects with enum', () => {
    const action = {
      name: ActionName.bot,
      params: {},
      text: {
        role: {
          $field: {
            type: 'string',
            name: 'role',
            description: 'User role',
            enum: ['admin', 'user', 'guest'],
            required: true,
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain('$[!role ys enum<admin,user,guest>|User role]')
  })

  test('should handle empty params', () => {
    const action = {
      name: ActionName.bot,
      params: null,
      text: 'Hello world',
    }

    const result = stringifyAction(action)

    expect(result).toBe('```bot\nHello world\n```')
  })

  test('should handle boolean params with false values', () => {
    const action = {
      name: ActionName.bot,
      params: { readonly: false, hidden: true },
      text: 'Hello world',
    }

    const result = stringifyAction(action)

    expect(result).toBe('```bot/readonly/hidden=true\nHello world\n```')
  })

  test('test harness 001', () => {
    const action = {
      name: ActionName.bot,
      params: { call: '' },
      text: {
        prompt: {
          $field: {
            type: 'string',
            name: 'action',
            description: 'detailed description of the action to be performed',
            required: true,
          },
        },

        botIds: [].join(','),

        selectedBotIds: {
          $field: {
            type: 'string',
            name: 'agents',
            description: `a comma separated list of agent slugs to search`,
            required: true,
          },
        },

        batch: true,
      },
    }

    const result = stringifyAction(action)

    expect(result).toBe(
      '```bot/call\nprompt: $[!action ys|detailed description of the action to be performed]\nbotIds: ""\nselectedBotIds: $[!agents ys|a comma separated list of agent slugs to search]\nbatch: true\n```'
    )
  })

  test('should handle nested objects with $field properties', () => {
    const action = {
      name: ActionName.fetch,
      params: {},
      text: {
        method: 'POST',
        url: '/api/test',
        body: {
          user: {
            $field: {
              type: 'string',
              name: 'username',
              description: 'The username',
              required: true,
            },
          },
          settings: {
            enabled: {
              $field: {
                type: 'boolean',
                name: 'enabled',
                description: 'Enable feature',
                required: false,
              },
            },
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain('$[!username ys|The username]')
    expect(result).toContain('$[enabled boolean|Enable feature]')
    expect(result).toContain('method: "POST"')
    expect(result).toContain('url: "/api/test"')
  })

  test('should handle deeply nested $field properties', () => {
    const action = {
      name: ActionName.fetch,
      params: {},
      text: {
        data: {
          level1: {
            level2: {
              value: {
                $field: {
                  type: 'number',
                  name: 'deepValue',
                  description: 'A deeply nested value',
                  required: true,
                },
              },
            },
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain('$[!deepValue number|A deeply nested value]')
  })

  test('should handle mixed nested structure with primitives and $field', () => {
    const action = {
      name: ActionName.fetch,
      params: {},
      text: {
        method: 'POST',
        staticValue: 'constant',
        dynamicField: {
          $field: {
            type: 'string',
            name: 'dynamic',
            description: 'Dynamic value',
            required: true,
          },
        },
        nested: {
          static: 42,
          dynamic: {
            $field: {
              type: 'number',
              name: 'count',
              description: 'Item count',
              required: false,
            },
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain('method: "POST"')
    expect(result).toContain('staticValue: "constant"')
    expect(result).toContain('$[!dynamic ys|Dynamic value]')
    expect(result).toContain('static: 42')
    expect(result).toContain('$[count number|Item count]')
  })
})

describe('stringifyAction - additional edge cases', () => {
  it('should handle action with undefined params', () => {
    const action = {
      name: ActionName.echo,
      params: undefined,
      text: 'Hello world',
    }

    const result = stringifyAction(action)

    expect(result).toBe('```echo\nHello world\n```')
  })

  it('should handle action with numeric params', () => {
    const action = {
      name: ActionName.fetch,
      params: { timeout: 5000, retries: 3 },
      text: 'API call',
    }

    const result = stringifyAction(action)

    expect(result).toBe('```fetch/timeout=5000/retries=3\nAPI call\n```')
  })

  it('should handle action with mixed param types', () => {
    const action = {
      name: ActionName.bot,
      params: {
        id: 'test-123',
        count: 42,
        enabled: true,
        disabled: false,
        flag: '',
      },
      text: 'Mixed params',
    }

    const result = stringifyAction(action)

    expect(result).toBe(
      '```bot/id=test-123/count=42/enabled=true/disabled/flag\nMixed params\n```'
    )
  })

  it('should handle complex nested objects in text', () => {
    const action = {
      name: ActionName.form,
      params: {},
      text: {
        fields: [
          { name: 'firstName', type: 'text' },
          { name: 'lastName', type: 'text' },
        ],
        validation: {
          required: ['firstName'],
          minLength: { firstName: 2 },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toBe(
      '```form\nfields:\n  - name: "firstName"\n    type: "text"\n  - name: "lastName"\n    type: "text"\nvalidation:\n  required:\n    - "firstName"\n  minLength:\n    firstName: 2\n```'
    )
  })

  it('should handle field objects with all possible properties', () => {
    const action = {
      name: ActionName.bot,
      params: {},
      text: {
        complexField: {
          $field: {
            type: 'string',
            name: 'userRole',
            description: 'The role of the user in the system',
            required: true,
            enum: ['admin', 'user', 'guest', 'moderator'],
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain(
      '$[!userRole ys enum<admin,user,guest,moderator>|The role of the user in the system]'
    )
  })

  it('should handle field objects with optional properties', () => {
    const action = {
      name: ActionName.bot,
      params: {},
      text: {
        optionalField: {
          $field: {
            type: 'number',
            name: 'age',
            description: 'User age',
            required: false,
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain('$[age number|User age]')
  })

  it('should handle field objects with placeholder property using round brackets', () => {
    const action = {
      name: ActionName.bot,
      params: {},
      text: {
        placeholderField: {
          $field: {
            type: 'string',
            name: 'suggestion',
            description: 'A suggested value',
            required: false,
            placeholder: true,
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain('((suggestion ys|A suggested value))')
  })

  it('should handle required field objects with placeholder property using round brackets', () => {
    const action = {
      name: ActionName.bot,
      params: {},
      text: {
        placeholderField: {
          $field: {
            type: 'string',
            name: 'requiredSuggestion',
            description: 'A required suggested value',
            required: true,
            placeholder: true,
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain(
      '((!requiredSuggestion ys|A required suggested value))'
    )
  })

  it('should handle field objects with placeholder and enum using round brackets', () => {
    const action = {
      name: ActionName.bot,
      params: {},
      text: {
        placeholderWithEnum: {
          $field: {
            type: 'string',
            name: 'status',
            description: 'Status suggestion',
            required: false,
            placeholder: true,
            enum: ['active', 'inactive', 'pending'],
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain(
      '((status ys enum<active,inactive,pending>|Status suggestion))'
    )
  })

  it('should use square brackets when placeholder is false', () => {
    const action = {
      name: ActionName.bot,
      params: {},
      text: {
        nonPlaceholderField: {
          $field: {
            type: 'string',
            name: 'input',
            description: 'User input',
            required: true,
            placeholder: false,
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain('$[!input ys|User input]')
  })

  it('should handle mixed placeholder and non-placeholder fields', () => {
    const action = {
      name: ActionName.fetch,
      params: {},
      text: {
        userInput: {
          $field: {
            type: 'string',
            name: 'query',
            description: 'Search query',
            required: true,
            placeholder: false,
          },
        },
        suggestion: {
          $field: {
            type: 'string',
            name: 'hint',
            description: 'Search hint',
            required: false,
            placeholder: true,
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain('$[!query ys|Search query]')
    expect(result).toContain('((hint ys|Search hint))')
  })

  it('should handle arrays in text object', () => {
    const action = {
      name: ActionName.bot,
      params: {},
      text: {
        items: ['item1', 'item2', 'item3'],
        count: 3,
      },
    }

    const result = stringifyAction(action)

    expect(result).toBe(
      '```bot\nitems:\n  - "item1"\n  - "item2"\n  - "item3"\ncount: 3\n```'
    )
  })

  it('should handle special characters in params requiring escaping', () => {
    const action = {
      name: ActionName.file,
      params: {
        path: 'folder/subfolder/file.txt',
        url: 'https://example.com/api/v1/data',
      },
      text: 'File operation',
    }

    const result = stringifyAction(action)

    expect(result).toBe(
      '```file/path=folder%2Fsubfolder%2Ffile.txt/url=https:%2F%2Fexample.com%2Fapi%2Fv1%2Fdata\nFile operation\n```'
    )
  })

  it('should handle empty string text', () => {
    const action = {
      name: ActionName.echo,
      params: { type: 'empty' },
      text: '',
    }

    const result = stringifyAction(action)

    expect(result).toBe('```echo/type=empty\n\n```')
  })

  it('should handle text with newlines and special characters', () => {
    const action = {
      name: ActionName.echo,
      params: {},
      text: 'Line 1\nLine 2\n\nLine 4 with "quotes" and \'apostrophes\'',
    }

    const result = stringifyAction(action)

    expect(result).toBe(
      '```echo\nLine 1\nLine 2\n\nLine 4 with "quotes" and \'apostrophes\'\n```'
    )
  })
})

describe('stringifyAction - default value handling', () => {
  it('should handle field objects with string default value', () => {
    const action = {
      name: ActionName.bot,
      params: {},
      text: {
        fieldWithDefault: {
          $field: {
            type: 'string',
            name: 'greeting',
            description: 'A greeting message',
            required: false,
            default: 'Hello',
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain('$[greeting ys default<Hello>|A greeting message]')
  })

  it('should handle field objects with number default value', () => {
    const action = {
      name: ActionName.bot,
      params: {},
      text: {
        timeout: {
          $field: {
            type: 'number',
            name: 'timeout',
            description: 'Request timeout in ms',
            required: false,
            default: 5000,
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain(
      '$[timeout number default<5000>|Request timeout in ms]'
    )
  })

  it('should handle field objects with boolean default value (true)', () => {
    const action = {
      name: ActionName.bot,
      params: {},
      text: {
        enabled: {
          $field: {
            type: 'boolean',
            name: 'enabled',
            description: 'Enable feature',
            required: false,
            default: true,
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain('$[enabled boolean default<true>|Enable feature]')
  })

  it('should handle field objects with boolean default value (false)', () => {
    const action = {
      name: ActionName.bot,
      params: {},
      text: {
        disabled: {
          $field: {
            type: 'boolean',
            name: 'disabled',
            description: 'Disable feature',
            required: false,
            default: false,
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain(
      '$[disabled boolean default<false>|Disable feature]'
    )
  })

  it('should handle field objects with default value of 0', () => {
    const action = {
      name: ActionName.bot,
      params: {},
      text: {
        count: {
          $field: {
            type: 'number',
            name: 'count',
            description: 'Item count',
            required: false,
            default: 0,
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain('$[count number default<0>|Item count]')
  })

  it('should handle field objects with empty string default value', () => {
    const action = {
      name: ActionName.bot,
      params: {},
      text: {
        prefix: {
          $field: {
            type: 'string',
            name: 'prefix',
            description: 'Optional prefix',
            required: false,
            default: '',
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain('$[prefix ys default<>|Optional prefix]')
  })

  it('should handle required field with default value', () => {
    const action = {
      name: ActionName.bot,
      params: {},
      text: {
        retries: {
          $field: {
            type: 'number',
            name: 'retries',
            description: 'Number of retries',
            required: true,
            default: 3,
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain('$[!retries number default<3>|Number of retries]')
  })

  it('should handle field with enum and default value', () => {
    const action = {
      name: ActionName.bot,
      params: {},
      text: {
        priority: {
          $field: {
            type: 'string',
            name: 'priority',
            description: 'Task priority',
            required: false,
            enum: ['low', 'medium', 'high'],
            default: 'medium',
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain(
      '$[priority ys enum<low,medium,high> default<medium>|Task priority]'
    )
  })

  it('should handle field with placeholder and default value', () => {
    const action = {
      name: ActionName.bot,
      params: {},
      text: {
        suggestion: {
          $field: {
            type: 'string',
            name: 'suggestion',
            description: 'Suggested value',
            required: false,
            placeholder: true,
            default: 'default suggestion',
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain(
      '((suggestion ys default<default suggestion>|Suggested value))'
    )
  })

  it('should handle field with placeholder, enum, and default value', () => {
    const action = {
      name: ActionName.bot,
      params: {},
      text: {
        status: {
          $field: {
            type: 'string',
            name: 'status',
            description: 'Status suggestion',
            required: false,
            placeholder: true,
            enum: ['active', 'inactive'],
            default: 'active',
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain(
      '((status ys enum<active,inactive> default<active>|Status suggestion))'
    )
  })

  it('should handle required field with placeholder and default value', () => {
    const action = {
      name: ActionName.bot,
      params: {},
      text: {
        requiredWithDefault: {
          $field: {
            type: 'number',
            name: 'limit',
            description: 'Result limit',
            required: true,
            placeholder: true,
            default: 10,
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain('((!limit number default<10>|Result limit))')
  })

  it('should not include default when undefined', () => {
    const action = {
      name: ActionName.bot,
      params: {},
      text: {
        noDefault: {
          $field: {
            type: 'string',
            name: 'field',
            description: 'Field without default',
            required: true,
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain('$[!field ys|Field without default]')
    expect(result).not.toContain('default<')
  })

  it('should handle multiple fields with different default configurations', () => {
    const action = {
      name: ActionName.fetch,
      params: {},
      text: {
        method: 'POST',
        timeout: {
          $field: {
            type: 'number',
            name: 'timeout',
            description: 'Timeout in ms',
            required: false,
            default: 30000,
          },
        },
        retries: {
          $field: {
            type: 'number',
            name: 'retries',
            description: 'Retry count',
            required: true,
            default: 3,
          },
        },
        format: {
          $field: {
            type: 'string',
            name: 'format',
            description: 'Response format',
            required: false,
            enum: ['json', 'xml', 'text'],
            default: 'json',
          },
        },
        query: {
          $field: {
            type: 'string',
            name: 'query',
            description: 'Search query',
            required: true,
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain('method: "POST"')
    expect(result).toContain('$[timeout number default<30000>|Timeout in ms]')
    expect(result).toContain('$[!retries number default<3>|Retry count]')
    expect(result).toContain(
      '$[format ys enum<json,xml,text> default<json>|Response format]'
    )
    expect(result).toContain('$[!query ys|Search query]')
    // Verify the query field does not have default
    expect(result).not.toMatch(/query.*default</)
  })

  it('should handle nested objects with fields containing defaults', () => {
    const action = {
      name: ActionName.fetch,
      params: {},
      text: {
        config: {
          settings: {
            maxItems: {
              $field: {
                type: 'number',
                name: 'maxItems',
                description: 'Maximum items to fetch',
                required: false,
                default: 100,
              },
            },
            sortOrder: {
              $field: {
                type: 'string',
                name: 'sortOrder',
                description: 'Sort order',
                required: false,
                enum: ['asc', 'desc'],
                default: 'asc',
              },
            },
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain(
      '$[maxItems number default<100>|Maximum items to fetch]'
    )
    expect(result).toContain(
      '$[sortOrder ys enum<asc,desc> default<asc>|Sort order]'
    )
  })
})

// Additional tests for helper functions to improve coverage
describe('escape', () => {
  it('should escape forward slashes in strings', () => {
    expect(escape('path/to/file')).toBe('path%2Fto%2Ffile')
    expect(escape('src/lib/action.js')).toBe('src%2Flib%2Faction.js')
  })

  it('should handle strings without forward slashes', () => {
    expect(escape('simple-string')).toBe('simple-string')
    expect(escape('test123')).toBe('test123')
  })

  it('should handle empty strings', () => {
    expect(escape('')).toBe('')
  })

  it('should handle special characters other than forward slashes', () => {
    expect(escape('test@example.com')).toBe('test@example.com')
    expect(escape('test+tag')).toBe('test+tag')
  })

  it('should convert non-string inputs to strings before escaping', () => {
    expect(escape(123)).toBe('123')
    expect(escape(true)).toBe('true')
    // Note: null.toString() throws, so we test the actual behavior
    expect(() => escape(null)).toThrow()
  })

  it('should handle multiple forward slashes', () => {
    expect(escape('path/to/deep/nested/file')).toBe(
      'path%2Fto%2Fdeep%2Fnested%2Ffile'
    )
    expect(escape('//double//slash//')).toBe('%2F%2Fdouble%2F%2Fslash%2F%2F')
  })
})

describe('unescape', () => {
  it('should unescape encoded forward slashes in strings', () => {
    expect(unescape('path%2Fto%2Ffile')).toBe('path/to/file')
    expect(unescape('src%2Flib%2Faction.js')).toBe('src/lib/action.js')
  })

  it('should handle strings without encoded forward slashes', () => {
    expect(unescape('simple-string')).toBe('simple-string')
    expect(unescape('test123')).toBe('test123')
  })

  it('should handle empty strings', () => {
    expect(unescape('')).toBe('')
  })

  it('should handle mixed case encoded slashes', () => {
    expect(unescape('path%2fto%2Ffile')).toBe('path/to/file')
  })

  it('should convert non-string inputs to strings before unescaping', () => {
    expect(unescape(123)).toBe('123')
    expect(unescape(true)).toBe('true')
    // Note: null.toString() throws, so we test the actual behavior
    expect(() => unescape(null)).toThrow()
  })

  it('should handle multiple encoded forward slashes', () => {
    expect(unescape('path%2Fto%2Fdeep%2Fnested%2Ffile')).toBe(
      'path/to/deep/nested/file'
    )
    expect(unescape('%2F%2Fdouble%2F%2Fslash%2F%2F')).toBe('//double//slash//')
  })

  it('should be inverse of escape function', () => {
    const testStrings = [
      'path/to/file',
      'src/lib/action.js',
      '//double//slash//',
      'no-slashes',
      '',
    ]

    testStrings.forEach((str) => {
      expect(unescape(escape(str))).toBe(str)
    })
  })
})

describe('parseParams', () => {
  it('should parse simple key-value parameters', () => {
    expect(parseParams('key=value')).toEqual({ key: 'value' })
    expect(parseParams('name=test')).toEqual({ name: 'test' })
  })

  it('should parse multiple parameters separated by forward slashes', () => {
    expect(parseParams('key1=value1/key2=value2')).toEqual({
      key1: 'value1',
      key2: 'value2',
    })
  })

  it('should parse numeric values as numbers', () => {
    expect(parseParams('count=123')).toEqual({ count: 123 })
    expect(parseParams('price=99.99')).toEqual({ price: 99.99 })
    expect(parseParams('negative=-42')).toEqual({ negative: -42 })
  })

  it('should parse boolean values', () => {
    expect(parseParams('enabled=true')).toEqual({ enabled: true })
    expect(parseParams('disabled=false')).toEqual({ disabled: false })
  })

  it('should parse mixed parameter types', () => {
    expect(parseParams('count=5/enabled=true/name=test/price=19.99')).toEqual({
      count: 5,
      enabled: true,
      name: 'test',
      price: 19.99,
    })
  })

  it('should handle parameters without values as empty strings', () => {
    expect(parseParams('flag')).toEqual({ flag: '' })
    expect(parseParams('readonly/hidden=true')).toEqual({
      readonly: '',
      hidden: true,
    })
  })

  it('should handle empty parameter strings', () => {
    expect(parseParams('')).toEqual({})
  })

  it('should handle parameters with equal signs in values', () => {
    expect(parseParams('equation=x=y+z')).toEqual({ equation: 'x=y+z' })
    // Note: URLs with :// will be split incorrectly by forward slashes
    // This tests the actual behavior, not ideal behavior
    expect(parseParams('protocol=http/host=example.com')).toEqual({
      protocol: 'http',
      host: 'example.com',
    })
  })

  it('should handle escaped forward slashes in parameter names and values', () => {
    expect(parseParams('path%2Fkey=value')).toEqual({ 'path/key': 'value' })
    expect(parseParams('key=path%2Fto%2Ffile')).toEqual({ key: 'path/to/file' })
  })

  it('should handle spaces in parameter values', () => {
    expect(parseParams('message=hello world')).toEqual({
      message: 'hello world',
    })
    expect(parseParams('name=John Doe/age=30')).toEqual({
      name: 'John Doe',
      age: 30,
    })
  })

  it('should skip empty parameter names', () => {
    expect(parseParams('/validKey=value')).toEqual({ validKey: 'value' })
    expect(parseParams('=emptyName/validKey=value')).toEqual({
      validKey: 'value',
    })
  })

  it('should handle string values that look like numbers but have leading zeros', () => {
    expect(parseParams('id=007')).toEqual({ id: 7 })
    expect(parseParams('code=00123')).toEqual({ code: 123 })
  })

  it('should handle string values that look like booleans but are not exactly true/false', () => {
    expect(parseParams('flag=TRUE')).toEqual({ flag: 'TRUE' })
    expect(parseParams('flag=False')).toEqual({ flag: 'False' })
    expect(parseParams('flag=truthy')).toEqual({ flag: 'truthy' })
  })
})

describe('parseText - additional edge cases', () => {
  it('should handle additionalTypes parameter', () => {
    const input = '```customAction\nTest content\n```'
    const result = parseText(input, ['customAction'])

    expect(result.actions).toHaveLength(1)
    expect(result.actions[0]).toEqual({
      name: 'customAction',
      params: {},
      text: 'Test content',
    })
  })

  it('should ignore unknown action types when additionalTypes not provided', () => {
    const input = '```unknownAction\nTest content\n```'
    const result = parseText(input)

    expect(result.actions).toHaveLength(0)
    expect(result.stripped).toBe(input)
  })

  it('should handle empty input', () => {
    const result = parseText('')

    expect(result.stripped).toBe('')
    expect(result.actions).toEqual([])
    expect(result.original).toBe('')
  })

  it('should handle input with only whitespace', () => {
    const result = parseText('   \n\n  ')

    expect(result.stripped).toBe('')
    expect(result.actions).toEqual([])
    expect(result.original).toBe('   \n\n  ')
  })

  it('should handle malformed action blocks gracefully', () => {
    const input = '```incomplete-block'
    const result = parseText(input)

    expect(result.actions).toEqual([])
    expect(result.stripped).toBe(input)
  })

  it('should handle mixed valid and invalid blocks', () => {
    const input = `Valid text before
\`\`\`echo
Valid action
\`\`\`
\`\`\`invalid-action
Invalid content
\`\`\`
Valid text after`

    const result = parseText(input)

    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].name).toBe('echo')
    expect(result.stripped).toContain('Valid text before')
    expect(result.stripped).toContain('Valid text after')
  })
})

describe('stringifyAction - $static value handling', () => {
  it('should insert $static string values as literal unquoted strings', () => {
    const action = {
      name: ActionName.mcp,
      params: { install: true },
      text: {
        url: {
          $field: {
            type: 'string',
            name: 'url',
            description: 'the MCP URL',
            required: true,
            placeholder: true,
          },
        },
        headers: {
          Authorization: {
            $static: '${SECRET_DEFAULT}',
          },
        },
      },
    }

    const result = stringifyAction(action)

    // @note $static values should be inserted literally without quotes

    expect(result).toContain('Authorization: ${SECRET_DEFAULT}')
    expect(result).not.toContain('"${SECRET_DEFAULT}"')
    expect(result).not.toContain('$[Authorization')
  })

  it('should insert $static numeric values as literal numbers', () => {
    const action = {
      name: ActionName.echo,
      params: {},
      text: {
        timeout: {
          $static: 5000,
        },
        maxRetries: {
          $static: 3,
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain('timeout: 5000')
    expect(result).toContain('maxRetries: 3')
    expect(result).not.toContain('"5000"')
    expect(result).not.toContain('"3"')
  })

  it('should insert $static boolean values as literal booleans', () => {
    const action = {
      name: ActionName.echo,
      params: {},
      text: {
        enabled: {
          $static: true,
        },
        disabled: {
          $static: false,
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain('enabled: true')
    expect(result).toContain('disabled: false')
    expect(result).not.toContain('"true"')
    expect(result).not.toContain('"false"')
  })

  it('should mix $static and $field values correctly', () => {
    const action = {
      name: ActionName.fetch,
      params: {},
      text: {
        url: {
          $field: {
            type: 'string',
            name: 'url',
            description: 'the resource URL',
            required: true,
            placeholder: true,
          },
        },
        headers: {
          Authorization: {
            $static: 'Bearer ${TOKEN}',
          },
          'Content-Type': {
            $field: {
              type: 'string',
              name: 'Content-Type',
              description: 'the content type',
              required: false,
            },
          },
        },
      },
    }

    const result = stringifyAction(action)

    // @note $static should be literal

    expect(result).toContain('Authorization: Bearer ${TOKEN}')

    // @note $field should use field syntax

    expect(result).toContain(
      'Content-Type: $[Content-Type ys|the content type]'
    )

    // @note url should use placeholder syntax

    expect(result).toMatch(/\(\(!url/)
  })

  it('should handle nested objects with $static values', () => {
    const action = {
      name: ActionName.echo,
      params: {},
      text: {
        config: {
          settings: {
            apiKey: {
              $static: '${API_KEY}',
            },
            maxRetries: {
              $static: 3,
            },
            debug: {
              $static: true,
            },
          },
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain('apiKey: ${API_KEY}')
    expect(result).toContain('maxRetries: 3')
    expect(result).toContain('debug: true')
  })

  it('should handle $static values with special characters', () => {
    const action = {
      name: ActionName.echo,
      params: {},
      text: {
        template: {
          $static: '${VAR_NAME}_suffix',
        },
        path: {
          $static: '/api/v1/${RESOURCE}',
        },
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain('template: ${VAR_NAME}_suffix')
    expect(result).toContain('path: /api/v1/${RESOURCE}')
  })

  it('should handle $static values alongside primitive values', () => {
    const action = {
      name: ActionName.echo,
      params: {},
      text: {
        staticHeader: {
          $static: '${SECRET}',
        },
        plainString: 'regular value',
        plainNumber: 42,
        plainBoolean: true,
      },
    }

    const result = stringifyAction(action)

    expect(result).toContain('staticHeader: ${SECRET}')
    expect(result).toContain('plainString: "regular value"')
    expect(result).toContain('plainNumber: 42')
    expect(result).toContain('plainBoolean: true')
  })
})
