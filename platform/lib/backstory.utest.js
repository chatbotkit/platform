import { MessageType } from '@/prisma/types'

import {
  generateSectionAlternatives,
  getSceneBackstoryAndMessages,
  parseBackstory,
  parseSceneMessages,
  parseSceneText,
} from '@/lib/backstory'

describe('generateSectionAlternatives', () => {
  it('should generate correct section alternatives for basic sections', () => {
    const result = generateSectionAlternatives('intro')

    expect(result).toEqual(['<intro>', '<|intro|>', '[[intro]]', '[intro]'])
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('should include additional alternatives when provided', () => {
    const result = generateSectionAlternatives('user', ['user:', 'usr:'])

    expect(result).toEqual([
      '<user>',
      '<|user|>',
      '[[user]]',
      '[user]',
      'user:',
      'usr:',
    ])
  })

  it('should handle empty additional array', () => {
    const result = generateSectionAlternatives('scene', [])

    expect(result).toEqual(['<scene>', '<|scene|>', '[[scene]]', '[scene]'])
  })

  it('should handle sections with special characters', () => {
    const result = generateSectionAlternatives('test-section')

    expect(result).toEqual([
      '<test-section>',
      '<|test-section|>',
      '[[test-section]]',
      '[test-section]',
    ])
  })
})

describe('parseSceneText', () => {
  it('should return empty string for null or undefined input', () => {
    expect(parseSceneText(null)).toBe('')
    expect(parseSceneText(undefined)).toBe('')
    expect(parseSceneText('')).toBe('')
  })

  it('should return scene text before any user section', () => {
    const scene = 'This is the setting\nMore setting details\n<|user|>\nHello'

    expect(parseSceneText(scene)).toBe(
      'This is the setting\nMore setting details'
    )
  })

  it('should return scene text before any bot section', () => {
    const scene = 'Scene description\n<|bot|>\nBot response'

    expect(parseSceneText(scene)).toBe('Scene description')
  })

  it('should handle alternative user section formats', () => {
    const scene1 = 'Setting\n[[user]]\nHello'
    const scene2 = 'Setting\n[user]\nHello'
    const scene3 = 'Setting\nuser:\nHello'

    expect(parseSceneText(scene1)).toBe('Setting')
    expect(parseSceneText(scene2)).toBe('Setting')
    expect(parseSceneText(scene3)).toBe('Setting')
  })

  it('should handle alternative bot section formats', () => {
    const scene1 = 'Setting\n[[bot]]\nResponse'
    const scene2 = 'Setting\n[bot]\nResponse'
    const scene3 = 'Setting\nbot:\nResponse'

    expect(parseSceneText(scene1)).toBe('Setting')
    expect(parseSceneText(scene2)).toBe('Setting')
    expect(parseSceneText(scene3)).toBe('Setting')
  })

  it('should return entire text if no user or bot sections found', () => {
    const scene =
      'This is just scene description\nWith multiple lines\nNo messages'

    expect(parseSceneText(scene)).toBe(scene)
  })

  it('should handle case insensitive section matching', () => {
    const scene = 'Setting\n<|USER|>\nHello'

    expect(parseSceneText(scene)).toBe('Setting')
  })

  it('should trim whitespace from result', () => {
    const scene = '  Setting with spaces  \n\n<|user|>\nHello'

    expect(parseSceneText(scene)).toBe('Setting with spaces')
  })
})

describe('parseSceneMessages', () => {
  it('should return empty array for null or undefined input', () => {
    expect(parseSceneMessages(null)).toEqual([])
    expect(parseSceneMessages(undefined)).toEqual([])
    expect(parseSceneMessages('')).toEqual([])
  })

  it('should parse single user message', () => {
    const scene = '<|user|>\nHello there'
    const result = parseSceneMessages(scene)

    expect(result).toEqual([
      { text: 'Hello there', type: MessageType.user, meta: {} },
    ])
  })

  it('should parse single bot message', () => {
    const scene = '<|bot|>\nHi back'
    const result = parseSceneMessages(scene)

    expect(result).toEqual([
      { text: 'Hi back', type: MessageType.bot, meta: {} },
    ])
  })

  it('should parse multiple messages in sequence', () => {
    const scene = '<|user|>\nHello\n<|bot|>\nHi there\n<|user|>\nHow are you?'
    const result = parseSceneMessages(scene)

    expect(result).toEqual([
      { text: 'Hello', type: MessageType.user, meta: {} },
      { text: 'Hi there', type: MessageType.bot, meta: {} },
      { text: 'How are you?', type: MessageType.user, meta: {} },
    ])
  })

  it('should handle alternative section formats', () => {
    const scene = '[[user]]\nHello\n[bot]\nResponse\nuser:\nAnother message'
    const result = parseSceneMessages(scene)

    expect(result).toEqual([
      { text: 'Hello', type: MessageType.user, meta: {} },
      { text: 'Response', type: MessageType.bot, meta: {} },
      { text: 'Another message', type: MessageType.user, meta: {} },
    ])
  })

  it('should handle multiline messages', () => {
    const scene =
      '<|user|>\nThis is a long message\nwith multiple lines\nof content\n<|bot|>\nShort reply'

    const result = parseSceneMessages(scene)

    expect(result).toEqual([
      {
        text: 'This is a long message\nwith multiple lines\nof content',
        type: MessageType.user,
        meta: {},
      },
      { text: 'Short reply', type: MessageType.bot, meta: {} },
    ])
  })

  it('should handle inline message content', () => {
    const scene = '<|user|>Quick message\n<|bot|>Quick reply'
    const result = parseSceneMessages(scene)

    expect(result).toEqual([
      { text: 'Quick message', type: MessageType.user, meta: {} },
      { text: 'Quick reply', type: MessageType.bot, meta: {} },
    ])
  })

  it('should ignore text before first message section', () => {
    const scene =
      'This is scene setting\nMore setting\n<|user|>\nActual message'

    const result = parseSceneMessages(scene)

    expect(result).toEqual([
      { text: 'Actual message', type: MessageType.user, meta: {} },
    ])
  })

  it('should handle case insensitive section matching', () => {
    const scene = '<|USER|>\nHello\n<|BOT|>\nResponse'
    const result = parseSceneMessages(scene)

    expect(result).toEqual([
      { text: 'Hello', type: MessageType.user, meta: {} },
      { text: 'Response', type: MessageType.bot, meta: {} },
    ])
  })

  it('should trim whitespace from message text', () => {
    const scene =
      '<|user|>\n  Hello with spaces  \n\n<|bot|>\n  Reply with spaces  '

    const result = parseSceneMessages(scene)

    expect(result).toEqual([
      { text: 'Hello with spaces', type: MessageType.user, meta: {} },
      { text: 'Reply with spaces', type: MessageType.bot, meta: {} },
    ])
  })
})

describe('getSceneBackstoryAndMessages', () => {
  it('should return empty backstory and messages for null input', () => {
    const result = getSceneBackstoryAndMessages(null)

    expect(result).toEqual({
      frontmatter: null,
      backstory: '',
      messages: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })
  })

  it('should return empty backstory and messages for empty input', () => {
    const result = getSceneBackstoryAndMessages('')

    expect(result).toEqual({
      frontmatter: null,
      backstory: '',
      messages: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })
  })

  it('should return first intro and scene by default', () => {
    const input =
      'Intro 1\n<|intro|>\nIntro 2\n<|scene|>\nScene 1\n<|user|>\nHello\n<|scene|>\nScene 2\n<|bot|>\nHi'

    const result = getSceneBackstoryAndMessages(input)

    expect(result.backstory).toBe('Intro 1\n\nScene 1')
    expect(result.messages).toEqual([
      { text: 'Hello', type: MessageType.user, meta: {} },
    ])
  })

  it('should handle only intro without scenes', () => {
    const input = 'Just an intro'
    const result = getSceneBackstoryAndMessages(input)

    expect(result.backstory).toBe('Just an intro')
    expect(result.messages).toEqual([])
  })

  it('should handle only scene without intro', () => {
    const input = '<|scene|>\nJust a scene\n<|user|>\nMessage'
    const result = getSceneBackstoryAndMessages(input)

    expect(result.backstory).toBe('Just a scene')
    expect(result.messages).toEqual([
      { text: 'Message', type: MessageType.user, meta: {} },
    ])
  })

  it('should return datasets and skillsets', () => {
    const input =
      'Intro\n<|dataset|>\n- test\n<|skillset|>\n- name: skill\n  instruction: do skill'
    const result = getSceneBackstoryAndMessages(input)

    expect(result.datasets).toHaveLength(1)
    expect(result.skillsets).toHaveLength(1)
  })

  it('should support random option', () => {
    const input =
      'Intro 1\n<|intro|>\nIntro 2\n<|scene|>\nScene 1\n<|scene|>\nScene 2'

    const result1 = getSceneBackstoryAndMessages(input, { random: true })
    const result2 = getSceneBackstoryAndMessages(input, { random: true })

    expect(result1.backstory).toMatch(
      /^(Intro [12](\n\n(Scene [12]))?|Scene [12])$/
    )
    expect(result2.backstory).toMatch(
      /^(Intro [12](\n\n(Scene [12]))?|Scene [12])$/
    )
  })
})

describe('parseBackstory', () => {
  it('must parse', () => {
    expect(parseBackstory()).toEqual({
      frontmatter: null,
      intros: [{ text: '' }],
      scenes: [],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })

    expect(parseBackstory('')).toEqual({
      frontmatter: null,
      intros: [{ text: '' }],
      scenes: [],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })

    expect(parseBackstory('intro 1')).toEqual({
      frontmatter: null,
      intros: [{ text: 'intro 1' }],
      scenes: [],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })
    expect(parseBackstory('intro 1\n<|intro|>\nintro 2')).toEqual({
      frontmatter: null,
      intros: [{ text: 'intro 1' }, { text: 'intro 2' }],
      scenes: [],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })

    expect(
      parseBackstory('intro 1\n<|intro|>\nintro 2\n<|intro|>\nintro 3')
    ).toEqual({
      frontmatter: null,
      intros: [{ text: 'intro 1' }, { text: 'intro 2' }, { text: 'intro 3' }],
      scenes: [],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })

    expect(parseBackstory('intro 1\n<|scene|>\nscene 1')).toEqual({
      frontmatter: null,
      intros: [{ text: 'intro 1' }],
      scenes: [{ text: 'scene 1', messages: [] }],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })

    expect(
      parseBackstory('intro 1\n<|scene|>\nscene 1\n<|scene|>\nscene 2')
    ).toEqual({
      frontmatter: null,
      intros: [{ text: 'intro 1' }],
      scenes: [
        { text: 'scene 1', messages: [] },
        { text: 'scene 2', messages: [] },
      ],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })

    expect(
      parseBackstory(
        'intro 1\n<|scene|>\nscene 1\n<|scene|>\nscene 2\n<|scene|>\nscene 3'
      )
    ).toEqual({
      frontmatter: null,
      intros: [{ text: 'intro 1' }],
      scenes: [
        { text: 'scene 1', messages: [] },
        { text: 'scene 2', messages: [] },
        { text: 'scene 3', messages: [] },
      ],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })

    expect(parseBackstory('intro 1\n<|scene|>\n<|user|>\nHi there')).toEqual({
      frontmatter: null,
      intros: [{ text: 'intro 1' }],
      scenes: [
        {
          text: '',
          messages: [{ text: 'Hi there', type: 'user', meta: {} }],
        },
      ],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })

    expect(parseBackstory('intro 1\n<|scene|>\n<|user|>Hi there')).toEqual({
      frontmatter: null,
      intros: [{ text: 'intro 1' }],
      scenes: [
        {
          text: '',
          messages: [{ text: 'Hi there', type: 'user', meta: {} }],
        },
      ],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })

    expect(
      parseBackstory('intro 1\n<|scene|>\nA basic setting\n<|user|>\nHi there')
    ).toEqual({
      frontmatter: null,
      intros: [{ text: 'intro 1' }],
      scenes: [
        {
          text: 'A basic setting',
          messages: [{ text: 'Hi there', type: 'user', meta: {} }],
        },
      ],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })

    expect(
      parseBackstory('intro 1\n<|scene|>\nA basic setting\n<|user|>Hi there')
    ).toEqual({
      frontmatter: null,
      intros: [{ text: 'intro 1' }],
      scenes: [
        {
          text: 'A basic setting',
          messages: [{ text: 'Hi there', type: 'user', meta: {} }],
        },
      ],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })

    expect(
      parseBackstory(`<|scene|>
The password is avocado

<|bot|>
Arr, matey!

<|scene|>
The password is apple

<|bot|>
Arr, matey!
      `)
    ).toEqual({
      frontmatter: null,
      intros: [],
      scenes: [
        {
          text: 'The password is avocado',
          messages: [{ text: 'Arr, matey!', type: 'bot', meta: {} }],
        },
        {
          text: 'The password is apple',
          messages: [{ text: 'Arr, matey!', type: 'bot', meta: {} }],
        },
      ],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })
  })

  it('must parse skillsets', () => {
    expect(
      parseBackstory(`<|skillset|>
- name: extract
  description: Extracts information
  instruction: Used to extract information
- name: transform
  description: Transforms information
  instruction: Used to transform information`)
    ).toEqual({
      frontmatter: null,
      intros: [],
      scenes: [],
      contexts: [],
      datasets: [],
      skillsets: [
        {
          name: undefined,
          description: undefined,
          abilities: [
            {
              name: 'extract',
              description: 'Extracts information',
              instruction: 'Used to extract information',
            },
            {
              name: 'transform',
              description: 'Transforms information',
              instruction: 'Used to transform information',
            },
          ],
        },
      ],
      agent: [],
    })
  })

  it('must parse agent', () => {
    expect(
      parseBackstory(`<|agent|>
name: TestBot
description: A test bot
model: base`)
    ).toEqual({
      frontmatter: null,
      intros: [],
      scenes: [],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
      agent: [
        {
          name: 'TestBot',
          description: 'A test bot',
          model: 'base',
        },
      ],
    })

    expect(
      parseBackstory(`<|agent|>
name: Bot1
model: base`)
    ).toEqual({
      frontmatter: null,
      intros: [],
      scenes: [],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
      agent: [
        {
          name: 'Bot1',
          description: undefined,
          model: 'base',
        },
      ],
    })
  })

  it('must reject invalid agent model', () => {
    expect(
      parseBackstory(`<|agent|>
name: TestBot
description: A test bot
model: invalid-model-name`)
    ).toEqual({
      frontmatter: null,
      intros: [],
      scenes: [],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })

    expect(
      parseBackstory(`<|agent|>
name: Bot1
model: base

<|agent|>
name: Bot2
model: not-a-real-model`)
    ).toEqual({
      frontmatter: null,
      intros: [],
      scenes: [],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [
        {
          name: 'Bot1',
          description: undefined,
          model: 'base',
        },
      ],
    })
  })

  it('must parse comments', () => {
    expect(
      parseBackstory(`
<|comment|>
This is a comment
<|scene|>
A basic setting
  `)
    ).toEqual({
      frontmatter: null,
      intros: [],
      scenes: [
        {
          text: 'A basic setting',
          messages: [],
        },
      ],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })

    expect(
      parseBackstory(`
<|comment|>
This is a
multi-line
comment
<|scene|>
A basic setting
  `)
    ).toEqual({
      frontmatter: null,
      intros: [],
      scenes: [
        {
          text: 'A basic setting',
          messages: [],
        },
      ],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })

    expect(
      parseBackstory(`
<|scene|>
A basic setting
<|comment|>
This is a
multi-line
comment
`)
    ).toEqual({
      frontmatter: null,
      intros: [],
      scenes: [
        {
          text: 'A basic setting',
          messages: [],
        },
      ],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })
  })

  it('must parse with alternative section formats', () => {
    expect(parseBackstory('intro 1\n[[intro]]\nintro 2')).toEqual({
      frontmatter: null,
      intros: [{ text: 'intro 1' }, { text: 'intro 2' }],
      scenes: [],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })

    expect(parseBackstory('[scene]\nscene content\n[user]\nHello')).toEqual({
      frontmatter: null,
      intros: [],
      scenes: [
        {
          text: 'scene content',
          messages: [{ text: 'Hello', type: 'user', meta: {} }],
        },
      ],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })

    expect(parseBackstory('<|scene|>\nscene\nuser:\nMessage')).toEqual({
      frontmatter: null,
      intros: [],
      scenes: [
        {
          text: 'scene',
          messages: [{ text: 'Message', type: 'user', meta: {} }],
        },
      ],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })
  })

  it('must parse datasets', () => {
    expect(
      parseBackstory(`<|dataset|>
- record1
- record2`)
    ).toEqual({
      frontmatter: null,
      intros: [],
      scenes: [],
      contexts: [],
      datasets: [
        {
          name: undefined,
          description: undefined,
          records: [{ text: 'record1' }, { text: 'record2' }],
        },
      ],
      skillsets: [],
      agent: [],
    })

    expect(
      parseBackstory(`<|dataset|>
records:
  - text: record1
  - text: record2`)
    ).toEqual({
      frontmatter: null,
      intros: [],
      scenes: [],
      contexts: [],
      datasets: [
        {
          name: undefined,
          description: undefined,
          records: [{ text: 'record1' }, { text: 'record2' }],
        },
      ],
      skillsets: [],
      agent: [],
    })
  })

  it('must handle malformed YAML in datasets gracefully', () => {
    expect(
      parseBackstory(`<|dataset|>
invalid: yaml: content: here`)
    ).toEqual({
      frontmatter: null,
      intros: [],
      scenes: [],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })
  })

  it('must handle malformed YAML in skillsets gracefully', () => {
    expect(
      parseBackstory(`<|skillset|>
invalid: yaml: content`)
    ).toEqual({
      frontmatter: null,
      intros: [],
      scenes: [],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })
  })

  it('must handle empty sections', () => {
    expect(
      parseBackstory('<|intro|>\n<|scene|>\n<|dataset|>\n<|skillset|>')
    ).toEqual({
      frontmatter: null,
      intros: [{ text: '' }],
      scenes: [{ text: '', messages: [] }],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })
  })

  it('must handle case insensitive section matching', () => {
    expect(
      parseBackstory(
        'intro\n<|INTRO|>\nINTRO 2\n<|Scene|>\nSCENE\n<|USER|>\nHELLO'
      )
    ).toEqual({
      frontmatter: null,
      intros: [{ text: 'intro' }, { text: 'INTRO 2' }],
      scenes: [
        {
          text: 'SCENE',
          messages: [{ text: 'HELLO', type: 'user', meta: {} }],
        },
      ],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })
  })

  it('must handle whitespace in section definitions', () => {
    expect(parseBackstory('<|intro|>   \n  \nintro content')).toEqual({
      frontmatter: null,
      intros: [{ text: 'intro content' }],
      scenes: [],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })
  })

  it('must handle complex multiline scenarios', () => {
    const complexBackstory = `
You are a helpful assistant.

<|intro|>
This is another intro.

<|scene|>
Setting: Office environment
Time: Monday morning

<|user|>
Good morning! How can I help you today?

<|bot|>
Good morning! I'm here to assist with any questions you might have.

<|user|>
What's the weather like?

<|scene|>
Setting: Different scene
Additional context here

<|dataset|>
weather_data:
  - sunny: 75F
  - cloudy: 68F

<|skillset|>
- name: weather_check
  description: Checks current weather
  instruction: Use this to get weather information`

    expect(parseBackstory(complexBackstory)).toEqual({
      frontmatter: null,
      agent: [],
      intros: [
        { text: 'You are a helpful assistant.' },
        { text: 'This is another intro.' },
      ],
      scenes: [
        {
          text: 'Setting: Office environment\nTime: Monday morning',
          messages: [
            {
              text: 'Good morning! How can I help you today?',
              type: 'user',
              meta: {},
            },
            {
              text: "Good morning! I'm here to assist with any questions you might have.",
              type: 'bot',
              meta: {},
            },
            { text: "What's the weather like?", type: 'user', meta: {} },
          ],
        },
        {
          text: 'Setting: Different scene\nAdditional context here',
          messages: [],
        },
      ],
      contexts: [],
      datasets: [],
      skillsets: [
        {
          name: undefined,
          description: undefined,
          abilities: [
            {
              name: 'weather_check',
              description: 'Checks current weather',
              instruction: 'Use this to get weather information',
            },
          ],
        },
      ],
    })
  })

  it('must handle edge case with only whitespace', () => {
    expect(parseBackstory('   \n\n   \t  ')).toEqual({
      frontmatter: null,
      intros: [{ text: '' }],
      scenes: [],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })
  })

  it('must preserve line breaks in content', () => {
    expect(parseBackstory('Line 1\nLine 2\n\nLine 4')).toEqual({
      frontmatter: null,
      intros: [{ text: 'Line 1\nLine 2\n\nLine 4' }],
      scenes: [],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })
  })

  it('must parse frontmatter correctly', () => {
    const backstoryWithFrontmatter = `---
title: Test Backstory
version: 1.0
---
This is the intro content`

    expect(parseBackstory(backstoryWithFrontmatter)).toEqual({
      frontmatter: {
        title: 'Test Backstory',
        version: 1.0,
      },
      intros: [{ text: 'This is the intro content' }],
      scenes: [],
      contexts: [],
      datasets: [],
      skillsets: [],
      agent: [],
    })
  })

  it('must merge frontmatter dataset with parsed datasets', () => {
    const backstoryWithDataset = `---
dataset:
  name: frontmatter dataset
  description: test description
  records:
    - text: frontmatter record
---
<|dataset|>
- inline dataset`

    const result = parseBackstory(backstoryWithDataset)

    expect(result.frontmatter).toEqual({
      dataset: {
        name: 'frontmatter dataset',
        description: 'test description',
        records: [{ text: 'frontmatter record' }],
      },
    })
    expect(result.datasets).toHaveLength(2)
    expect(result.datasets[0]).toEqual({
      name: undefined,
      description: undefined,
      records: [{ text: 'inline dataset' }],
    })
    expect(result.datasets[1]).toEqual({
      name: 'frontmatter dataset',
      description: 'test description',
      records: [{ text: 'frontmatter record' }],
    })
  })

  it('must merge frontmatter skillset with parsed skillsets', () => {
    const backstoryWithSkillset = `---
skillset:
  - name: frontmatter_skill
    description: From frontmatter
    instruction: Test skill
---
<|skillset|>
- name: inline_skill
  description: From inline
  instruction: Another test`

    const result = parseBackstory(backstoryWithSkillset)

    expect(result.frontmatter).toEqual({
      skillset: [
        {
          name: 'frontmatter_skill',
          description: 'From frontmatter',
          instruction: 'Test skill',
        },
      ],
    })
    expect(result.skillsets).toHaveLength(2)
    expect(result.skillsets[0]).toEqual({
      name: undefined,
      description: undefined,
      abilities: [
        {
          name: 'inline_skill',
          description: 'From inline',
          instruction: 'Another test',
        },
      ],
    })
    expect(result.skillsets[1]).toEqual({
      name: undefined,
      description: undefined,
      abilities: [
        {
          name: 'frontmatter_skill',
          description: 'From frontmatter',
          instruction: 'Test skill',
        },
      ],
    })
  })

  it('must handle frontmatter with array datasets', () => {
    const backstoryWithArrayDataset = `---
dataset:
  - item1
  - item2
---
Intro content`

    const result = parseBackstory(backstoryWithArrayDataset)

    expect(result.frontmatter).toEqual({
      dataset: ['item1', 'item2'],
    })
    // Array datasets are merged into single dataset
    expect(result.datasets).toHaveLength(1)
    expect(result.datasets[0]).toEqual({
      name: undefined,
      description: undefined,
      records: [{ text: 'item1' }, { text: 'item2' }],
    })
  })
})

describe('getSceneBackstoryAndMessages with frontmatter', () => {
  it('must return frontmatter from input', () => {
    const backstoryWithFrontmatter = `---
title: Test Scene
metadata: test value
---
Intro text
<|scene|>
Scene content
<|user|>
Hello`

    const result = getSceneBackstoryAndMessages(backstoryWithFrontmatter)

    expect(result.frontmatter).toEqual({
      title: 'Test Scene',
      metadata: 'test value',
    })
    expect(result.backstory).toBe('Intro text\n\nScene content')
    expect(result.messages).toEqual([
      { text: 'Hello', type: MessageType.user, meta: {} },
    ])
  })

  it('must handle frontmatter with datasets and skillsets', () => {
    const backstoryWithEverything = `---
dataset:
  records:
    - text: test record
skillset:
  abilities:
    - name: test_skill
      description: Test
      instruction: Do test
---
Intro`

    const result = getSceneBackstoryAndMessages(backstoryWithEverything)

    expect(result.frontmatter).toEqual({
      dataset: {
        records: [{ text: 'test record' }],
      },
      skillset: {
        abilities: [
          {
            name: 'test_skill',
            description: 'Test',
            instruction: 'Do test',
          },
        ],
      },
    })
    expect(result.datasets).toHaveLength(1)
    expect(result.skillsets).toHaveLength(1)
  })

  it('must handle frontmatter with agent', () => {
    const backstoryWithBot = `---
agent:
  name: MainBot
  description: The main assistant bot
  model: base
---
Intro`

    const result = getSceneBackstoryAndMessages(backstoryWithBot)

    expect(result.frontmatter).toEqual({
      agent: {
        name: 'MainBot',
        description: 'The main assistant bot',
        model: 'base',
      },
    })
    expect(result.agent).toHaveLength(1)
    expect(result.agent[0]).toEqual({
      name: 'MainBot',
      description: 'The main assistant bot',
      model: 'base',
    })
  })

  it('must handle frontmatter with bots array', () => {
    const backstoryWithBots = `---
agent:
  - name: Bot1
    model: base
  - name: Bot2
    description: Secondary bot
    model: base
---
Intro`

    const result = getSceneBackstoryAndMessages(backstoryWithBots)

    expect(result.frontmatter).toEqual({
      agent: [
        {
          name: 'Bot1',
          model: 'base',
        },
        {
          name: 'Bot2',
          description: 'Secondary bot',
          model: 'base',
        },
      ],
    })
    expect(result.agent).toHaveLength(2)
    expect(result.agent[0]).toEqual({
      name: 'Bot1',
      description: undefined,
      model: 'base',
    })
    expect(result.agent[1]).toEqual({
      name: 'Bot2',
      description: 'Secondary bot',
      model: 'base',
    })
  })
})
