import notUsed from '@/schemas/notUsed'

describe('notUsed schema', () => {
  it('allows a property to be defined but results in undefined', async () => {
    const data = {
      someProperty: 'value',
    }

    const { error, value } = await notUsed.validateAsync(data)

    expect(error).toBeUndefined()
    expect(value).toBeUndefined()
  })

  it('allows an empty object and results in undefined', async () => {
    const data = {}

    const { error, value } = await notUsed.validateAsync(data)

    expect(error).toBeUndefined()
    expect(value).toBeUndefined()
  })
})
