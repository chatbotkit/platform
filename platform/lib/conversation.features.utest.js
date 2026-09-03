import {
  compactFeatureOptionsSchema,
  compactFeatureSchema,
  featureSchema,
  skillsFeatureSkillSchema,
  webFeatureOptionsSchema,
  webFeatureSchema,
} from '@/lib/conversation.features'

// All simple flag feature names exported by the discriminated union
const ALL_FLAG_FEATURES = [
  'diligence',
  'personalization',
  'memory',
  'task',
  'time',
  'markdown',
  'buttons',
  'math',
  'references',
  'carousel',
  'form',
  'mermaid',
  'audio',
  'canvas',
  'footnotes',
  'batch',
  'silent',
  'vision',
  'attachments',
  'dataset',
  'skillset',
  'auth',
  'chunking',
  'noFeatures',
  'noFunctions',
  'noInlineDatasets',
  'noInlineSkillsets',
  'bpacc',
  'reprogramming',
  'justification',
]

describe('conversation.features', () => {
  describe('simple flag features', () => {
    it.each(ALL_FLAG_FEATURES)('should validate %s feature', (name) => {
      const result = featureSchema.safeParse({ name })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ name })
    })

    it.each(ALL_FLAG_FEATURES)(
      'should reject %s feature with extra properties (strict mode)',
      (name) => {
        const result = featureSchema.safeParse({ name, unexpected: true })

        expect(result.success).toBe(false)
      }
    )

    it.each(ALL_FLAG_FEATURES)(
      'should reject %s feature with null name',
      (_name) => {
        const result = featureSchema.safeParse({ name: null })

        expect(result.success).toBe(false)
      }
    )
  })

  describe('featureSchema - discriminated union', () => {
    it('should reject unknown feature names', () => {
      const result = featureSchema.safeParse({ name: '[Filtered]' })

      expect(result.success).toBe(false)
    })

    it('should reject empty string as feature name', () => {
      const result = featureSchema.safeParse({ name: '' })

      expect(result.success).toBe(false)
    })

    it('should reject missing name field', () => {
      const result = featureSchema.safeParse({})

      expect(result.success).toBe(false)
    })

    it('should reject null input', () => {
      const result = featureSchema.safeParse(null)

      expect(result.success).toBe(false)
    })

    it('should reject non-object input', () => {
      const result = featureSchema.safeParse('markdown')

      expect(result.success).toBe(false)
    })
  })

  describe('web feature', () => {
    it('should validate web feature without options', () => {
      const result = featureSchema.safeParse({ name: 'web' })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ name: 'web' })
    })

    it('should validate web feature with both options', () => {
      const result = featureSchema.safeParse({
        name: 'web',
        options: { fetch: true, search: false },
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        name: 'web',
        options: { fetch: true, search: false },
      })
    })

    it('should validate web feature with only search option', () => {
      const result = featureSchema.safeParse({
        name: 'web',
        options: { search: true },
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ name: 'web', options: { search: true } })
    })

    it('should validate web feature with only fetch option', () => {
      const result = featureSchema.safeParse({
        name: 'web',
        options: { fetch: false },
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ name: 'web', options: { fetch: false } })
    })

    it('should validate web feature with empty options object', () => {
      const result = featureSchema.safeParse({ name: 'web', options: {} })

      expect(result.success).toBe(true)
    })

    it('should reject web feature with unknown options property (strict)', () => {
      const result = featureSchema.safeParse({
        name: 'web',
        options: { search: true, unknown: 'value' },
      })

      expect(result.success).toBe(false)
    })

    it('should reject web feature with extra top-level properties (strict)', () => {
      const result = featureSchema.safeParse({
        name: 'web',
        extra: 'property',
      })

      expect(result.success).toBe(false)
    })

    it('should reject web feature with non-boolean search', () => {
      const result = featureSchema.safeParse({
        name: 'web',
        options: { search: 'yes' },
      })

      expect(result.success).toBe(false)
    })
  })

  describe('webFeatureOptionsSchema', () => {
    it('should accept empty object', () => {
      expect(webFeatureOptionsSchema.safeParse({}).success).toBe(true)
    })

    it('should accept all valid options', () => {
      expect(
        webFeatureOptionsSchema.safeParse({ search: true, fetch: false })
          .success
      ).toBe(true)
    })

    it('should reject extra properties', () => {
      expect(
        webFeatureOptionsSchema.safeParse({ search: true, extra: 1 }).success
      ).toBe(false)
    })
  })

  describe('compact feature', () => {
    it('should validate compact with tokens threshold', () => {
      const result = featureSchema.safeParse({
        name: 'compact',
        options: { tokens: 1200 },
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        name: 'compact',
        options: { tokens: 1200 },
      })
    })

    it('should validate compact with messages threshold', () => {
      const result = featureSchema.safeParse({
        name: 'compact',
        options: { messages: 10 },
      })

      expect(result.success).toBe(true)
    })

    it('should validate compact with both tokens and messages', () => {
      const result = featureSchema.safeParse({
        name: 'compact',
        options: { tokens: 2000, messages: 20 },
      })

      expect(result.success).toBe(true)
    })

    it('should reject compact without options', () => {
      const result = featureSchema.safeParse({ name: 'compact' })

      expect(result.success).toBe(false)
    })

    it('should reject compact when tokens and messages are both missing', () => {
      const result = featureSchema.safeParse({
        name: 'compact',
        options: {},
      })

      expect(result.success).toBe(false)
    })

    it('should reject compact with zero tokens', () => {
      const result = featureSchema.safeParse({
        name: 'compact',
        options: { tokens: 0 },
      })

      expect(result.success).toBe(false)
    })

    it('should reject compact with negative messages', () => {
      const result = featureSchema.safeParse({
        name: 'compact',
        options: { messages: -1 },
      })

      expect(result.success).toBe(false)
    })

    it('should reject compact with float tokens (must be int)', () => {
      const result = featureSchema.safeParse({
        name: 'compact',
        options: { tokens: 100.5 },
      })

      expect(result.success).toBe(false)
    })

    it('should reject compact with float messages (must be int)', () => {
      const result = featureSchema.safeParse({
        name: 'compact',
        options: { messages: 5.5 },
      })

      expect(result.success).toBe(false)
    })

    it('should reject compact with extra options properties (strict)', () => {
      const result = featureSchema.safeParse({
        name: 'compact',
        options: { tokens: 1000, unknown: true },
      })

      expect(result.success).toBe(false)
    })

    it('should reject compact with extra top-level properties (strict)', () => {
      const result = featureSchema.safeParse({
        name: 'compact',
        options: { tokens: 1000 },
        extra: true,
      })

      expect(result.success).toBe(false)
    })
  })

  describe('compactFeatureOptionsSchema', () => {
    it('should require at least tokens or messages', () => {
      expect(compactFeatureOptionsSchema.safeParse({}).success).toBe(false)
    })

    it('should accept tokens only', () => {
      expect(
        compactFeatureOptionsSchema.safeParse({ tokens: 500 }).success
      ).toBe(true)
    })

    it('should accept messages only', () => {
      expect(
        compactFeatureOptionsSchema.safeParse({ messages: 5 }).success
      ).toBe(true)
    })

    it('should accept both tokens and messages', () => {
      expect(
        compactFeatureOptionsSchema.safeParse({ tokens: 500, messages: 5 })
          .success
      ).toBe(true)
    })
  })

  describe('backstory feature', () => {
    it('should validate backstory feature with extend mode', () => {
      const result = featureSchema.safeParse({
        name: 'backstory',
        options: {
          mode: 'extend',
          text: 'Use a meeting-host persona.',
        },
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        name: 'backstory',
        options: {
          mode: 'extend',
          text: 'Use a meeting-host persona.',
        },
      })
    })

    it('should validate backstory feature with replace mode', () => {
      const result = featureSchema.safeParse({
        name: 'backstory',
        options: {
          mode: 'replace',
          text: 'You are a dedicated meeting assistant.',
        },
      })

      expect(result.success).toBe(true)
    })

    it('should reject backstory feature without options', () => {
      const result = featureSchema.safeParse({
        name: 'backstory',
      })

      expect(result.success).toBe(false)
    })

    it('should reject backstory feature with invalid mode', () => {
      const result = featureSchema.safeParse({
        name: 'backstory',
        options: {
          mode: 'append',
          text: 'Use a meeting-host persona.',
        },
      })

      expect(result.success).toBe(false)
    })

    it('should reject backstory feature with blank text', () => {
      const result = featureSchema.safeParse({
        name: 'backstory',
        options: {
          mode: 'extend',
          text: '   ',
        },
      })

      expect(result.success).toBe(false)
    })

    it('should reject backstory feature with extra options properties', () => {
      const result = featureSchema.safeParse({
        name: 'backstory',
        options: {
          mode: 'extend',
          text: 'Use a meeting-host persona.',
          extra: true,
        },
      })

      expect(result.success).toBe(false)
    })
  })

  describe('notes feature', () => {
    it('should validate notes feature with a single note', () => {
      const result = featureSchema.safeParse({
        name: 'notes',
        options: { notes: ['Stay on topic.'] },
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        name: 'notes',
        options: { notes: ['Stay on topic.'] },
      })
    })

    it('should validate notes feature with multiple notes', () => {
      const result = featureSchema.safeParse({
        name: 'notes',
        options: { notes: ['First note.', 'Second note.'] },
      })

      expect(result.success).toBe(true)
    })

    it('should validate notes feature with an empty notes array', () => {
      const result = featureSchema.safeParse({
        name: 'notes',
        options: { notes: [] },
      })

      expect(result.success).toBe(true)
    })

    it('should trim note entries', () => {
      const result = featureSchema.safeParse({
        name: 'notes',
        options: { notes: ['  padded note  '] },
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        name: 'notes',
        options: { notes: ['padded note'] },
      })
    })

    it('should reject notes without options', () => {
      const result = featureSchema.safeParse({ name: 'notes' })

      expect(result.success).toBe(false)
    })

    it('should reject a blank note entry', () => {
      const result = featureSchema.safeParse({
        name: 'notes',
        options: { notes: ['   '] },
      })

      expect(result.success).toBe(false)
    })

    it('should reject a non-string note entry', () => {
      const result = featureSchema.safeParse({
        name: 'notes',
        options: { notes: [123] },
      })

      expect(result.success).toBe(false)
    })

    it('should reject notes with extra options properties (strict)', () => {
      const result = featureSchema.safeParse({
        name: 'notes',
        options: { notes: ['A note.'], extra: true },
      })

      expect(result.success).toBe(false)
    })

    it('should reject notes with extra top-level properties (strict)', () => {
      const result = featureSchema.safeParse({
        name: 'notes',
        options: { notes: ['A note.'] },
        extra: true,
      })

      expect(result.success).toBe(false)
    })
  })

  describe('skills feature', () => {
    it('should validate skills feature with a single skill', () => {
      const result = featureSchema.safeParse({
        name: 'skills',
        options: {
          skills: [
            {
              name: 'Review',
              description: 'Review the current change',
              path: '/skills/review.md',
            },
          ],
        },
      })

      expect(result.success).toBe(true)
    })

    it('should validate skills feature with multiple skills', () => {
      const result = featureSchema.safeParse({
        name: 'skills',
        options: {
          skills: [
            { name: 'Skill A', description: 'First skill', path: '/a.md' },
            { name: 'Skill B', description: 'Second skill', path: '/b.md' },
          ],
        },
      })

      expect(result.success).toBe(true)
    })

    it('should validate skills feature with empty skills array', () => {
      const result = featureSchema.safeParse({
        name: 'skills',
        options: { skills: [] },
      })

      expect(result.success).toBe(true)
    })

    it('should reject skills without options', () => {
      const result = featureSchema.safeParse({ name: 'skills' })

      expect(result.success).toBe(false)
    })

    it('should reject skills with missing required skill field (path)', () => {
      const result = featureSchema.safeParse({
        name: 'skills',
        options: {
          skills: [{ name: 'Review', description: 'Review the change' }],
        },
      })

      expect(result.success).toBe(false)
    })

    it('should reject skills with missing required skill field (description)', () => {
      const result = featureSchema.safeParse({
        name: 'skills',
        options: {
          skills: [{ name: 'Review', path: '/review.md' }],
        },
      })

      expect(result.success).toBe(false)
    })

    it('should reject skills with extra skill properties (strict)', () => {
      const result = featureSchema.safeParse({
        name: 'skills',
        options: {
          skills: [
            {
              name: 'Review',
              description: 'Review change',
              path: '/review.md',
              extra: true,
            },
          ],
        },
      })

      expect(result.success).toBe(false)
    })

    it('should reject skills with extra options properties (strict)', () => {
      const result = featureSchema.safeParse({
        name: 'skills',
        options: { skills: [], extra: true },
      })

      expect(result.success).toBe(false)
    })

    it('should reject skills with extra top-level properties (strict)', () => {
      const result = featureSchema.safeParse({
        name: 'skills',
        options: { skills: [] },
        extra: true,
      })

      expect(result.success).toBe(false)
    })
  })

  describe('skillsFeatureSkillSchema', () => {
    it('should accept valid skill object', () => {
      expect(
        skillsFeatureSkillSchema.safeParse({
          name: 'Deploy',
          description: 'Deploy the service',
          path: '/skills/deploy.md',
        }).success
      ).toBe(true)
    })

    it('should reject skill with missing name', () => {
      expect(
        skillsFeatureSkillSchema.safeParse({
          description: 'Deploy the service',
          path: '/skills/deploy.md',
        }).success
      ).toBe(false)
    })

    it('should reject skill with extra properties', () => {
      expect(
        skillsFeatureSkillSchema.safeParse({
          name: 'Deploy',
          description: 'Deploy the service',
          path: '/skills/deploy.md',
          weight: 1,
        }).success
      ).toBe(false)
    })
  })

  describe('compactFeatureSchema', () => {
    it('should reject if options is an array', () => {
      const result = compactFeatureSchema.safeParse({
        name: 'compact',
        options: [{ tokens: 100 }],
      })

      expect(result.success).toBe(false)
    })
  })

  describe('webFeatureSchema', () => {
    it('should allow omitting options entirely', () => {
      const result = webFeatureSchema.safeParse({ name: 'web' })

      expect(result.success).toBe(true)
      expect(result.data.options).toBeUndefined()
    })
  })
})
