import functionsSchema from '@/schemas/functionsSchema'

describe('functionsSchema', () => {
  it('must correctly validate', () => {
    expect(
      functionsSchema.validate([
        {
          name: 'name',
          description: 'description',
          parameters: {},
        },
      ]).error
    ).toBeUndefined()

    expect(
      functionsSchema.validate([
        {
          name: 'name',
          description: 'description',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
          },
        },
      ]).error
    ).toBeUndefined()

    expect(
      functionsSchema.validate([
        {
          name: 'name',
          description: 'description',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
            required: ['name'],
          },
        },
      ]).error
    ).toBeUndefined()

    expect(
      functionsSchema.validate([
        {
          name: 'name',
          description: 'description',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
            required: ['name'],
          },
          result: {
            data: '123',
          },
        },
      ]).error
    ).toBeUndefined()
  })

  it('must reject duplicate function names in the same payload', () => {
    expect(
      functionsSchema.validate([
        {
          name: 'duplicate_name',
          description: 'first description',
          parameters: {},
        },
        {
          name: 'duplicate_name',
          description: 'second description',
          parameters: {},
        },
      ]).error
    ).toBeDefined()
  })

  it('must reject empty result object', () => {
    expect(
      functionsSchema.validate([
        {
          name: 'with_empty_result',
          description: 'description',
          parameters: {},
          result: {},
        },
      ]).error
    ).toBeDefined()
  })

  it('must allow result with channel only', () => {
    expect(
      functionsSchema.validate([
        {
          name: 'with_channel_result',
          description: 'description',
          parameters: {},
          result: {
            channel: 'channel-id',
          },
        },
      ]).error
    ).toBeUndefined()
  })

  it('must allow result with data only', () => {
    expect(
      functionsSchema.validate([
        {
          name: 'with_data_result',
          description: 'description',
          parameters: {},
          result: {
            data: { ok: true },
          },
        },
      ]).error
    ).toBeUndefined()
  })
})

describe('functionsSchema name validation', () => {
  const validateName = (name) =>
    functionsSchema.validate([
      {
        name,
        description: 'desc',
        parameters: {},
      },
    ])

  const validNames = [
    'a',
    'A',
    'name',
    'Name',
    'name123',
    'A1',
    '$',
    '$dollar',
    '$name',
    'a_b',
    'A_B',
    'a_b1',
    'a$b',
    'A$B',
    'a_b$1',
  ]

  const invalidNames = [
    '', // empty
    '_private', // starts with underscore
    '1start', // starts with digit
    'na-me', // hyphen not allowed
    'name-hyphen',
    'name.dot', // dot not allowed
    'name!', // punctuation
    'name?',
    'na me', // internal space
    ' name', // leading space now invalid (no trim)
    'name ', // trailing space now invalid (no trim)
  ]

  it.each(validNames)('accepts valid name %s', (name) => {
    const { error } = validateName(name)

    expect(error).toBeUndefined()
  })

  it.each(invalidNames)('rejects invalid name %s', (name) => {
    const { error } = validateName(name)

    expect(error).toBeDefined()

    if (name === '') {
      expect(error?.details?.[0]?.message).toMatch(/not allowed to be empty/)
    } else {
      expect(error?.details?.[0]?.message).toMatch(
        /Name must be a valid JS function identifier/
      )
    }
  })

  it('rejects name starting with underscore even if rest valid', () => {
    const { error } = validateName('_validAfter')

    expect(error).toBeDefined()
    expect(error?.details?.[0]?.message).toMatch(
      /Name must be a valid JS function identifier/
    )
  })

  it('accepts complex mixed allowed characters sequence', () => {
    const { error } = validateName('$Name_123$')

    expect(error).toBeUndefined()
  })

  it('accepts a 64 character max length name', () => {
    const sixtyFour = 'a' + 'A'.repeat(63) // total length 64, starts with letter
    const { error } = validateName(sixtyFour)

    expect(sixtyFour.length).toBe(64)
    expect(error).toBeUndefined()
  })

  it('rejects a 65 character name', () => {
    const sixtyFive = 'a' + 'A'.repeat(64) // total length 65
    const { error } = validateName(sixtyFive)

    expect(sixtyFive.length).toBe(65)
    expect(error).toBeDefined()
    expect(error?.details?.[0]?.message).toMatch(/at most 64 characters/)
  })
})
