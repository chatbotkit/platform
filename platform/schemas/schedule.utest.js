import schema from '@/lib/joi.schema'

import schedule from '@/schemas/schedule'

describe('schedule schema', () => {
  it('test 001', async () => {
    const s = schema.object({
      schedule: schedule,
    })

    expect(s.validate({})).toEqual({ value: {} })
    expect(s.validate({ schedule: null })).toEqual({
      value: { schedule: null },
    })
    expect(s.validate({ schedule: 'daily' })).toEqual({
      value: { schedule: 'daily' },
    })
    expect(s.validate({ schedule: 'not-valid' })?.error).toBeDefined()
  })
})
