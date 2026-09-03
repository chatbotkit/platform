import { schema } from '@/lib/joi.handler'

import blueprintIdSchema from '@/schemas/blueprintId'

describe('blueprintIdSchema', () => {
  describe('basic validation', () => {
    const validate = async (schema, input, expected) => {
      const response = await schema.validateAsync(input)

      expect(response).toEqual(expected)
    }

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should correctly handle falsy values', async () => {
      const s = schema.object({
        blueprintId: blueprintIdSchema('use'),
      })

      await validate(s, {}, {})
      await validate(s, { blueprintId: null }, { blueprintId: null })
      await validate(s, { blueprintId: '' }, { blueprintId: null })
      await validate(s, { blueprintId: '  ' }, { blueprintId: null })
    })
  })
})
