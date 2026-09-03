import {
  SCHEMA_MARKER,
  extractCodeSchema,
  extractSchemaSource,
} from '@/lib/code.schema'

const SCHEMA = {
  type: 'object',
  required: ['prompt'],
  properties: {
    prompt: { type: 'string', description: 'the user prompt' },
  },
}

describe('code.schema', () => {
  describe('extractCodeSchema', () => {
    test('reads a JSDoc block-comment schema (JavaScript)', () => {
      const code = [
        '/**',
        ' * @schema',
        ' * {',
        ' *   "type": "object",',
        ' *   "required": ["prompt"],',
        ' *   "properties": {',
        ' *     "prompt": { "type": "string", "description": "the user prompt" }',
        ' *   }',
        ' * }',
        ' */',
        'export default function handler(input) {',
        '  return { text: input.prompt }',
        '}',
      ].join('\n')

      expect(extractCodeSchema(code)).toEqual(SCHEMA)
    })

    test('reads a // line-comment schema (JavaScript)', () => {
      const code = [
        '// @schema',
        '// { "type": "object", "required": ["prompt"],',
        '//   "properties": { "prompt": { "type": "string", "description": "the user prompt" } } }',
        'export default function handler(input) { return { text: input.prompt } }',
      ].join('\n')

      expect(extractCodeSchema(code)).toEqual(SCHEMA)
    })

    test('reads a # comment schema (Python)', () => {
      const code = [
        '# @schema',
        '# { "type": "object", "required": ["prompt"],',
        '#   "properties": { "prompt": { "type": "string", "description": "the user prompt" } } }',
        'def handler(input):',
        '    return { "text": input["prompt"] }',
      ].join('\n')

      expect(extractCodeSchema(code)).toEqual(SCHEMA)
    })

    test('reads a single-line schema', () => {
      const code =
        '// @schema { "type": "object", "properties": { "n": { "type": "number" } } }\nexport default () => {}'

      expect(extractCodeSchema(code)).toEqual({
        type: 'object',
        properties: { n: { type: 'number' } },
      })
    })

    test('preserves braces and hashes inside string values', () => {
      const code = [
        '# @schema',
        '# { "type": "object", "properties": {',
        '#   "tpl": { "type": "string", "description": "use {braces} and # here" }',
        '# } }',
        'def handler(input): pass',
      ].join('\n')

      const schema = extractCodeSchema(code) as unknown as {
        properties: { tpl: { description: string } }
      }

      expect(schema.properties.tpl.description).toBe('use {braces} and # here')
    })

    test('returns null when no schema is declared', () => {
      expect(
        extractCodeSchema('export default function handler(input) {}')
      ).toBeNull()
    })

    test('throws when the marker is present but has no object', () => {
      expect(() => extractCodeSchema('// @schema\nexport default () => {}')).toThrow(
        SCHEMA_MARKER
      )
    })

    test('throws when the schema block is malformed JSON', () => {
      const code = '// @schema { "type": "object", "properties": { oops } }\nx'

      expect(() => extractCodeSchema(code)).toThrow()
    })
  })

  describe('extractSchemaSource', () => {
    test('returns the cleaned JSON text', () => {
      const code = '# @schema\n# { "type": "object" }\npass'

      expect(extractSchemaSource(code)).toBe('{ "type": "object" }')
    })

    test('returns null without a marker', () => {
      expect(extractSchemaSource('def handler(): pass')).toBeNull()
    })
  })
})
