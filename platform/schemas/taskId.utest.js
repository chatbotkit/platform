import { schema } from '@/lib/joi.handler'

import taskIdSchema from '@/schemas/taskId'

describe('taskIdSchema', () => {
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
        taskId: taskIdSchema('use'),
      })

      await validate(s, {}, {})
      await validate(s, { taskId: null }, { taskId: null })
      await validate(s, { taskId: '' }, { taskId: null })
      await validate(s, { taskId: '  ' }, { taskId: null })
    })
  })
})
