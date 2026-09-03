/* eslint-disable @typescript-eslint/no-require-imports */
import { getConfig, getConfigBySchema } from '@/lib/action.config'
import { BotInputError, SafeError } from '@/lib/error'

import { z } from 'zod'

describe('getConfig', () => {
  it('should parse simple YAML input and merge with initial values', () => {
    const input = 'prompt: test message\nbatch: true'
    const initial = { prompt: 'default', silent: false }

    const result = getConfig({ input, initial })

    expect(result).toEqual({
      prompt: 'test message',
      batch: true,
      silent: false,
    })
  })

  it('should handle empty input with initial values', () => {
    const input = ''
    const initial = { prompt: 'default', silent: false }

    const result = getConfig({ input, initial })

    expect(result).toEqual({
      prompt: 'default',
      silent: false,
    })
  })

  it('should override initial values with params', () => {
    const input = 'prompt: yaml value'
    const initial = { prompt: 'initial value', batch: false }
    const params = { prompt: 'param value', silent: true }

    const result = getConfig({ input, params, initial })

    expect(result).toEqual({
      prompt: 'param value', // params should override everything
      batch: false,
      silent: true,
    })
  })

  it('should handle invalid YAML gracefully by returning initial and params', () => {
    const input = 'invalid: yaml: content: [unclosed'
    const initial = { prompt: 'default' }
    const params = { batch: true }

    const result = getConfig({ input, params, initial })

    expect(result).toEqual({
      prompt: 'default',
      batch: true,
    })
  })

  it('should handle non-object YAML values', () => {
    const input = 'just a string'
    const initial = { prompt: 'default' }
    const params = { batch: true }

    const result = getConfig({ input, params, initial })

    expect(result).toEqual({
      prompt: 'default',
      batch: true,
    })
  })

  it('should handle null YAML values', () => {
    const input = 'null'
    const initial = { prompt: 'default' }
    const params = { batch: true }

    const result = getConfig({ input, params, initial })

    expect(result).toEqual({
      prompt: 'default',
      batch: true,
    })
  })

  it('should handle complex nested YAML objects', () => {
    const input = `
settings:
  batch: true
  options:
    timeout: 30
    retries: 3
prompt: complex test
`

    const initial = { prompt: 'default', settings: { batch: false } }

    const result = getConfig({ input, initial })

    expect(result).toEqual({
      prompt: 'complex test',
      settings: {
        batch: true,
        options: {
          timeout: 30,
          retries: 3,
        },
      },
    })
  })

  it('should handle arrays in YAML', () => {
    const input = `
items:
  - first
  - second
  - third
count: 3
`

    const initial = { count: 0 }

    const result = getConfig({ input, initial })

    expect(result).toEqual({
      items: ['first', 'second', 'third'],
      count: 3,
    })
  })

  it('should merge params deeply over YAML and initial values', () => {
    const input = `
config:
  timeout: 30
  retries: 3
  options:
    verbose: true
`

    const initial = {
      config: {
        timeout: 10,
        debug: false,
        options: {
          verbose: false,
          logging: true,
        },
      },
    }

    const params = {
      config: {
        retries: 5,
        options: {
          verbose: false,
        },
      },
    }

    const result = getConfig({ input, params, initial })

    expect(result).toEqual({
      config: {
        timeout: 30, // from YAML
        retries: 5, // from params (overrides YAML)
        debug: false, // from initial
        options: {
          verbose: false, // from params (overrides YAML)
          logging: true, // from initial
        },
      },
    })
  })

  it('does not let a bare-true routing flag clobber a typed body field', () => {
    // Regression for the shell/file `replace` collision: the operation is
    // encoded as the bare flag `{ replace: true }` in params, while the real
    // replacement text lives in the body. Without the guard, params wins the
    // merge and `replace` becomes `true`.
    const input = 'file: /a.html\nsearch: old\nreplace: new'
    const params = { replace: true }

    const result = getConfig({ input, params })

    expect(result.replace).toBe('new')
  })

  it('still lets a genuine boolean flag override a boolean body field', () => {
    // The guard only drops a bare `true` that shadows a NON-boolean body value.
    // A real boolean field must still be overridable via params.
    const input = 'batch: false'
    const params = { batch: true }

    const result = getConfig({ input, params })

    expect(result.batch).toBe(true)
  })

  it('still lets a non-boolean param override a body field', () => {
    // A real (non-true) override is untouched by the guard.
    const input = 'prompt: from body'
    const params = { prompt: 'from params' }

    const result = getConfig({ input, params })

    expect(result.prompt).toBe('from params')
  })
})

describe('getConfigBySchema', () => {
  it('does not let a routing-key param clobber a same-named string field', () => {
    // End-to-end: this is exactly what doShellReplace/doFileReplace perform -
    // the field values live in `input` (the action text from
    // ShellReplaceAction.toActionResult()) and the operation arrives as the
    // routing flag `{ replace: true }` in `params`. getConfig drops the flag so
    // the merge keeps the string instead of throwing "Expected string, received
    // boolean at replace".
    const { ShellReplaceAction } = require('@/lib/action.tags')

    const replacement = 'const LEVELS = [{ name: "First Light" }]'

    const { params, text } = new ShellReplaceAction({
      file: '/space/games/prism/index.html',
      search: 'const LEVELS = []',
      replace: replacement,
    }).toActionResult()

    // Sanity-check the precondition: the operation really does arrive as a bare
    // boolean flag colliding with the `replace` field.
    expect(params.replace).toBe(true)

    const schema = z.object({
      file: z.string().min(1),
      search: z.string().min(1),
      replace: z.string(),
    })

    let result

    expect(() => {
      result = getConfigBySchema({ input: text, params, schema })
    }).not.toThrow()

    expect(result.replace).toBe(replacement)
  })

  it('should validate and return parsed config with schema', () => {
    const input = 'prompt: test message\nbatch: true'

    const schema = z.object({
      prompt: z.string(),
      batch: z.boolean(),
    })

    const result = getConfigBySchema({ input, schema })

    expect(result).toEqual({
      prompt: 'test message',
      batch: true,
    })
  })

  it('should apply default values from schema', () => {
    const input = 'prompt: test message'

    const schema = z.object({
      prompt: z.string(),
      batch: z.boolean().default(false),
      silent: z.boolean().default(true),
    })

    const result = getConfigBySchema({ input, schema })

    expect(result).toEqual({
      prompt: 'test message',
      batch: false,
      silent: true,
    })
  })

  it('should work with initial values and schema defaults', () => {
    const input = 'prompt: test message'
    const initial = { timeout: 30 }

    const schema = z.object({
      prompt: z.string(),
      batch: z.boolean().default(false),
      timeout: z.number().optional(),
    })

    const result = getConfigBySchema({ input, initial, schema })

    expect(result).toEqual({
      prompt: 'test message',
      batch: false,
      timeout: 30,
    })
  })

  it('should throw validation error for invalid schema', () => {
    const input = 'prompt: 123\nbatch: not_boolean'

    const schema = z.object({
      prompt: z.string(),
      batch: z.boolean(),
    })

    expect(() => {
      getConfigBySchema({ input, schema })
    }).toThrow()
  })

  it('should throw a BotInputError (SafeError) with a friendly message on type mismatch', () => {
    // @note the agent supplying a wrong-typed argument (e.g. a boolean where a
    // string is expected) must surface as a SafeError so the function-call
    // catch returns the message to the agent as feedback and keeps it out of
    // Sentry, rather than hard-failing with a generic exception
    const input = 'replace: true\nsearch: foo'

    const schema = z.object({
      search: z.string(),
      replace: z.string(),
    })

    expect(() => {
      getConfigBySchema({ input, schema })
    }).toThrow(BotInputError)

    expect(() => {
      getConfigBySchema({ input, schema })
    }).toThrow(SafeError)

    expect(() => {
      getConfigBySchema({ input, schema })
    }).toThrow(/Expected string, received boolean/)
  })

  it('should throw validation error for missing required fields', () => {
    const input = 'batch: true'

    const schema = z.object({
      prompt: z.string().min(1),
      batch: z.boolean(),
    })

    expect(() => {
      getConfigBySchema({ input, schema })
    }).toThrow()
  })

  it('should validate string length constraints', () => {
    const input = 'prompt: \nbatch: true'

    const schema = z.object({
      prompt: z.string().min(1),
      batch: z.boolean(),
    })

    expect(() => {
      getConfigBySchema({ input, schema })
    }).toThrow()
  })

  it('should handle complex schemas with nested objects', () => {
    const input = `
settings:
  timeout: 30
  retries: 3
  enabled: true
prompt: complex test
`

    const schema = z.object({
      prompt: z.string(),
      settings: z.object({
        timeout: z.number(),
        retries: z.number(),
        enabled: z.boolean(),
      }),
    })

    const result = getConfigBySchema({ input, schema })

    expect(result).toEqual({
      prompt: 'complex test',
      settings: {
        timeout: 30,
        retries: 3,
        enabled: true,
      },
    })
  })

  it('should handle optional fields in schema', () => {
    const input = 'prompt: test message'

    const schema = z.object({
      prompt: z.string(),
      botId: z.string().optional(),
      ids: z.string().optional(),
      selectedBotIds: z.string().optional(),
    })

    const result = getConfigBySchema({ input, schema })

    expect(result).toEqual({
      prompt: 'test message',
    })
  })

  it('should work with params override and schema validation', () => {
    const input = 'prompt: yaml value\nbatch: false'
    const params = { prompt: 'param value' }

    const schema = z.object({
      prompt: z.string().min(1),
      batch: z.boolean().default(true),
    })

    const result = getConfigBySchema({ input, params, schema })

    expect(result).toEqual({
      prompt: 'param value',
      batch: false,
    })
  })

  it('should handle type coercion when possible', () => {
    const input = 'timeout: "30"\nretries: "3"'

    const schema = z.object({
      timeout: z.coerce.number(),
      retries: z.coerce.number(),
    })

    const result = getConfigBySchema({ input, schema })

    expect(result).toEqual({
      timeout: 30,
      retries: 3,
    })
  })

  it('should mirror usage patterns from action.exec.bot.js doBotAsk', () => {
    // This mirrors the exact usage in doBotAsk function
    const input = 'some input text'
    const params = {}

    const initial = {
      prompt: input,
    }

    const schema = z.object({
      prompt: z.string().min(1),
    })

    const result = getConfigBySchema({ input, params, initial, schema })

    expect(result).toEqual({
      prompt: 'some input text',
    })
  })

  it('should mirror usage patterns from action.exec.bot.js doBotCall', () => {
    // This mirrors the exact usage in doBotCall function
    const input = 'batch: true\nsilent: false'
    const params = {}

    const initial = {
      prompt: input,
    }

    const schema = z.object({
      prompt: z.string().min(1),
      batch: z.boolean().default(false),
      silent: z.boolean().default(false),
    })

    const result = getConfigBySchema({ input, params, initial, schema })

    expect(result).toEqual({
      prompt: 'batch: true\nsilent: false',
      batch: true,
      silent: false,
    })
  })

  it('should mirror usage patterns from action.exec.bot.js launch function', () => {
    // This mirrors the exact usage in launch function
    const input = 'botId: test-bot-123\nselectedBotIds: bot1,bot2'
    const params = {}

    const schema = z.object({
      botId: z.string().optional(),
      id: z.string().optional(),
      botIds: z.string().optional(),
      ids: z.string().optional(),
      selectedBotIds: z.string().optional(),
      selectedIds: z.string().optional(),
    })

    const result = getConfigBySchema({ input, params, schema })

    expect(result).toEqual({
      botId: 'test-bot-123',
      selectedBotIds: 'bot1,bot2',
    })
  })
})

describe('error handling and edge cases', () => {
  it('should handle completely empty input', () => {
    const input = ''
    const result = getConfig({ input })

    expect(result).toEqual({})
  })

  it('should handle whitespace-only input', () => {
    const input = '   \n   \t   '
    const result = getConfig({ input })

    expect(result).toEqual({})
  })

  it('should handle undefined params gracefully', () => {
    const input = 'prompt: test'
    const result = getConfig({ input, params: undefined })

    expect(result).toEqual({
      prompt: 'test',
    })
  })

  it('should handle undefined initial gracefully', () => {
    const input = 'prompt: test'
    const result = getConfig({ input, initial: undefined })

    expect(result).toEqual({
      prompt: 'test',
    })
  })

  it('should handle schema validation errors with descriptive messages', () => {
    const input = 'prompt: 123'

    const schema = z.object({
      prompt: z.string(),
    })

    expect(() => {
      getConfigBySchema({ input, schema })
    }).toThrow(/Expected string, received number/)
  })

  it('should handle malformed YAML with special characters', () => {
    const input = 'prompt: "unclosed quote\nbatch: true'
    const initial = { prompt: 'default' }

    const result = getConfig({ input, initial })

    expect(result).toEqual({
      prompt: 'default',
    })
  })

  it('should handle YAML with null values correctly', () => {
    const input = 'prompt: ~\nbatch: null\nsilent:'
    const initial = { prompt: 'default' }

    const result = getConfig({ input, initial })

    expect(result).toEqual({
      prompt: null,
      batch: null,
      silent: null,
    })
  })
})

describe('linked resource substitution', () => {
  it('should substitute ${SPACE_DEFAULT} with linked spaceId', () => {
    const input = 'spaceId: ${SPACE_DEFAULT}\npath: /docs'

    const schema = z.object({
      spaceId: z.string().min(1),
      path: z.string().min(1),
    })

    const options = {
      linkedResources: { spaceId: 'sp_12345' },
    }

    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      spaceId: 'sp_12345',
      path: '/docs',
    })
  })

  it('should substitute ${SPACE_DEFAULT} with linked spaceId for the non spaceId', () => {
    const input = 'anotherId: ${SPACE_DEFAULT}\npath: /docs'

    const schema = z.object({
      anotherId: z.string().min(1),
      path: z.string().min(1),
    })

    const options = {
      linkedResources: { spaceId: 'sp_12345' },
    }

    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      anotherId: 'sp_12345',
      path: '/docs',
    })
  })

  it('should substitute ${BOT_DEFAULT} with linked botId', () => {
    const input = 'botId: ${BOT_DEFAULT}\nprompt: hello'

    const schema = z.object({
      botId: z.string().min(1),
      prompt: z.string().min(1),
    })

    const options = {
      linkedResources: { botId: 'bot_abc123' },
    }

    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      botId: 'bot_abc123',
      prompt: 'hello',
    })
  })

  it('should substitute ${BOT_DEFAULT} with linked botId for the non botId', () => {
    const input = 'anotherId: ${BOT_DEFAULT}\nprompt: hello'

    const schema = z.object({
      anotherId: z.string().min(1),
      prompt: z.string().min(1),
    })

    const options = {
      linkedResources: { botId: 'bot_abc123' },
    }

    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      anotherId: 'bot_abc123',
      prompt: 'hello',
    })
  })

  it('should substitute ${BLUEPRINT_DEFAULT} with context blueprintId', () => {
    const input = 'blueprintId: ${BLUEPRINT_DEFAULT}'

    const schema = z.object({
      blueprintId: z.string().min(1),
    })

    const options = {
      contextResources: { blueprintId: 'bp_xyz789' },
    }

    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      blueprintId: 'bp_xyz789',
    })
  })

  it('should substitute ${BLUEPRINT_DEFAULT} with context blueprintId for the non blueprintId', () => {
    const input = 'anotherId: ${BLUEPRINT_DEFAULT}'

    const schema = z.object({
      anotherId: z.string().min(1),
    })

    const options = {
      contextResources: { blueprintId: 'bp_xyz789' },
    }

    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      anotherId: 'bp_xyz789',
    })
  })

  it('should substitute ${SKILLSET_DEFAULT} with context skillsetId', () => {
    const input = 'skillsetId: ${SKILLSET_DEFAULT}'

    const schema = z.object({
      skillsetId: z.string().min(1),
    })

    const options = {
      contextResources: { skillsetId: 'sk_abc' },
    }

    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      skillsetId: 'sk_abc',
    })
  })

  it('should substitute ${SKILLSET_DEFAULT} with context skillsetId for the non skillsetId', () => {
    const input = 'anotherId: ${SKILLSET_DEFAULT}'

    const schema = z.object({
      anotherId: z.string().min(1),
    })

    const options = {
      contextResources: { skillsetId: 'sk_abc' },
    }

    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      anotherId: 'sk_abc',
    })
  })

  it('should substitute ${ABILITY_DEFAULT} with context abilityId', () => {
    const input = 'abilityId: ${ABILITY_DEFAULT}'

    const schema = z.object({
      abilityId: z.string().min(1),
    })

    const options = {
      contextResources: { abilityId: 'ab_123' },
    }

    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      abilityId: 'ab_123',
    })
  })

  it('should substitute ${ABILITY_DEFAULT} with context abilityId for the non abilityId', () => {
    const input = 'anotherId: ${ABILITY_DEFAULT}'

    const schema = z.object({
      anotherId: z.string().min(1),
    })

    const options = {
      contextResources: { abilityId: 'ab_123' },
    }

    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      anotherId: 'ab_123',
    })
  })

  it('should NOT substitute ${SECRET_DEFAULT} - preserves placeholder to avoid accidental leakage', () => {
    // @note SECRET_DEFAULT is intentionally NOT substituted like other linked resources
    // to avoid accidental secret leakage. The placeholder is preserved and individual
    // actions handle secret resolution securely.

    const input = 'secretId: ${SECRET_DEFAULT}'

    const schema = z.object({
      secretId: z.string().min(1),
    })

    const options = {
      linkedResources: { secretId: 'sec_456' },
    }

    const result = getConfigBySchema({ input, schema, options })

    // @note placeholder is preserved, not substituted with linked secretId
    expect(result).toEqual({
      secretId: '${SECRET_DEFAULT}',
    })
  })

  it('should NOT substitute ${SECRET_DEFAULT} for any field - preserves placeholder', () => {
    // @note SECRET_DEFAULT preservation applies regardless of field name

    const input = 'anotherId: ${SECRET_DEFAULT}'

    const schema = z.object({
      anotherId: z.string().min(1),
    })

    const options = {
      linkedResources: { secretId: 'sec_456' },
    }

    const result = getConfigBySchema({ input, schema, options })

    // @note placeholder is preserved even for non-secretId fields
    expect(result).toEqual({
      anotherId: '${SECRET_DEFAULT}',
    })
  })

  it('should preserve ${SECRET_DEFAULT} in nested objects', () => {
    // @note SECRET_DEFAULT preservation works at any nesting level

    const input = `
config:
  api:
    secretId: \${SECRET_DEFAULT}
    timeout: 30
`

    const schema = z.object({
      config: z.object({
        api: z.object({
          secretId: z.string().min(1),
          timeout: z.number(),
        }),
      }),
    })

    const options = {
      linkedResources: { secretId: 'sec_nested' },
    }

    const result = getConfigBySchema({ input, schema, options })

    // @note placeholder is preserved even in nested objects
    expect(result).toEqual({
      config: {
        api: {
          secretId: '${SECRET_DEFAULT}',
          timeout: 30,
        },
      },
    })
  })

  it('should preserve ${SECRET_DEFAULT} while substituting other placeholders', () => {
    // @note SECRET_DEFAULT is the only placeholder that is NOT substituted

    const input = `
spaceId: \${SPACE_DEFAULT}
secretId: \${SECRET_DEFAULT}
botId: \${BOT_DEFAULT}
`

    const schema = z.object({
      spaceId: z.string().min(1),
      secretId: z.string().min(1),
      botId: z.string().optional(),
    })

    const options = {
      linkedResources: {
        spaceId: 'sp_123',
        secretId: 'sec_456',
        botId: 'bot_789',
      },
    }

    const result = getConfigBySchema({ input, schema, options })

    // @note only SECRET_DEFAULT is preserved, others are substituted
    expect(result).toEqual({
      spaceId: 'sp_123',
      secretId: '${SECRET_DEFAULT}',
      botId: 'bot_789',
    })
  })

  it('should substitute ${FILE_DEFAULT} with linked fileId', () => {
    const input = 'fileId: ${FILE_DEFAULT}'

    const schema = z.object({
      fileId: z.string().min(1),
    })

    const options = {
      linkedResources: { fileId: 'file_789' },
    }

    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      fileId: 'file_789',
    })
  })

  it('should substitute ${FILE_DEFAULT} with linked fileId for the non fileId', () => {
    const input = 'anotherId: ${FILE_DEFAULT}'

    const schema = z.object({
      anotherId: z.string().min(1),
    })

    const options = {
      linkedResources: { fileId: 'file_789' },
    }

    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      anotherId: 'file_789',
    })
  })

  it('should substitute multiple placeholders in the same config', () => {
    const input = `
spaceId: \${SPACE_DEFAULT}
botId: \${BOT_DEFAULT}
path: /documents
`

    const schema = z.object({
      spaceId: z.string().min(1),
      botId: z.string().min(1),
      path: z.string().min(1),
    })

    const options = {
      linkedResources: {
        spaceId: 'sp_multi1',
        botId: 'bot_multi2',
      },
    }

    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      spaceId: 'sp_multi1',
      botId: 'bot_multi2',
      path: '/documents',
    })
  })

  it('should replace placeholder with empty string when linked resource is not provided', () => {
    const input = 'spaceId: ${SPACE_DEFAULT}'

    const schema = z.object({
      spaceId: z.string(), // no .min(1) so empty string is valid
    })

    const options = {
      linkedResources: {}, // spaceId not provided
    }

    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      spaceId: '',
    })
  })

  it('should fail validation when placeholder is not substituted and field requires min length', () => {
    const input = 'spaceId: ${SPACE_DEFAULT}'

    const schema = z.object({
      spaceId: z.string().min(1),
    })

    const options = {
      linkedResources: {}, // spaceId not provided
    }

    expect(() => {
      getConfigBySchema({ input, schema, options })
    }).toThrow()
  })

  it('should fallback to empty string when options is not provided and no context', () => {
    const input = 'spaceId: ${SPACE_DEFAULT}'

    const schema = z.object({
      spaceId: z.string(), // no .min(1) so empty string is valid
    })

    // @note no options parameter - will try to resolve from context, which is
    // empty in this test, so should get empty string
    const result = getConfigBySchema({ input, schema })

    expect(result).toEqual({
      spaceId: '',
    })
  })

  it('should fallback to empty string when linkedResources is undefined and no context', () => {
    const input = 'spaceId: ${SPACE_DEFAULT}'

    const schema = z.object({
      spaceId: z.string(), // no .min(1) so empty string is valid
    })

    const options = {} // linkedResources not provided

    // @note will try to resolve from context, which is empty in this test,
    // so should get empty string
    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      spaceId: '',
    })
  })

  it('should substitute placeholders in nested objects', () => {
    const input = `
config:
  spaceId: \${SPACE_DEFAULT}
  settings:
    botId: \${BOT_DEFAULT}
`

    const schema = z.object({
      config: z.object({
        spaceId: z.string().min(1),
        settings: z.object({
          botId: z.string().min(1),
        }),
      }),
    })

    const options = {
      linkedResources: {
        spaceId: 'sp_nested',
        botId: 'bot_nested',
      },
    }

    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      config: {
        spaceId: 'sp_nested',
        settings: {
          botId: 'bot_nested',
        },
      },
    })
  })

  it('should not substitute strings that are not placeholders', () => {
    const input = 'spaceId: actual_space_id\nbotId: actual_bot_id'

    const schema = z.object({
      spaceId: z.string().min(1),
      botId: z.string().min(1),
    })

    const options = {
      linkedResources: {
        spaceId: 'sp_should_not_use',
        botId: 'bot_should_not_use',
      },
    }

    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      spaceId: 'actual_space_id',
      botId: 'actual_bot_id',
    })
  })

  it('should work with initial values and placeholder substitution', () => {
    const input = 'spaceId: ${SPACE_DEFAULT}'
    const initial = { path: '/default/path' }

    const schema = z.object({
      spaceId: z.string().min(1),
      path: z.string().min(1),
    })

    const options = {
      linkedResources: { spaceId: 'sp_with_initial' },
    }

    const result = getConfigBySchema({ input, initial, schema, options })

    expect(result).toEqual({
      spaceId: 'sp_with_initial',
      path: '/default/path',
    })
  })

  it('should work with params override and placeholder substitution', () => {
    const input = 'spaceId: ${SPACE_DEFAULT}'
    const params = { path: '/params/path' }

    const schema = z.object({
      spaceId: z.string().min(1),
      path: z.string().min(1),
    })

    const options = {
      linkedResources: { spaceId: 'sp_with_params' },
    }

    const result = getConfigBySchema({ input, params, schema, options })

    expect(result).toEqual({
      spaceId: 'sp_with_params',
      path: '/params/path',
    })
  })

  it('should allow params to override placeholder value', () => {
    const input = 'spaceId: ${SPACE_DEFAULT}'
    const params = { spaceId: 'sp_from_params' }

    const schema = z.object({
      spaceId: z.string().min(1),
    })

    const options = {
      linkedResources: { spaceId: 'sp_from_linked' },
    }

    const result = getConfigBySchema({ input, params, schema, options })

    // params should override YAML, so the placeholder substitution doesn't apply
    expect(result).toEqual({
      spaceId: 'sp_from_params',
    })
  })
})

describe('linked resource via initial pattern', () => {
  // @note passing spaceId via initial is still allowed when explicitly provided
  // by the caller. The dangerous behavior we removed was the automatic injection
  // from linkedResources into initial.

  it('should use linked resource from initial when explicitly provided by caller', () => {
    // This is safe because the caller explicitly passed spaceId in initial
    const input = 'path: /documents'
    const initial = { spaceId: 'sp_from_initial' }

    const schema = z.object({
      spaceId: z.string().min(1),
      path: z.string().min(1),
    })

    const result = getConfigBySchema({ input, initial, schema })

    expect(result).toEqual({
      spaceId: 'sp_from_initial',
      path: '/documents',
    })
  })

  it('should allow YAML input to override linked resource from initial', () => {
    const input = 'spaceId: sp_from_yaml\npath: /documents'
    const initial = { spaceId: 'sp_from_initial' }

    const schema = z.object({
      spaceId: z.string().min(1),
      path: z.string().min(1),
    })

    const result = getConfigBySchema({ input, initial, schema })

    expect(result).toEqual({
      spaceId: 'sp_from_yaml',
      path: '/documents',
    })
  })

  it('should allow params to override linked resource from initial', () => {
    const input = 'path: /documents'
    const initial = { spaceId: 'sp_from_initial' }
    const params = { spaceId: 'sp_from_params' }

    const schema = z.object({
      spaceId: z.string().min(1),
      path: z.string().min(1),
    })

    const result = getConfigBySchema({ input, initial, params, schema })

    expect(result).toEqual({
      spaceId: 'sp_from_params',
      path: '/documents',
    })
  })

  it('should use placeholder substitution when ${SPACE_DEFAULT} is in input even with initial set', () => {
    // This tests the case where both initial is set AND placeholder is used
    // The placeholder should be substituted with the linked resource from options
    const input = 'spaceId: ${SPACE_DEFAULT}\npath: /documents'
    const initial = { spaceId: 'sp_from_initial_unused' }

    const schema = z.object({
      spaceId: z.string().min(1),
      path: z.string().min(1),
    })

    const options = {
      linkedResources: { spaceId: 'sp_from_substitution' },
    }

    const result = getConfigBySchema({ input, initial, schema, options })

    // YAML overrides initial, then placeholder is substituted
    expect(result).toEqual({
      spaceId: 'sp_from_substitution',
      path: '/documents',
    })
  })

  it('should mirror action.exec.space.ts pattern with initial and options', () => {
    const linkedSpaceId = 'sp_linked_123'
    const input = 'recursive: true'
    const initial = {
      spaceId: linkedSpaceId, // Set from options.linkedResources?.spaceId
      path: '.',
    }

    const schema = z.object({
      spaceId: z.string().min(1),
      path: z.string().optional(),
      recursive: z.boolean().optional(),
    })

    const options = {
      linkedResources: { spaceId: linkedSpaceId },
    }

    const result = getConfigBySchema({ input, initial, schema, options })

    expect(result).toEqual({
      spaceId: 'sp_linked_123',
      path: '.',
      recursive: true,
    })
  })

  it('should allow explicit spaceId in YAML to override the pattern', () => {
    const linkedSpaceId = 'sp_linked_123'
    const input = 'spaceId: sp_explicit_override\nrecursive: true'
    const initial = {
      spaceId: linkedSpaceId,
      path: '.',
    }

    const schema = z.object({
      spaceId: z.string().min(1),
      path: z.string().optional(),
      recursive: z.boolean().optional(),
    })

    const options = {
      linkedResources: { spaceId: linkedSpaceId },
    }

    const result = getConfigBySchema({ input, initial, schema, options })

    expect(result).toEqual({
      spaceId: 'sp_explicit_override',
      path: '.',
      recursive: true,
    })
  })

  it('should work when initial has undefined spaceId (no linked resource)', () => {
    // Edge case: linkedResources?.spaceId is undefined
    const input = 'spaceId: sp_from_input\npath: /docs'
    const initial = {
      spaceId: undefined, // options.linkedResources?.spaceId was undefined
      path: '.',
    }

    const schema = z.object({
      spaceId: z.string().min(1),
      path: z.string().min(1),
    })

    const result = getConfigBySchema({ input, initial, schema })

    expect(result).toEqual({
      spaceId: 'sp_from_input',
      path: '/docs',
    })
  })

  it('should fail validation when no spaceId provided and initial is undefined', () => {
    const input = 'path: /docs'
    const initial = {
      spaceId: undefined, // No linked resource available
      path: '.',
    }

    const schema = z.object({
      spaceId: z.string().min(1),
      path: z.string().min(1),
    })

    expect(() => {
      getConfigBySchema({ input, initial, schema })
    }).toThrow()
  })

  it('should handle multiple linked resources via initial pattern', () => {
    const input = 'query: search term'
    const initial = {
      spaceId: 'sp_linked',
      botId: 'bot_linked',
    }

    const schema = z.object({
      spaceId: z.string().min(1),
      botId: z.string().min(1),
      query: z.string().min(1),
    })

    const result = getConfigBySchema({ input, initial, schema })

    expect(result).toEqual({
      spaceId: 'sp_linked',
      botId: 'bot_linked',
      query: 'search term',
    })
  })
})

describe('linkedResources does NOT auto-merge into initial (secure by default)', () => {
  // @note we intentionally removed auto-merge of linkedResources into initial
  // because implicit injection of resource IDs is dangerous - users may not
  // realize they're operating on a specific resource. Users must now explicitly
  // specify resource IDs via placeholder substitution (e.g., ${SPACE_DEFAULT})

  it('should NOT auto-merge linkedResources into initial - requires explicit placeholder', () => {
    const input = 'path: /documents'

    const schema = z.object({
      spaceId: z.string().min(1),
      path: z.string().min(1),
    })

    const options = {
      linkedResources: { spaceId: 'sp_auto_merged' },
    }

    // @note this should fail because spaceId is not explicitly provided in input
    expect(() => {
      getConfigBySchema({ input, schema, options })
    }).toThrow()
  })

  it('should work when spaceId is explicitly provided via placeholder', () => {
    const input = 'spaceId: ${SPACE_DEFAULT}\npath: /documents'

    const schema = z.object({
      spaceId: z.string().min(1),
      path: z.string().min(1),
    })

    const options = {
      linkedResources: { spaceId: 'sp_from_linked' },
    }

    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      spaceId: 'sp_from_linked',
      path: '/documents',
    })
  })

  it('should allow explicit initial values to work (caller explicitly provides spaceId)', () => {
    const input = 'path: /documents'
    const initial = { spaceId: 'sp_explicit_initial' }

    const schema = z.object({
      spaceId: z.string().min(1),
      path: z.string().min(1),
    })

    const options = {
      linkedResources: { spaceId: 'sp_from_linked' },
    }

    const result = getConfigBySchema({ input, initial, schema, options })

    // explicit initial should work (caller consciously passed spaceId)
    expect(result).toEqual({
      spaceId: 'sp_explicit_initial',
      path: '/documents',
    })
  })

  it('should allow YAML input to provide spaceId explicitly', () => {
    const input = 'spaceId: sp_from_yaml\npath: /documents'

    const schema = z.object({
      spaceId: z.string().min(1),
      path: z.string().min(1),
    })

    const options = {
      linkedResources: { spaceId: 'sp_from_linked' },
    }

    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      spaceId: 'sp_from_yaml',
      path: '/documents',
    })
  })

  it('should allow params to provide spaceId explicitly', () => {
    const input = 'path: /documents'
    const params = { spaceId: 'sp_from_params' }

    const schema = z.object({
      spaceId: z.string().min(1),
      path: z.string().min(1),
    })

    const options = {
      linkedResources: { spaceId: 'sp_from_linked' },
    }

    const result = getConfigBySchema({ input, params, schema, options })

    expect(result).toEqual({
      spaceId: 'sp_from_params',
      path: '/documents',
    })
  })

  it('should fail when multiple resources are provided without placeholders', () => {
    const input = 'query: search term'

    const schema = z.object({
      spaceId: z.string().min(1),
      blueprintId: z.string().min(1),
      query: z.string().min(1),
    })

    const options = {
      linkedResources: {
        spaceId: 'sp_auto',
      },
      contextResources: {
        blueprintId: 'bp_auto',
      },
    }

    // @note this should fail because spaceId and blueprintId are not explicitly provided
    expect(() => {
      getConfigBySchema({ input, schema, options })
    }).toThrow()
  })

  it('should work when multiple placeholders are used explicitly', () => {
    const input =
      'spaceId: ${SPACE_DEFAULT}\nblueprintId: ${BLUEPRINT_DEFAULT}\nquery: search term'

    const schema = z.object({
      spaceId: z.string().min(1),
      blueprintId: z.string().min(1),
      query: z.string().min(1),
    })

    const options = {
      linkedResources: {
        spaceId: 'sp_substituted',
      },
      contextResources: {
        blueprintId: 'bp_substituted',
      },
    }

    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      spaceId: 'sp_substituted',
      blueprintId: 'bp_substituted',
      query: 'search term',
    })
  })

  it('should require explicit placeholder for space action pattern', () => {
    // The secure pattern now requires explicit placeholder usage
    const input = 'spaceId: ${SPACE_DEFAULT}\nrecursive: true'
    const initial = { path: '.' }

    const schema = z.object({
      spaceId: z.string().min(1),
      path: z.string().optional(),
      recursive: z.boolean().optional(),
    })

    const options = {
      linkedResources: { spaceId: 'sp_simplified' },
    }

    const result = getConfigBySchema({ input, initial, schema, options })

    expect(result).toEqual({
      spaceId: 'sp_simplified',
      path: '.',
      recursive: true,
    })
  })

  it('should work with placeholder substitution for multiple resources', () => {
    const input =
      'spaceId: ${SPACE_DEFAULT}\nbotId: ${BOT_DEFAULT}\npath: /docs'

    const schema = z.object({
      spaceId: z.string().min(1),
      botId: z.string().min(1),
      path: z.string().min(1),
    })

    const options = {
      linkedResources: {
        spaceId: 'sp_substituted',
        botId: 'bot_substituted',
      },
    }

    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      spaceId: 'sp_substituted',
      botId: 'bot_substituted',
      path: '/docs',
    })
  })
})

describe('linked resource with context fallback', () => {
  // Mock context functions
  let mockContextBot

  beforeEach(() => {
    jest.resetModules()

    mockContextBot = null

    // Mock the context module
    jest.mock('@/lib/context.store', () => ({
      getContextBot: jest.fn(() => mockContextBot),
    }))
  })

  afterEach(() => {
    jest.unmock('@/lib/context.store')
  })

  it('should use linked resource over context (linked resource has priority)', async () => {
    // Set up context
    mockContextBot = { id: 'bot_context', namespace: 'sp_context' }

    const { getConfigBySchema } = await import('@/lib/action.config')

    const input = 'spaceId: ${SPACE_DEFAULT}\nbotId: ${BOT_DEFAULT}'

    const schema = z.object({
      spaceId: z.string().min(1),
      botId: z.string().min(1),
    })

    const options = {
      linkedResources: {
        spaceId: 'sp_linked',
        botId: 'bot_linked',
      },
    }

    const result = getConfigBySchema({ input, schema, options })

    // @note linked resources should take precedence over context
    expect(result).toEqual({
      spaceId: 'sp_linked',
      botId: 'bot_linked',
    })
  })

  it('should fallback to context bot id when botId not linked', async () => {
    // Set up context with bot
    mockContextBot = { id: 'bot_from_context', namespace: 'sp_123' }

    const { getConfigBySchema } = await import('@/lib/action.config')

    const input = 'botId: ${BOT_DEFAULT}'

    const schema = z.object({
      botId: z.string().min(1),
    })

    const options = {
      linkedResources: {}, // no linked botId
    }

    const result = getConfigBySchema({ input, schema, options })

    // @note should use context bot's id
    expect(result).toEqual({
      botId: 'bot_from_context',
    })
  })

  it('should return empty string when neither linked nor context available', async () => {
    // No context set
    mockContextBot = null

    const { getConfigBySchema } = await import('@/lib/action.config')

    const input = 'spaceId: ${SPACE_DEFAULT}\nbotId: ${BOT_DEFAULT}'

    const schema = z.object({
      spaceId: z.string(), // no .min(1) so empty string is valid
      botId: z.string(), // no .min(1) so empty string is valid
    })

    const options = {
      linkedResources: {}, // no linked resources
    }

    const result = getConfigBySchema({ input, schema, options })

    // @note should use empty strings
    expect(result).toEqual({
      spaceId: '',
      botId: '',
    })
  })

  it('should use partial linked resources and fallback for rest', async () => {
    // Set up context
    mockContextBot = { id: 'bot_context', namespace: 'sp_context' }

    const { getConfigBySchema } = await import('@/lib/action.config')

    const input = 'botId: ${BOT_DEFAULT}\npath: /docs'

    const schema = z.object({
      botId: z.string().min(1),
      path: z.string().min(1),
    })

    const options = {
      linkedResources: {
        // botId is not linked, should fallback to context
      },
    }

    const result = getConfigBySchema({ input, schema, options })

    // @note botId falls back to context
    expect(result).toEqual({
      botId: 'bot_context',
      path: '/docs',
    })
  })

  it('should fallback to context bot blueprintId when blueprintId not linked', async () => {
    // Set up context with bot that has blueprintId
    mockContextBot = { id: 'bot_context', blueprintId: 'bp_from_context' }

    const { getConfigBySchema } = await import('@/lib/action.config')

    const input = 'blueprintId: ${BLUEPRINT_DEFAULT}'

    const schema = z.object({
      blueprintId: z.string().min(1),
    })

    const options = {
      linkedResources: {}, // no linked blueprintId
    }

    const result = getConfigBySchema({ input, schema, options })

    // @note should use context bot's blueprintId
    expect(result).toEqual({
      blueprintId: 'bp_from_context',
    })
  })

  it('should prefer context blueprintId over context bot blueprintId', async () => {
    // Set up context with bot that has blueprintId
    mockContextBot = { id: 'bot_context', blueprintId: 'bp_from_context_bot' }

    const { getConfigBySchema } = await import('@/lib/action.config')

    const input = 'blueprintId: ${BLUEPRINT_DEFAULT}'

    const schema = z.object({
      blueprintId: z.string().min(1),
    })

    const options = {
      contextResources: { blueprintId: 'bp_from_context' },
    }

    const result = getConfigBySchema({ input, schema, options })

    // @note context resource should take precedence over context bot
    expect(result).toEqual({
      blueprintId: 'bp_from_context',
    })
  })

  it('should return empty string for blueprintId when neither context resource nor context bot available', async () => {
    // No context set
    mockContextBot = null

    const { getConfigBySchema } = await import('@/lib/action.config')

    const input = 'blueprintId: ${BLUEPRINT_DEFAULT}'

    const schema = z.object({
      blueprintId: z.string(), // no .min(1) so empty string is valid
    })

    const options = {
      contextResources: {},
    }

    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      blueprintId: '',
    })
  })

  it('should return empty string for blueprintId when context bot has no blueprintId', async () => {
    // Context bot without blueprintId
    mockContextBot = { id: 'bot_context' }

    const { getConfigBySchema } = await import('@/lib/action.config')

    const input = 'blueprintId: ${BLUEPRINT_DEFAULT}'

    const schema = z.object({
      blueprintId: z.string(), // no .min(1) so empty string is valid
    })

    const options = {
      linkedResources: {},
    }

    const result = getConfigBySchema({ input, schema, options })

    expect(result).toEqual({
      blueprintId: '',
    })
  })
})
