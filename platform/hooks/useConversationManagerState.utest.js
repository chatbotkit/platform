import useConversationManagerState, {
  init,
  reduce,
} from './useConversationManagerState'

import { act, renderHook } from '@testing-library/react'

describe('useConversationManagerState', () => {
  describe('init', () => {
    it('should initialize state with default values', () => {
      const result = init({})

      expect(result).toEqual({
        backstory: '',
        model: '',
        botId: '',
        datasetId: null,
        skillsetId: null,
        messages: [],
        entities: {},
        actions: [],
        references: {},
        functions: [],
        attachments: [],
        clips: [],
        conversationId: null,
        token: null,
        text: '',
        thinking: false,
        writing: false,
      })
    })

    it('should initialize state with provided values', () => {
      const initialState = {
        backstory: 'test backstory',
        model: 'gpt-4',
        botId: 'bot-123',
        datasetId: 'dataset-456',
        skillsetId: 'skillset-789',
        messages: [{ id: '1', type: 'user', text: 'hello' }],
        entities: { entity1: 'value1' },
        actions: [{ id: 'action-1', name: 'test' }],
        references: { ref1: { id: 'ref1', url: 'http://example.com' } },
        functions: [{ name: 'testFunc' }],
        attachments: [{ id: 'att-1', name: 'file.pdf' }],
        clips: [{ id: 'clip-1', text: 'clip text' }],
        conversationId: 'conv-123',
        token: 'token-abc',
      }

      const result = init(initialState)

      expect(result).toMatchObject(initialState)
      expect(result.text).toBe('')
      expect(result.thinking).toBe(false)
      expect(result.writing).toBe(false)
    })

    it('should preserve thinking value when explicitly set to true', () => {
      const result = init({ thinking: true })

      expect(result.thinking).toBe(true)
      expect(result.writing).toBe(false)
    })

    it('should preserve thinking value when explicitly set to false', () => {
      const result = init({ thinking: false })

      expect(result.thinking).toBe(false)
    })

    it('should preserve writing value when explicitly set to true', () => {
      const result = init({ writing: true })

      expect(result.writing).toBe(true)
      expect(result.thinking).toBe(false)
    })

    it('should preserve writing value when explicitly set to false', () => {
      const result = init({ writing: false })

      expect(result.writing).toBe(false)
    })

    it('should preserve both thinking and writing when both are true', () => {
      const result = init({ thinking: true, writing: true })

      expect(result.thinking).toBe(true)
      expect(result.writing).toBe(true)
    })

    it('should preserve thinking and writing along with other state values', () => {
      const initialState = {
        backstory: 'test backstory',
        model: 'gpt-4',
        messages: [{ id: '1', type: 'user', text: 'hello' }],
        thinking: true,
        writing: true,
      }

      const result = init(initialState)

      expect(result.backstory).toBe('test backstory')
      expect(result.model).toBe('gpt-4')
      expect(result.messages).toEqual(initialState.messages)
      expect(result.thinking).toBe(true)
      expect(result.writing).toBe(true)
    })
  })

  describe('reduce', () => {
    let initialState

    beforeEach(() => {
      initialState = init({
        messages: [
          { id: 'msg-1', type: 'user', text: 'hello' },
          { id: 'msg-2', type: 'bot', text: 'hi there' },
        ],
        actions: [{ id: 'action-1', name: 'existing' }],
        references: { ref1: { id: 'ref1', url: 'http://example.com' } },
        attachments: [{ id: 'att-1', name: 'file1.pdf' }],
        clips: [{ id: 'clip-1', text: 'existing clip' }],
      })
    })

    describe('reset', () => {
      it('should reset state to provided state', () => {
        const newState = { messages: [], backstory: 'new backstory' }

        const result = reduce(initialState, {
          type: 'reset',
          data: { state: newState },
        })

        expect(result.messages).toEqual([])
        expect(result.backstory).toBe('new backstory')
      })

      it('should reset state using function', () => {
        const result = reduce(initialState, {
          type: 'reset',
          data: {
            state: (prevState) => ({
              ...prevState,
              messages: [],
            }),
          },
        })

        expect(result.messages).toEqual([])
        expect(result.botId).toBe(initialState.botId)
      })
    })

    describe('setBackstory', () => {
      it('should set backstory with string value', () => {
        const result = reduce(initialState, {
          type: 'setBackstory',
          data: { backstory: 'new backstory' },
        })

        expect(result.backstory).toBe('new backstory')
      })

      it('should set backstory with function', () => {
        const result = reduce(
          { ...initialState, backstory: 'old' },
          {
            type: 'setBackstory',
            data: { backstory: (prev) => prev + ' updated' },
          }
        )

        expect(result.backstory).toBe('old updated')
      })
    })

    describe('setModel', () => {
      it('should set model', () => {
        const result = reduce(initialState, {
          type: 'setModel',
          data: { model: 'gpt-4' },
        })

        expect(result.model).toBe('gpt-4')
      })
    })

    describe('setBotId', () => {
      it('should set botId', () => {
        const result = reduce(initialState, {
          type: 'setBotId',
          data: { botId: 'bot-456' },
        })

        expect(result.botId).toBe('bot-456')
      })
    })

    describe('setDatasetId', () => {
      it('should set datasetId', () => {
        const result = reduce(initialState, {
          type: 'setDatasetId',
          data: { datasetId: 'dataset-789' },
        })

        expect(result.datasetId).toBe('dataset-789')
      })
    })

    describe('setSkillsetId', () => {
      it('should set skillsetId', () => {
        const result = reduce(initialState, {
          type: 'setSkillsetId',
          data: { skillsetId: 'skillset-abc' },
        })

        expect(result.skillsetId).toBe('skillset-abc')
      })
    })

    describe('setMessages', () => {
      it('should replace all messages', () => {
        const newMessages = [{ id: 'msg-3', type: 'user', text: 'new message' }]

        const result = reduce(initialState, {
          type: 'setMessages',
          data: { messages: newMessages },
        })

        expect(result.messages).toEqual(newMessages)
      })
    })

    describe('appendMessage', () => {
      it('should append message to end of messages array', () => {
        const newMessage = { id: 'msg-3', type: 'user', text: 'new message' }

        const result = reduce(initialState, {
          type: 'appendMessage',
          data: { message: newMessage },
        })

        expect(result.messages).toHaveLength(3)
        expect(result.messages[2]).toEqual(newMessage)
      })
    })

    describe('prependMessage', () => {
      it('should insert message before the last message', () => {
        const newMessage = { id: 'msg-3', type: 'bot', text: 'prepended' }

        const result = reduce(initialState, {
          type: 'prependMessage',
          data: { message: newMessage },
        })

        expect(result.messages).toHaveLength(3)
        expect(result.messages[0]).toEqual(initialState.messages[0])
        expect(result.messages[1]).toEqual(newMessage)
        expect(result.messages[2]).toEqual(initialState.messages[1])
      })
    })

    describe('extendMessage', () => {
      it('should extend existing message', () => {
        const result = reduce(initialState, {
          type: 'extendMessage',
          data: {
            id: 'msg-2',
            message: { text: 'updated text', extra: 'data' },
          },
        })

        expect(result.messages[1].text).toBe('updated text')
        expect(result.messages[1].extra).toBe('data')
        expect(result.messages[1].type).toBe('bot')
      })

      it('should return unchanged state when message id not found and upsert is false', () => {
        const result = reduce(initialState, {
          type: 'extendMessage',
          data: {
            id: 'non-existent',
            message: { text: 'should not apply' },
            upsert: false,
          },
        })

        expect(result).toBe(initialState)
      })

      it('should return unchanged state when message id not found and upsert is not provided', () => {
        const result = reduce(initialState, {
          type: 'extendMessage',
          data: {
            id: 'non-existent',
            message: { text: 'should not apply' },
          },
        })

        expect(result).toBe(initialState)
      })

      it('should create new message when id not found and upsert is true', () => {
        const result = reduce(initialState, {
          type: 'extendMessage',
          data: {
            id: 'msg-new',
            message: { type: 'bot', text: 'new message', extra: 'data' },
            upsert: true,
          },
        })

        expect(result.messages).toHaveLength(3)
        expect(result.messages[2]).toEqual({
          id: 'msg-new',
          type: 'bot',
          text: 'new message',
          extra: 'data',
        })
      })

      it('should upsert message with minimal data', () => {
        const result = reduce(initialState, {
          type: 'extendMessage',
          data: {
            id: 'msg-minimal',
            message: { type: 'user', text: 'hello' },
            upsert: true,
          },
        })

        expect(result.messages).toHaveLength(3)
        expect(result.messages[2]).toEqual({
          id: 'msg-minimal',
          type: 'user',
          text: 'hello',
        })
      })

      it('should extend existing message even when upsert is true', () => {
        const result = reduce(initialState, {
          type: 'extendMessage',
          data: {
            id: 'msg-2',
            message: { text: 'updated with upsert', newField: 'added' },
            upsert: true,
          },
        })

        expect(result.messages).toHaveLength(2)
        expect(result.messages[1].id).toBe('msg-2')
        expect(result.messages[1].text).toBe('updated with upsert')
        expect(result.messages[1].newField).toBe('added')
        expect(result.messages[1].type).toBe('bot')
      })

      it('should use findLastIndex when extending message', () => {
        const stateWithDuplicateIds = {
          ...initialState,
          messages: [
            { id: 'msg-1', type: 'user', text: 'first' },
            { id: 'msg-dup', type: 'bot', text: 'first occurrence' },
            { id: 'msg-2', type: 'user', text: 'middle' },
            { id: 'msg-dup', type: 'bot', text: 'last occurrence' },
          ],
        }

        const result = reduce(stateWithDuplicateIds, {
          type: 'extendMessage',
          data: {
            id: 'msg-dup',
            message: { text: 'updated' },
          },
        })

        expect(result.messages[3].text).toBe('updated')
        expect(result.messages[1].text).toBe('first occurrence')
      })
    })

    describe('removeMessage', () => {
      it('should remove message by id', () => {
        const result = reduce(initialState, {
          type: 'removeMessage',
          data: { id: 'msg-1' },
        })

        expect(result.messages).toHaveLength(1)
        expect(result.messages[0].id).toBe('msg-2')
      })

      it('should return unchanged state when message id not found', () => {
        const result = reduce(initialState, {
          type: 'removeMessage',
          data: { id: 'non-existent-id' },
        })

        expect(result.messages).toHaveLength(2)
        expect(result.messages).toEqual(initialState.messages)
      })
    })

    describe('evacuateMessage', () => {
      it('should remove message by id when text is empty', () => {
        const stateWithEmptyMessage = {
          ...initialState,
          messages: [
            { id: 'msg-1', type: 'user', text: 'hello' },
            { id: 'msg-2', type: 'bot', text: '' },
            { id: 'msg-3', type: 'bot', text: 'hi there' },
          ],
        }

        const result = reduce(stateWithEmptyMessage, {
          type: 'evacuateMessage',
          data: { id: 'msg-2' },
        })

        expect(result.messages).toHaveLength(2)
        expect(result.messages[0].id).toBe('msg-1')
        expect(result.messages[1].id).toBe('msg-3')
      })

      it('should return unchanged state when message has non-empty text', () => {
        const result = reduce(initialState, {
          type: 'evacuateMessage',
          data: { id: 'msg-2' },
        })

        expect(result.messages).toHaveLength(2)
        expect(result.messages).toEqual(initialState.messages)
      })

      it('should return unchanged state when message id not found', () => {
        const result = reduce(initialState, {
          type: 'evacuateMessage',
          data: { id: 'non-existent-id' },
        })

        expect(result.messages).toHaveLength(2)
        expect(result.messages).toEqual(initialState.messages)
      })

      it('should remove first empty message when multiple exist with same id', () => {
        const stateWithDuplicates = {
          ...initialState,
          messages: [
            { id: 'msg-1', type: 'bot', text: '' },
            { id: 'msg-2', type: 'user', text: 'hello' },
            { id: 'msg-1', type: 'bot', text: '' },
            { id: 'msg-3', type: 'bot', text: 'response' },
          ],
        }

        const result = reduce(stateWithDuplicates, {
          type: 'evacuateMessage',
          data: { id: 'msg-1' },
        })

        expect(result.messages).toHaveLength(3)
        expect(result.messages[0].id).toBe('msg-2')
        expect(result.messages[1].id).toBe('msg-1')
        expect(result.messages[2].id).toBe('msg-3')
      })

      it('should handle message with null or undefined text as non-empty', () => {
        const stateWithNullText = {
          ...initialState,
          messages: [
            { id: 'msg-1', type: 'user', text: 'hello' },
            { id: 'msg-2', type: 'bot', text: null },
            { id: 'msg-3', type: 'bot', text: undefined },
          ],
        }

        const result = reduce(stateWithNullText, {
          type: 'evacuateMessage',
          data: { id: 'msg-2' },
        })

        expect(result.messages).toHaveLength(3)
        expect(result.messages).toEqual(stateWithNullText.messages)
      })
    })

    describe('addBotMessageToken', () => {
      it('should add token to existing bot message', () => {
        const result = reduce(initialState, {
          type: 'addBotMessageToken',
          data: { id: 'msg-2', token: ' added' },
        })

        expect(result.messages[1].text).toBe('hi there added')
      })

      it('should create new bot message if id not found', () => {
        const result = reduce(initialState, {
          type: 'addBotMessageToken',
          data: { id: 'msg-3', token: 'hello' },
        })

        expect(result.messages).toHaveLength(3)
        expect(result.messages[2].id).toBe('msg-3')
        expect(result.messages[2].type).toBe('bot')
        expect(result.messages[2].text).toBe('hello')
      })

      it('should handle empty text in existing message', () => {
        const stateWithEmptyText = {
          ...initialState,
          messages: [
            ...initialState.messages,
            { id: 'msg-3', type: 'bot', text: '' },
          ],
        }

        const result = reduce(stateWithEmptyText, {
          type: 'addBotMessageToken',
          data: { id: 'msg-3', token: 'first' },
        })

        expect(result.messages[2].text).toBe('first')
      })
    })

    describe('addBotMessageReasoningToken', () => {
      it('should add reasoning token to existing bot message', () => {
        const stateWithReasoning = {
          ...initialState,
          messages: [
            ...initialState.messages,
            { id: 'msg-3', type: 'bot', text: 'response', reasoning: 'think' },
          ],
        }

        const result = reduce(stateWithReasoning, {
          type: 'addBotMessageReasoningToken',
          data: { id: 'msg-3', token: 'ing' },
        })

        expect(result.messages[2].reasoning).toBe('thinking')
      })

      it('should create new bot message with reasoning if id not found', () => {
        const result = reduce(initialState, {
          type: 'addBotMessageReasoningToken',
          data: { id: 'msg-4', token: 'reasoning' },
        })

        expect(result.messages).toHaveLength(3)
        expect(result.messages[2].id).toBe('msg-4')
        expect(result.messages[2].type).toBe('bot')
        expect(result.messages[2].reasoning).toBe('reasoning')
      })
    })

    describe('addBotMessageAction', () => {
      it('should add action to existing bot message', () => {
        const action = { id: 'action-1', name: 'search', status: 'pending' }

        const result = reduce(initialState, {
          type: 'addBotMessageAction',
          data: { id: 'msg-2', action },
        })

        expect(result.messages[1].actions).toHaveLength(1)
        expect(result.messages[1].actions[0]).toEqual(action)
      })

      it('should update existing action in message', () => {
        const stateWithAction = {
          ...initialState,
          messages: [
            ...initialState.messages.slice(0, 1),
            {
              ...initialState.messages[1],
              actions: [{ id: 'action-1', name: 'search', status: 'pending' }],
            },
          ],
        }

        const updatedAction = {
          id: 'action-1',
          name: 'search',
          status: 'completed',
        }

        const result = reduce(stateWithAction, {
          type: 'addBotMessageAction',
          data: { id: 'msg-2', action: updatedAction },
        })

        expect(result.messages[1].actions).toHaveLength(1)
        expect(result.messages[1].actions[0].status).toBe('completed')
      })

      it('should create new bot message with action if id not found', () => {
        const action = { id: 'action-2', name: 'new', status: 'pending' }

        const result = reduce(initialState, {
          type: 'addBotMessageAction',
          data: { id: 'msg-5', action },
        })

        expect(result.messages).toHaveLength(3)
        expect(result.messages[2].id).toBe('msg-5')
        expect(result.messages[2].actions).toEqual([action])
      })
    })

    describe('addBotMessageReference', () => {
      it('should add reference to existing bot message', () => {
        const reference = {
          id: 'ref-1',
          url: 'http://example.com',
          title: 'Example',
        }

        const result = reduce(initialState, {
          type: 'addBotMessageReference',
          data: { id: 'msg-2', reference },
        })

        expect(result.messages[1].references).toHaveLength(1)
        expect(result.messages[1].references[0]).toEqual(reference)
      })

      it('should update existing reference in message', () => {
        const stateWithRef = {
          ...initialState,
          messages: [
            ...initialState.messages.slice(0, 1),
            {
              ...initialState.messages[1],
              references: [{ id: 'ref-1', url: 'http://old.com' }],
            },
          ],
        }

        const updatedReference = { id: 'ref-1', url: 'http://new.com' }

        const result = reduce(stateWithRef, {
          type: 'addBotMessageReference',
          data: { id: 'msg-2', reference: updatedReference },
        })

        expect(result.messages[1].references).toHaveLength(1)
        expect(result.messages[1].references[0].url).toBe('http://new.com')
      })

      it('should create new bot message with reference if id not found', () => {
        const reference = { id: 'ref-2', url: 'http://test.com' }

        const result = reduce(initialState, {
          type: 'addBotMessageReference',
          data: { id: 'msg-6', reference },
        })

        expect(result.messages).toHaveLength(3)
        expect(result.messages[2].id).toBe('msg-6')
        expect(result.messages[2].references).toEqual([reference])
      })
    })

    describe('extendLastUserMessage', () => {
      it('should extend the last user message', () => {
        const result = reduce(initialState, {
          type: 'extendLastUserMessage',
          data: { message: { text: 'updated hello', meta: 'data' } },
        })

        expect(result.messages[0].text).toBe('updated hello')
        expect(result.messages[0].meta).toBe('data')
      })

      it('should return unchanged state when no user messages exist', () => {
        const stateWithoutUser = {
          ...initialState,
          messages: [{ id: 'msg-1', type: 'bot', text: 'only bot' }],
        }

        const result = reduce(stateWithoutUser, {
          type: 'extendLastUserMessage',
          data: { message: { text: 'should not apply' } },
        })

        expect(result).toBe(stateWithoutUser)
      })
    })

    describe('extendLastBotMessage', () => {
      it('should extend the last bot message', () => {
        const result = reduce(initialState, {
          type: 'extendLastBotMessage',
          data: { message: { text: 'updated bot message', meta: 'data' } },
        })

        expect(result.messages[1].text).toBe('updated bot message')
        expect(result.messages[1].meta).toBe('data')
      })

      it('should return unchanged state when no bot messages exist', () => {
        const stateWithoutBot = {
          ...initialState,
          messages: [{ id: 'msg-1', type: 'user', text: 'only user' }],
        }

        const result = reduce(stateWithoutBot, {
          type: 'extendLastBotMessage',
          data: { message: { text: 'should not apply' } },
        })

        expect(result).toBe(stateWithoutBot)
      })
    })

    describe('setEntities', () => {
      it('should set entities', () => {
        const entities = { entity1: 'value1', entity2: 'value2' }

        const result = reduce(initialState, {
          type: 'setEntities',
          data: { entities },
        })

        expect(result.entities).toEqual(entities)
      })
    })

    describe('setFunctions', () => {
      it('should set functions', () => {
        const functions = [{ name: 'func1' }, { name: 'func2' }]

        const result = reduce(initialState, {
          type: 'setFunctions',
          data: { functions },
        })

        expect(result.functions).toEqual(functions)
      })
    })

    describe('setActions', () => {
      it('should replace all actions', () => {
        const actions = [{ id: 'action-2', name: 'new' }]

        const result = reduce(initialState, {
          type: 'setActions',
          data: { actions },
        })

        expect(result.actions).toEqual(actions)
      })
    })

    describe('appendAction', () => {
      it('should append action to actions array', () => {
        const action = { id: 'action-2', name: 'new action' }

        const result = reduce(initialState, {
          type: 'appendAction',
          data: { action },
        })

        expect(result.actions).toHaveLength(2)
        expect(result.actions[1]).toEqual(action)
      })
    })

    describe('setReferences', () => {
      it('should replace all references', () => {
        const references = { ref2: { id: 'ref2', url: 'http://new.com' } }

        const result = reduce(initialState, {
          type: 'setReferences',
          data: { references },
        })

        expect(result.references).toEqual(references)
      })
    })

    describe('appendReference', () => {
      it('should add reference to references object', () => {
        const reference = { id: 'ref2', url: 'http://test.com' }

        const result = reduce(initialState, {
          type: 'appendReference',
          data: { reference },
        })

        expect(result.references.ref2).toEqual(reference)
        expect(result.references.ref1).toEqual(initialState.references.ref1)
      })
    })

    describe('setAttachments', () => {
      it('should replace all attachments', () => {
        const attachments = [{ id: 'att-2', name: 'file2.pdf' }]

        const result = reduce(initialState, {
          type: 'setAttachments',
          data: { attachments },
        })

        expect(result.attachments).toEqual(attachments)
      })
    })

    describe('appendAttachment', () => {
      it('should append attachment to attachments array', () => {
        const attachment = { id: 'att-2', name: 'file2.pdf' }

        const result = reduce(initialState, {
          type: 'appendAttachment',
          data: { attachment },
        })

        expect(result.attachments).toHaveLength(2)
        expect(result.attachments[1]).toEqual(attachment)
      })
    })

    describe('setClips', () => {
      it('should replace all clips', () => {
        const clips = [{ id: 'clip-2', text: 'new clip' }]

        const result = reduce(initialState, {
          type: 'setClips',
          data: { clips },
        })

        expect(result.clips).toEqual(clips)
      })
    })

    describe('appendClip', () => {
      it('should append clip to clips array', () => {
        const clip = { id: 'clip-2', text: 'new clip' }

        const result = reduce(initialState, {
          type: 'appendClip',
          data: { clip },
        })

        expect(result.clips).toHaveLength(2)
        expect(result.clips[1]).toEqual(clip)
      })
    })

    describe('setConversationId', () => {
      it('should set conversationId', () => {
        const result = reduce(initialState, {
          type: 'setConversationId',
          data: { conversationId: 'conv-456' },
        })

        expect(result.conversationId).toBe('conv-456')
      })
    })

    describe('setToken', () => {
      it('should set token', () => {
        const result = reduce(initialState, {
          type: 'setToken',
          data: { token: 'token-xyz' },
        })

        expect(result.token).toBe('token-xyz')
      })
    })

    describe('setText', () => {
      it('should set text', () => {
        const result = reduce(initialState, {
          type: 'setText',
          data: { text: 'user input text' },
        })

        expect(result.text).toBe('user input text')
      })
    })

    describe('setThinking', () => {
      it('should set thinking to true', () => {
        const result = reduce(initialState, {
          type: 'setThinking',
          data: { thinking: true },
        })

        expect(result.thinking).toBe(true)
      })

      it('should set thinking to false', () => {
        const result = reduce(
          { ...initialState, thinking: true },
          {
            type: 'setThinking',
            data: { thinking: false },
          }
        )

        expect(result.thinking).toBe(false)
      })
    })

    describe('setWriting', () => {
      it('should set writing to true', () => {
        const result = reduce(initialState, {
          type: 'setWriting',
          data: { writing: true },
        })

        expect(result.writing).toBe(true)
      })

      it('should set writing to false', () => {
        const result = reduce(
          { ...initialState, writing: true },
          {
            type: 'setWriting',
            data: { writing: false },
          }
        )

        expect(result.writing).toBe(false)
      })
    })

    describe('default', () => {
      it('should throw error for unrecognized action type', () => {
        expect(() => {
          reduce(initialState, { type: 'unknownAction', data: {} })
        }).toThrow('Unrecognized action type unknownAction')
      })
    })
  })

  describe('useConversationManagerState hook', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useConversationManagerState())

      expect(result.current.messages).toEqual([])
      expect(result.current.backstory).toBe('')
      expect(result.current.model).toBe('')
      expect(result.current.thinking).toBe(false)
      expect(result.current.writing).toBe(false)
    })

    it('should initialize with provided values', () => {
      const initialMessages = [{ id: 'msg-1', type: 'user', text: 'hello' }]

      const { result } = renderHook(() =>
        useConversationManagerState({
          messages: initialMessages,
          backstory: 'test backstory',
          model: 'gpt-4',
        })
      )

      expect(result.current.messages).toEqual(initialMessages)
      expect(result.current.backstory).toBe('test backstory')
      expect(result.current.model).toBe('gpt-4')
    })

    it('should append message', () => {
      const { result } = renderHook(() => useConversationManagerState())

      act(() => {
        result.current.appendMessage({
          id: 'msg-1',
          type: 'user',
          text: 'hello',
        })
      })

      expect(result.current.messages).toHaveLength(1)
      expect(result.current.messages[0].text).toBe('hello')
    })

    it('should set backstory', () => {
      const { result } = renderHook(() => useConversationManagerState())

      act(() => {
        result.current.setBackstory('new backstory')
      })

      expect(result.current.backstory).toBe('new backstory')
    })

    it('should not split messages when not thinking or writing', () => {
      const messages = [
        { id: 'msg-1', type: 'user', text: 'hello' },
        { id: 'msg-2', type: 'bot', text: 'hi' },
      ]

      const { result } = renderHook(() =>
        useConversationManagerState({
          messages,
          thinking: false,
          writing: false,
        })
      )

      expect(result.current.receivedMessages).toEqual(messages)
      expect(result.current.incomingMessage).toBeNull()
    })

    it('should not split messages when last message is not bot type', () => {
      const messages = [
        { id: 'msg-1', type: 'bot', text: 'hi' },
        { id: 'msg-2', type: 'user', text: 'hello' },
      ]

      const { result } = renderHook(() =>
        useConversationManagerState({
          messages,
        })
      )

      act(() => {
        result.current.setThinking(true)
      })

      expect(result.current.receivedMessages).toEqual(messages)
      expect(result.current.incomingMessage).toBeNull()
    })

    it('should extend message', () => {
      const { result } = renderHook(() =>
        useConversationManagerState({
          messages: [{ id: 'msg-1', type: 'user', text: 'hello' }],
        })
      )

      act(() => {
        result.current.extendMessage('msg-1', { text: 'hello world' })
      })

      expect(result.current.messages[0].text).toBe('hello world')
    })

    it('should remove message', () => {
      const { result } = renderHook(() =>
        useConversationManagerState({
          messages: [
            { id: 'msg-1', type: 'user', text: 'hello' },
            { id: 'msg-2', type: 'bot', text: 'hi' },
          ],
        })
      )

      act(() => {
        result.current.removeMessage('msg-1')
      })

      expect(result.current.messages).toHaveLength(1)
      expect(result.current.messages[0].id).toBe('msg-2')
    })

    it('should add bot message token', () => {
      const { result } = renderHook(() =>
        useConversationManagerState({
          messages: [{ id: 'msg-1', type: 'bot', text: 'hello' }],
        })
      )

      act(() => {
        result.current.addBotMessageToken('msg-1', ' world')
      })

      expect(result.current.messages[0].text).toBe('hello world')
    })

    it('should reset state', () => {
      const { result } = renderHook(() =>
        useConversationManagerState({
          messages: [{ id: 'msg-1', type: 'user', text: 'hello' }],
          backstory: 'old backstory',
        })
      )

      act(() => {
        result.current.reset({ messages: [], backstory: 'new backstory' })
      })

      expect(result.current.messages).toEqual([])
      expect(result.current.backstory).toBe('new backstory')
    })

    it('should use prependMessage via hook', () => {
      const { result } = renderHook(() =>
        useConversationManagerState({
          messages: [
            { id: 'msg-1', type: 'user', text: 'hello' },
            { id: 'msg-2', type: 'bot', text: 'hi' },
          ],
        })
      )

      act(() => {
        result.current.prependMessage({
          id: 'msg-3',
          type: 'bot',
          text: 'prepended',
        })
      })

      expect(result.current.messages).toHaveLength(3)
      expect(result.current.messages[1].id).toBe('msg-3')
    })

    it('should use extendLastUserMessage via hook', () => {
      const { result } = renderHook(() =>
        useConversationManagerState({
          messages: [{ id: 'msg-1', type: 'user', text: 'hello' }],
        })
      )

      act(() => {
        result.current.extendLastUserMessage({
          text: 'hello world',
          extra: 'data',
        })
      })

      expect(result.current.messages[0].text).toBe('hello world')
      expect(result.current.messages[0].extra).toBe('data')
    })

    it('should use extendLastBotMessage via hook', () => {
      const { result } = renderHook(() =>
        useConversationManagerState({
          messages: [{ id: 'msg-1', type: 'bot', text: 'response' }],
        })
      )

      act(() => {
        result.current.extendLastBotMessage({
          text: 'response updated',
          meta: 'info',
        })
      })

      expect(result.current.messages[0].text).toBe('response updated')
      expect(result.current.messages[0].meta).toBe('info')
    })

    it('should use addBotMessageReasoningToken via hook', () => {
      const { result } = renderHook(() =>
        useConversationManagerState({
          messages: [
            { id: 'msg-1', type: 'bot', text: 'response', reasoning: 'think' },
          ],
        })
      )

      act(() => {
        result.current.addBotMessageReasoningToken('msg-1', 'ing')
      })

      expect(result.current.messages[0].reasoning).toBe('thinking')
    })

    it('should use addBotMessageAction via hook', () => {
      const { result } = renderHook(() =>
        useConversationManagerState({
          messages: [{ id: 'msg-1', type: 'bot', text: 'response' }],
        })
      )

      act(() => {
        result.current.addBotMessageAction('msg-1', {
          id: 'action-1',
          name: 'search',
        })
      })

      expect(result.current.messages[0].actions).toHaveLength(1)
      expect(result.current.messages[0].actions[0].name).toBe('search')
    })

    it('should use addBotMessageReference via hook', () => {
      const { result } = renderHook(() =>
        useConversationManagerState({
          messages: [{ id: 'msg-1', type: 'bot', text: 'response' }],
        })
      )

      act(() => {
        result.current.addBotMessageReference('msg-1', {
          id: 'ref-1',
          url: 'http://example.com',
        })
      })

      expect(result.current.messages[0].references).toHaveLength(1)
      expect(result.current.messages[0].references[0].url).toBe(
        'http://example.com'
      )
    })

    it('should handle multiple state updates in sequence', () => {
      const { result } = renderHook(() => useConversationManagerState())

      act(() => {
        result.current.setBackstory('backstory 1')
        result.current.setModel('gpt-4')
        result.current.appendMessage({
          id: 'msg-1',
          type: 'user',
          text: 'hello',
        })
        result.current.setThinking(true)
      })

      expect(result.current.backstory).toBe('backstory 1')
      expect(result.current.model).toBe('gpt-4')
      expect(result.current.messages).toHaveLength(1)
      expect(result.current.thinking).toBe(true)
    })

    it('should handle empty messages when thinking', () => {
      const { result } = renderHook(() =>
        useConversationManagerState({
          messages: [],
        })
      )

      act(() => {
        result.current.setThinking(true)
      })

      expect(result.current.receivedMessages).toEqual([])
      expect(result.current.incomingMessage).toBeNull()
    })

    it('should use setters with other state properties', () => {
      const { result } = renderHook(() => useConversationManagerState())

      act(() => {
        result.current.setDatasetId('dataset-123')
        result.current.setSkillsetId('skillset-456')
        result.current.setConversationId('conv-789')
        result.current.setToken('token-abc')
        result.current.setText('user input')
      })

      expect(result.current.datasetId).toBe('dataset-123')
      expect(result.current.skillsetId).toBe('skillset-456')
      expect(result.current.conversationId).toBe('conv-789')
      expect(result.current.token).toBe('token-abc')
      expect(result.current.text).toBe('user input')
    })

    it('should use setters for collections', () => {
      const { result } = renderHook(() => useConversationManagerState())

      act(() => {
        result.current.setEntities({ entity1: 'value1' })
        result.current.setFunctions([{ name: 'func1' }])
        result.current.setActions([{ id: 'action-1', name: 'action' }])
        result.current.setReferences({
          ref1: { id: 'ref1', url: 'http://test.com' },
        })
        result.current.setAttachments([{ id: 'att-1', name: 'file.pdf' }])
        result.current.setClips([{ id: 'clip-1', text: 'clip' }])
      })

      expect(result.current.entities).toEqual({ entity1: 'value1' })
      expect(result.current.functions).toHaveLength(1)
      expect(result.current.actions).toHaveLength(1)
      expect(result.current.references).toHaveProperty('ref1')
      expect(result.current.attachments).toHaveLength(1)
      expect(result.current.clips).toHaveLength(1)
    })

    it('should use append methods for collections', () => {
      const { result } = renderHook(() => useConversationManagerState())

      act(() => {
        result.current.appendAction({ id: 'action-1', name: 'first' })
        result.current.appendAction({ id: 'action-2', name: 'second' })
        result.current.appendReference({ id: 'ref-1', url: 'http://test1.com' })
        result.current.appendReference({ id: 'ref-2', url: 'http://test2.com' })
        result.current.appendAttachment({ id: 'att-1', name: 'file1.pdf' })
        result.current.appendAttachment({ id: 'att-2', name: 'file2.pdf' })
        result.current.appendClip({ id: 'clip-1', text: 'clip1' })
        result.current.appendClip({ id: 'clip-2', text: 'clip2' })
      })

      expect(result.current.actions).toHaveLength(2)
      expect(result.current.references).toHaveProperty('ref-1')
      expect(result.current.references).toHaveProperty('ref-2')
      expect(result.current.attachments).toHaveLength(2)
      expect(result.current.clips).toHaveLength(2)
    })
  })

  describe('reduce - additional edge cases', () => {
    describe('prependMessage with empty array', () => {
      it('should handle prependMessage when messages array is empty', () => {
        const state = init({ messages: [] })

        const result = reduce(state, {
          type: 'prependMessage',
          data: { message: { id: 'msg-1', type: 'bot', text: 'first' } },
        })

        expect(result.messages).toHaveLength(1)
        expect(result.messages[0].id).toBe('msg-1')
      })
    })

    describe('findLastIndex behavior', () => {
      it('should find last occurrence when multiple messages have same id', () => {
        const state = init({
          messages: [
            { id: 'msg-1', type: 'bot', text: 'first' },
            { id: 'msg-1', type: 'bot', text: 'second' },
            { id: 'msg-1', type: 'bot', text: 'third' },
          ],
        })

        const result = reduce(state, {
          type: 'addBotMessageToken',
          data: { id: 'msg-1', token: ' updated' },
        })

        expect(result.messages[2].text).toBe('third updated')
        expect(result.messages[0].text).toBe('first')
        expect(result.messages[1].text).toBe('second')
      })
    })

    describe('function-based setters', () => {
      it('should use function with setModel', () => {
        const state = init({ model: 'gpt-3.5' })

        const result = reduce(state, {
          type: 'setModel',
          data: { model: (prev) => prev + '-turbo' },
        })

        expect(result.model).toBe('gpt-3.5-turbo')
      })

      it('should use function with setMessages', () => {
        const state = init({
          messages: [{ id: 'msg-1', type: 'user', text: 'hello' }],
        })

        const result = reduce(state, {
          type: 'setMessages',
          data: {
            messages: (prev) => [
              ...prev,
              { id: 'msg-2', type: 'bot', text: 'hi' },
            ],
          },
        })

        expect(result.messages).toHaveLength(2)
        expect(result.messages[1].id).toBe('msg-2')
      })

      it('should use function with setDatasetId', () => {
        const state = init({ datasetId: 'dataset-1' })

        const result = reduce(state, {
          type: 'setDatasetId',
          data: { datasetId: (prev) => prev + '-updated' },
        })

        expect(result.datasetId).toBe('dataset-1-updated')
      })

      it('should use function with setEntities', () => {
        const state = init({ entities: { entity1: 'value1' } })

        const result = reduce(state, {
          type: 'setEntities',
          data: {
            entities: (prev) => ({ ...prev, entity2: 'value2' }),
          },
        })

        expect(result.entities).toEqual({
          entity1: 'value1',
          entity2: 'value2',
        })
      })

      it('should use function with setActions', () => {
        const state = init({ actions: [{ id: 'action-1', name: 'first' }] })

        const result = reduce(state, {
          type: 'setActions',
          data: {
            actions: (prev) => [...prev, { id: 'action-2', name: 'second' }],
          },
        })

        expect(result.actions).toHaveLength(2)
      })
    })

    describe('addBotMessageToken edge cases', () => {
      it('should handle null text field', () => {
        const state = init({
          messages: [{ id: 'msg-1', type: 'bot', text: null }],
        })

        const result = reduce(state, {
          type: 'addBotMessageToken',
          data: { id: 'msg-1', token: 'new text' },
        })

        expect(result.messages[0].text).toBe('new text')
      })

      it('should handle undefined text field', () => {
        const state = init({
          messages: [{ id: 'msg-1', type: 'bot' }],
        })

        const result = reduce(state, {
          type: 'addBotMessageToken',
          data: { id: 'msg-1', token: 'new text' },
        })

        expect(result.messages[0].text).toBe('new text')
      })
    })

    describe('addBotMessageReasoningToken edge cases', () => {
      it('should handle null reasoning field', () => {
        const state = init({
          messages: [
            { id: 'msg-1', type: 'bot', text: 'response', reasoning: null },
          ],
        })

        const result = reduce(state, {
          type: 'addBotMessageReasoningToken',
          data: { id: 'msg-1', token: 'new reasoning' },
        })

        expect(result.messages[0].reasoning).toBe('new reasoning')
      })

      it('should handle undefined reasoning field', () => {
        const state = init({
          messages: [{ id: 'msg-1', type: 'bot', text: 'response' }],
        })

        const result = reduce(state, {
          type: 'addBotMessageReasoningToken',
          data: { id: 'msg-1', token: 'new reasoning' },
        })

        expect(result.messages[0].reasoning).toBe('new reasoning')
      })
    })

    describe('addBotMessageAction with empty actions array', () => {
      it('should initialize actions array when undefined', () => {
        const state = init({
          messages: [{ id: 'msg-1', type: 'bot', text: 'response' }],
        })

        const result = reduce(state, {
          type: 'addBotMessageAction',
          data: { id: 'msg-1', action: { id: 'action-1', name: 'search' } },
        })

        expect(result.messages[0].actions).toHaveLength(1)
        expect(result.messages[0].actions[0].name).toBe('search')
      })
    })

    describe('addBotMessageReference with empty references array', () => {
      it('should initialize references array when undefined', () => {
        const state = init({
          messages: [{ id: 'msg-1', type: 'bot', text: 'response' }],
        })

        const result = reduce(state, {
          type: 'addBotMessageReference',
          data: {
            id: 'msg-1',
            reference: { id: 'ref-1', url: 'http://test.com' },
          },
        })

        expect(result.messages[0].references).toHaveLength(1)
        expect(result.messages[0].references[0].url).toBe('http://test.com')
      })
    })

    describe('reset with function', () => {
      it('should pass current state to reset function', () => {
        const state = init({
          messages: [{ id: 'msg-1', type: 'user', text: 'hello' }],
          backstory: 'old',
        })

        const result = reduce(state, {
          type: 'reset',
          data: {
            state: (prevState) => ({
              ...prevState,
              backstory: prevState.backstory + ' updated',
              messages: [],
            }),
          },
        })

        expect(result.backstory).toBe('old updated')
        expect(result.messages).toEqual([])
      })
    })
  })
})
