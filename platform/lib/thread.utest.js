/* eslint-disable @typescript-eslint/no-require-imports */
import {
  buildThread,
  createRepetitionGuard,
  describeThreadCycle,
  hasRepeatedActivityTail,
  hasRepeatedResultRun,
  hasRepeatedSuffix,
  hasRepeatedTextRun,
  isThreadCyclic,
} from '@/lib/thread'

describe('buildThread', () => {
  const mockTokenEstimationFunction = jest.fn()

  mockTokenEstimationFunction.mockImplementation((message) => {
    return Promise.resolve({ tokens: message.estimatedTokens })
  })

  const mockInclusiveFunction = jest.fn()

  afterAll(() => {
    jest.clearAllMocks()
  })

  it('should correctly build a thread with messages under the token limit', async () => {
    const messages = [
      { text: 'Hello', estimatedTokens: 5 },
      { text: 'World', estimatedTokens: 10 },
    ]

    const maxTokens = 20

    const result = await buildThread({
      messages,
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens,
    })

    expect(result.messages.length).toBe(2)
    expect(result.usage.tokens).toBe(15)
  })

  it('should trim messages correctly when exceeding maxTokens', async () => {
    const messages = [
      { text: 'Hello', estimatedTokens: 5 },
      { text: 'World', estimatedTokens: 10 },
      { text: 'Again', estimatedTokens: 10 },
    ]

    const maxTokens = 15

    const result = await buildThread({
      messages,
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens,
    })

    expect(result.messages.length).toBe(1)
    expect(result.messages[0].text).toBe('Again')
    expect(result.usage.tokens).toBe(10)
  })

  it('should include messages up to maxTokens if inclusive is true', async () => {
    const messages = [
      { text: 'Hello', estimatedTokens: 5 },
      { text: 'World', estimatedTokens: 10 },
      { text: 'Again', estimatedTokens: 5 },
    ]

    const maxTokens = 15

    const result = await buildThread({
      messages,
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens,
      inclusive: true,
    })

    expect(result.messages.length).toBe(3)
    expect(result.messages[0].text).toBe('Hello')
    expect(result.messages[1].text).toBe('World')
    expect(result.messages[2].text).toBe('Again')
    expect(result.usage.tokens).toBe(20)
  })

  it('should correctly handle the boundary condition when inclusive flag is set', async () => {
    const messages = [
      { text: 'Boundary', estimatedTokens: 10 },
      { text: 'Exact', estimatedTokens: 5 },
    ]

    const maxTokens = 15

    const result = await buildThread({
      messages,
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens,
      inclusive: true,
    })

    expect(result.messages.length).toBe(2)
    expect(result.usage.tokens).toBe(15)
  })

  it('inclusive function is called to trim the last message', async () => {
    const messages = [
      { text: 'First', estimatedTokens: 40 },
      { text: 'Second', estimatedTokens: 20 },
      { text: 'Third', estimatedTokens: 50 },
    ]

    const maxTokens = 100

    mockInclusiveFunction.mockResolvedValue({
      text: 'First',
      usage: { tokens: 30 },
    })

    const result = await buildThread({
      messages,
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens,
      inclusive: mockInclusiveFunction,
    })

    expect(mockInclusiveFunction).toHaveBeenCalledTimes(1)
    expect(mockInclusiveFunction).toHaveBeenCalledWith(
      { ...messages[0], usage: { tokens: messages[0].estimatedTokens } },
      30
    )
    expect(result.messages.map((msg) => msg.text)).toEqual([
      'First',
      'Second',
      'Third',
    ])
    expect(result.usage.tokens).toBe(100)
  })

  it('inclusive function trims to zero tokens correctly', async () => {
    const messages = [
      { text: 'Almost Full', estimatedTokens: 95 },
      { text: 'Too Big', estimatedTokens: 20 },
    ]

    const maxTokens = 100

    mockInclusiveFunction.mockResolvedValue({
      text: 'Almost Full',
      usage: { tokens: 0 },
    })

    const result = await buildThread({
      messages,
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens,
      inclusive: mockInclusiveFunction,
    })

    expect(mockInclusiveFunction).toHaveBeenCalledTimes(1)
    expect(result.messages.length).toBe(2)
    expect(result.messages[0].text).toBe('Almost Full')
    expect(result.messages[1].text).toBe('Too Big')
    expect(result.usage.tokens).toBe(20)
  })

  it('should not include the message if the inclusive function returns false', async () => {
    const messages = [
      { text: 'First', estimatedTokens: 30 },
      { text: 'Second', estimatedTokens: 20 },
      { text: 'Third', estimatedTokens: 60 },
    ]

    const maxTokens = 100

    mockInclusiveFunction.mockResolvedValue(false)

    const result = await buildThread({
      messages,
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens,
      inclusive: mockInclusiveFunction,
    })

    expect(mockInclusiveFunction).toHaveBeenCalledTimes(1)
    expect(result.messages.length).toBe(2)
    expect(result.messages[0].text).toBe('Second')
    expect(result.messages[1].text).toBe('Third')
    expect(result.usage.tokens).toBe(80)
  })

  it('should use pre-provided usage without calling tokenEstimationFunction', async () => {
    const messages = [
      { text: 'Hello', usage: { tokens: 5 } },
      { text: 'World', estimatedTokens: 10 },
    ]

    const maxTokens = 20

    const mockTokenEstimationFunction = jest.fn()

    mockTokenEstimationFunction.mockImplementation((message) => {
      return Promise.resolve({ tokens: message.estimatedTokens })
    })

    const result = await buildThread({
      messages,
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens,
    })

    expect(result.messages.length).toBe(2)
    expect(result.usage.tokens).toBe(15)

    expect(mockTokenEstimationFunction).toHaveBeenCalledTimes(1)
    expect(mockTokenEstimationFunction).toHaveBeenCalledWith({
      text: 'World',
      estimatedTokens: 10,
    })
  })

  it('should process messages in reverse and restore the order correctly', async () => {
    const messages = [
      { text: 'First', estimatedTokens: 5 },
      { text: 'Second', estimatedTokens: 10 },
      { text: 'Third', estimatedTokens: 5 },
    ]

    const maxTokens = 20

    const result = await buildThread({
      messages,
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens,
    })

    expect(result.messages[0].text).toBe('First')
    expect(result.messages[1].text).toBe('Second')
  })

  it('should correctly handle messages with zero tokens', async () => {
    const messages = [
      { text: 'Zero', usage: { tokens: 0 } },
      { text: 'Non-Zero', estimatedTokens: 10 },
    ]

    const maxTokens = 10

    const result = await buildThread({
      messages,
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens,
    })

    expect(result.messages.length).toBe(1)
    expect(result.usage.tokens).toBe(10)
  })

  it('should handle non-integer token values correctly', async () => {
    const messages = [
      { text: 'Fraction', estimatedTokens: 3.5 },
      { text: 'Whole', estimatedTokens: 6.5 },
    ]

    const maxTokens = 10

    const result = await buildThread({
      messages,
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens,
    })

    expect(result.messages.length).toBe(2)
    expect(result.usage.tokens).toBeCloseTo(10)
  })

  it('should correctly handle messages with zero tokens inclusive', async () => {
    const messages = [
      { text: 'Zero', usage: { tokens: 0 } },
      { text: 'Non-Zero', estimatedTokens: 10 },
    ]

    const maxTokens = 10

    const result = await buildThread({
      messages,
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens,
      inclusive: true,
    })

    expect(result.messages.length).toBe(2)
    expect(result.usage.tokens).toBe(10)
  })

  it('should handle edge cases gracefully', async () => {
    let result = await buildThread({
      messages: [],
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens: 10,
    })

    expect(result.messages.length).toBe(0)
    expect(result.usage.tokens).toBe(0)

    result = await buildThread({
      messages: [{ text: 'Hello', estimatedTokens: 20 }],
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens: 0,
    })

    expect(result.messages.length).toBe(0)

    result = await buildThread({
      messages: [{ text: 'Large', estimatedTokens: 30 }],
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens: 10,
    })

    expect(result.messages.length).toBe(0)
  })

  it('should handle errors in token estimation', async () => {
    const badEstimationFunction = jest.fn(() =>
      Promise.reject(new Error('Failed estimation'))
    )

    await expect(
      buildThread({
        messages: [{ text: 'Error', estimatedTokens: 5 }],
        tokenEstimationFunction: badEstimationFunction,
        maxTokens: 10,
      })
    ).rejects.toThrow('Failed estimation')
  })

  it('should include the original meta data in the result', async () => {
    const messages = [
      { text: 'Hello', estimatedTokens: 5, meta: { author: 'Alice' } },
      { text: 'World', estimatedTokens: 10, meta: { author: 'Bob' } },
    ]

    const maxTokens = 20

    const result = await buildThread({
      messages,
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens,
    })

    expect(result.messages.length).toBe(2)
    expect(result.messages[0].meta.author).toBe('Alice')
    expect(result.messages[1].meta.author).toBe('Bob')
  })

  it('should respect minMessages even when exceeding maxTokens', async () => {
    const messages = [
      { text: 'First', estimatedTokens: 30 },
      { text: 'Second', estimatedTokens: 40 },
      { text: 'Third', estimatedTokens: 50 },
    ]

    const maxTokens = 60
    const minMessages = 2

    const result = await buildThread({
      messages,
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens,
      minMessages,
    })

    expect(result.messages.length).toBe(2)
    expect(result.messages[0].text).toBe('Second')
    expect(result.messages[1].text).toBe('Third')
    expect(result.usage.tokens).toBe(90) // exceeds maxTokens but respects minMessages
  })

  it('should include all messages when minMessages equals message count', async () => {
    const messages = [
      { text: 'First', estimatedTokens: 40 },
      { text: 'Second', estimatedTokens: 60 },
    ]

    const maxTokens = 50
    const minMessages = 2

    const result = await buildThread({
      messages,
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens,
      minMessages,
    })

    expect(result.messages.length).toBe(2)
    expect(result.usage.tokens).toBe(100) // exceeds maxTokens
  })

  it('should handle minMessages greater than available messages', async () => {
    const messages = [{ text: 'Only', estimatedTokens: 20 }]

    const maxTokens = 1
    const minMessages = 5

    const result = await buildThread({
      messages,
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens,
      minMessages,
    })

    expect(result.messages.length).toBe(1)
    expect(result.usage.tokens).toBe(20)
  })

  it('should handle negative minMessages by converting to positive', async () => {
    const messages = [
      { text: 'First', estimatedTokens: 30 },
      { text: 'Second', estimatedTokens: 40 },
      { text: 'Third', estimatedTokens: 50 },
    ]

    const maxTokens = 60
    const minMessages = -2

    const result = await buildThread({
      messages,
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens,
      minMessages,
    })

    expect(result.messages.length).toBe(2)
    expect(result.messages[0].text).toBe('Second')
    expect(result.messages[1].text).toBe('Third')
    expect(result.usage.tokens).toBe(90)
  })

  it('should work with minMessages and inclusive=true', async () => {
    const messages = [
      { text: 'First', estimatedTokens: 30 },
      { text: 'Second', estimatedTokens: 40 },
      { text: 'Third', estimatedTokens: 50 },
    ]

    const maxTokens = 80
    const minMessages = 3

    const result = await buildThread({
      messages,
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens,
      minMessages,
      inclusive: true,
    })

    expect(result.messages.length).toBe(3)
    expect(result.usage.tokens).toBe(120)
  })

  it('should work with minMessages and inclusive function', async () => {
    const messages = [
      { text: 'First', estimatedTokens: 30 },
      { text: 'Second', estimatedTokens: 40 },
      { text: 'Third', estimatedTokens: 60 },
    ]

    const maxTokens = 100
    const minMessages = 2

    mockInclusiveFunction.mockResolvedValue({
      text: 'First',
      usage: { tokens: 20 },
    })

    const result = await buildThread({
      messages,
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens,
      minMessages,
      inclusive: mockInclusiveFunction,
    })

    expect(result.messages.length).toBe(3)
    expect(result.messages[0].text).toBe('First')
    expect(result.usage.tokens).toBe(130) // 30 + 40 + 60
  })

  it('should handle zero minMessages', async () => {
    const messages = [
      { text: 'First', estimatedTokens: 30 },
      { text: 'Second', estimatedTokens: 40 },
      { text: 'Third', estimatedTokens: 50 },
    ]

    const maxTokens = 60
    const minMessages = 0

    const result = await buildThread({
      messages,
      tokenEstimationFunction: mockTokenEstimationFunction,
      maxTokens,
      minMessages,
    })

    expect(result.messages.length).toBe(1)
    expect(result.messages[0].text).toBe('Third')
    expect(result.usage.tokens).toBe(50)
  })

  it('buildThread should not exceed maxTokens when inclusive function returns oversized message', async () => {
    const tokenEstimationFunction = jest
      .fn()
      .mockImplementation((message) =>
        Promise.resolve({ tokens: message.tokens })
      )

    const inclusiveFunction = jest.fn().mockResolvedValue({
      type: 'user',
      text: 'first (oversized trim result)',
      usage: { tokens: 50 },
    })

    const result = await buildThread({
      messages: [
        { type: 'user', text: 'first', tokens: 60 },
        { type: 'bot', text: 'second', tokens: 60 },
      ],
      tokenEstimationFunction,
      maxTokens: 100,
      inclusive: inclusiveFunction,
    })

    expect(result.usage.tokens).toBeLessThanOrEqual(100)
  })

  it('buildThread should keep usage finite when inclusive returns invalid token usage', async () => {
    const tokenEstimationFunction = jest
      .fn()
      .mockImplementation((message) =>
        Promise.resolve({ tokens: message.tokens })
      )

    const inclusiveFunction = jest.fn().mockResolvedValue({
      type: 'user',
      text: 'first (invalid trim result)',
      usage: { tokens: Number.NaN },
    })

    const result = await buildThread({
      messages: [
        { type: 'user', text: 'first', tokens: 60 },
        { type: 'bot', text: 'second', tokens: 60 },
      ],
      tokenEstimationFunction,
      maxTokens: 100,
      inclusive: inclusiveFunction,
    })

    expect(Number.isFinite(result.usage.tokens)).toBe(true)
  })

  it('hasRepeatedSuffix should not throw when meta is circular', () => {
    const circular = { id: 'c1' }

    circular.self = circular

    const messages = [
      { type: 'user', text: 'hello', meta: circular },
      { type: 'bot', text: 'hi' },
      { type: 'user', text: 'hello', meta: circular },
      { type: 'bot', text: 'hi' },
    ]

    expect(() => hasRepeatedSuffix(messages)).not.toThrow()
  })

  it('hasRepeatedSuffix should not treat delimiter-collision fingerprints as a cycle', () => {
    const messages = [
      { type: 'a:b', text: 'c' },
      { type: 'bot', text: 'same-tail' },
      { type: 'a', text: 'b:c' },
      { type: 'bot', text: 'same-tail' },
    ]

    expect(hasRepeatedSuffix(messages)).toBe(false)
  })

  // @todo add executable isolation for invalid minPatternLength=0 without hanging test process
  it('hasRepeatedSuffix should handle minPatternLength=0 safely', () => {
    const messages = [
      { type: 'user', text: 'A' },
      { type: 'bot', text: 'B' },
    ]

    expect(() =>
      hasRepeatedSuffix(messages, { minPatternLength: 0 })
    ).not.toThrow()
  })

  // @todo add executable isolation for invalid minRepetitions=0 without hanging test process
  it('hasRepeatedSuffix should handle minRepetitions=0 safely', () => {
    const messages = [
      { type: 'user', text: 'A' },
      { type: 'bot', text: 'B' },
    ]

    expect(() =>
      hasRepeatedSuffix(messages, { minRepetitions: 0 })
    ).not.toThrow()
  })
})

describe('hasRepeatedSuffix', () => {
  describe('basic cycle detection', () => {
    it('should return false for empty messages', () => {
      expect(hasRepeatedSuffix([])).toBe(false)
    })

    it('should return false for a single message', () => {
      const messages = [{ type: 'user', text: 'hello' }]

      expect(hasRepeatedSuffix(messages)).toBe(false)
    })

    it('should return false for two messages', () => {
      const messages = [
        { type: 'user', text: 'hello' },
        { type: 'bot', text: 'hi' },
      ]

      expect(hasRepeatedSuffix(messages)).toBe(false)
    })

    it('should return false for three messages', () => {
      const messages = [
        { type: 'user', text: 'hello' },
        { type: 'bot', text: 'hi' },
        { type: 'user', text: 'how are you' },
      ]

      expect(hasRepeatedSuffix(messages)).toBe(false)
    })

    it('should detect a simple 2-message cycle repeating twice', () => {
      const messages = [
        { type: 'user', text: 'hello' },
        { type: 'bot', text: 'hi' },
        { type: 'user', text: 'hello' },
        { type: 'bot', text: 'hi' },
      ]

      expect(hasRepeatedSuffix(messages)).toBe(true)
    })

    it('should detect a 3-message cycle repeating twice', () => {
      const messages = [
        { type: 'user', text: 'A' },
        { type: 'bot', text: 'B' },
        { type: 'user', text: 'C' },
        { type: 'user', text: 'A' },
        { type: 'bot', text: 'B' },
        { type: 'user', text: 'C' },
      ]

      expect(hasRepeatedSuffix(messages)).toBe(true)
    })

    it('should return false when messages are similar but not identical', () => {
      const messages = [
        { type: 'user', text: 'hello' },
        { type: 'bot', text: 'hi' },
        { type: 'user', text: 'hello!' },
        { type: 'bot', text: 'hi' },
      ]

      expect(hasRepeatedSuffix(messages)).toBe(false)
    })

    it('should return false for non-repeating conversation', () => {
      const messages = [
        { type: 'user', text: 'hello' },
        { type: 'bot', text: 'hi there' },
        { type: 'user', text: 'how are you' },
        { type: 'bot', text: 'I am fine' },
      ]

      expect(hasRepeatedSuffix(messages)).toBe(false)
    })
  })

  describe('cycle must be at the end of conversation', () => {
    it('should detect cycle at end even with different prefix', () => {
      const messages = [
        { type: 'user', text: 'starting message' },
        { type: 'bot', text: 'welcome' },
        { type: 'user', text: 'loop' },
        { type: 'bot', text: 'response' },
        { type: 'user', text: 'loop' },
        { type: 'bot', text: 'response' },
      ]

      expect(hasRepeatedSuffix(messages)).toBe(true)
    })

    it('should return false if cycle is not at the end', () => {
      const messages = [
        { type: 'user', text: 'loop' },
        { type: 'bot', text: 'response' },
        { type: 'user', text: 'loop' },
        { type: 'bot', text: 'response' },
        { type: 'user', text: 'something different' },
        { type: 'bot', text: 'different response' },
      ]

      expect(hasRepeatedSuffix(messages)).toBe(false)
    })

    it('should return false when cycle was broken with a single different message', () => {
      const messages = [
        { type: 'user', text: 'A' },
        { type: 'bot', text: 'B' },
        { type: 'user', text: 'A' },
        { type: 'bot', text: 'B' },
        { type: 'user', text: 'A' },
        { type: 'bot', text: 'B' },
        { type: 'user', text: 'finally something new' },
      ]

      expect(hasRepeatedSuffix(messages)).toBe(false)
    })

    it('should return false when past cycle is followed by new conversation', () => {
      const messages = [
        { type: 'user', text: 'stuck' },
        { type: 'bot', text: 'retry' },
        { type: 'user', text: 'stuck' },
        { type: 'bot', text: 'retry' },
        { type: 'user', text: 'stuck' },
        { type: 'bot', text: 'retry' },
        { type: 'user', text: 'let me try something else' },
        { type: 'bot', text: 'sure, go ahead' },
        { type: 'user', text: 'this works!' },
        { type: 'bot', text: 'great!' },
      ]

      expect(hasRepeatedSuffix(messages)).toBe(false)
    })

    it('should return false when cycle existed but conversation evolved', () => {
      const messages = [
        { type: 'user', text: 'help' },
        { type: 'bot', text: 'how can I help?' },
        { type: 'user', text: 'help' },
        { type: 'bot', text: 'how can I help?' },
        { type: 'user', text: 'I need to reset my password' },
        { type: 'bot', text: 'I can help with that' },
      ]

      expect(hasRepeatedSuffix(messages)).toBe(false)
    })

    it('should detect new cycle that forms after breaking old cycle', () => {
      const messages = [
        { type: 'user', text: 'old loop' },
        { type: 'bot', text: 'old response' },
        { type: 'user', text: 'old loop' },
        { type: 'bot', text: 'old response' },
        { type: 'user', text: 'break' },
        { type: 'user', text: 'new loop' },
        { type: 'bot', text: 'new response' },
        { type: 'user', text: 'new loop' },
        { type: 'bot', text: 'new response' },
      ]

      expect(hasRepeatedSuffix(messages)).toBe(true)
    })
  })

  describe('meta field handling', () => {
    it('should consider meta when comparing messages', () => {
      const messages = [
        { type: 'user', text: 'hello', meta: { id: 1 } },
        { type: 'bot', text: 'hi' },
        { type: 'user', text: 'hello', meta: { id: 2 } },
        { type: 'bot', text: 'hi' },
      ]

      expect(hasRepeatedSuffix(messages)).toBe(false)
    })

    it('should detect cycle when meta is identical', () => {
      const messages = [
        { type: 'user', text: 'hello', meta: { id: 1 } },
        { type: 'bot', text: 'hi', meta: { source: 'ai' } },
        { type: 'user', text: 'hello', meta: { id: 1 } },
        { type: 'bot', text: 'hi', meta: { source: 'ai' } },
      ]

      expect(hasRepeatedSuffix(messages)).toBe(true)
    })

    it('should handle undefined meta consistently', () => {
      const messages = [
        { type: 'user', text: 'hello' },
        { type: 'bot', text: 'hi' },
        { type: 'user', text: 'hello' },
        { type: 'bot', text: 'hi' },
      ]

      expect(hasRepeatedSuffix(messages)).toBe(true)
    })
  })

  describe('minRepetitions option', () => {
    it('should require 3 repetitions when minRepetitions is 3', () => {
      const twoReps = [
        { type: 'user', text: 'A' },
        { type: 'bot', text: 'B' },
        { type: 'user', text: 'A' },
        { type: 'bot', text: 'B' },
      ]

      expect(hasRepeatedSuffix(twoReps, { minRepetitions: 3 })).toBe(false)

      const threeReps = [
        { type: 'user', text: 'A' },
        { type: 'bot', text: 'B' },
        { type: 'user', text: 'A' },
        { type: 'bot', text: 'B' },
        { type: 'user', text: 'A' },
        { type: 'bot', text: 'B' },
      ]

      expect(hasRepeatedSuffix(threeReps, { minRepetitions: 3 })).toBe(true)
    })

    it('should detect cycle with minRepetitions of 1', () => {
      const messages = [
        { type: 'user', text: 'A' },
        { type: 'bot', text: 'B' },
      ]

      expect(hasRepeatedSuffix(messages, { minRepetitions: 1 })).toBe(true)
    })
  })

  describe('minPatternLength option', () => {
    it('should ignore 2-message patterns when minPatternLength is 3', () => {
      const messages = [
        { type: 'user', text: 'A' },
        { type: 'bot', text: 'B' },
        { type: 'user', text: 'A' },
        { type: 'bot', text: 'B' },
      ]

      expect(hasRepeatedSuffix(messages, { minPatternLength: 3 })).toBe(false)
    })

    it('should detect 3-message patterns when minPatternLength is 3', () => {
      const messages = [
        { type: 'user', text: 'A' },
        { type: 'bot', text: 'B' },
        { type: 'user', text: 'C' },
        { type: 'user', text: 'A' },
        { type: 'bot', text: 'B' },
        { type: 'user', text: 'C' },
      ]

      expect(hasRepeatedSuffix(messages, { minPatternLength: 3 })).toBe(true)
    })
  })

  describe('maxPatternLength option', () => {
    it('should not detect longer patterns when maxPatternLength is limited', () => {
      const messages = [
        { type: 'user', text: 'A' },
        { type: 'bot', text: 'B' },
        { type: 'user', text: 'C' },
        { type: 'user', text: 'A' },
        { type: 'bot', text: 'B' },
        { type: 'user', text: 'C' },
      ]

      expect(hasRepeatedSuffix(messages, { maxPatternLength: 2 })).toBe(false)
      expect(hasRepeatedSuffix(messages, { maxPatternLength: 3 })).toBe(true)
    })
  })

  describe('combined options', () => {
    it('should work with multiple options combined', () => {
      const messages = [
        { type: 'user', text: 'A' },
        { type: 'bot', text: 'B' },
        { type: 'user', text: 'C' },
        { type: 'user', text: 'A' },
        { type: 'bot', text: 'B' },
        { type: 'user', text: 'C' },
        { type: 'user', text: 'A' },
        { type: 'bot', text: 'B' },
        { type: 'user', text: 'C' },
      ]

      expect(
        hasRepeatedSuffix(messages, { minRepetitions: 3, minPatternLength: 3 })
      ).toBe(true)
      expect(
        hasRepeatedSuffix(messages, { minRepetitions: 4, minPatternLength: 3 })
      ).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle single repeated message type', () => {
      const messages = [
        { type: 'bot', text: 'error' },
        { type: 'bot', text: 'error' },
        { type: 'bot', text: 'error' },
        { type: 'bot', text: 'error' },
      ]

      expect(hasRepeatedSuffix(messages)).toBe(true)
    })

    it('should handle long conversation with cycle at end', () => {
      const messages = [
        { type: 'user', text: 'start' },
        { type: 'bot', text: 'welcome' },
        { type: 'user', text: 'question 1' },
        { type: 'bot', text: 'answer 1' },
        { type: 'user', text: 'question 2' },
        { type: 'bot', text: 'answer 2' },
        { type: 'user', text: 'stuck' },
        { type: 'bot', text: 'retry' },
        { type: 'user', text: 'stuck' },
        { type: 'bot', text: 'retry' },
      ]

      expect(hasRepeatedSuffix(messages)).toBe(true)
    })

    it('should handle empty text messages', () => {
      const messages = [
        { type: 'user', text: '' },
        { type: 'bot', text: '' },
        { type: 'user', text: '' },
        { type: 'bot', text: '' },
      ]

      expect(hasRepeatedSuffix(messages)).toBe(true)
    })
  })

  describe('activity message cycles', () => {
    const {
      makeActivityMessagePair,
      makeRequestActivityMessage,
      makeResponseActivityMessage,
      makeTriggerActivityMessage,
    } = require('@/lib/activity')

    it('should detect repeated identical activity pairs', () => {
      const [req1, res1] = makeActivityMessagePair(
        'getData',
        { id: 1 },
        { data: 'result' }
      )
      const [req2, res2] = makeActivityMessagePair(
        'getData',
        { id: 1 },
        { data: 'result' }
      )

      const messages = [req1, res1, req2, res2]

      expect(hasRepeatedSuffix(messages)).toBe(true)
    })

    it('should not detect cycle when activity pairs have different arguments', () => {
      const [req1, res1] = makeActivityMessagePair(
        'getData',
        { id: 1 },
        { data: 'result1' }
      )
      const [req2, res2] = makeActivityMessagePair(
        'getData',
        { id: 2 },
        { data: 'result2' }
      )

      const messages = [req1, res1, req2, res2]

      expect(hasRepeatedSuffix(messages)).toBe(false)
    })

    it('should not detect cycle when activity pairs have different results', () => {
      const [req1, res1] = makeActivityMessagePair(
        'getData',
        { id: 1 },
        { data: 'result1' }
      )
      const [req2, res2] = makeActivityMessagePair(
        'getData',
        { id: 1 },
        { data: 'result2' }
      )

      const messages = [req1, res1, req2, res2]

      expect(hasRepeatedSuffix(messages)).toBe(false)
    })

    it('should not detect cycle when activity pairs have different function names', () => {
      const [req1, res1] = makeActivityMessagePair(
        'getData',
        { id: 1 },
        { data: 'result' }
      )
      const [req2, res2] = makeActivityMessagePair(
        'fetchData',
        { id: 1 },
        { data: 'result' }
      )

      const messages = [req1, res1, req2, res2]

      expect(hasRepeatedSuffix(messages)).toBe(false)
    })

    it('should detect cycle with multiple repeated activity pairs', () => {
      const [req1, res1] = makeActivityMessagePair(
        'retry',
        {},
        { error: 'failed' }
      )
      const [req2, res2] = makeActivityMessagePair(
        'retry',
        {},
        { error: 'failed' }
      )
      const [req3, res3] = makeActivityMessagePair(
        'retry',
        {},
        { error: 'failed' }
      )

      const messages = [req1, res1, req2, res2, req3, res3]

      expect(hasRepeatedSuffix(messages)).toBe(true)
      expect(hasRepeatedSuffix(messages, { minRepetitions: 3 })).toBe(true)
      expect(hasRepeatedSuffix(messages, { minRepetitions: 4 })).toBe(false)
    })

    it('should detect cycle with pattern of different activity pairs repeating', () => {
      const [reqA1, resA1] = makeActivityMessagePair('stepA', {}, { ok: true })
      const [reqB1, resB1] = makeActivityMessagePair('stepB', {}, { ok: true })
      const [reqA2, resA2] = makeActivityMessagePair('stepA', {}, { ok: true })
      const [reqB2, resB2] = makeActivityMessagePair('stepB', {}, { ok: true })

      const messages = [reqA1, resA1, reqB1, resB1, reqA2, resA2, reqB2, resB2]

      expect(hasRepeatedSuffix(messages)).toBe(true)
    })

    it('should detect cycle when activity pairs are preceded by regular messages', () => {
      const [req1, res1] = makeActivityMessagePair(
        'action',
        { x: 1 },
        { done: true }
      )
      const [req2, res2] = makeActivityMessagePair(
        'action',
        { x: 1 },
        { done: true }
      )

      const messages = [
        { type: 'user', text: 'hello' },
        { type: 'bot', text: 'hi there' },
        req1,
        res1,
        req2,
        res2,
      ]

      expect(hasRepeatedSuffix(messages)).toBe(true)
    })

    it('should detect cycle with mixed user/bot and activity messages', () => {
      const [req1, res1] = makeActivityMessagePair('fetch', {}, {})

      const messages = [
        { type: 'user', text: 'do something' },
        req1,
        res1,
        { type: 'bot', text: 'done' },
        { type: 'user', text: 'do something' },
        ...makeActivityMessagePair('fetch', {}, {}),
        { type: 'bot', text: 'done' },
      ]

      expect(hasRepeatedSuffix(messages)).toBe(true)
    })

    it('should not detect cycle when only requests repeat but responses differ', () => {
      const req1 = makeRequestActivityMessage('getData', { id: 1 })
      const res1 = makeResponseActivityMessage(
        'getData',
        { id: 1 },
        { value: 100 }
      )
      const req2 = makeRequestActivityMessage('getData', { id: 1 })
      const res2 = makeResponseActivityMessage(
        'getData',
        { id: 1 },
        { value: 200 }
      )

      const messages = [req1, res1, req2, res2]

      expect(hasRepeatedSuffix(messages)).toBe(false)
    })

    it('should detect cycle with trigger activities repeating', () => {
      const trigger1 = makeTriggerActivityMessage('onStart')
      const trigger2 = makeTriggerActivityMessage('onStart')
      const trigger3 = makeTriggerActivityMessage('onStart')
      const trigger4 = makeTriggerActivityMessage('onStart')

      const messages = [trigger1, trigger2, trigger3, trigger4]

      expect(hasRepeatedSuffix(messages)).toBe(true)
    })

    it('should detect cycle with alternating trigger and request/response', () => {
      const trigger1 = makeTriggerActivityMessage('onEvent')
      const [req1, res1] = makeActivityMessagePair('handle', {}, {})
      const trigger2 = makeTriggerActivityMessage('onEvent')
      const [req2, res2] = makeActivityMessagePair('handle', {}, {})

      const messages = [trigger1, req1, res1, trigger2, req2, res2]

      expect(hasRepeatedSuffix(messages)).toBe(true)
    })

    it('should detect rotating repeated read activity loops', () => {
      const makeReadDesignPair = (path) =>
        makeActivityMessagePair(
          'read_design_file',
          {
            input: {
              path,
            },
          },
          {
            result: {
              path,
              content: `content for ${path}`,
              totalLines: 72,
              startLine: 1,
              endLine: 72,
            },
          }
        )

      const [playstationReq1, playstationRes1] = makeReadDesignPair(
        'design-systems/playstation/DESIGN.md'
      )
      const [pacmanReq1, pacmanRes1] = makeReadDesignPair(
        'design-systems/pacman/DESIGN.md'
      )
      const [retroReq1, retroRes1] = makeReadDesignPair(
        'design-systems/retro/DESIGN.md'
      )
      const [tetrisReq1, tetrisRes1] = makeReadDesignPair(
        'design-systems/tetris/DESIGN.md'
      )

      const [playstationReq2, playstationRes2] = makeReadDesignPair(
        'design-systems/playstation/DESIGN.md'
      )
      const [pacmanReq2, pacmanRes2] = makeReadDesignPair(
        'design-systems/pacman/DESIGN.md'
      )
      const [retroReq2, retroRes2] = makeReadDesignPair(
        'design-systems/retro/DESIGN.md'
      )
      const [tetrisReq2, tetrisRes2] = makeReadDesignPair(
        'design-systems/tetris/DESIGN.md'
      )

      const messages = [
        playstationReq1,
        playstationRes1,
        pacmanReq1,
        pacmanRes1,
        retroReq1,
        retroRes1,
        tetrisReq1,
        tetrisRes1,
        playstationReq2,
        playstationRes2,
        pacmanReq2,
        pacmanRes2,
        retroReq2,
        retroRes2,
        tetrisReq2,
        tetrisRes2,
      ]

      expect(hasRepeatedSuffix(messages)).toBe(true)
    })

    it('should not detect cycle when activity sequence varies', () => {
      const [reqA, resA] = makeActivityMessagePair('actionA', {}, {})
      const [reqB, resB] = makeActivityMessagePair('actionB', {}, {})
      const [reqC, resC] = makeActivityMessagePair('actionC', {}, {})

      const messages = [reqA, resA, reqB, resB, reqC, resC]

      expect(hasRepeatedSuffix(messages)).toBe(false)
    })

    it('should detect agent stuck in retry loop with identical error responses', () => {
      const userMessage = { type: 'user', text: 'please help me' }
      const botThinking = { type: 'bot', text: 'Let me try...' }
      const [req1, res1] = makeActivityMessagePair(
        'callAPI',
        { endpoint: '/api/data' },
        { error: 'timeout', code: 500 }
      )
      const [req2, res2] = makeActivityMessagePair(
        'callAPI',
        { endpoint: '/api/data' },
        { error: 'timeout', code: 500 }
      )

      const messages = [
        userMessage,
        botThinking,
        req1,
        res1,
        botThinking,
        req2,
        res2,
      ]

      // @note pattern is [botThinking, req, res] repeating
      expect(hasRepeatedSuffix(messages, { minPatternLength: 3 })).toBe(true)
    })

    it('should not detect cycle when activity loop was broken', () => {
      const [req1, res1] = makeActivityMessagePair(
        'retry',
        {},
        { error: 'failed' }
      )
      const [req2, res2] = makeActivityMessagePair(
        'retry',
        {},
        { error: 'failed' }
      )
      const [req3, res3] = makeActivityMessagePair(
        'retry',
        {},
        { error: 'failed' }
      )
      const [reqSuccess, resSuccess] = makeActivityMessagePair(
        'retry',
        {},
        { success: true }
      )

      const messages = [
        req1,
        res1,
        req2,
        res2,
        req3,
        res3,
        reqSuccess,
        resSuccess,
      ]

      expect(hasRepeatedSuffix(messages)).toBe(false)
    })

    it('should not detect cycle when agent broke out of loop with different action', () => {
      const [reqA1, resA1] = makeActivityMessagePair(
        'fetchData',
        { id: 1 },
        { error: 'not found' }
      )
      const [reqA2, resA2] = makeActivityMessagePair(
        'fetchData',
        { id: 1 },
        { error: 'not found' }
      )
      const [reqB, resB] = makeActivityMessagePair(
        'createData',
        { id: 1 },
        { created: true }
      )

      const messages = [reqA1, resA1, reqA2, resA2, reqB, resB]

      expect(hasRepeatedSuffix(messages)).toBe(false)
    })

    it('should not detect cycle when bot responded differently after repeated activities', () => {
      const [req1, res1] = makeActivityMessagePair(
        'check',
        {},
        { status: 'pending' }
      )
      const [req2, res2] = makeActivityMessagePair(
        'check',
        {},
        { status: 'pending' }
      )
      const botMessage = {
        type: 'bot',
        text: 'The task is still pending, let me try a different approach',
      }
      const [reqNew, resNew] = makeActivityMessagePair(
        'forceComplete',
        {},
        { status: 'done' }
      )

      const messages = [req1, res1, req2, res2, botMessage, reqNew, resNew]

      expect(hasRepeatedSuffix(messages)).toBe(false)
    })

    it('should not detect cycle when user interrupted after repeated activities', () => {
      const [req1, res1] = makeActivityMessagePair(
        'search',
        { q: 'test' },
        { results: [] }
      )
      const [req2, res2] = makeActivityMessagePair(
        'search',
        { q: 'test' },
        { results: [] }
      )
      const userMessage = {
        type: 'user',
        text: 'stop searching, just give me the default',
      }
      const botMessage = { type: 'bot', text: 'Here is the default result' }

      const messages = [req1, res1, req2, res2, userMessage, botMessage]

      expect(hasRepeatedSuffix(messages)).toBe(false)
    })

    it('should detect new activity cycle after breaking previous one', () => {
      const [reqOld1, resOld1] = makeActivityMessagePair('oldAction', {}, {})
      const [reqOld2, resOld2] = makeActivityMessagePair('oldAction', {}, {})
      const breakMessage = { type: 'bot', text: 'Let me try something else' }
      const [reqNew1, resNew1] = makeActivityMessagePair(
        'newAction',
        {},
        { error: 'failed' }
      )
      const [reqNew2, resNew2] = makeActivityMessagePair(
        'newAction',
        {},
        { error: 'failed' }
      )

      const messages = [
        reqOld1,
        resOld1,
        reqOld2,
        resOld2,
        breakMessage,
        reqNew1,
        resNew1,
        reqNew2,
        resNew2,
      ]

      expect(hasRepeatedSuffix(messages)).toBe(true)
    })
  })
})

describe('hasRepeatedActivityTail', () => {
  const { makeActivityMessagePair } = require('@/lib/activity')

  const makeShellCommandPair = (command, output = '') =>
    makeActivityMessagePair(
      'bash',
      {
        input: {
          command,
        },
      },
      {
        output,
      }
    )

  const makeTrailingActivityRotationMessages = () => {
    const makeReadDesignPair = (path) =>
      makeActivityMessagePair(
        'read_design_file',
        {
          input: {
            path,
          },
        },
        {
          result: {
            path,
          },
        }
      )

    const [pacmanReq1, pacmanRes1] = makeReadDesignPair(
      'design-systems/pacman/DESIGN.md'
    )
    const [retroReq1, retroRes1] = makeReadDesignPair(
      'design-systems/retro/DESIGN.md'
    )
    const [tetrisReq1, tetrisRes1] = makeReadDesignPair(
      'design-systems/tetris/DESIGN.md'
    )
    const [playstationReq1, playstationRes1] = makeReadDesignPair(
      'design-systems/playstation/DESIGN.md'
    )

    const [pacmanReq2, pacmanRes2] = makeReadDesignPair(
      'design-systems/pacman/DESIGN.md'
    )
    const [retroReq2, retroRes2] = makeReadDesignPair(
      'design-systems/retro/DESIGN.md'
    )
    const [tetrisReq2, tetrisRes2] = makeReadDesignPair(
      'design-systems/tetris/DESIGN.md'
    )
    const [playstationReq2, playstationRes2] = makeReadDesignPair(
      'design-systems/playstation/DESIGN.md'
    )

    const [pacmanReq3, pacmanRes3] = makeReadDesignPair(
      'design-systems/pacman/DESIGN.md'
    )
    const [retroReq3, retroRes3] = makeReadDesignPair(
      'design-systems/retro/DESIGN.md'
    )

    const [mintTokenReq, mintTokenRes] = makeActivityMessagePair(
      'mint_github_repo_token',
      {
        input: {
          repo: 'chatbotkit/example',
        },
      },
      {
        token: 'redacted',
      }
    )
    const [installSkillsetReq, installSkillsetRes] = makeActivityMessagePair(
      'install_github_skillset',
      {
        input: 'fetch repo info and mint token for github access',
      },
      {
        success: true,
      }
    )

    return [
      { type: 'user', text: 'please inspect the retro design systems' },
      pacmanReq1,
      pacmanRes1,
      retroReq1,
      retroRes1,
      tetrisReq1,
      tetrisRes1,
      playstationReq1,
      playstationRes1,
      pacmanReq2,
      pacmanRes2,
      retroReq2,
      retroRes2,
      tetrisReq2,
      tetrisRes2,
      playstationReq2,
      playstationRes2,
      pacmanReq3,
      pacmanRes3,
      retroReq3,
      retroRes3,
      mintTokenReq,
      mintTokenRes,
      installSkillsetReq,
      installSkillsetRes,
    ]
  }

  it('should return false for empty messages', () => {
    const messages = []

    expect(hasRepeatedActivityTail(messages)).toBe(false)
    expect(isThreadCyclic(messages)).toBe(false)
  })

  it('should return false for a single non-activity message', () => {
    const messages = [{ type: 'user', text: 'hello' }]

    expect(hasRepeatedActivityTail(messages)).toBe(false)
    expect(isThreadCyclic(messages)).toBe(false)
  })

  it('should return false for a single activity request-response pair', () => {
    const [req, res] = makeShellCommandPair('sleep 5', '')
    const messages = [req, res]

    expect(hasRepeatedActivityTail(messages)).toBe(false)
    expect(isThreadCyclic(messages)).toBe(false)
  })

  it('should return false for a few repeated sleep commands without enough tail evidence', () => {
    const commands = [
      ['sleep 5', ''],
      ['sleep 5', ''],
      ['echo "still working..."', 'still working...'],
    ]

    const messages = commands.flatMap(([command, output]) =>
      makeShellCommandPair(command, output)
    )

    expect(hasRepeatedActivityTail(messages)).toBe(false)
    expect(isThreadCyclic(messages)).toBe(false)
  })

  it('should detect repeated trailing activity rotations even after the suffix changes', () => {
    const messages = makeTrailingActivityRotationMessages()

    expect(hasRepeatedActivityTail(messages)).toBe(true)
    expect(isThreadCyclic(messages)).toBe(true)
  })

  it('should return false when the thread does not end with activity messages', () => {
    const [readReq, readRes] = makeActivityMessagePair(
      'read_design_file',
      {
        input: {
          path: 'design-systems/pacman/DESIGN.md',
        },
      },
      {
        result: {
          path: 'design-systems/pacman/DESIGN.md',
        },
      }
    )

    const [tokenReq, tokenRes] = makeActivityMessagePair(
      'mint_github_repo_token',
      {
        input: {
          repo: 'chatbotkit/example',
        },
      },
      {
        token: 'redacted',
      }
    )

    const messages = [
      { type: 'user', text: 'please inspect the retro design systems' },
      readReq,
      readRes,
      tokenReq,
      tokenRes,
      { type: 'bot', text: 'let me summarize what I found' },
    ]

    expect(hasRepeatedActivityTail(messages)).toBe(false)
    expect(isThreadCyclic(messages)).toBe(false)
  })

  it('should stay consistent with the suffix heuristic for trailing activity loops', () => {
    const messages = makeTrailingActivityRotationMessages()

    expect(hasRepeatedSuffix(messages)).toBe(false)
    expect(hasRepeatedActivityTail(messages)).toBe(true)
    expect(isThreadCyclic(messages)).toBe(true)
  })

  it('should return false for varied shell commands that are clearly making progress', () => {
    const commands = [
      ['pwd', '/workspace/chatbotkit/platform'],
      ['ls -la', 'total 64\ndrwxr-xr-x 12 dev dev 4096 May 4 12:00 .'],
      ['git status --short', ' M app/page.tsx'],
      ['find . -maxdepth 2 -type f', './app/page.tsx\n./package.json'],
      ['cat package.json', '{"name":"app","scripts":{"lint":"next lint"}}'],
      ['npm install', 'added 12 packages, and audited 312 packages'],
      ['npm run lint', '> lint\n✔ No ESLint warnings or errors'],
      [
        "sed -n '1,220p' app/page.tsx",
        'export default function Page() {\n  return <main>Hello</main>\n}',
      ],
      ['cat > app/page.tsx', ''],
      ['npm run build', 'Route (app)\n┌ ○ /\n└ ○ /_not-found'],
      ['git diff -- app/page.tsx', '+export default function Page() {'],
      ['git status --short', ' M app/page.tsx'],
    ]

    const messages = commands.flatMap(([command, output]) =>
      makeShellCommandPair(command, output)
    )

    expect(hasRepeatedActivityTail(messages)).toBe(false)
    expect(isThreadCyclic(messages)).toBe(false)
  })

  it('should detect repeated sleep and filler shell commands as a stalled activity tail', () => {
    const commands = [
      ['sleep 5', ''],
      ['sleep 5', ''],
      ['sleep 5', ''],
      ['echo "still working..."', 'still working...'],
      ['sleep 5', ''],
      ['echo "checking..."', 'checking...'],
      ['sleep 5', ''],
      ['sleep 5', ''],
      ['echo "one moment..."', 'one moment...'],
      ['sleep 5', ''],
      ['sleep 5', ''],
      ['sleep 5', ''],
    ]

    const messages = commands.flatMap(([command, output]) =>
      makeShellCommandPair(command, output)
    )

    expect(hasRepeatedActivityTail(messages)).toBe(true)
    expect(isThreadCyclic(messages)).toBe(true)
  })

  it('should return false for sleep-heavy polling when each wait observes service progress', () => {
    const commands = [
      ['npm run dev > /tmp/dev.log 2>&1 &', 'started dev server in background'],
      ['sleep 2', ''],
      [
        'grep -i "ready" /tmp/dev.log',
        'ready - started server on 0.0.0.0:3000',
      ],
      ['sleep 2', ''],
      ['curl -fsS http://localhost:3000', '<html><body>home</body></html>'],
      ['sleep 1', ''],
      ['curl -fsS http://localhost:3000/api/health', '{"status":"ok"}'],
      ['npm run test:e2e', '12 passed'],
      ['pkill -f "npm run dev"', ''],
      [
        'curl -X POST http://localhost:3000/api/jobs -d \'{"task":"reindex"}\'',
        '{"id":"job_123","status":"queued"}',
      ],
      ['sleep 2', ''],
      [
        'curl -fsS http://localhost:3000/api/jobs/latest',
        '{"id":"job_123","status":"running","processed":10}',
      ],
      ['sleep 2', ''],
      [
        'curl -fsS http://localhost:3000/api/jobs/latest',
        '{"id":"job_123","status":"running","processed":47}',
      ],
      ['sleep 2', ''],
      [
        'curl -fsS http://localhost:3000/api/jobs/latest',
        '{"id":"job_123","status":"completed","processed":100}',
      ],
      ['npm run verify:index', 'index verification passed'],
    ]

    const messages = commands.flatMap(([command, output]) =>
      makeShellCommandPair(command, output)
    )

    expect(hasRepeatedActivityTail(messages)).toBe(false)
    expect(isThreadCyclic(messages)).toBe(false)
  })

  it('should return false for sleep-heavy infrastructure polling when state changes between checks', () => {
    const commands = [
      ['docker compose up -d', 'creating network\nstarting db'],
      ['sleep 3', ''],
      ['docker compose ps', 'db starting'],
      ['sleep 3', ''],
      ['docker compose logs --tail=50 db', 'database system is starting up'],
      ['sleep 3', ''],
      ['docker compose exec db pg_isready', 'accepting connections'],
      ['npm run migrate', 'migrations applied'],
      ['npm test', '24 passed'],
      ['docker compose down', 'stopped db'],
      ['git push origin HEAD', 'pushed to origin/next'],
      ['sleep 5', ''],
      ['gh run list --limit 1', 'in_progress build-and-test'],
      ['sleep 10', ''],
      ['gh run watch', 'build-and-test completed successfully'],
      ['gh run view --log-failed', 'no failed jobs'],
      ['npm run build &', 'started build in background'],
      ['sleep 2', ''],
      ['ps aux | grep "npm run build"', 'node ./node_modules/.bin/next build'],
      ['sleep 2', ''],
      ['tail -n 40 /tmp/build.log', 'Compiled successfully'],
      ['sleep 2', ''],
      ['wait', ''],
      ['test -d .next', ''],
    ]

    const messages = commands.flatMap(([command, output]) =>
      makeShellCommandPair(command, output)
    )

    expect(hasRepeatedActivityTail(messages)).toBe(false)
    expect(isThreadCyclic(messages)).toBe(false)
  })

  it('should return false when the same polling command reports changing progress', () => {
    const commands = [
      [
        'curl -fsS http://localhost:3000/api/jobs/latest',
        '{"id":"job_456","status":"queued","processed":0}',
      ],
      ['sleep 2', ''],
      [
        'curl -fsS http://localhost:3000/api/jobs/latest',
        '{"id":"job_456","status":"running","processed":12}',
      ],
      ['sleep 2', ''],
      [
        'curl -fsS http://localhost:3000/api/jobs/latest',
        '{"id":"job_456","status":"running","processed":41}',
      ],
      ['sleep 2', ''],
      [
        'curl -fsS http://localhost:3000/api/jobs/latest',
        '{"id":"job_456","status":"running","processed":78}',
      ],
      ['sleep 2', ''],
      [
        'curl -fsS http://localhost:3000/api/jobs/latest',
        '{"id":"job_456","status":"completed","processed":100}',
      ],
      ['npm run verify:index', 'index verification passed'],
    ]

    const messages = commands.flatMap(([command, output]) =>
      makeShellCommandPair(command, output)
    )

    expect(hasRepeatedActivityTail(messages)).toBe(false)
    expect(isThreadCyclic(messages)).toBe(false)
  })

  it('should return false when the same shell command runs against different targets', () => {
    const commands = [
      ['cat docs/a.md', '# alpha'],
      ['cat docs/b.md', '# beta'],
      ['cat docs/c.md', '# gamma'],
      ['cat docs/d.md', '# delta'],
      ['git add docs/a.md docs/b.md docs/c.md docs/d.md', ''],
      ['git diff --cached --stat', '4 files changed, 120 insertions(+)'],
    ]

    const messages = commands.flatMap(([command, output]) =>
      makeShellCommandPair(command, output)
    )

    expect(hasRepeatedActivityTail(messages)).toBe(false)
    expect(isThreadCyclic(messages)).toBe(false)
  })

  it('should return false for batch work with repeated command names but unique inputs and outputs', () => {
    const commands = [
      [
        'node scripts/process-file.js inbox/001.json',
        'processed inbox/001.json -> ok',
      ],
      [
        'node scripts/process-file.js inbox/002.json',
        'processed inbox/002.json -> ok',
      ],
      [
        'node scripts/process-file.js inbox/003.json',
        'processed inbox/003.json -> ok',
      ],
      [
        'node scripts/process-file.js inbox/004.json',
        'processed inbox/004.json -> ok',
      ],
      [
        'node scripts/process-file.js inbox/005.json',
        'processed inbox/005.json -> ok',
      ],
      ['node scripts/summarize-batch.js', '5 files processed successfully'],
    ]

    const messages = commands.flatMap(([command, output]) =>
      makeShellCommandPair(command, output)
    )

    expect(hasRepeatedActivityTail(messages)).toBe(false)
    expect(isThreadCyclic(messages)).toBe(false)
  })

  it('should detect a polling tail once progress stops changing and the same state repeats', () => {
    const commands = [
      [
        'curl -fsS http://localhost:3000/api/jobs/latest',
        '{"id":"job_789","status":"running","processed":12}',
      ],
      ['sleep 2', ''],
      [
        'curl -fsS http://localhost:3000/api/jobs/latest',
        '{"id":"job_789","status":"running","processed":48}',
      ],
      ['sleep 2', ''],
      [
        'curl -fsS http://localhost:3000/api/jobs/latest',
        '{"id":"job_789","status":"running","processed":48}',
      ],
      ['sleep 2', ''],
      [
        'curl -fsS http://localhost:3000/api/jobs/latest',
        '{"id":"job_789","status":"running","processed":48}',
      ],
      ['sleep 2', ''],
      [
        'curl -fsS http://localhost:3000/api/jobs/latest',
        '{"id":"job_789","status":"running","processed":48}',
      ],
      ['sleep 2', ''],
      [
        'curl -fsS http://localhost:3000/api/jobs/latest',
        '{"id":"job_789","status":"running","processed":48}',
      ],
      ['echo "still waiting..."', 'still waiting...'],
    ]

    const messages = commands.flatMap(([command, output]) =>
      makeShellCommandPair(command, output)
    )

    expect(hasRepeatedActivityTail(messages)).toBe(true)
    expect(isThreadCyclic(messages)).toBe(true)
  })

  it('should return false when the trailing activity tail contains malformed activity metadata', () => {
    const [req1, res1] = makeShellCommandPair('sleep 2', '')
    const [req2, res2] = makeShellCommandPair(
      'curl -fsS http://localhost:3000/api/jobs/latest',
      '{"id":"job_999","status":"running","processed":55}'
    )
    const malformedActivityMessage = {
      type: 'activity',
      meta: {
        activity: {
          type: 'request',
        },
      },
    }

    const messages = [req1, res1, req2, res2, malformedActivityMessage]

    expect(hasRepeatedActivityTail(messages)).toBe(false)
    expect(isThreadCyclic(messages)).toBe(false)
  })
})

describe('hasRepeatedResultRun', () => {
  const { makeActivityMessagePair } = require('@/lib/activity')

  // @note the dataset-search result shape behind an empty
  // knowledge-base search that hands back instructions but no records
  const emptySearchResult = {
    search: 'modern sofa',
    instructions: {
      match: { description: 'when there are records', instruction: '...' },
      mismatch: { description: 'when there are none', instruction: '...' },
    },
    records: [],
  }

  const search = (input, result = emptySearchResult) =>
    makeActivityMessagePair('search', { input }, result)

  it('returns false for an empty thread', () => {
    expect(hasRepeatedResultRun([])).toBe(false)
  })

  it('detects three identical tool calls in a row', () => {
    const messages = [
      ...search('modern sofa'),
      ...search('modern sofa'),
      ...search('modern sofa'),
    ]

    expect(hasRepeatedResultRun(messages)).toBe(true)
    expect(isThreadCyclic(messages)).toBe(true)
  })

  it('does not trip when the same result comes from different arguments', () => {
    // @note distinct calls that merely coincide on a trivial result (e.g.
    // several different shell commands each returning empty output, or
    // infrastructure polling) are progress, not a loop, and must not be flagged
    const empty = ''

    const messages = [
      ...makeActivityMessagePair('shell', { command: 'sleep 2' }, empty),
      ...makeActivityMessagePair('shell', { command: 'wait' }, empty),
      ...makeActivityMessagePair('shell', { command: 'test -d .next' }, empty),
    ]

    expect(hasRepeatedResultRun(messages)).toBe(false)
    expect(isThreadCyclic(messages)).toBe(false)
  })

  it('detects the loop despite interleaved reasoning and bot messages', () => {
    // @note this is a regression gap: a reasoning model emits a
    // reasoning/text message between each tool call, which breaks both the
    // exact-suffix and contiguous-activity-tail heuristics - leaving this one as
    // the only heuristic that attributes the cycle
    const messages = [
      { type: 'reasoning', text: 'Let me search for a sofa.' },
      ...search('modern sofa'),
      { type: 'reasoning', text: 'Nothing found, let me try again.' },
      ...search('modern sofa'),
      { type: 'bot', text: 'Still looking...' },
      ...search('modern sofa'),
    ]

    expect(hasRepeatedResultRun(messages)).toBe(true)
    expect(hasRepeatedSuffix(messages)).toBe(false) // sanity: broken by interleaving
    expect(hasRepeatedActivityTail(messages)).toBe(false) // sanity: tail not contiguous
    expect(describeThreadCycle(messages)).toBe('repeated_result_run')
  })

  it('ignores injected internal `_` notices so a recovery nudge does not mask the loop', () => {
    // @note after the first detection the loop injects a `_cycleDetected` pair;
    // it must not break the run or the second detection (the hard stop) is lost
    const messages = [
      ...search('modern sofa'),
      ...search('modern sofa'),
      ...makeActivityMessagePair(
        '_cycleDetected',
        {},
        { warning: 'try a different approach' }
      ),
      ...search('modern sofa'),
    ]

    expect(hasRepeatedResultRun(messages)).toBe(true)
  })

  it('does not trip below the repetition threshold', () => {
    const messages = [...search('modern sofa'), ...search('modern sofa')]

    expect(hasRepeatedResultRun(messages)).toBe(false)
  })

  it('does not trip when results differ (the tool is making progress)', () => {
    const messages = [
      ...search('sofa', { ...emptySearchResult, records: [{ text: 'A' }] }),
      ...search('sofa', { ...emptySearchResult, records: [{ text: 'B' }] }),
      ...search('sofa', { ...emptySearchResult, records: [{ text: 'C' }] }),
    ]

    expect(hasRepeatedResultRun(messages)).toBe(false)
    expect(isThreadCyclic(messages)).toBe(false)
  })

  it('does not trip when a different tool result breaks the trailing run', () => {
    const messages = [
      ...search('modern sofa'),
      ...makeActivityMessagePair('getProduct', { id: 1 }, { name: 'Sofa X' }),
      ...search('modern sofa'),
    ]

    expect(hasRepeatedResultRun(messages)).toBe(false)
  })

  it('skips responses that have no result yet (still streaming)', () => {
    const pending = {
      type: 'activity',
      text: '',
      meta: { activity: { type: 'response', function: { name: 'search' } } },
    }

    const messages = [
      ...search('modern sofa'),
      pending,
      ...search('modern sofa'),
    ]

    // @note only two settled results are present, the pending one is skipped
    expect(hasRepeatedResultRun(messages)).toBe(false)
  })

  it('honors a custom minResultRepetitions', () => {
    const two = [...search('modern sofa'), ...search('modern sofa')]

    expect(hasRepeatedResultRun(two, { minResultRepetitions: 2 })).toBe(true)

    const three = [...two, ...search('modern sofa')]

    expect(hasRepeatedResultRun(three, { minResultRepetitions: 4 })).toBe(false)
  })
})

describe('hasRepeatedResultRun - adversarial / regression cases', () => {
  const { makeActivityMessagePair } = require('@/lib/activity')

  const emptyRecords = { records: [] }
  const call = (name, args, result = emptyRecords) =>
    makeActivityMessagePair(name, args, result)

  // --- must NOT flag legitimate, productive work (false-positive guards) ---

  it('does not flag a productive multi-tool agent run', () => {
    const messages = [
      { type: 'user', text: 'build a report' },
      ...call('search', { input: 'q1' }, { records: [{ text: 'a' }] }),
      { type: 'reasoning', text: 'found one, fetching it' },
      ...call('fetch', { id: 1 }, { title: 'A' }),
      ...call('search', { input: 'q2' }, { records: [{ text: 'b' }] }),
      ...call('summarize', { ids: [1, 2] }, { ok: true }),
    ]

    expect(hasRepeatedResultRun(messages)).toBe(false)
    expect(isThreadCyclic(messages)).toBe(false)
  })

  it('does not flag pagination through changing pages of the same tool', () => {
    const messages = [
      ...call('list', { page: 1 }, { items: ['a'], next: 2 }),
      ...call('list', { page: 2 }, { items: ['b'], next: 3 }),
      ...call('list', { page: 3 }, { items: ['c'], next: null }),
    ]

    expect(hasRepeatedResultRun(messages)).toBe(false)
  })

  it('does not flag the same tool when the query varies each call', () => {
    const messages = [
      ...call('search', { input: 'sofa' }),
      ...call('search', { input: 'sofas' }),
      ...call('search', { input: 'couch' }),
    ]

    expect(hasRepeatedResultRun(messages)).toBe(false)
  })

  // --- correctness of the detection itself ---

  it.each([
    ['an empty string', ''],
    ['null', null],
    ['zero', 0],
    ['false', false],
  ])('catches a loop whose settled result is %s', (_label, result) => {
    const messages = [
      ...makeActivityMessagePair('probe', { q: 1 }, result),
      ...makeActivityMessagePair('probe', { q: 1 }, result),
      ...makeActivityMessagePair('probe', { q: 1 }, result),
    ]

    expect(hasRepeatedResultRun(messages)).toBe(true)
  })

  it('skips a still-streaming response (no result key) without masking the loop', () => {
    const pending = {
      type: 'activity',
      text: '',
      meta: { activity: { type: 'response', function: { name: 'search' } } },
    }

    const messages = [
      ...call('search', { input: 'sofa' }),
      ...call('search', { input: 'sofa' }),
      ...call('search', { input: 'sofa' }),
      pending,
    ]

    expect(hasRepeatedResultRun(messages)).toBe(true)
  })

  it('does not throw on a circular result and treats matching ones as a loop', () => {
    const circular = {}

    circular.self = circular

    const messages = [
      ...makeActivityMessagePair('x', { a: 1 }, circular),
      ...makeActivityMessagePair('x', { a: 1 }, circular),
      ...makeActivityMessagePair('x', { a: 1 }, circular),
    ]

    expect(() => hasRepeatedResultRun(messages)).not.toThrow()
    expect(hasRepeatedResultRun(messages)).toBe(true)
  })

  it('ignores a non-string function name without throwing', () => {
    const weird = {
      type: 'activity',
      text: '',
      meta: {
        activity: { type: 'response', function: { name: 123, result: 'x' } },
      },
    }

    const messages = [
      weird,
      weird,
      ...call('search', { input: 'sofa' }),
      ...call('search', { input: 'sofa' }),
      ...call('search', { input: 'sofa' }),
    ]

    expect(() => hasRepeatedResultRun(messages)).not.toThrow()
    expect(hasRepeatedResultRun(messages)).toBe(true)
  })

  it('clamps minResultRepetitions below 2 up to 2', () => {
    const one = [...call('search', { input: 'sofa' })]
    const two = [...one, ...call('search', { input: 'sofa' })]

    expect(hasRepeatedResultRun(one, { minResultRepetitions: 1 })).toBe(false)
    expect(hasRepeatedResultRun(two, { minResultRepetitions: 1 })).toBe(true)
  })

  it('boundary: N-1 identical results does not trip, N does', () => {
    const base = [
      ...call('search', { input: 'sofa' }),
      ...call('search', { input: 'sofa' }),
    ]

    expect(hasRepeatedResultRun(base)).toBe(false) // 2 < default 3

    const plusOne = [...base, ...call('search', { input: 'sofa' })]

    expect(hasRepeatedResultRun(plusOne)).toBe(true)
  })

  // --- documented limitations / deliberate behavior ---

  it('flags the same failing call repeated across separate user turns (by design)', () => {
    // @note deliberate: the same exact call returning the same result three
    // times is unproductive even with user/bot messages between. Within a single
    // completion this only injects the model-facing recovery notice on the first
    // strike; a hard stop still needs a second strike (DEFAULT_MAX_CYCLES).
    const messages = [
      { type: 'user', text: 'sofa?' },
      ...call('search', { input: 'sofa' }),
      { type: 'bot', text: 'nothing found' },
      { type: 'user', text: 'sofa please' },
      ...call('search', { input: 'sofa' }),
      { type: 'bot', text: 'still nothing' },
      { type: 'user', text: 'sofa!!' },
      ...call('search', { input: 'sofa' }),
    ]

    expect(hasRepeatedResultRun(messages)).toBe(true)
  })

  it('does not catch an alternating two-tool loop on its own, but the thread is still cyclic', () => {
    // @note a contiguous A,B,A,B loop is not a single repeated call, so this
    // heuristic leaves it to hasRepeatedSuffix / hasRepeatedActivityTail
    const messages = [
      ...call('a', { x: 1 }),
      ...call('b', { y: 1 }),
      ...call('a', { x: 1 }),
      ...call('b', { y: 1 }),
    ]

    expect(hasRepeatedResultRun(messages)).toBe(false)
    expect(isThreadCyclic(messages)).toBe(true)
  })

  it('does not catch an interleaved alternating two-tool loop (known gap)', () => {
    const messages = [
      { type: 'reasoning', text: 'one' },
      ...call('a', { x: 1 }),
      { type: 'reasoning', text: 'two' },
      ...call('b', { y: 1 }),
      { type: 'reasoning', text: 'three' },
      ...call('a', { x: 1 }),
      { type: 'reasoning', text: 'four' },
      ...call('b', { y: 1 }),
    ]

    expect(hasRepeatedResultRun(messages)).toBe(false)
  })

  it('is sensitive to argument serialization shape (object vs equivalent string)', () => {
    // @note documents the brittleness: the engine stores arguments with a
    // consistent shape per tool, so an identical loop produces identical
    // signatures; a contrived shape mismatch is treated as distinct calls
    const messages = [
      ...call('search', { input: 'sofa' }),
      ...call('search', '{"input":"sofa"}'),
      ...call('search', { input: 'sofa' }),
    ]

    expect(hasRepeatedResultRun(messages)).toBe(false)
  })
})

/**
 * Builds a block of text from sentence fragments, joined the way a streamed
 * completion would read.
 */
function buildText(sentences) {
  return sentences.map((sentence) => `${sentence}.`).join(' ')
}

/**
 * The degenerate pattern this heuristic exists for: a small set of sentences
 * churned over and over, the way a model gets stuck in its reasoning before
 * ever emitting a tool call.
 */
function buildRunawayText(repetitions = 60) {
  return buildText(
    Array.from({ length: repetitions }, () => [
      'Let me call lint()',
      "I'll do it now",
      'Let me call lint()',
      'I need to verify',
    ]).flat()
  )
}

describe('hasRepeatedTextRun', () => {
  it('returns false for empty or non-string input', () => {
    expect(hasRepeatedTextRun('')).toBe(false)
    expect(hasRepeatedTextRun(undefined)).toBe(false)
    expect(hasRepeatedTextRun(null)).toBe(false)
  })

  it('returns false for short text below the unit floor', () => {
    expect(hasRepeatedTextRun('No. No. No.')).toBe(false)
  })

  it('returns false for healthy, varied prose', () => {
    const healthy = buildText([
      'The blueprint was written successfully',
      'Next I want to lint it to surface any warnings',
      'If the lint comes back clean I can confirm to the user',
      'Otherwise I will fix the reported issues first',
      'After that the user needs to click Build',
      'They also have to configure their secrets',
      'Finally the dataset has to be populated',
      'Then the assistant will be ready to answer questions',
      'I should keep the explanation concise',
      'There is no need to repeat myself',
    ])

    expect(hasRepeatedTextRun(healthy)).toBe(false)
  })

  it('detects a runaway repetition of a small set of sentences', () => {
    expect(hasRepeatedTextRun(buildRunawayText())).toBe(true)
  })

  it('tolerates punctuation-only variation between repeats', () => {
    const text = buildText(
      Array.from({ length: 20 }, () => [
        'Let me call lint()',
        'Let me call lint',
        'Let me call lint()!',
      ]).flat()
    )

    // all three normalize to the same unit
    expect(hasRepeatedTextRun(text)).toBe(true)
  })

  it('catches a degenerate tail even after a long healthy prefix', () => {
    const healthyPrefix = buildText(
      Array.from(
        { length: 80 },
        (_, index) => `Distinct sentence number ${index}`
      )
    )

    const degenerateTail = buildText(
      Array.from({ length: 40 }, () => [
        'Let me call lint()',
        'I need to verify',
      ]).flat()
    )

    expect(hasRepeatedTextRun(`${healthyPrefix} ${degenerateTail}`)).toBe(true)
  })

  it('respects the minUnits floor option', () => {
    const text = buildText(['Repeat me', 'Repeat me', 'Repeat me', 'Repeat me'])

    expect(hasRepeatedTextRun(text)).toBe(false)
    expect(hasRepeatedTextRun(text, { minUnits: 4 })).toBe(true)
  })

  it('respects the maxUniqueRatio option', () => {
    // 10 units, 6 unique -> ratio 0.6
    const text = buildText([
      'alpha',
      'bravo',
      'charlie',
      'delta',
      'echo',
      'foxtrot',
      'alpha',
      'bravo',
      'charlie',
      'delta',
    ])

    expect(hasRepeatedTextRun(text)).toBe(false) // 6 <= 10 * 0.5 is false
    expect(hasRepeatedTextRun(text, { maxUniqueRatio: 0.7 })).toBe(true) // 6 <= 10 * 0.7
  })
})

/**
 * Splits text into small fragments to simulate the way tokens arrive over a
 * stream (often mid-word).
 */
function chunkify(text, size = 3) {
  const chunks = []

  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size))
  }

  return chunks
}

/**
 * Feeds a sequence of streamed chunks through the guard and reports whether it
 * ever tripped.
 */
function feed(guard, chunks) {
  let tripped = false

  for (const chunk of chunks) {
    if (guard.push(chunk)) {
      tripped = true
    }
  }

  return tripped
}

describe('createRepetitionGuard', () => {
  it('trips on a tight repeated phrase streamed in fragments', () => {
    const text = 'Let me call lint(). I need to verify. '.repeat(6)

    expect(feed(createRepetitionGuard(), chunkify(text))).toBe(true)
  })

  it('handles words split across chunk boundaries (char by char)', () => {
    const text = 'Let me call lint(). I need to verify. '.repeat(6)

    expect(feed(createRepetitionGuard(), chunkify(text, 1))).toBe(true)
  })

  it('does not trip on varied prose', () => {
    const text =
      'The blueprint compiles cleanly and the lint step surfaced no warnings, ' +
      'so the assistant should be ready for the user to build it and configure ' +
      'their secrets before populating the dataset and trying a first message.'

    expect(feed(createRepetitionGuard(), chunkify(text))).toBe(false)
  })

  it('tolerates punctuation differences between repeats', () => {
    // "lint()." / "lint()!" / "lint()" all normalize to the same word
    const text = 'go to lint(). go to lint()! go to lint() '.repeat(3)

    expect(feed(createRepetitionGuard(), chunkify(text))).toBe(true)
  })

  it('respects the maxRepeats option', () => {
    const text = 'alpha beta gamma delta '.repeat(3)

    expect(feed(createRepetitionGuard(), chunkify(text))).toBe(false)
    expect(feed(createRepetitionGuard({ maxRepeats: 3 }), chunkify(text))).toBe(
      true
    )
  })

  it('does not trip when repeats are spread beyond the window', () => {
    const guard = createRepetitionGuard({ window: 8 })

    const chunks = []

    for (let index = 0; index < 5; index++) {
      chunks.push(...chunkify('let me call lint now '))
      chunks.push(
        ...chunkify(`here is some unique filler text number ${index} padding `)
      )
    }

    expect(feed(guard, chunks)).toBe(false)
  })

  it('latches once tripped', () => {
    const guard = createRepetitionGuard()

    expect(feed(guard, chunkify('ping pong '.repeat(6)))).toBe(true)

    // still true even when fed fresh, non-repeating text
    expect(guard.push('a completely different sentence with no repeats')).toBe(
      true
    )
  })

  it('ignores empty input', () => {
    const guard = createRepetitionGuard()

    expect(guard.push('')).toBe(false)
  })

  it('reports null reason until it trips', () => {
    const guard = createRepetitionGuard()

    expect(guard.reason()).toBeNull()

    guard.push('a completely fine and varied sentence ')

    expect(guard.reason()).toBeNull()
  })

  it('exposes the phrase and count that tripped it', () => {
    const guard = createRepetitionGuard()

    feed(guard, chunkify('go to lint now '.repeat(6)))

    const reason = guard.reason()

    expect(reason).not.toBeNull()
    expect(typeof reason.phrase).toBe('string')
    expect(reason.phrase.length).toBeGreaterThan(0)
    expect(reason.count).toBeGreaterThanOrEqual(4)
  })

  it('reports the original phrase text, not just the normalized form', () => {
    // @note the normalized `phrase` is good for matching/grouping but reads
    // poorly; `text` preserves the casing and punctuation the model emitted so a
    // stop notice can quote it back ("I kept repeating ...") instead of a cryptic
    // message. See getRunawayStopMessage in model.provider.openai.conv.
    const guard = createRepetitionGuard()

    feed(guard, chunkify('Let me call Lint(). '.repeat(6)))

    const reason = guard.reason()

    expect(reason).not.toBeNull()
    // normalized: lower-cased, punctuation stripped
    expect(reason.phrase).toBe('let me call lint')
    // original: preserves the model's casing and punctuation
    expect(reason.text).toContain('Lint()')
    expect(reason.text).toMatch(/Let me call Lint/)
  })

  it('reports the diversity and novelty ratios that triage the trip', () => {
    // @note these two diagnostics are what let a trip self-classify in Sentry: a
    // genuine loop collapses both; a wrongly-flagged progressing list keeps both
    // high. See observeRunawayTextRun in model.provider.openai.conv.
    const loop = createRepetitionGuard()

    feed(loop, chunkify('please call the linter now '.repeat(8)))

    const loopReason = loop.reason()

    expect(loopReason).not.toBeNull()
    expect(loopReason.uniqueRatio).toBeLessThan(0.4)
    expect(loopReason.hapaxRatio).toBeLessThan(0.1)

    // a real progressing list only trips under a permissive gate, and when it
    // does both ratios are markedly higher - the signal that it was real work
    const listSample = [
      'Maria at Acme Robotics - warm lead, not yet emailed.',
      'Tom at Bolt Dynamics - warm lead, not yet emailed.',
      'Ada at Cair Systems - warm lead, not yet emailed.',
      'Ravi at Dyna Power - warm lead, not yet emailed.',
      'Sven at Echo Mobility - warm lead, not yet emailed.',
      'Lena at Flux Energy - warm lead, not yet emailed.',
    ].join('\n')

    const list = createRepetitionGuard({ maxUniqueRatio: 0.5 })

    feed(list, chunkify(listSample))

    const listReason = list.reason()

    expect(listReason).not.toBeNull()
    expect(listReason.uniqueRatio).toBeGreaterThan(loopReason.uniqueRatio)
    expect(listReason.hapaxRatio).toBeGreaterThan(loopReason.hapaxRatio)
  })

  // @note regression coverage: the guard cut off an agent that was
  // legitimately triaging an enumerated list of prospects. Each line scored a
  // *distinct* person/company, but every line ended with the same short verdict
  // ("not a major lab"), so the 4-gram phrase recurred enough to trip the guard
  // even though the model was making real progress. List triage where a verdict
  // phrase recurs across otherwise-unique lines must NOT be treated as runaway.
  describe('does not trip on progressing list triage', () => {
    const listTriage = [
      '1. Tetiana K @ Master of Code Global - Conversational AI agency, not a major lab. Skip.',
      '2. Steve C @ Anthropic - Head of BD and Partnerships, this is a major lab, strong fit, qualify.',
      '3. Andres G @ Gupshup - Conversational messaging platform, not a major lab. Skip.',
      '4. Maureen L @ Writer - Enterprise AI writing platform, good company but not a major lab. Maybe.',
      '5. Madeline S @ Lila Sciences - AI for science, interesting but not a major lab. Skip.',
      '6. Diana Y @ Hippocratic AI - Healthcare AI startup, not a major lab. Skip.',
      '7. Adam F @ Waymo - Autonomous driving under Alphabet, not a major lab. Skip.',
      '8. Magnus B @ Cognite - Industrial data and analytics, not a major lab. Skip.',
      '9. Kevin M @ You.com - AI first search engine, not a major lab but interesting. Maybe.',
      '10. Brian V @ Cresta - AI for contact centers, not a major lab. Skip.',
      '11. Tammy D @ Turing - AI powered talent platform, not a major lab. Skip.',
      '12. Svetlana J @ Fractal - Analytics and AI services, not a major lab. Skip.',
    ].join('\n')

    it('does not trip even though the verdict phrase recurs many times', () => {
      expect(feed(createRepetitionGuard(), chunkify(listTriage))).toBe(false)
    })

    it('keeps tripping on a genuinely stuck loop (no progress between repeats)', () => {
      // @note same short phrase with no novel content between repeats - this is
      // a real runaway and must still be caught after the fix
      const stuckLoop = 'Let me search again. No new results. '.repeat(10)

      expect(feed(createRepetitionGuard(), chunkify(stuckLoop))).toBe(true)
    })

    it('exposes the recurring phrase that the gate let through (none here)', () => {
      const guard = createRepetitionGuard()

      feed(guard, chunkify(listTriage))

      // @note the verdict recurs, but the gate spared it, so it never tripped
      expect(guard.reason()).toBeNull()
    })
  })

  // @note a progressing investor list must not be cut off mid-work. Its later
  // lines are terse
  // and shared a short tail ("... active in AI. Not in CRM."), which dragged the
  // rolling-window unique-word ratio to 0.449 - just under the original 0.5 gate
  // - so the guard latched on the recurring "ai not in crm" 4-gram even though
  // every line named a distinct investor. The first 1BF fix only covered long,
  // wordy triage lines (ratio > 0.6); this terser variant slipped through. The
  // gate's default maxUniqueRatio was lowered from 0.5 to 0.4, which spares this
  // list while genuine low-information loops (ratio <= 0.347, see "progress vs
  // stuck") are still caught.
  describe('spares a short-tailed progressing list', () => {
    // @note the exact fixture wording matters because the trip sits on a
    // knife-edge: the "ai not in
    // crm" 4-gram recurs exactly 4 times across a ~48-word window whose unique
    // ratio is 0.449. Trimming the preamble or normalizing the punctuation shifts
    // the word counts off that edge, so keep this fixture byte-for-byte.
    const liveSample = [
      'Let me now compile what I know. The user has already submitted to Merantix AG and Pitch Protocol. Let me look at what\'s already in the CRM that they may have submitted to (there isn\'t a clear "submitted" indicator, but they have many investors tracked).',
      '',
      "Looking at the data I've got:",
      '',
      '**Top AI Agent investors (not already in CRM):**',
      '1. **Index Ventures** - tops the PitchBook list alongside a16z. Not in CRM.',
      '2. **General Catalyst** - 24 AI agent deals, $73.52M median. Not in CRM.',
      '3. **Khosla Ventures** - mentioned everywhere as top AI investor. Not in CRM.',
      '4. **Lightspeed Venture Partners** - very active in AI. Not in CRM.',
      '5. **Founders Fund** - active in AI. Not in CRM.',
      '6. **Bessemer Venture Partners** - active in agentic AI. Not in CRM.',
      '7. **Insight Partners** - huge AI portfolio. Not in CRM.',
      '8. **Coatue** - active in AI. Not in CRM.',
      '',
    ].join('\n')

    it('does not cut off the real investor list from the Sentry event', () => {
      // @note 8 distinct investors = real progress; must not be flagged a runaway
      expect(feed(createRepetitionGuard(), chunkify(liveSample))).toBe(false)
    })

    it('does not depend on chunk boundaries (char by char)', () => {
      expect(feed(createRepetitionGuard(), chunkify(liveSample, 1))).toBe(false)
    })

    it('still catches the terser, genuinely stuck form of the same lines', () => {
      // @note the safety net must stay sharp: the SAME short line with no novel
      // token between repeats carries no information and is a real loop (ratio
      // ~0.12, well under the 0.4 gate). The fix must not weaken this.
      const stuck = 'Acme - active in AI. Not in CRM. '.repeat(8)

      expect(feed(createRepetitionGuard(), chunkify(stuck))).toBe(true)
    })
  })

  // @note hardening for the loop-detection gate. These pin down the boundary
  // between "the model is progressing" (diverse content, must NOT be cut off)
  // and "the model is stuck" (low-diversity repetition, must be caught) so that
  // future tuning cannot silently regress either direction.
  describe('progress vs stuck (diversity gate)', () => {
    const trips = (text) => feed(createRepetitionGuard(), chunkify(text, 1))

    // --- progress: must NOT trip ---

    it('does not trip on scoring with substantive, distinct reasons', () => {
      const text = [
        '1. Acme Robotics scored three out of ten because the team is far too small and very early.',
        '2. Beta Industries scored seven out of ten because revenue is strong and the fit looks excellent.',
        '3. Gamma Systems scored two out of ten because the market is shrinking and churn keeps rising.',
        '4. Delta Group scored eight out of ten because expansion is rapid and margins remain healthy.',
        '5. Epsilon Labs scored four out of ten because funding is thin and growth has clearly stalled.',
      ].join('\n')

      expect(trips(text)).toBe(false)
    })

    it('does not trip on repeated section headers across distinct analyses', () => {
      const text = [
        'Analysis for Acme. Strengths: strong founding team and clear traction. Weaknesses: thin runway.',
        'Analysis for Beta. Strengths: large market and proven distribution. Weaknesses: heavy competition.',
        'Analysis for Gamma. Strengths: novel technology and patents. Weaknesses: long sales cycles ahead.',
        'Analysis for Delta. Strengths: loyal customers and high retention. Weaknesses: limited product range.',
      ].join('\n')

      expect(trips(text)).toBe(false)
    })

    // --- stuck: must trip ---

    it('trips when the same item is re-evaluated over and over', () => {
      const text = 'Candidate Acme Corp is not a major lab so skip it. '.repeat(
        8
      )

      expect(trips(text)).toBe(true)
    })

    it('trips on a two-sentence alternating loop', () => {
      expect(trips('Let me try again. That did not work. '.repeat(8))).toBe(
        true
      )
    })

    it('still catches a sustained loop that follows a healthy diverse prefix', () => {
      // @note the rolling window means an early healthy prefix only delays the
      // catch by ~one window; a runaway that keeps going is still stopped
      const text =
        'The blueprint compiles cleanly and lint surfaced no warnings so the ' +
        'assistant is ready for the user to build and configure their secrets. ' +
        'No new results. '.repeat(25)

      expect(trips(text)).toBe(true)
    })

    // --- boundary: terse, low-information templating is treated as a loop ---

    it('treats terse low-diversity templating as a loop (same class as a stable-stem loop)', () => {
      // @note structurally identical to "stable 4-word stem and a drifting
      // tail" above: a long fixed scaffold with only a token or two of drift per
      // line carries little information and is intentionally caught. The
      // production false positive differed because each line
      // carried a full sentence of distinct analysis.
      const text = [
        'Found Acme in Berlin, added it to the shortlist.',
        'Found Beta in London, added it to the shortlist.',
        'Found Gamma in Madrid, added it to the shortlist.',
        'Found Delta in Paris, added it to the shortlist.',
        'Found Epsilon in Rome, added it to the shortlist.',
        'Found Zeta in Oslo, added it to the shortlist.',
      ].join(' ')

      expect(trips(text)).toBe(true)
    })

    // --- the gate is tunable ---

    it('honours maxUniqueRatio: a higher ratio makes the guard more aggressive', () => {
      const diverseList = [
        '1. Tetiana K @ Master of Code Global - Conversational AI agency, not a major lab. Skip.',
        '2. Andres G @ Gupshup - Conversational messaging platform, not a major lab. Skip.',
        '3. Madeline S @ Lila Sciences - AI for science, interesting but not a major lab. Skip.',
        '4. Diana Y @ Hippocratic AI - Healthcare AI startup, not a major lab. Skip.',
        '5. Adam F @ Waymo - Autonomous driving under Alphabet, not a major lab. Skip.',
      ].join('\n')

      // the default gate (0.4) leaves diverse progress alone...
      expect(feed(createRepetitionGuard(), chunkify(diverseList))).toBe(false)

      // ...but a near-1 ratio trips on any recurring phrase regardless of diversity
      expect(
        feed(
          createRepetitionGuard({ maxUniqueRatio: 0.9 }),
          chunkify(diverseList)
        )
      ).toBe(true)
    })
  })

  // @note gate regression coverage (related regressions). The fix is a single
  // threshold (0.4) sitting in a ~0.10-wide gap, so it is easy to silently undo.
  // These spread realistic content across the boundary from many directions -
  // different domains, formats and languages - so a regression in either
  // direction is caught:
  //   - the SPARE cases marked "(brackets the gate)" land at a window ratio in
  //     (0.40, 0.50]; they pass now but would TRIP again if the gate were raised
  //     back toward 0.5, so they pin the fix in place;
  //   - the other SPARE cases never form a recurring phrase at all, guarding the
  //     n-gram / normalization / window logic rather than the threshold;
  //   - the CATCH cases keep the safety net sharp across varied loop shapes.
  // Ratios in comments are measured against the default guard (ngram 4, window
  // 48, maxRepeats 4); see the gate in createRepetitionGuard.
  describe('gate regression coverage (related regressions)', () => {
    const trips = (text) => feed(createRepetitionGuard(), chunkify(text, 1))
    const tripsAt = (text, maxUniqueRatio) =>
      feed(createRepetitionGuard({ maxUniqueRatio }), chunkify(text, 1))

    // --- SPARE: realistic lists that bracket the 0.4 gate (ratio in 0.40..0.50,
    // i.e. spared now but caught by the old 0.5 gate) ---

    it('spares a CRM prospect list sharing a short verdict tail (ratio ~0.43)', () => {
      const text = [
        'Maria at Acme Robotics - warm lead, not yet emailed.',
        'Tom at Bolt Dynamics - warm lead, not yet emailed.',
        'Ada at Cair Systems - warm lead, not yet emailed.',
        'Ravi at Dyna Power - warm lead, not yet emailed.',
        'Sven at Echo Mobility - warm lead, not yet emailed.',
        'Lena at Flux Energy - warm lead, not yet emailed.',
      ].join('\n')

      expect(trips(text)).toBe(false)
      // pins the fix: the old gate would have cut this real progress off
      expect(tripsAt(text, 0.5)).toBe(true)
    })

    it('spares a support-ticket triage list (ratio ~0.43)', () => {
      const text = [
        'Ticket 4012 about login errors - needs triage today.',
        'Ticket 4013 about billing - needs triage today.',
        'Ticket 4014 about exports - needs triage today.',
        'Ticket 4015 about webhooks - needs triage today.',
        'Ticket 4016 about search - needs triage today.',
        'Ticket 4017 about uploads - needs triage today.',
      ].join('\n')

      expect(trips(text)).toBe(false)
      expect(tripsAt(text, 0.5)).toBe(true)
    })

    it('spares a Dutch product/SKU list (non-English domain, ratio ~0.45)', () => {
      // @note an agent listing distinct entries from a non-English parts
      // catalogue that all happen to share a stock verdict must
      // not read as a runaway just because it is not in English.
      const text = [
        'ABB tweepolig C16 - momenteel niet op voorraad.',
        'Hager tweepolig C20 - momenteel niet op voorraad.',
        'Legrand vierpolig C32 - momenteel niet op voorraad.',
        'Schneider tweepolig B16 - momenteel niet op voorraad.',
        'Eaton driepolig C25 - momenteel niet op voorraad.',
        'Vynckier tweepolig C10 - momenteel niet op voorraad.',
      ].join('\n')

      expect(trips(text)).toBe(false)
      expect(tripsAt(text, 0.5)).toBe(true)
    })

    // --- SPARE: diverse formats/languages that never form a recurring phrase
    // (guards the n-gram / normalization / window logic, not the threshold) ---

    it('spares a changelog whose lines share a leading verb', () => {
      const text = [
        '- fix: guard against null in the parser path',
        '- fix: clamp the retry budget in the upload path',
        '- feat: add pagination to the search endpoint',
        '- perf: cache the tokenizer between requests',
        '- docs: rewrite the webhook setup section',
        '- chore: bump the redis client to v5',
      ].join('\n')

      expect(trips(text)).toBe(false)
    })

    it('spares code-review comments that all end with the same instruction', () => {
      const text = [
        'src/auth.ts:12 - missing await on the token refresh, fix it.',
        'src/cache.ts:88 - unbounded map will leak memory, fix it.',
        'src/api.ts:140 - swallowing the error here is wrong, fix it.',
        'src/db.ts:31 - the transaction is never committed, fix it.',
        'src/ui.tsx:77 - the effect has a stale closure, fix it.',
      ].join('\n')

      expect(trips(text)).toBe(false)
    })

    it('spares a French-language triage list (ratio ~0.59)', () => {
      const text = [
        '1. Index Ventures - parmi les plus actifs, pas dans le CRM.',
        '2. General Catalyst - portefeuille IA solide, pas dans le CRM.',
        '3. Khosla Ventures - investisseur de premier plan, pas dans le CRM.',
        '4. Lightspeed - tres actif en IA, pas dans le CRM.',
        '5. Bessemer - actif en IA agentique, pas dans le CRM.',
      ].join('\n')

      expect(trips(text)).toBe(false)
    })

    // --- CATCH: genuine loops in varied shapes/languages stay caught ---

    it('catches a Dutch reasoning loop (the 1BE domain, ratio ~0.14)', () => {
      const text = 'Ik zoek opnieuw naar de automaat. Geen resultaat. '.repeat(
        8
      )

      expect(trips(text)).toBe(true)
    })

    it('catches a self-apology / "try a different approach" loop (ratio ~0.22)', () => {
      const text =
        'I apologize for the confusion. Let me try a different approach. '.repeat(
          6
        )

      expect(trips(text)).toBe(true)
    })

    it('catches a tool-call narration loop (ratio ~0.16)', () => {
      const text = 'Let me call the search tool. Calling search now. '.repeat(6)

      expect(trips(text)).toBe(true)
    })
  })
})

// @note empirical regression set derived from anonymised production-like
// failures. Every case is a FALSE POSITIVE: the guard cut off legitimate
// structured output mid-stream. The string fixtures reproduce the *shape* of
// the buffers the guard saw - line counts, repeated annotation tails, distinct
// line leads and token diversity - so coverage matches real behaviour.
// They must NOT trip; the genuine-loop cases beside them must still trip so the
// safety net stays sharp.
//
// @note the fixtures are ANONYMISED. Figures, schema identifiers, place names,
// statute and document references and product names were substituted 1:1 with
// neutral equivalents of the same shape, so the lexical-diversity ratios these
// cases pin are unchanged while no customer content remains. Keep it that way:
// when adding a case from a production trip, carry over the structure and
// replace anything that identifies a customer, a person or a place. These cases
// Anything added here must remain suitable for publication.
describe('production-like repetition-guard regressions', () => {
  const trips = (text) => feed(createRepetitionGuard(), chunkify(text, 1))

  // --- false positives: legitimate output that must be spared ---

  // a TSV financial table the model echoed inside a code fence, dominated by
  // repeated "0.00" rows.
  const tsvTable =
    'Cole abaixo diretamente no Excel (formato **TSV**).  \n**Aba DRE → clique na célula P‑3 da linha 4** (“RECEITA BRUTA DE VENDAS INTERNAS”) e dê **Ctrl+V**.\n\n> Colunas no bloco: **P‑3 (2023) | P‑2 (2024) | P‑1 (2025) | P0 (01-03/2026)**  \n> Linhas: exatamente na ordem do template (da linha 4 até “Lucro disponível do período”).\n\n```tsv\n31504927.60\t35271408.35\t41638052.91\t12903617.48\n0.00\t0.00\t0.00\t0.00\n31504927.60\t35271408.35\t41638052.91\t12903617.48\n-5108334.72\t-7241160.83\t-9425801.19\t-3140772.55\n26396592.88\t28030247.52\t32212251.72\t9762845.93\n0.00\t0.00\t0.00\t0.00\n-11338460.07\t-14205933.41\t-19460218.35\t-5613074.28\n-11338460.07\t-14205933.41\t-19460218.35\t-5613074.28\n8815307.00\t9427119.66\t11336729.44\t4108562.37\n0.00\t0.00\t0.00\t0.00\n-7419023.61\t-7640155.28\t-8551944.17\t-3172608.95\n0.00\t0.00\t0.00\t0.00\n1395283.44\t1786964.21\t2784930.66\t935657.28\n0.00\t0.00\t0.00\t0.00\n1395283.44\t1786964.21\t2784930.66\t935657.28\n24118.53\t31740.92\t0.00\t208531.74\n-537820.16\t-604915.37\t0.00\t-31846.20\n0.00\t0.00\t0.00\t0.00\n\n'

  it('spares a fenced TSV financial table (repeated 0.00 rows)', () => {
    expect(trips(tsvTable)).toBe(false)
  })

  // generated SQL inside a fence, with repeated CASE WHEN ... ELSE 0 END clauses.
  const sqlBlock =
    "--\n\n## 🔍 Explicação da lógica\n\n### Como o `CASE` decide qual campo preencher:\n\n```\nVALORAJUSTE = 1.000,00  (positivo)\n      │\n      ├── TAXAPOSITIVO   = 1.000,00 × 25% = 250,00  ✅\n      ├── TAXANEGATIVO   = 0                         ✅\n      ├── CONTRIBPOSITIVO = 1.000,00 × 20% = 200,00  ✅\n      └── CONTRIBNEGATIVO = 0                         ✅\n\nVALORAJUSTE = -1.000,00  (negativo)\n      │\n      ├── TAXAPOSITIVO   = 0                          ✅\n      ├── TAXANEGATIVO   = -1.000,00 × 25% = -250,00 ✅\n      ├── CONTRIBPOSITIVO = 0                          ✅\n      └── CONTRIBNEGATIVO = -1.000,00 × 20% = -200,00 ✅\n\nVALORAJUSTE = 0  (zero)\n      │\n      ├── TAXAPOSITIVO   = 0  ✅\n      ├── TAXANEGATIVO   = 0  ✅\n      ├── CONTRIBPOSITIVO = 0  ✅\n      └── CONTRIBNEGATIVO = 0  ✅\n```\n\n---\n\n## ⚠️ Observações importantes\n\n> **1. O script atualiza todos os registros da tabela**\n> Caso precise atualizar apenas registros de um período ou de uma aplicação específica, adicione um `WHERE`. Por exemplo:\n> ```sql\n> WHERE COMPETENCIA = '2024-01-01'\n> -- ou\n> WHERE IDREGISTRO = 123\n> ```\n\n> **2. Recomendação - execute um SELECT antes do UPDATE**\n> Para validar os valores antes de gravar, rode este SELECT:\n> ```sql\n> SELECT  VALORAJUSTE,\n>         CASE WHEN VALORAJUSTE > 0 THEN VALORAJUSTE * 0.25 ELSE 0 END AS TAXAPOSITIVO,\n>         CASE WHEN VALORAJUSTE < 0 THEN VALORAJUSTE * 0.25 ELSE 0 END AS TAXANEGATIVO,\n>         CASE WHEN VALORAJUSTE > 0 THEN VALORAJUSTE * 0.20 ELSE 0 END AS CONTRIBPOSITIVO,\n>         CASE WHEN VALORAJUSTE < 0 \n"

  it('spares fenced SQL with repeated CASE WHEN clauses', () => {
    expect(trips(sqlBlock)).toBe(false)
  })

  // a transit timetable: each line a distinct departure time, many sharing the
  // same parenthetical annotation tail.
  const busSchedule =
    'Os próximos horários da linha 118 saindo de Vila Central hoje são:\n\n- 04:30\n- 04:55\n- 05:20\n- 05:25 (via bairro Parque Norte)\n- 05:45 (via bairro Parque Norte)\n- 05:45\n- 06:10 (via bairro Parque Norte)\n- 06:10\n- 06:30 (via bairro Parque Norte)\n- 06:50 (via bairro Parque Norte)\n- 07:10\n- 07:37\n- 08:04\n- 08:40\n- 09:14\n- 09:48\n- 10:32\n- 11:10\n- 11:37\n- 12:04\n- 12:31\n- 12:58\n- 13:25\n- 13:52\n- 14:19\n- 14:46\n- 15:13 (via bairro Parque Norte)\n- 15:40 (via bairro Parque Norte)\n- 16:07 (via bairro Parque Norte)\n- 16:34 (via bairro Parque Norte)\n- 17:01 (via bairro Parque Norte)\n- 17:28 (via bairro Parque Norte)\n- 18:01 (via bairro Parque Norte)\n- 18:34 (via bairro Parque Norte)\n- 19:07 (finaliza viagem em Jardim Aurora)\n- 19:40 (finaliza viagem em Jardim Aurora)\n- 20:18 (finaliza viagem em Jardim Aurora)\n- 20:56\n- 21:34 (finaliza viagem em Jardim Aurora\n'

  it('spares a bus timetable (distinct times, recurring annotation)', () => {
    expect(trips(busSchedule)).toBe(false)
  })

  // a pretty-printed JSON spreadsheet: each row a distinct cell key, repeating
  // the same legal reference as the value.
  const jsonListing =
    '{\n  "A1": "CARGO",\n  "B1": "",\n  "C1": "REFERÊNCIA",\n  "A2": "COORDENADORES DE AREA",\n  "B2": "REMUNERAÇÃO PREVISTA NA LEI MUNICIPAL N.º 1.234/2000",\n  "C2": "LEI MUNICIPAL N.º 1.234/2000",\n  "A3": "VICE-COORDENADORES DE AREA",\n  "B3": "REMUNERAÇÃO PREVISTA NA LEI MUNICIPAL N.º 1.234/2000",\n  "C3": "LEI MUNICIPAL N.º 1.234/2000",\n  "A4": "ASSISTENTES ADMINISTRATIVOS",\n  "B4": "REMUNERAÇÃO PREVISTA NA LEI MUNICIPAL N.º 1.234/2000",\n  "C4": "LEI MUNICIPAL N.º 1.234/2000"\n}\n'

  it('spares a JSON spreadsheet repeating a legal reference', () => {
    expect(trips(jsonListing)).toBe(false)
  })

  // a document revision with the same list item quoted across several sections.
  const privacyDoc =
    'Recebi a nova versão. Segue a revisão comparativa.\n\n---\n\n# 📋 Revisão - IN-DOC-NI-001 | Aviso de Privacidade\n\n---\n\n## ✅ Pendências anteriores resolvidas\n\n| # | Item | Situação |\n|---|---|---|\n| 2 | Título 5.1.13 padronizado: "Uso de Inteligência Artificial Generativa" | ✅ Corrigido |\n| 3 | Pontuação bases legais 5.1.6: itens 4 e 5 corrigidos para ponto e vírgula/ponto final | ✅ Corrigido |\n| 3 | Pontuação bases legais 5.2.7: itens 5 e 6 corrigidos | ✅ Corrigido |\n| 4 | Ponto final incluído no inciso 12 (5.1.9 e 5.2.10) | ✅ Corrigido |\n\n---\n\n## ⚠️ Pendência remanescente\n\n---\n\n### 🔴 1. Listas internas de itens - Ainda desatualizadas em ambos os avisos\n\nEsta é a **única pendência obrigatória** restante.\n\n**Aviso Interno** - lista no corpo do texto ainda com 13 itens:\n> *"13. Alterações neste Aviso de Privacidade."*\n\n**Deve ser:**\n> *"13. Uso de Inteligência Artificial Generativa;*\n> *14. Alterações neste Aviso de Privacidade."*\n\n---\n\n**Aviso Externo** - lista no corpo do texto ainda com 15 itens:\n> *"15. Alterações neste Aviso de Privacidade."*\n\n**Deve ser:**\n> *"15. Uso de Inteligência Artificial Generativa;*\n> *16. Alterações neste Aviso de Privacidade."*\n'

  it('spares a revision doc with repeated blockquoted list items', () => {
    expect(trips(privacyDoc)).toBe(false)
  })

  // @note CJK prose carrying embedded digits. The old ASCII-only normalization
  // stripped the Korean and left a phantom "4 4 4 4" run; the fix keeps Unicode
  // letters so each "4-something" stays a distinct token.
  const cjkDigitText = [
    '4일 동안 비가 내렸다.',
    '4호선 열차가 늦게 도착했다.',
    '4시에 친구를 만났다.',
    '4번 출구로 나갔다.',
    '4층 사무실에서 일했다.',
    '4년 전 이야기를 떠올렸다.',
    '4월에 여행을 떠났다.',
    '4호 건물 앞에서 기다렸다.',
  ].join(' ')

  it('spares CJK prose whose embedded digits used to collapse to a phantom loop', () => {
    expect(trips(cjkDigitText)).toBe(false)
  })

  // --- genuine loops in the same domains: the safety net must still fire ---

  it('still catches a stuck transit bot (no progress between repeats)', () => {
    const stuck =
      'Não encontrei horários para essa linha. Vou verificar novamente. '.repeat(
        8
      )

    expect(trips(stuck)).toBe(true)
  })

  it('still catches an identical-line bulleted loop (newlines, ~zero novelty)', () => {
    const stuck = Array.from(
      { length: 10 },
      () => '- erro ao consultar a base'
    ).join('\n')

    expect(trips(stuck)).toBe(true)
  })

  // @note residual known gap (documented). This list is rendered inside a single
  // JSON string value, so its line breaks are escaped (\n) rather than real
  // newlines - the structural-enumeration signal cannot see the rows, and there
  // is no code fence either. Low volume (a tool result echoed verbatim). Flip to
  // a plain `it` once escaped line breaks are handled.
  const productList =
    '{\n  "resposta": "Encontramos informações sobre aspiradores de pó da Northwind, mas não há um modelo específico chamado \\"Lite\\" listado. Alguns modelos disponíveis são:\\n- Aspirador de pó EASY2: peso 4,7 kg, capacidade de armazenamento de pó 1,6 L, tensão 127/220V.\\n- Aspirador de pó EASY1: peso 4,5 kg, capacidade de armazenamento de pó 1,6 L, tensão 127/220V.\\n- Aspirador de pó POWERFORCE PFC02: peso 6 kg, capacidade de armazenamento de pó 3,5 L, tensão 127/220V.\\n- Aspirador de pó STK10: peso 1,7 kg, tensão 127/220V.\\n- Aspirador de pó\n'

  it.failing(
    'spares a product list nested in a JSON string (escaped newlines)',
    () => {
      expect(trips(productList)).toBe(false)
    }
  )

  // @note residual known gap (documented). A markdown comparison table contrasting
  // almost-identical document sections: real newlines, but only two distinct row
  // keys (5.1.9 / 5.2.10, each appearing twice), so BOTH novelty signals read it
  // as a loop - whole-window hapax is ~0 and the distinct line-lead count is 2,
  // under MIN_DISTINCT_LINE_LEADS (3). We do not drop that floor to 2 because an
  // A/B alternating loop also has two line starts and must stay caught. Genuinely
  // borderline (near-duplicate rows), so left caught. Flip to a plain `it` only if
  // a stronger table-structure signal is added.
  const nacionalTable =
    'Recebi a nova versão. Vou fazer a revisão completa e consolidada.\n\n---\n\n# 📋 Revisão Final - IN-DOC-NI-001 | Aviso de Privacidade\n\n---\n\n## ✅ Avanços confirmados nesta versão\n\n| Item | Situação |\n|---|---|\n| Seção 7: Lei nº 13.709/2018 consolidada com "e suas alterações" | ✅ Correto |\n| Leis 13.853/2019 e 14.010/2020 riscadas | ✅ Correto |\n| Canal de contato 5.2.1 atualizado | ✅ Correto |\n| Política de Proteção de Dados na seção 6 | ✅ Correto |\n| IAGen incluído (5.1.13 e 5.2.15) | ✅ Correto |\n| Encarregado de Dados incluído (5.1.9 e 5.2.10) | ✅ Correto |\n\n---\n\n## ⚠️ Pendências remanescentes\n\n---\n\n### 🔴 1. "Agência" → "Autoridade" - Ainda não corrigido\n\nConfirmado pela **Lei nº 15.352/2026** que você citou, o nome correto passou a ser **"Agência"**. Porém, há uma **inconsistência interna** no próprio documento que precisa ser resolvida:\n\n| Local | Texto atual | Situação |\n|---|---|---|\n| 5.1.9 - parágrafo final | *"Agência Nacional de Proteção de Dados (ANPD)"* | ✅ Correto |\n| 5.2.10 - parágrafo final | *"Agência Nacional de Proteção de Dados (ANPD)"* | ✅ Correto |\n| 5.1.9 - inciso 5 | *"após a regulamentação pela **Autoridade** Nacional de Proteção de Dados"* | 🔴 Desatualizado |\n| 5.2.10 - inciso 5 | *"após a regulamentação pela **Autoridade** Nacional de Proteção de Dados"* | 🔴'

  it.failing(
    'spares a near-duplicate markdown comparison table (genuinely low novelty)',
    () => {
      expect(trips(nacionalTable)).toBe(false)
    }
  )

  // @note a bulleted list of distinct medical-device models whose last several
  // items share a LONG
  // annotation ("uso off-label devido à ausência de marcador de coil", ~9 words).
  // That tail repeats enough to drag whole-window hapax to 0.082 - under the 0.1
  // floor - so the hapax signal alone wrongly declined this plainly-progressing
  // list. The distinct-line-lead signal rescues it: the lines start with many
  // distinct device names (>= MIN_DISTINCT_LINE_LEADS), so it is now spared.
  const medicalDeviceList =
    'Os seguintes microcateteres são compatíveis com o Coilset VFC 11 - 20mm:\n\n- Alpha 10\n- Alpha 14\n- Bravo 1018\n- Bravo SL-10\n- Bravo XT-17\n- Delta 17\n- Charlie Duo 156\n- Headway 17 Advanced\n- Headway 21\n- Neuroslider 17 DLC\n- Neuroslider 17\n- Neuroslider 21\n- Phenom 17\n- Phenom 21\n- Prowler 10\n- Prowler 14\n- Prowler Select LP ES\n- Prowler Select Plus\n- Prowler Plus\n- Rebar 18\n- Trevo Pro 14 (uso off-label devido à ausência de marcador de coil)\n- Trevo Pro 18 (uso off-label devido à ausência de marcador de coil)\n- Trevo Trak 21 (uso off-label devido à ausência de marcador de coil)\n- Vasco+ 10\n- Vasco+ 18\n- Via 17\n- Via 21 (uso off-label devido à ausência'

  it('spares a device list whose distinct items share a long off-label annotation', () => {
    expect(trips(medicalDeviceList)).toBe(false)
  })

  // @note the production guard sets a minChars floor (wired at the call site in
  // model.provider.openai.conv). Short repetitive output - which is all the
  // remaining residuals are - falls below the floor and is never interrupted; a
  // genuine runaway is unbounded and crosses it. The bare guard above (minChars 0)
  // still trips on those residuals, which is why they stay it.failing; these pin
  // the production policy that resolves them.
  describe('minChars length gate (production policy)', () => {
    const PROD_MIN_CHARS = 2000
    const tripsWith = (text, minChars) =>
      feed(createRepetitionGuard({ minChars }), chunkify(text, 1))

    it('spares the short residuals at the production minimum', () => {
      // both are well under PROD_MIN_CHARS, so the guard never arms on them
      expect(tripsWith(productList, PROD_MIN_CHARS)).toBe(false)
      expect(tripsWith(nacionalTable, PROD_MIN_CHARS)).toBe(false)
    })

    it('still trips a genuine runaway that runs past the minimum', () => {
      const runaway = 'Let me try again. No new results. '.repeat(100)

      expect(tripsWith(runaway, PROD_MIN_CHARS)).toBe(true)
    })

    it('leaves a short loop alone above the floor but still catches it without one', () => {
      const shortLoop = 'No new results. '.repeat(8)

      expect(tripsWith(shortLoop, PROD_MIN_CHARS)).toBe(false)
      expect(tripsWith(shortLoop, 0)).toBe(true)
    })
  })
})

describe('describeThreadCycle', () => {
  it('returns null for a non-cyclic thread', () => {
    const messages = [
      { type: 'user', text: 'hello' },
      { type: 'bot', text: 'hi there, how can I help?' },
    ]

    expect(describeThreadCycle(messages)).toBeNull()
  })

  it('names the heuristic that tripped, agreeing with isThreadCyclic', () => {
    const messages = [{ type: 'bot', text: 'go to lint now. '.repeat(20) }]

    expect(isThreadCyclic(messages)).toBe(true)
    expect(describeThreadCycle(messages)).toBe('repeated_message_text_run')
  })
})

describe('isThreadCyclic with runaway message text', () => {
  const userMessage = (text) => ({ type: 'user', text })
  const botMessage = (text) => ({ type: 'bot', text })

  it('flags a thread whose trailing message contains a runaway run', () => {
    const messages = [
      userMessage('please build me a support assistant'),
      botMessage('Sure, let me put together a blueprint for that.'),
      userMessage('is it ready?'),
      botMessage(buildRunawayText()),
    ]

    expect(isThreadCyclic(messages)).toBe(true)
  })

  it('does not flag a healthy conversation', () => {
    const messages = [
      userMessage('please build me a support assistant'),
      botMessage('Sure, let me put together a blueprint for that.'),
      userMessage('is it ready?'),
      botMessage(
        'Yes, the blueprint is written and lints clean. Click Build, configure your secrets, then populate the dataset.'
      ),
    ]

    expect(isThreadCyclic(messages)).toBe(false)
  })

  it('only inspects the trailing messages', () => {
    const messages = [
      botMessage(buildRunawayText()),
      ...Array.from({ length: 6 }, (_, index) =>
        botMessage(`A perfectly healthy follow-up message number ${index}.`)
      ),
    ]

    expect(isThreadCyclic(messages)).toBe(false)
  })

  // @note reasoning and activity are internal working channels
  // (the model's scratchpad and its tool-call output). They are legitimately
  // repetitive and are not the user-facing answer, so a runaway run inside them
  // must not flag the thread as cyclic - matching the live stream guard, which
  // now only inspects answer text.
  it('does not flag a runaway run inside a trailing reasoning message', () => {
    const messages = [
      userMessage('please build me a support assistant'),
      botMessage('Sure, let me put together a blueprint for that.'),
      userMessage('is it ready?'),
      { type: 'reasoning', text: buildRunawayText() },
    ]

    expect(isThreadCyclic(messages)).toBe(false)
  })

  it('does not flag a runaway run inside a trailing activity message', () => {
    const messages = [
      userMessage('please build me a support assistant'),
      userMessage('is it ready?'),
      { type: 'activity', text: buildRunawayText() },
    ]

    expect(isThreadCyclic(messages)).toBe(false)
  })
})

// Adversarial / edge inputs. The `it` cases are guarantees we want to hold; the
// `it.failing` cases document known gaps - they pass while the gap exists and
// will start failing (alerting us) once the gap is fixed.
describe('strange cases - no false positives', () => {
  const trips = (text) => feed(createRepetitionGuard(), chunkify(text, 1))

  it('does not trip on a markdown bullet list', () => {
    const text =
      '- set up the project\n- install dependencies\n- configure the env\n' +
      '- run the tests\n- deploy the app\n- celebrate the launch\n'

    expect(trips(text)).toBe(false)
  })

  it('does not trip on varied markdown table rows', () => {
    const text =
      '| name | role |\n| alice | admin |\n| bob | user |\n' +
      '| carol | guest |\n| dave | owner |\n| erin | viewer |\n'

    expect(trips(text)).toBe(false)
  })

  it('does not trip on repeated code lines with varying values', () => {
    const text =
      'assert x equals 1\nassert x equals 2\nassert x equals 3\n' +
      'assert x equals 4\nassert x equals 5\nassert x equals 6\n'

    expect(trips(text)).toBe(false)
  })

  it('does not trip on counting numbers', () => {
    expect(trips('1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18')).toBe(false)
  })

  it('does not trip on an emoji or punctuation storm', () => {
    expect(trips('🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉')).toBe(false)
    expect(trips('!!!! ???? .... ,,,, ---- ____ ==== ++++')).toBe(false)
  })

  it('does not trip on legit progress with a short drifting stem', () => {
    const text = Array.from({ length: 12 }, (_, i) => `run step ${i} `).join('')

    expect(trips(text)).toBe(false)
  })

  it('does not trip on three repeats (under the default threshold)', () => {
    expect(trips('please call the linter now '.repeat(3))).toBe(false)
  })
})

describe('strange cases - loops that are caught', () => {
  const trips = (text) => feed(createRepetitionGuard(), chunkify(text, 1))

  it('catches a loop with a stable 4-word stem and a drifting tail', () => {
    const text = Array.from(
      { length: 10 },
      (_, i) => `let me call lint attempt number ${i} `
    ).join('')

    expect(trips(text)).toBe(true)
  })

  it('catches a loop separated by tabs and newlines', () => {
    expect(trips('go\tgo\ngo go\tgo\ngo go go go go go')).toBe(true)
  })

  it('catches a newline-delimited loop via the backstop', () => {
    expect(hasRepeatedTextRun('call the linter now\n'.repeat(20))).toBe(true)
  })
})

describe('strange cases - known gaps', () => {
  const trips = (text) => feed(createRepetitionGuard(), chunkify(text, 1))

  // GAP: the guard splits on whitespace, so a loop with no spaces at all (one
  // giant token) never forms words and is never inspected.
  it.failing('catches a repeated word with no whitespace', () => {
    expect(trips('lint'.repeat(50))).toBe(true)
  })

  // GAP: same whitespace-boundary root cause - space-less scripts (Chinese,
  // Japanese, Thai) are not tokenized into words at all.
  it.failing('catches a CJK loop with no spaces', () => {
    expect(trips('请调用检查工具'.repeat(30))).toBe(true)
  })

  // GAP: the backstop segments on sentence terminators (.!?\n); a degenerate
  // run-on with none of those collapses to a single unit below the floor. (The
  // live guard still catches the spaced version mid-stream.)
  it.failing('backstop catches a run-on loop with no terminators', () => {
    expect(hasRepeatedTextRun('call the linter now '.repeat(30))).toBe(true)
  })

  // GAP: hasRepeatedMessageTextRun inspects each trailing message on its own, so
  // a loop split across two adjacent messages where neither half trips alone is
  // missed.
  it.failing('isThreadCyclic catches a loop split across two messages', () => {
    const half = 'let me call lint now. I need to verify. '.repeat(3)

    const messages = [
      { type: 'user', text: 'go' },
      { type: 'bot', text: half },
      { type: 'bot', text: half },
    ]

    expect(isThreadCyclic(messages)).toBe(true)
  })
})
