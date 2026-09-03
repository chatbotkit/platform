import {
  CHARS_PER_TOKEN,
  COMPACTION_KEEP_RECENT_RATIO,
  COMPACTION_MIN_MESSAGES,
  COMPACTION_TRIGGER_RATIO,
  TOKEN_ESTIMATE_SAFETY_MARGIN,
  applyCompactionSummary,
  buildCompactionSummaryPrompt,
  checkCompaction,
  estimateMessageTokens,
  estimateMessagesTokens,
  splitMessagesForCompaction,
} from '@/lib/conversation.compaction'

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/**
 * Build a simple message object for tests.
 *
 * @param {'user'|'bot'|'context'|'backstory'|'activity'|'instruction'} type
 * @param {string} text
 */
function makeMessage(type, text) {
  return { type, text }
}

/**
 * Build a list of alternating user / bot messages, each of `charCount` characters.
 */
function makeConversation(turns, charCount = 100) {
  const messages = []

  for (let i = 0; i < turns; i++) {
    messages.push(
      makeMessage(i % 2 === 0 ? 'user' : 'bot', 'x'.repeat(charCount))
    )
  }

  return messages
}

// ---------------------------------------------------------------------------
// estimateMessageTokens
// ---------------------------------------------------------------------------

describe('estimateMessageTokens', () => {
  it('returns 0 for an empty text', () => {
    expect(estimateMessageTokens(makeMessage('user', ''))).toBe(0)
  })

  it('applies chars-per-token ratio and safety margin', () => {
    const text = 'a'.repeat(400)
    const expected = Math.ceil(
      (400 / CHARS_PER_TOKEN) * TOKEN_ESTIMATE_SAFETY_MARGIN
    )

    expect(estimateMessageTokens(makeMessage('user', text))).toBe(expected)
  })

  it('rounds up (ceiling) rather than down', () => {
    // 1 char → ceil(0.25 * 1.25) = ceil(0.3125) = 1
    expect(estimateMessageTokens(makeMessage('user', 'a'))).toBe(1)
  })

  it('is consistent across message types', () => {
    const text = 'hello world'
    const expected = estimateMessageTokens(makeMessage('user', text))

    expect(estimateMessageTokens(makeMessage('bot', text))).toBe(expected)
    expect(estimateMessageTokens(makeMessage('context', text))).toBe(expected)
  })
})

// ---------------------------------------------------------------------------
// estimateMessagesTokens
// ---------------------------------------------------------------------------

describe('estimateMessagesTokens', () => {
  it('returns 0 for an empty list', () => {
    expect(estimateMessagesTokens([])).toBe(0)
  })

  it('sums individual estimates', () => {
    const msgs = [
      makeMessage('user', 'a'.repeat(100)),
      makeMessage('bot', 'b'.repeat(200)),
    ]
    const expected =
      estimateMessageTokens(msgs[0]) + estimateMessageTokens(msgs[1])

    expect(estimateMessagesTokens(msgs)).toBe(expected)
  })

  it('is additive for a long list', () => {
    const msgs = makeConversation(10, 100)
    let sum = 0

    for (const m of msgs) {
      sum += estimateMessageTokens(m)
    }

    expect(estimateMessagesTokens(msgs)).toBe(sum)
  })
})

// ---------------------------------------------------------------------------
// splitMessagesForCompaction
// ---------------------------------------------------------------------------

describe('splitMessagesForCompaction', () => {
  it('returns empty summarize bucket when below COMPACTION_MIN_MESSAGES', () => {
    const msgs = makeConversation(COMPACTION_MIN_MESSAGES - 1)
    const result = splitMessagesForCompaction(msgs, { maxTokens: 1000 })

    expect(result.messagesToSummarize).toHaveLength(0)
    expect(result.messagesToKeep).toEqual(msgs)
  })

  it('keeps at least ceil(length * COMPACTION_KEEP_RECENT_RATIO) messages', () => {
    const msgs = makeConversation(20, 100)
    const minKept = Math.max(
      2,
      Math.ceil(msgs.length * COMPACTION_KEEP_RECENT_RATIO)
    )
    const result = splitMessagesForCompaction(msgs, { maxTokens: 1000 })

    expect(result.messagesToKeep.length).toBeGreaterThanOrEqual(minKept)
  })

  it('messagesToSummarize + messagesToKeep reconstructs the original list', () => {
    const msgs = makeConversation(20, 100)
    const { messagesToSummarize, messagesToKeep } = splitMessagesForCompaction(
      msgs,
      { maxTokens: 1000 }
    )

    expect([...messagesToSummarize, ...messagesToKeep]).toEqual(msgs)
  })

  it('respects explicit keepRecentCount', () => {
    const msgs = makeConversation(10, 100)
    const { messagesToKeep } = splitMessagesForCompaction(msgs, {
      maxTokens: 1000,
      keepRecentCount: 3,
    })

    expect(messagesToKeep).toHaveLength(3)
    expect(messagesToKeep).toEqual(msgs.slice(-3))
  })

  it('never places backstory messages in the summarize bucket', () => {
    const msgs = [
      makeMessage('backstory', 'system context'),
      ...makeConversation(10, 100),
    ]
    const { messagesToSummarize } = splitMessagesForCompaction(msgs, {
      maxTokens: 1000,
    })
    const backstoryInSummarize = messagesToSummarize.filter(
      (m) => m.type === 'backstory'
    )

    expect(backstoryInSummarize).toHaveLength(0)
  })

  it('returns empty summarize bucket when all messages are backstory', () => {
    const msgs = [
      makeMessage('backstory', 'system context a'),
      makeMessage('backstory', 'system context b'),
      makeMessage('backstory', 'system context c'),
      makeMessage('backstory', 'system context d'),
    ]
    const result = splitMessagesForCompaction(msgs, { maxTokens: 1000 })

    expect(result.messagesToSummarize).toHaveLength(0)
    expect(result.messagesToKeep).toEqual(msgs)
  })

  it('keepRecentCount capped to message list length does not crash', () => {
    const msgs = makeConversation(4, 100)
    // keepRecentCount larger than list means nothing to summarize
    const result = splitMessagesForCompaction(msgs, {
      maxTokens: 1000,
      keepRecentCount: 100,
    })

    expect(result.messagesToSummarize).toHaveLength(0)
    expect(result.messagesToKeep).toEqual(msgs)
  })
})

// ---------------------------------------------------------------------------
// checkCompaction
// ---------------------------------------------------------------------------

describe('checkCompaction', () => {
  it('returns shouldCompact:false when tokens are well below threshold', () => {
    // 4 small messages → very few tokens vs a huge maxTokens budget
    const msgs = makeConversation(4, 10)
    const result = checkCompaction(msgs, { maxTokens: 100_000 })

    expect(result.shouldCompact).toBe(false)
  })

  it('returns shouldCompact:false when message count is below COMPACTION_MIN_MESSAGES', () => {
    // fill with large text but keep count below the minimum
    const msgs = makeConversation(COMPACTION_MIN_MESSAGES - 1, 10_000)
    const result = checkCompaction(msgs, { maxTokens: 1 })

    expect(result.shouldCompact).toBe(false)
  })

  it('returns shouldCompact:true when tokens exceed triggerRatio * maxTokens', () => {
    // 20 messages, each 400 chars → ~125 tokens each (with margin) → ~2500 total
    const msgs = makeConversation(20, 400)
    const totalEstimate = estimateMessagesTokens(msgs)
    // set maxTokens just below the estimated total / triggerRatio
    const maxTokens = Math.floor(totalEstimate / COMPACTION_TRIGGER_RATIO) - 1
    const result = checkCompaction(msgs, { maxTokens })

    expect(result.shouldCompact).toBe(true)
  })

  it('includes estimatedTokens in the result regardless of shouldCompact value', () => {
    const msgs = makeConversation(4, 100)
    const result = checkCompaction(msgs, { maxTokens: 100_000 })

    expect(typeof result.estimatedTokens).toBe('number')
    expect(result.estimatedTokens).toBeGreaterThan(0)
  })

  it('includes messagesToSummarize and messagesToKeep when shouldCompact is true', () => {
    const msgs = makeConversation(20, 400)
    const totalEstimate = estimateMessagesTokens(msgs)
    const maxTokens = Math.floor(totalEstimate / COMPACTION_TRIGGER_RATIO) - 1
    const result = checkCompaction(msgs, { maxTokens })

    if (!result.shouldCompact) {
      throw new Error('Expected shouldCompact:true for this test')
    }

    expect(result.messagesToSummarize.length).toBeGreaterThan(0)
    expect(result.messagesToKeep.length).toBeGreaterThan(0)
    expect([...result.messagesToSummarize, ...result.messagesToKeep]).toEqual(
      msgs
    )
  })

  it('respects a custom triggerRatio', () => {
    const msgs = makeConversation(20, 400)
    const totalEstimate = estimateMessagesTokens(msgs)

    // at triggerRatio = 0.5, threshold is 50 % of maxTokens
    const maxTokens = Math.floor(totalEstimate / 0.5) - 1
    const resultDefault = checkCompaction(msgs, { maxTokens })
    const resultCustom = checkCompaction(msgs, { maxTokens, triggerRatio: 0.5 })

    // custom ratio (0.5) fires at a lower token count than default (0.9)
    // so at the same maxTokens, it is more likely to fire
    // here, both should fire since we set maxTokens to be just under the threshold
    expect(resultCustom.shouldCompact).toBe(true)
    // @note we just verify both are valid CompactionCheck objects
    expect(typeof resultDefault.shouldCompact).toBe('boolean')
  })
})

// ---------------------------------------------------------------------------
// buildCompactionSummaryPrompt
// ---------------------------------------------------------------------------

describe('buildCompactionSummaryPrompt', () => {
  it('returns a non-empty string', () => {
    const msgs = makeConversation(4, 50)

    expect(typeof buildCompactionSummaryPrompt(msgs)).toBe('string')
    expect(buildCompactionSummaryPrompt(msgs).length).toBeGreaterThan(0)
  })

  it('includes a <conversation> block', () => {
    const msgs = makeConversation(4, 50)
    const prompt = buildCompactionSummaryPrompt(msgs)

    expect(prompt).toContain('<conversation>')
    expect(prompt).toContain('</conversation>')
  })

  it('includes message content inside the conversation block', () => {
    const msgs = [
      makeMessage('user', 'What is the weather today?'),
      makeMessage('bot', 'It is sunny and 25 degrees.'),
    ]
    const prompt = buildCompactionSummaryPrompt(msgs)

    expect(prompt).toContain('What is the weather today?')
    expect(prompt).toContain('It is sunny and 25 degrees.')
  })

  it('excludes backstory messages from the conversation block', () => {
    const secretBackstory = 'TOP_SECRET_SYSTEM_CONTEXT'
    const msgs = [
      makeMessage('backstory', secretBackstory),
      makeMessage('user', 'hello'),
    ]
    const prompt = buildCompactionSummaryPrompt(msgs)

    expect(prompt).not.toContain(secretBackstory)
  })

  it('excludes activity messages from the conversation block', () => {
    const activityText = 'ACTIVITY_INTERNAL_STATE'
    const msgs = [
      makeMessage('user', 'trigger action'),
      makeMessage('activity', activityText),
      makeMessage('bot', 'done'),
    ]
    const prompt = buildCompactionSummaryPrompt(msgs)

    expect(prompt).not.toContain(activityText)
  })

  it('includes the output section headers', () => {
    const msgs = makeConversation(4, 50)
    const prompt = buildCompactionSummaryPrompt(msgs)

    expect(prompt).toContain('## Context Summary')
    expect(prompt).toContain('### What was discussed')
    expect(prompt).toContain('### What was accomplished')
    expect(prompt).toContain('### Important details to remember')
    expect(prompt).toContain('### Ongoing state')
  })

  it('labels messages with their type in uppercase', () => {
    const msgs = [makeMessage('user', 'hello')]
    const prompt = buildCompactionSummaryPrompt(msgs)

    expect(prompt).toContain('[USER]:')
  })

  it('handles an empty list gracefully', () => {
    const prompt = buildCompactionSummaryPrompt([])

    expect(typeof prompt).toBe('string')
    expect(prompt).toContain('<conversation>')
  })
})

// ---------------------------------------------------------------------------
// applyCompactionSummary
// ---------------------------------------------------------------------------

describe('applyCompactionSummary', () => {
  it('prepends a context message before non-backstory kept messages', () => {
    const kept = [makeMessage('user', 'recent question')]
    const result = applyCompactionSummary(
      kept,
      'summary text',
      makeConversation(5, 1)
    )

    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('context')
    expect(result[1]).toBe(kept[0])
  })

  it('includes the summary text in the context message', () => {
    const result = applyCompactionSummary(
      [],
      'My summary here',
      makeConversation(3, 1)
    )

    expect(result[0].text).toContain('My summary here')
  })

  it('includes droppedCount in the header line', () => {
    const result = applyCompactionSummary([], 'summary', makeConversation(7, 1))

    expect(result[0].text).toContain('7')
  })

  it('trims leading/trailing whitespace from the summary text', () => {
    const result = applyCompactionSummary(
      [],
      '  \n trimmed \n  ',
      makeConversation(1, 1)
    )

    expect(result[0].text).not.toMatch(/^\s+/)
    expect(result[0].text).not.toMatch(/\s+$/)
  })

  it('sets meta.compacted to true', () => {
    const result = applyCompactionSummary([], 'summary', makeConversation(2, 1))

    expect(result[0].meta?.compacted).toBe(true)
  })

  it('sets meta.droppedCount to the number of summarized messages', () => {
    const result = applyCompactionSummary([], 'summary', makeConversation(9, 1))

    expect(result[0].meta?.droppedCount).toBe(9)
  })

  it('stores summarizedIds for messages that have an id', () => {
    const m1 = { ...makeMessage('user', 'hello'), id: 'id-1' }
    const m2 = { ...makeMessage('bot', 'hi'), id: 'id-2' }
    const m3 = makeMessage('user', 'no id')
    const result = applyCompactionSummary([], 'summary', [m1, m2, m3])

    expect(result[0].meta?.summarizedIds).toEqual(['id-1', 'id-2'])
  })

  it('omits summarizedIds when none of the messages have an id', () => {
    const result = applyCompactionSummary([], 'summary', makeConversation(3, 1))

    expect(result[0].meta?.summarizedIds).toBeUndefined()
  })

  it('preserves all kept messages in order after the summary', () => {
    const kept = makeConversation(5, 50)
    const result = applyCompactionSummary(
      kept,
      'summary',
      makeConversation(3, 1)
    )

    // first is the summary, then the kept messages in original order
    expect(result.slice(1)).toEqual(kept)
  })

  it('places backstory messages before the summary message', () => {
    const backstory = makeMessage('backstory', 'system context')
    const recent = makeConversation(3, 50)
    const kept = [backstory, ...recent]
    const result = applyCompactionSummary(
      kept,
      'summary',
      makeConversation(5, 1)
    )

    // backstory first, then summary, then recent messages
    expect(result[0]).toBe(backstory)
    expect(result[1].type).toBe('context')
    expect(result.slice(2)).toEqual(recent)
  })

  it('places multiple backstory messages before the summary', () => {
    const bs1 = makeMessage('backstory', 'context a')
    const bs2 = makeMessage('backstory', 'context b')
    const recent = [makeMessage('user', 'hello')]
    const kept = [bs1, bs2, ...recent]
    const result = applyCompactionSummary(
      kept,
      'summary',
      makeConversation(2, 1)
    )

    expect(result[0]).toBe(bs1)
    expect(result[1]).toBe(bs2)
    expect(result[2].type).toBe('context')
    expect(result[3]).toBe(recent[0])
  })

  it('handles an empty kept list (only summary message returned)', () => {
    const result = applyCompactionSummary(
      [],
      'summary',
      makeConversation(10, 1)
    )

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('context')
  })
})

// ---------------------------------------------------------------------------
// Round-trip: split → prompt → apply
// ---------------------------------------------------------------------------

describe('compaction round-trip', () => {
  it('produces a shorter message list after applying a mock summary', () => {
    const messages = makeConversation(20, 200)
    const totalEstimate = estimateMessagesTokens(messages)
    const maxTokens = Math.floor(totalEstimate / COMPACTION_TRIGGER_RATIO) - 1

    const check = checkCompaction(messages, { maxTokens })

    if (!check.shouldCompact) {
      throw new Error('Expected shouldCompact:true for this test')
    }

    const mockSummary = 'A mock summary of the earlier conversation.'
    const compacted = applyCompactionSummary(
      check.messagesToKeep,
      mockSummary,
      check.messagesToSummarize
    )

    // the compacted list is shorter than the original
    expect(compacted.length).toBeLessThan(messages.length)
    // the first message in the compacted list is the summary
    expect(compacted[0].type).toBe('context')
    expect(compacted[0].text).toContain(mockSummary)
  })

  it('buildCompactionSummaryPrompt works on the messagesToSummarize from checkCompaction', () => {
    const messages = makeConversation(20, 200)
    const totalEstimate = estimateMessagesTokens(messages)
    const maxTokens = Math.floor(totalEstimate / COMPACTION_TRIGGER_RATIO) - 1

    const check = checkCompaction(messages, { maxTokens })

    if (!check.shouldCompact) {
      throw new Error('Expected shouldCompact:true for this test')
    }

    // Should not throw and should produce a non-empty prompt
    const prompt = buildCompactionSummaryPrompt(check.messagesToSummarize)

    expect(prompt.length).toBeGreaterThan(0)
  })
})
