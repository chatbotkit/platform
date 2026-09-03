import {
  getActivityArgumentsAndResult,
  getActivityMessageResult,
  groupActivityMessages,
  isPairedActivityMessage,
  isTheSameActivityMessage,
  makeActivityMessagePair,
  makeRequestActivityMessage,
  makeResponseActivityMessage,
  makeTriggerActivityMessage,
} from '@/lib/activity'

describe('isTheSameActivityMessage', () => {
  test('returns false if either message is not an activity message', () => {
    const nonActivityMessage = { type: 'not-activity' }

    const activityMessage = makeRequestActivityMessage('functionName', {
      arg1: 'value1',
    })

    expect(isTheSameActivityMessage(nonActivityMessage, activityMessage)).toBe(
      false
    )
    expect(isTheSameActivityMessage(activityMessage, nonActivityMessage)).toBe(
      false
    )
    expect(
      isTheSameActivityMessage(nonActivityMessage, nonActivityMessage)
    ).toBe(false)
  })

  test('returns false if either message has no activity in meta', () => {
    const activityMessageWithoutActivity = { type: 'activity', meta: {} }

    const requestMessage = makeRequestActivityMessage('functionName', {
      arg1: 'value1',
    })

    expect(
      isTheSameActivityMessage(activityMessageWithoutActivity, requestMessage)
    ).toBe(false)
    expect(
      isTheSameActivityMessage(requestMessage, activityMessageWithoutActivity)
    ).toBe(false)
  })

  test('return true if both messages are the same activity message', () => {
    const requestMessage = makeRequestActivityMessage('functionName', {
      arg1: 'value1',
    })

    expect(isTheSameActivityMessage(requestMessage, requestMessage)).toBe(true)
  })

  test('return true if both messages are the same activity message with different references', () => {
    const requestMessage1 = makeRequestActivityMessage('functionName', {
      arg1: 'value1',
    })

    const requestMessage2 = makeRequestActivityMessage('functionName', {
      arg1: 'value1',
    })

    expect(isTheSameActivityMessage(requestMessage1, requestMessage2)).toBe(
      true
    )
  })

  test('return true if both messages are activity response messages with same function name and arguments', () => {
    const args = { arg1: 'value1', arg2: 'value2' }

    const responseMessage1 = makeResponseActivityMessage(
      'functionName',
      args,
      'result'
    )

    const responseMessage2 = makeResponseActivityMessage(
      'functionName',
      args,
      'result'
    )

    expect(isTheSameActivityMessage(responseMessage1, responseMessage2)).toBe(
      true
    )
  })

  test('return false if function names are different', () => {
    const requestMessage = makeRequestActivityMessage('functionName1', {
      arg1: 'value1',
    })

    const responseMessage = makeResponseActivityMessage(
      'functionName2',
      { arg1: 'value1' },
      'result'
    )

    expect(isTheSameActivityMessage(requestMessage, responseMessage)).toBe(
      false
    )
    expect(isTheSameActivityMessage(responseMessage, requestMessage)).toBe(
      false
    )
  })

  test('return false if both messages of a different kind', () => {
    const requestMessage = makeRequestActivityMessage('functionName', {
      arg1: 'value1',
    })

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      { arg1: 'different' },
      'result'
    )

    expect(isTheSameActivityMessage(requestMessage, responseMessage)).toBe(
      false
    )
  })

  test('return false if messages are of different activity types', () => {
    const requestMessage = makeRequestActivityMessage('functionName', {
      arg1: 'value1',
    })

    const triggerMessage = makeTriggerActivityMessage('functionName')

    expect(isTheSameActivityMessage(requestMessage, triggerMessage)).toBe(false)
    expect(isTheSameActivityMessage(triggerMessage, requestMessage)).toBe(false)
  })
})

describe('isPairedActivityMessage', () => {
  test('returns false if either message is not an activity message', () => {
    const nonActivityMessage = { type: 'not-activity' }

    const requestMessage = makeRequestActivityMessage('functionName', {
      arg1: 'value1',
    })

    expect(isPairedActivityMessage(nonActivityMessage, requestMessage)).toBe(
      false
    )
    expect(isPairedActivityMessage(requestMessage, nonActivityMessage)).toBe(
      false
    )
    expect(
      isPairedActivityMessage(nonActivityMessage, nonActivityMessage)
    ).toBe(false)
  })

  test('returns false if either message has no activity in meta', () => {
    const activityMessageWithoutActivity = { type: 'activity', meta: {} }

    const requestMessage = makeRequestActivityMessage('functionName', {
      arg1: 'value1',
    })

    expect(
      isPairedActivityMessage(activityMessageWithoutActivity, requestMessage)
    ).toBe(false)
    expect(
      isPairedActivityMessage(requestMessage, activityMessageWithoutActivity)
    ).toBe(false)
  })

  test('returns false if both activities have the same type', () => {
    const requestMessage1 = makeRequestActivityMessage('functionName', {
      arg1: 'value1',
    })

    const requestMessage2 = makeRequestActivityMessage('functionName', {
      arg1: 'value1',
    })

    const responseMessage1 = makeResponseActivityMessage(
      'functionName',
      { arg1: 'value1' },
      'result'
    )

    const responseMessage2 = makeResponseActivityMessage(
      'functionName',
      { arg1: 'value1' },
      'result'
    )

    expect(isPairedActivityMessage(requestMessage1, requestMessage2)).toBe(
      false
    )
    expect(isPairedActivityMessage(responseMessage1, responseMessage2)).toBe(
      false
    )
  })

  test('returns false if either activity is not request or response type', () => {
    const triggerMessage = makeTriggerActivityMessage('functionName')

    const requestMessage = makeRequestActivityMessage('functionName', {
      arg1: 'value1',
    })

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      { arg1: 'value1' },
      'result'
    )

    expect(isPairedActivityMessage(triggerMessage, requestMessage)).toBe(false)
    expect(isPairedActivityMessage(triggerMessage, responseMessage)).toBe(false)
    expect(isPairedActivityMessage(requestMessage, triggerMessage)).toBe(false)
    expect(isPairedActivityMessage(responseMessage, triggerMessage)).toBe(false)
  })

  test('returns false if function names are different', () => {
    const requestMessage = makeRequestActivityMessage('functionName1', {
      arg1: 'value1',
    })

    const responseMessage = makeResponseActivityMessage(
      'functionName2',
      { arg1: 'value1' },
      'result'
    )

    expect(isPairedActivityMessage(requestMessage, responseMessage)).toBe(false)
    expect(isPairedActivityMessage(responseMessage, requestMessage)).toBe(false)
  })

  test('returns true for matching request and response activities with same arguments', () => {
    const args = { arg1: 'value1', arg2: 'value2' }
    const requestMessage = makeRequestActivityMessage('functionName', args)

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      args,
      'result'
    )

    expect(isPairedActivityMessage(requestMessage, responseMessage)).toBe(true)
    expect(isPairedActivityMessage(responseMessage, requestMessage)).toBe(true)
  })

  test('returns true when arguments are equal objects but not the same reference', () => {
    const requestMessage = makeRequestActivityMessage('functionName', {
      arg1: 'value1',
      nested: { prop: true },
    })

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      { arg1: 'value1', nested: { prop: true } },
      'result'
    )

    expect(isPairedActivityMessage(requestMessage, responseMessage)).toBe(true)
  })

  test('returns true when arguments are parsable YAML strings with equivalent content', () => {
    const requestMessage = makeRequestActivityMessage(
      'functionName',
      'arg1: value1\nnested:\n  prop: true'
    )

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      'arg1: value1\nnested:\n  prop: true',
      'result'
    )

    expect(isPairedActivityMessage(requestMessage, responseMessage)).toBe(true)
  })

  test('returns false when arguments are different objects', () => {
    const requestMessage = makeRequestActivityMessage('functionName', {
      arg1: 'value1',
    })

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      { arg1: 'different' },
      'result'
    )

    expect(isPairedActivityMessage(requestMessage, responseMessage)).toBe(false)
  })

  test('returns false when arguments are different YAML strings', () => {
    const requestMessage = makeRequestActivityMessage(
      'functionName',
      'arg1: value1'
    )

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      'arg1: different',
      'result'
    )

    expect(isPairedActivityMessage(requestMessage, responseMessage)).toBe(false)
  })

  test('handles undefined arguments correctly', () => {
    const requestMessage = makeRequestActivityMessage('functionName', undefined)

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      undefined,
      'result'
    )

    expect(isPairedActivityMessage(requestMessage, responseMessage)).toBe(true)
  })

  test('handles null arguments correctly', () => {
    const requestMessage = makeRequestActivityMessage('functionName', null)

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      null,
      'result'
    )

    expect(isPairedActivityMessage(requestMessage, responseMessage)).toBe(true)
  })

  test('handles empty arguments correctly', () => {
    const requestMessage = makeRequestActivityMessage('functionName', {})

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      {},
      'result'
    )

    expect(isPairedActivityMessage(requestMessage, responseMessage)).toBe(true)
  })

  test('handles empty string arguments correctly', () => {
    const requestMessage = makeRequestActivityMessage('functionName', '')

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      '',
      'result'
    )

    expect(isPairedActivityMessage(requestMessage, responseMessage)).toBe(true)
  })

  test('compares array arguments correctly', () => {
    const requestMessage = makeRequestActivityMessage('functionName', [1, 2, 3])

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      [1, 2, 3],
      'result'
    )

    const differentResponseMessage = makeResponseActivityMessage(
      'functionName',
      [1, 2, 4],
      'result'
    )

    expect(isPairedActivityMessage(requestMessage, responseMessage)).toBe(true)
    expect(
      isPairedActivityMessage(requestMessage, differentResponseMessage)
    ).toBe(false)
  })

  test('handles YAML strings with different whitespace but same content', () => {
    const requestMessage = makeRequestActivityMessage(
      'functionName',
      'arg1: value1\nnested:\n  prop: true'
    )

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      'arg1: value1\nnested:\n    prop: true',
      'result'
    )

    expect(isPairedActivityMessage(requestMessage, responseMessage)).toBe(true)
  })

  test('handles YAML strings with properties in different order', () => {
    const requestMessage = makeRequestActivityMessage(
      'functionName',
      'arg1: value1\narg2: value2'
    )

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      'arg2: value2\narg1: value1',
      'result'
    )

    expect(isPairedActivityMessage(requestMessage, responseMessage)).toBe(true)
  })
})

describe('getActivityMessageResult', () => {
  test('returns null for non-activity messages', () => {
    const nonActivityMessage = { type: 'not-activity' }

    expect(getActivityMessageResult(nonActivityMessage)).toBe(null)
  })

  test('returns null for activity messages without meta', () => {
    const messageWithoutMeta = { type: 'activity' }

    expect(getActivityMessageResult(messageWithoutMeta)).toBe(null)
  })

  test('returns null for activity messages without activity in meta', () => {
    const messageWithoutActivity = { type: 'activity', meta: {} }

    expect(getActivityMessageResult(messageWithoutActivity)).toBe(null)
  })

  test('returns null for activity messages without result in function', () => {
    const requestMessage = makeRequestActivityMessage('functionName', {
      arg1: 'value1',
    })

    expect(getActivityMessageResult(requestMessage)).toBe(null)
  })

  test('returns object result directly for object results', () => {
    const result = { key: 'value', nested: { prop: true } }

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      { arg1: 'value1' },
      result
    )

    expect(getActivityMessageResult(responseMessage)).toEqual(result)
    expect(getActivityMessageResult(responseMessage)).toBe(result)
  })

  test('returns null object result directly', () => {
    const responseMessage = makeResponseActivityMessage(
      'functionName',
      { arg1: 'value1' },
      null
    )

    expect(getActivityMessageResult(responseMessage)).toBe(null)
  })

  test('returns array result directly for array results', () => {
    const result = [1, 2, { key: 'value' }]

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      { arg1: 'value1' },
      result
    )

    expect(getActivityMessageResult(responseMessage)).toEqual(result)
    expect(getActivityMessageResult(responseMessage)).toBe(result)
  })

  test('parses YAML string results when possible', () => {
    const yamlResult = 'key: value\nnested:\n  prop: true'
    const expectedParsed = { key: 'value', nested: { prop: true } }

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      { arg1: 'value1' },
      yamlResult
    )

    expect(getActivityMessageResult(responseMessage)).toEqual(expectedParsed)
  })

  test('returns original string for non-parsable string results', () => {
    const stringResult = 'plain text result'

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      { arg1: 'value1' },
      stringResult
    )

    expect(getActivityMessageResult(responseMessage)).toBe(stringResult)
  })

  test('returns empty string result directly', () => {
    const responseMessage = makeResponseActivityMessage(
      'functionName',
      { arg1: 'value1' },
      ''
    )

    expect(getActivityMessageResult(responseMessage)).toBe('')
  })

  test('returns number results directly', () => {
    const numberResult = 42

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      { arg1: 'value1' },
      numberResult
    )

    expect(getActivityMessageResult(responseMessage)).toBe(numberResult)
  })

  test('returns boolean results directly', () => {
    const booleanResult = true

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      { arg1: 'value1' },
      booleanResult
    )

    expect(getActivityMessageResult(responseMessage)).toBe(booleanResult)

    const falseResult = false

    const falseMessage = makeResponseActivityMessage(
      'functionName',
      { arg1: 'value1' },
      falseResult
    )

    expect(getActivityMessageResult(falseMessage)).toBe(falseResult)
  })

  test('returns undefined results directly', () => {
    const responseMessage = makeResponseActivityMessage(
      'functionName',
      { arg1: 'value1' },
      undefined
    )

    expect(getActivityMessageResult(responseMessage)).toBe(undefined)
  })

  test('handles complex YAML string results', () => {
    const complexYaml = `
      users:
        - name: John
          age: 30
          active: true
        - name: Jane
          age: 25
          active: false
      config:
        timeout: 5000
        retries: 3
    `

    const expectedParsed = {
      users: [
        { name: 'John', age: 30, active: true },
        { name: 'Jane', age: 25, active: false },
      ],
      config: { timeout: 5000, retries: 3 },
    }

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      { arg1: 'value1' },
      complexYaml
    )

    expect(getActivityMessageResult(responseMessage)).toEqual(expectedParsed)
  })

  test('handles JSON-like YAML string results', () => {
    const jsonLikeYaml = '{"key": "value", "number": 123, "boolean": true}'
    const expectedParsed = { key: 'value', number: 123, boolean: true }

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      { arg1: 'value1' },
      jsonLikeYaml
    )

    expect(getActivityMessageResult(responseMessage)).toEqual(expectedParsed)
  })

  test('handles key: value pair', () => {
    const yamlString = 'key: value'
    const expectedParsed = { key: 'value' }

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      { arg1: 'value1' },
      yamlString
    )

    expect(getActivityMessageResult(responseMessage)).toEqual(expectedParsed)
  })

  test('preserves nested object structure in results', () => {
    const nestedResult = {
      level1: {
        level2: {
          level3: {
            value: 'deep',
            array: [1, 2, 3],
          },
        },
      },
    }

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      { arg1: 'value1' },
      nestedResult
    )

    expect(getActivityMessageResult(responseMessage)).toEqual(nestedResult)
    expect(
      getActivityMessageResult(responseMessage).level1.level2.level3.value
    ).toBe('deep')
  })

  test('handles broken json', () => {
    const brokenJson = '{"key": "value", "number": 123, "boolean": true'
    const expectedParsed = { key: 'value', number: 123, boolean: true }

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      { arg1: 'value1' },
      brokenJson
    )

    expect(getActivityMessageResult(responseMessage)).toEqual(expectedParsed)
  })
})

describe('getActivityArgumentsAndResult', () => {
  test('returns null values for malformed activity without function details', () => {
    expect(
      getActivityArgumentsAndResult({
        type: 'request-response',
      })
    ).toEqual({
      arguments: null,
      result: null,
    })
  })
})

describe('groupActivityMessages', () => {
  test('returns empty array for empty input', () => {
    expect(groupActivityMessages([])).toEqual([])
  })

  test('preserves non-activity messages unchanged', () => {
    const messages = [
      { type: 'user', text: 'hello' },
      { type: 'bot', text: 'hi there' },
      { type: 'context', text: 'some context' },
    ]

    expect(groupActivityMessages(messages)).toEqual(messages)
  })

  test('preserves trigger activity messages unchanged', () => {
    const triggerMessage = makeTriggerActivityMessage('functionName')
    const messages = [triggerMessage]

    const result = groupActivityMessages(messages)

    expect(result).toHaveLength(1)
    expect(result[0].meta.activity.type).toBe('trigger')
  })

  test('preserves unpaired request activity messages', () => {
    const requestMessage = makeRequestActivityMessage('functionName', {
      arg1: 'value1',
    })

    const messages = [requestMessage]

    const result = groupActivityMessages(messages)

    expect(result).toHaveLength(1)
    expect(result[0].meta.activity.type).toBe('request')
  })

  test('preserves unpaired response activity messages', () => {
    const responseMessage = makeResponseActivityMessage(
      'functionName',
      { arg1: 'value1' },
      'result'
    )

    const messages = [responseMessage]

    const result = groupActivityMessages(messages)

    expect(result).toHaveLength(1)
    expect(result[0].meta.activity.type).toBe('response')
  })

  test('groups paired request and response into combined activity', () => {
    const args = { arg1: 'value1' }

    const requestMessage = makeRequestActivityMessage('functionName', args)

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      args,
      'the result'
    )

    const messages = [requestMessage, responseMessage]

    const result = groupActivityMessages(messages)

    expect(result).toHaveLength(1)
    expect(result[0].meta.activity.type).toBe('request-response')
    expect(result[0].meta.activity.function.name).toBe('functionName')
    expect(result[0].meta.activity.function.arguments).toEqual(args)
    expect(result[0].meta.activity.function.result).toBe('the result')
  })

  test('handles mixed message types with grouped activities', () => {
    const args = { query: 'test' }

    const messages = [
      { type: 'user', text: 'search for something' },
      makeRequestActivityMessage('search', args),
      makeResponseActivityMessage('search', args, { results: [] }),
      { type: 'bot', text: 'here are the results' },
    ]

    const result = groupActivityMessages(messages)

    expect(result).toHaveLength(3)
    expect(result[0].type).toBe('user')
    expect(result[1].meta.activity.type).toBe('request-response')
    expect(result[2].type).toBe('bot')
  })

  test('handles multiple paired activities', () => {
    const args1 = { query: 'first' }
    const args2 = { query: 'second' }

    const messages = [
      makeRequestActivityMessage('search', args1),
      makeResponseActivityMessage('search', args1, 'result1'),
      makeRequestActivityMessage('search', args2),
      makeResponseActivityMessage('search', args2, 'result2'),
    ]

    const result = groupActivityMessages(messages)

    expect(result).toHaveLength(2)
    expect(result[0].meta.activity.type).toBe('request-response')
    expect(result[0].meta.activity.function.arguments).toEqual(args1)
    expect(result[0].meta.activity.function.result).toBe('result1')
    expect(result[1].meta.activity.type).toBe('request-response')
    expect(result[1].meta.activity.function.arguments).toEqual(args2)
    expect(result[1].meta.activity.function.result).toBe('result2')
  })

  test('does not group activities with different function names', () => {
    const args = { arg1: 'value1' }

    const requestMessage = makeRequestActivityMessage('function1', args)

    const responseMessage = makeResponseActivityMessage(
      'function2',
      args,
      'result'
    )

    const messages = [requestMessage, responseMessage]

    const result = groupActivityMessages(messages)

    expect(result).toHaveLength(2)
    expect(result[0].meta.activity.type).toBe('request')
    expect(result[1].meta.activity.type).toBe('response')
  })

  test('does not group activities with different arguments', () => {
    const requestMessage = makeRequestActivityMessage('functionName', {
      arg1: 'value1',
    })

    const responseMessage = makeResponseActivityMessage(
      'functionName',
      { arg1: 'different' },
      'result'
    )

    const messages = [requestMessage, responseMessage]

    const result = groupActivityMessages(messages)

    expect(result).toHaveLength(2)
    expect(result[0].meta.activity.type).toBe('request')
    expect(result[1].meta.activity.type).toBe('response')
  })

  test('handles interleaved non-activity messages between pairs', () => {
    const args = { query: 'test' }

    const messages = [
      makeRequestActivityMessage('search', args),
      { type: 'context', text: 'some context' },
      makeResponseActivityMessage('search', args, 'result'),
    ]

    const result = groupActivityMessages(messages)

    expect(result).toHaveLength(2)
    expect(result[0].meta.activity.type).toBe('request-response')
    expect(result[1].type).toBe('context')
  })

  test('correctly pairs when response comes after multiple requests', () => {
    const args1 = { query: 'first' }
    const args2 = { query: 'second' }

    const messages = [
      makeRequestActivityMessage('search', args1),
      makeRequestActivityMessage('search', args2),
      makeResponseActivityMessage('search', args1, 'result1'),
      makeResponseActivityMessage('search', args2, 'result2'),
    ]

    const result = groupActivityMessages(messages)

    expect(result).toHaveLength(2)
    expect(result[0].meta.activity.function.arguments).toEqual(args1)
    expect(result[0].meta.activity.function.result).toBe('result1')
    expect(result[1].meta.activity.function.arguments).toEqual(args2)
    expect(result[1].meta.activity.function.result).toBe('result2')
  })

  test('preserves original message properties in grouped activity', () => {
    const args = { query: 'test' }

    const requestMessage = {
      ...makeRequestActivityMessage('search', args),
      id: 'request-123',
      createdAt: '2024-01-01T00:00:00Z',
    }

    const responseMessage = {
      ...makeResponseActivityMessage('search', args, 'result'),
      id: 'response-456',
      createdAt: '2024-01-01T00:00:01Z',
    }

    const messages = [requestMessage, responseMessage]

    const result = groupActivityMessages(messages)

    expect(result).toHaveLength(1)
    // @note should preserve the request message's id as the base
    expect(result[0].id).toBe('request-123')
    expect(result[0].createdAt).toBe('2024-01-01T00:00:00Z')
  })
})

describe('makeRequestActivityMessage', () => {
  test('creates a valid request activity message', () => {
    const functionName = 'testFunction'
    const args = { param1: 'value1', param2: 42 }

    const message = makeRequestActivityMessage(functionName, args)

    expect(message.type).toBe('activity')
    expect(message.meta).toBeDefined()
    expect(message.meta.activity).toBeDefined()
    expect(message.meta.activity.type).toBe('request')
    expect(message.meta.activity.function).toBeDefined()
    expect(message.meta.activity.function.name).toBe(functionName)
    expect(message.meta.activity.function.arguments).toEqual(args)
  })

  test('preserve leading _ in function name', () => {
    const functionName = '_privateFunction'
    const args = { param: 'value' }

    const message = makeRequestActivityMessage(functionName, args)

    expect(message.meta.activity.function.name).toBe(functionName)
  })

  test('sets text from justification when arguments is an object', () => {
    const functionName = 'testFunction'
    const args = {
      input: 'London',
      justification: 'Need current weather to answer the user request.',
    }

    const message = makeRequestActivityMessage(functionName, args)

    expect(message.text).toBe(
      'Need current weather to answer the user request.'
    )
  })

  test('strips top-level synthetic justification from stored object arguments', () => {
    const functionName = 'testFunction'
    const args = {
      input: {
        city: 'London',
        justification: 'Ability-defined nested justification',
      },
      justification: 'Need current weather to answer the user request.',
    }

    const message = makeRequestActivityMessage(functionName, args)

    expect(message.text).toBe(
      'Need current weather to answer the user request.'
    )
    expect(message.meta.activity.function.arguments).toEqual({
      input: {
        city: 'London',
        justification: 'Ability-defined nested justification',
      },
    })
  })

  test('sets text from justification when arguments is a JSON string', () => {
    const functionName = 'testFunction'
    const args = JSON.stringify({
      input: 'London',
      justification: 'Need current weather to answer the user request.',
    })

    const message = makeRequestActivityMessage(functionName, args)

    expect(message.text).toBe(
      'Need current weather to answer the user request.'
    )
  })

  test('strips top-level synthetic justification from stored string arguments', () => {
    const functionName = 'testFunction'
    const args = JSON.stringify({
      input: {
        city: 'London',
        justification: 'Ability-defined nested justification',
      },
      justification: 'Need current weather to answer the user request.',
    })

    const message = makeRequestActivityMessage(functionName, args)

    expect(message.text).toBe(
      'Need current weather to answer the user request.'
    )
    expect(message.meta.activity.function.arguments).toBe(
      JSON.stringify({
        input: {
          city: 'London',
          justification: 'Ability-defined nested justification',
        },
      })
    )
  })

  test('preserves justification-only arguments for internal activities', () => {
    const functionName = '_emptyDetected'
    const args = {
      justification: 'Last message was empty',
    }

    const message = makeRequestActivityMessage(functionName, args)

    expect(message.text).toBe('Last message was empty')
    expect(message.meta.activity.function.arguments).toEqual(args)
  })
})

describe('makeResponseActivityMessage', () => {
  test('creates a valid response activity message', () => {
    const functionName = 'testFunction'
    const args = { param1: 'value1', param2: 42 }
    const result = { success: true, data: [1, 2, 3] }

    const message = makeResponseActivityMessage(functionName, args, result)

    expect(message.type).toBe('activity')
    expect(message.meta).toBeDefined()
    expect(message.meta.activity).toBeDefined()
    expect(message.meta.activity.type).toBe('response')
    expect(message.meta.activity.function).toBeDefined()
    expect(message.meta.activity.function.name).toBe(functionName)
    expect(message.meta.activity.function.arguments).toEqual(args)
    expect(message.meta.activity.function.result).toBe(result)
  })

  test('preserve leading _ in function name', () => {
    const functionName = '_privateFunction'
    const args = { param: 'value' }
    const result = 'some result'

    const message = makeResponseActivityMessage(functionName, args, result)

    expect(message.meta.activity.function.name).toBe(functionName)
  })

  test('strips top-level synthetic justification from stored response arguments', () => {
    const functionName = 'testFunction'
    const args = {
      input: {
        city: 'London',
        justification: 'Ability-defined nested justification',
      },
      justification: 'Need current weather to answer the user request.',
    }
    const result = { success: true }

    const message = makeResponseActivityMessage(functionName, args, result)

    expect(message.meta.activity.function.arguments).toEqual({
      input: {
        city: 'London',
        justification: 'Ability-defined nested justification',
      },
    })
  })
})

describe('makeActivityMessagePair', () => {
  test('creates a valid request-response activity message pair', () => {
    const functionName = 'testFunction'
    const args = { param1: 'value1', param2: 42 }
    const result = { success: true, data: [1, 2, 3] }

    const [request, response] = makeActivityMessagePair(
      functionName,
      args,
      result
    )

    expect(request.type).toBe('activity')
    expect(request.meta.activity.type).toBe('request')
    expect(request.meta.activity.function.name).toBe(functionName)
    expect(request.meta.activity.function.arguments).toEqual(args)

    expect(response.type).toBe('activity')
    expect(response.meta.activity.type).toBe('response')
    expect(response.meta.activity.function.name).toBe(functionName)
    expect(response.meta.activity.function.arguments).toEqual(args)
    expect(response.meta.activity.function.result).toBe(result)
  })

  test('preserve leading _ in function name', () => {
    const functionName = '_privateFunction'
    const args = { param: 'value' }
    const result = 'some result'

    const [request, response] = makeActivityMessagePair(
      functionName,
      args,
      result
    )

    expect(request.meta.activity.function.name).toBe(functionName)
    expect(response.meta.activity.function.name).toBe(functionName)
  })
})
