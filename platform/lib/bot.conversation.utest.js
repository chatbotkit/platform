import {
  getConversationDetails,
  getConversationDetailsField,
  getConversationDetailsFieldWithReversedPrecedence,
  getConversationDetailsWithReversedPrecedence,
} from '@/lib/bot.conversation'

describe('getConversationDetails', () => {
  test('returns botId only when bot has an id - discards all other top-level fields', () => {
    const details = {
      backstory: 'My backstory',
      model: 'gpt-4',
      datasetId: 'ds-1',
      skillsetId: 'sk-1',
      privacy: true,
      moderation: true,
      bot: { id: 'bot-1', model: 'gpt-3' },
    }

    const result = getConversationDetails(details)

    expect(result).toEqual({ botId: 'bot-1' })
    expect(result).not.toHaveProperty('backstory')
    expect(result).not.toHaveProperty('model')
    expect(result).not.toHaveProperty('datasetId')
  })

  test('returns top-level fields when bot has no id', () => {
    const details = {
      backstory: 'My backstory',
      model: 'gpt-4',
      datasetId: 'ds-1',
      skillsetId: 'sk-1',
      privacy: true,
      moderation: false,
      bot: { model: 'gpt-3' }, // bot without id
    }

    const result = getConversationDetails(details)

    expect(result).toEqual({
      backstory: 'My backstory',
      model: 'gpt-4',
      datasetId: 'ds-1',
      skillsetId: 'sk-1',
      privacy: true,
      moderation: false,
    })
    expect(result).not.toHaveProperty('botId')
  })

  test('returns top-level fields when no bot is provided', () => {
    const details = {
      backstory: 'Backstory text',
      model: 'claude-3',
    }

    const result = getConversationDetails(details)

    expect(result).toEqual({
      backstory: 'Backstory text',
      model: 'claude-3',
      datasetId: undefined,
      skillsetId: undefined,
      privacy: undefined,
      moderation: undefined,
    })
  })

  test('excludes null top-level fields when bot has no id (null becomes undefined)', () => {
    const details = {
      backstory: null,
      model: 'gpt-4',
      datasetId: null,
    }

    const result = getConversationDetails(details)

    // @note null values are coerced to undefined via ?? operator
    expect(result.backstory).toBeUndefined()
    expect(result.model).toBe('gpt-4')
    expect(result.datasetId).toBeUndefined()
  })

  test('returns botId only when bot.id is present even if top-level fields are also null', () => {
    const details = {
      backstory: null,
      model: null,
      bot: { id: 'bot-2' },
    }

    const result = getConversationDetails(details)

    expect(result).toEqual({ botId: 'bot-2' })
  })
})

describe('getConversationDetailsWithReversedPrecedence', () => {
  test('top-level fields take precedence over bot fields', () => {
    const details = {
      backstory: 'direct backstory',
      model: 'gpt-4',
      bot: { id: 'bot-1', backstory: 'bot backstory', model: 'gpt-3' },
    }

    const result = getConversationDetailsWithReversedPrecedence(details)

    expect(result.backstory).toBe('direct backstory')
    expect(result.model).toBe('gpt-4')
  })

  test('falls back to bot field when top-level field is null', () => {
    const details = {
      backstory: null,
      model: null,
      bot: { id: 'bot-1', backstory: 'bot backstory', model: 'gpt-3' },
    }

    const result = getConversationDetailsWithReversedPrecedence(details)

    // @note null falls through ?? to use bot values
    expect(result.backstory).toBe('bot backstory')
    expect(result.model).toBe('gpt-3')
  })

  test('does NOT fall back to bot when top-level is false (falsy non-null)', () => {
    const details = {
      privacy: false,
      moderation: false,
      bot: { id: 'bot-1', privacy: true, moderation: true },
    }

    const result = getConversationDetailsWithReversedPrecedence(details)

    // @note false is falsy but not null/undefined, so ?? does NOT fall through
    expect(result.privacy).toBe(false)
    expect(result.moderation).toBe(false)
  })

  test('returns undefined when both top-level and bot fields are null', () => {
    const details = {
      backstory: null,
      model: null,
      bot: { id: 'bot-1', backstory: null, model: null },
    }

    const result = getConversationDetailsWithReversedPrecedence(details)

    expect(result.backstory).toBeUndefined()
    expect(result.model).toBeUndefined()
  })

  test('uses bot fields when no top-level fields provided', () => {
    const details = {
      bot: {
        id: 'bot-1',
        backstory: 'bot backstory',
        model: 'claude-3',
        datasetId: 'ds-1',
      },
    }

    const result = getConversationDetailsWithReversedPrecedence(details)

    expect(result.backstory).toBe('bot backstory')
    expect(result.model).toBe('claude-3')
    expect(result.datasetId).toBe('ds-1')
  })

  test('does not include botId - returns field values directly', () => {
    const details = {
      model: 'gpt-4',
      bot: { id: 'bot-1', model: 'gpt-3' },
    }

    const result = getConversationDetailsWithReversedPrecedence(details)

    // @note reversed precedence does not return botId - only field values
    expect(result).not.toHaveProperty('botId')
  })
})

describe('getConversationDetailsFieldWithReversedPrecedence', () => {
  test('returns top-level field when both top-level and bot field are present', () => {
    const details = { model: 'gpt-4', bot: { id: 'bot-1', model: 'gpt-3' } }

    const result = getConversationDetailsFieldWithReversedPrecedence(
      details,
      'model'
    )

    expect(result).toBe('gpt-4')
  })

  test('falls back to bot field when top-level field is null', () => {
    const details = { model: null, bot: { id: 'bot-1', model: 'gpt-3' } }

    const result = getConversationDetailsFieldWithReversedPrecedence(
      details,
      'model'
    )

    expect(result).toBe('gpt-3')
  })

  test('returns defaultValue when both top-level and bot field are null', () => {
    const details = { model: null, bot: { id: 'bot-1', model: null } }

    const result = getConversationDetailsFieldWithReversedPrecedence(
      details,
      'model',
      'default-model'
    )

    expect(result).toBe('default-model')
  })

  test('maps botId field to bot.id', () => {
    const details = { bot: { id: 'bot-1' } }

    const result = getConversationDetailsFieldWithReversedPrecedence(
      details,
      'botId'
    )

    // @note 'botId' is a special case that maps to bot.id
    expect(result).toBe('bot-1')
  })

  test('returns null as default when no value and no defaultValue provided', () => {
    const details = {}

    const result = getConversationDetailsFieldWithReversedPrecedence(
      details,
      'model'
    )

    expect(result).toBeNull()
  })
})

describe('getConversationDetailsField', () => {
  test('returns the specified field from the bot object if not "backstory"', () => {
    const details = { bot: { model: 'ModelA' } }

    const result = getConversationDetailsField(details, 'model')

    expect(result).toBe('ModelA')
  })

  test('returns the field from details if bot is not present', () => {
    const details = { privacy: 'private' }

    const result = getConversationDetailsField(details, 'privacy')

    expect(result).toBe('private')
  })

  test('returns default value if field is not present in bot and details', () => {
    const details = { bot: {} }
    const defaultValue = 'defaultValue'

    const result = getConversationDetailsField(
      details,
      'nonExistentField',
      defaultValue
    )

    expect(result).toBe(defaultValue)
  })

  test('returns default value if bot is null', () => {
    const details = { bot: null }
    const defaultValue = 'defaultValue'

    const result = getConversationDetailsField(details, 'model', defaultValue)

    expect(result).toBe(defaultValue)
  })

  test('returns default value if bot is present but field is undefined', () => {
    const details = { bot: { model: undefined } }
    const defaultValue = 'defaultModel'

    const result = getConversationDetailsField(details, 'model', defaultValue)

    expect(result).toBe(defaultValue)
  })
})
