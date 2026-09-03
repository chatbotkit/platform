import {
  ACTION_TAGS_SCHEMA,
  ArrayField,
  BooleanField,
  NumberField,
  ObjectField,
  StringField,
} from '@/lib/action.tags'
import { convertToCallableTemplateInstruction } from '@/lib/instruction.convert'
import { getInstructionType } from '@/lib/instruction.type'

import yaml from 'js-yaml'

/**
 * Helper function to parse YAML with ACTION_TAGS_SCHEMA.
 *
 * @param {string} input
 * @returns {any}
 */
function parseWithActionTags(input) {
  return yaml.load(input, { schema: ACTION_TAGS_SCHEMA })
}

describe('convertToCallableTemplateInstruction', () => {
  describe('basic functionality', () => {
    it('should convert template with no parameters', () => {
      const template = {
        template: 'template-simple',
        instruction: '```text\nDo something simple\n```',
      }

      const result = convertToCallableTemplateInstruction(template)
      const parsed = parseWithActionTags(result)

      expect(parsed).toEqual({
        template: 'template-simple',
      })
    })

    it('should convert template with single parameter', () => {
      const template = {
        template: 'template-with-param',
        instruction: '```text\nProcess ((input|the input value))\n```',
      }

      const result = convertToCallableTemplateInstruction(template)
      const parsed = parseWithActionTags(result)

      expect(parsed.template).toBe('template-with-param')
      expect(parsed.parameters.input).toBeInstanceOf(StringField)
      expect(parsed.parameters.input.value.name).toBe('input')
      expect(parsed.parameters.input.value.description).toBe('the input value')
      expect(parsed.parameters.input.value.optional).toBe(true)
      expect(parsed.parameters.input.value.placeholder).toBe(true)
    })

    it('should convert template with multiple parameters', () => {
      const template = {
        template: 'template-multi',
        instruction:
          '```text\nProcess ((input|input data)) with ((options|processing options))\n```',
      }

      const result = convertToCallableTemplateInstruction(template)
      const parsed = parseWithActionTags(result)

      expect(parsed.template).toBe('template-multi')
      expect(parsed.parameters.input).toBeInstanceOf(StringField)
      expect(parsed.parameters.input.value.name).toBe('input')
      expect(parsed.parameters.input.value.description).toBe('input data')
      expect(parsed.parameters.options).toBeInstanceOf(StringField)
      expect(parsed.parameters.options.value.name).toBe('options')
      expect(parsed.parameters.options.value.description).toBe(
        'processing options'
      )
    })
  })

  describe('parameter handling', () => {
    it('should handle required parameter fields', () => {
      const template = {
        template: 'template-required',
        instruction: '```text\nProcess ((!input|required input))\n```',
      }

      const result = convertToCallableTemplateInstruction(template)
      const parsed = parseWithActionTags(result)

      expect(parsed.template).toBe('template-required')
      expect(parsed.parameters.input).toBeInstanceOf(StringField)
      expect(parsed.parameters.input.value.name).toBe('input')
      expect(parsed.parameters.input.value.description).toBe('required input')
      expect(parsed.parameters.input.value.optional).toBe(false)
    })

    it('should handle parameter with operand', () => {
      const template = {
        template: 'template-operand',
        instruction: '```text\nProcess ((input js|json stringify))\n```',
      }

      const result = convertToCallableTemplateInstruction(template)
      const parsed = parseWithActionTags(result)

      expect(parsed.template).toBe('template-operand')
      expect(parsed.parameters.input).toBeInstanceOf(StringField)
      expect(parsed.parameters.input.value.name).toBe('input')
      expect(parsed.parameters.input.value.description).toBe('json stringify')
    })

    it('should handle multiple parameters with various modifiers', () => {
      const template = {
        template: 'template-complex',
        instruction:
          '```text\nProcess ((!name|required name)) and ((data js|json data)) and ((optional|optional param))\n```',
      }

      const result = convertToCallableTemplateInstruction(template)
      const parsed = parseWithActionTags(result)

      expect(parsed.template).toBe('template-complex')

      expect(parsed.parameters.name).toBeInstanceOf(StringField)
      expect(parsed.parameters.name.value.name).toBe('name')
      expect(parsed.parameters.name.value.description).toBe('required name')
      expect(parsed.parameters.name.value.optional).toBe(false)

      expect(parsed.parameters.data).toBeInstanceOf(StringField)
      expect(parsed.parameters.data.value.name).toBe('data')
      expect(parsed.parameters.data.value.description).toBe('json data')
      expect(parsed.parameters.data.value.optional).toBe(true)

      expect(parsed.parameters.optional).toBeInstanceOf(StringField)
      expect(parsed.parameters.optional.value.name).toBe('optional')
      expect(parsed.parameters.optional.value.description).toBe(
        'optional param'
      )
      expect(parsed.parameters.optional.value.optional).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle empty instruction', () => {
      const template = {
        template: 'template-empty',
        instruction: '```text\n\n```',
      }

      const result = convertToCallableTemplateInstruction(template)
      const parsed = parseWithActionTags(result)

      expect(parsed).toEqual({
        template: 'template-empty',
      })
    })

    it('should handle template with special characters in ID', () => {
      const template = {
        template: 'template/special-chars_123',
        instruction: '```text\nProcess ((input|data))\n```',
      }

      const result = convertToCallableTemplateInstruction(template)
      const parsed = parseWithActionTags(result)

      expect(parsed.template).toBe('template/special-chars_123')
      expect(parsed.parameters.input).toBeInstanceOf(StringField)
      expect(parsed.parameters.input.value.name).toBe('input')
      expect(parsed.parameters.input.value.description).toBe('data')
    })

    it('should handle parameter without description', () => {
      const template = {
        template: 'template-no-desc',
        instruction: '```text\nProcess ((input))\n```',
      }

      const result = convertToCallableTemplateInstruction(template)
      const parsed = parseWithActionTags(result)

      expect(parsed.template).toBe('template-no-desc')
      expect(parsed.parameters.input).toBeInstanceOf(StringField)
      expect(parsed.parameters.input.value.name).toBe('input')
      expect(parsed.parameters.input.value.description).toBeUndefined()
    })

    it('should handle instruction with only whitespace around parameters', () => {
      const template = {
        template: 'template-whitespace',
        instruction: '```text\n   ((param|description))   \n```',
      }

      const result = convertToCallableTemplateInstruction(template)
      const parsed = parseWithActionTags(result)

      expect(parsed.template).toBe('template-whitespace')
      expect(parsed.parameters.param).toBeInstanceOf(StringField)
      expect(parsed.parameters.param.value.name).toBe('param')
      expect(parsed.parameters.param.value.description).toBe('description')
    })
  })

  describe('bracket type handling', () => {
    it('should only extract round bracket parameters', () => {
      const template = {
        template: 'template-brackets',
        instruction:
          '```text\nProcess ((roundParam|round)) and ${curlyParam|curly} and $[squareParam|square]\n```',
      }

      const result = convertToCallableTemplateInstruction(template)
      const parsed = parseWithActionTags(result)

      // @note only round bracket parameters should be extracted
      expect(parsed.template).toBe('template-brackets')
      expect(Object.keys(parsed.parameters)).toEqual(['roundParam'])
      expect(parsed.parameters.roundParam).toBeInstanceOf(StringField)
      expect(parsed.parameters.roundParam.value.name).toBe('roundParam')
      expect(parsed.parameters.roundParam.value.description).toBe('round')
    })

    it('should handle double parentheses format', () => {
      const template = {
        template: 'template-double-paren',
        instruction: '```text\nUse ((param1|first)) and ((param2|second))\n```',
      }

      const result = convertToCallableTemplateInstruction(template)
      const parsed = parseWithActionTags(result)

      expect(parsed.template).toBe('template-double-paren')
      expect(parsed.parameters.param1).toBeInstanceOf(StringField)
      expect(parsed.parameters.param1.value.name).toBe('param1')
      expect(parsed.parameters.param1.value.description).toBe('first')
      expect(parsed.parameters.param2).toBeInstanceOf(StringField)
      expect(parsed.parameters.param2.value.name).toBe('param2')
      expect(parsed.parameters.param2.value.description).toBe('second')
    })
  })

  describe('return value format', () => {
    it('should return valid YAML string', () => {
      const template = {
        template: 'template-format',
        instruction: '```text\nTest ((param|description))\n```',
      }

      const result = convertToCallableTemplateInstruction(template)

      expect(typeof result).toBe('string')
      expect(() => parseWithActionTags(result)).not.toThrow()
    })

    it('should not include parameters key when no fields exist', () => {
      const template = {
        template: 'no-params',
        instruction: '```text\nno params here\n```',
      }

      const result = convertToCallableTemplateInstruction(template)
      const parsed = parseWithActionTags(result)

      expect(parsed).toEqual({
        template: 'no-params',
      })
      expect(Object.keys(parsed)).not.toContain('parameters')
    })

    it('should include parameters key when fields exist', () => {
      const template = {
        template: 'with-params',
        instruction: '```text\n((param|desc))\n```',
      }

      const result = convertToCallableTemplateInstruction(template)
      const parsed = parseWithActionTags(result)

      expect(Object.keys(parsed)).toContain('parameters')
      expect(parsed.parameters.param).toBeInstanceOf(StringField)
      expect(parsed.parameters.param.value.name).toBe('param')
      expect(parsed.parameters.param.value.description).toBe('desc')
    })

    it('should produce YAML with action tag syntax', () => {
      const template = {
        template: 'with-params',
        instruction: '```text\n((param|desc))\n```',
      }

      const result = convertToCallableTemplateInstruction(template)

      // @note verify the output contains !string tag syntax
      expect(result).toContain('!string')
      expect(result).toContain('name: "param"')
      expect(result).toContain('description: "desc"')
    })

    it('should be detected as template instruction type', () => {
      const template = {
        template: 'template-detection',
        instruction: '```text\nProcess ((input|the input))\n```',
      }

      const result = convertToCallableTemplateInstruction(template)

      // @note verify getInstructionType correctly identifies this as a template
      expect(getInstructionType(result)).toBe('template')
    })

    it('should be detected as template instruction type even without parameters', () => {
      const template = {
        template: 'template-no-params',
        instruction: '```text\nDo something simple\n```',
      }

      const result = convertToCallableTemplateInstruction(template)

      // @note verify getInstructionType correctly identifies this as a template
      expect(getInstructionType(result)).toBe('template')
    })
  })

  describe('real-world scenarios', () => {
    it('should handle a typical template instruction', () => {
      const template = {
        template: 'summarize-content',
        instruction:
          '```text\nSummarize the following ((content|the content to summarize)) in ((language|target language)) with ((style|writing style)) tone.\n```',
      }

      const result = convertToCallableTemplateInstruction(template)
      const parsed = parseWithActionTags(result)

      expect(parsed.template).toBe('summarize-content')

      expect(parsed.parameters.content).toBeInstanceOf(StringField)
      expect(parsed.parameters.content.value.name).toBe('content')
      expect(parsed.parameters.content.value.description).toBe(
        'the content to summarize'
      )

      expect(parsed.parameters.language).toBeInstanceOf(StringField)
      expect(parsed.parameters.language.value.name).toBe('language')
      expect(parsed.parameters.language.value.description).toBe(
        'target language'
      )

      expect(parsed.parameters.style).toBeInstanceOf(StringField)
      expect(parsed.parameters.style.value.name).toBe('style')
      expect(parsed.parameters.style.value.description).toBe('writing style')
    })

    it('should handle template with required and optional parameters', () => {
      const template = {
        template: 'process-data',
        instruction:
          '```text\nProcess ((!data|required data input)) with optional ((format|output format))\n```',
      }

      const result = convertToCallableTemplateInstruction(template)
      const parsed = parseWithActionTags(result)

      expect(parsed.template).toBe('process-data')

      expect(parsed.parameters.data).toBeInstanceOf(StringField)
      expect(parsed.parameters.data.value.name).toBe('data')
      expect(parsed.parameters.data.value.description).toBe(
        'required data input'
      )
      expect(parsed.parameters.data.value.optional).toBe(false)

      expect(parsed.parameters.format).toBeInstanceOf(StringField)
      expect(parsed.parameters.format.value.name).toBe('format')
      expect(parsed.parameters.format.value.description).toBe('output format')
      expect(parsed.parameters.format.value.optional).toBe(true)
    })

    it('should handle template with complex instruction text', () => {
      const template = {
        template: 'complex-template',
        instruction: `\`\`\`text

Please use the following context:
- Topic: ((topic|main topic))
- Audience: ((audience|target audience))

Generate a response that is helpful and informative.
\`\`\`
`,
      }

      const result = convertToCallableTemplateInstruction(template)
      const parsed = parseWithActionTags(result)

      expect(parsed.template).toBe('complex-template')

      expect(parsed.parameters.topic).toBeInstanceOf(StringField)
      expect(parsed.parameters.topic.value.name).toBe('topic')
      expect(parsed.parameters.topic.value.description).toBe('main topic')

      expect(parsed.parameters.audience).toBeInstanceOf(StringField)
      expect(parsed.parameters.audience.value.name).toBe('audience')
      expect(parsed.parameters.audience.value.description).toBe(
        'target audience'
      )
    })
  })

  describe('typed fields', () => {
    it('should create NumberField for number type parameters', () => {
      const template = {
        template: 'template-number',
        instruction: '```text\nProcess ((count number|the count))\n```',
      }

      const result = convertToCallableTemplateInstruction(template)
      const parsed = parseWithActionTags(result)

      expect(parsed.template).toBe('template-number')
      expect(parsed.parameters.count).toBeInstanceOf(NumberField)
      expect(parsed.parameters.count.value.name).toBe('count')
      expect(parsed.parameters.count.value.description).toBe('the count')
    })

    it('should create BooleanField for boolean type parameters', () => {
      const template = {
        template: 'template-boolean',
        instruction: '```text\nProcess ((active boolean|is active))\n```',
      }

      const result = convertToCallableTemplateInstruction(template)
      const parsed = parseWithActionTags(result)

      expect(parsed.template).toBe('template-boolean')
      expect(parsed.parameters.active).toBeInstanceOf(BooleanField)
      expect(parsed.parameters.active.value.name).toBe('active')
      expect(parsed.parameters.active.value.description).toBe('is active')
    })

    it('should handle mixed types', () => {
      const template = {
        template: 'template-mixed',
        instruction:
          '```text\nProcess ((name|the name)) with ((count number|the count)) and ((flag boolean|the flag))\n```',
      }

      const result = convertToCallableTemplateInstruction(template)
      const parsed = parseWithActionTags(result)

      expect(parsed.template).toBe('template-mixed')
      expect(parsed.parameters.name).toBeInstanceOf(StringField)
      expect(parsed.parameters.count).toBeInstanceOf(NumberField)
      expect(parsed.parameters.flag).toBeInstanceOf(BooleanField)
    })
  })

  describe('array and object field types', () => {
    // @note these tests use jest mocking because the field extraction system
    // doesn't currently support array/object types via round bracket syntax.
    // The implementation supports them for when fields come from other sources
    // like structured instructions.

    beforeEach(() => {
      jest.resetModules()
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should create ArrayField for array type fields', async () => {
      jest.doMock('@/lib/instruction.field', () => ({
        extractInstructionFields: () => [
          {
            name: 'items',
            type: 'array',
            description: 'the items list',
            required: false,
            placeholder: true,
          },
        ],
      }))

      const { convertToCallableTemplateInstruction: mockConvert } =
        await import('@/lib/instruction.convert')

      const template = {
        template: 'template-array',
        instruction: 'mock instruction',
      }

      const result = mockConvert(template)
      const parsed = parseWithActionTags(result)

      expect(parsed.template).toBe('template-array')
      expect(parsed.parameters.items).toBeInstanceOf(ArrayField)
      expect(parsed.parameters.items.value.name).toBe('items')
      expect(parsed.parameters.items.value.description).toBe('the items list')
      expect(parsed.parameters.items.value.placeholder).toBe(true)
    })

    it('should create ObjectField for object type fields', async () => {
      jest.doMock('@/lib/instruction.field', () => ({
        extractInstructionFields: () => [
          {
            name: 'config',
            type: 'object',
            description: 'the configuration',
            required: false,
            placeholder: true,
          },
        ],
      }))

      const { convertToCallableTemplateInstruction: mockConvert } =
        await import('@/lib/instruction.convert')

      const template = {
        template: 'template-object',
        instruction: 'mock instruction',
      }

      const result = mockConvert(template)
      const parsed = parseWithActionTags(result)

      expect(parsed.template).toBe('template-object')
      expect(parsed.parameters.config).toBeInstanceOf(ObjectField)
      expect(parsed.parameters.config.value.name).toBe('config')
      expect(parsed.parameters.config.value.description).toBe(
        'the configuration'
      )
      expect(parsed.parameters.config.value.placeholder).toBe(true)
    })

    it('should handle all field types together', async () => {
      jest.doMock('@/lib/instruction.field', () => ({
        extractInstructionFields: () => [
          {
            name: 'name',
            type: 'string',
            description: 'the name',
            placeholder: true,
          },
          {
            name: 'count',
            type: 'number',
            description: 'the count',
            placeholder: true,
          },
          {
            name: 'flag',
            type: 'boolean',
            description: 'the flag',
            placeholder: true,
          },
          {
            name: 'items',
            type: 'array',
            description: 'the items',
            placeholder: true,
          },
          {
            name: 'config',
            type: 'object',
            description: 'the config',
            placeholder: true,
          },
        ],
      }))

      const { convertToCallableTemplateInstruction: mockConvert } =
        await import('@/lib/instruction.convert')

      const template = {
        template: 'template-all-types',
        instruction: 'mock instruction',
      }

      const result = mockConvert(template)
      const parsed = parseWithActionTags(result)

      expect(parsed.template).toBe('template-all-types')
      expect(parsed.parameters.name).toBeInstanceOf(StringField)
      expect(parsed.parameters.count).toBeInstanceOf(NumberField)
      expect(parsed.parameters.flag).toBeInstanceOf(BooleanField)
      expect(parsed.parameters.items).toBeInstanceOf(ArrayField)
      expect(parsed.parameters.config).toBeInstanceOf(ObjectField)
    })
  })
})
