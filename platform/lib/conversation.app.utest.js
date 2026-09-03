import {
  AUTONOMOUS_CONVERSATION_APPS,
  isAutonomousConversation,
} from './conversation.app'

describe('conversation.app', () => {
  describe('AUTONOMOUS_CONVERSATION_APPS', () => {
    it('should include the expected autonomous app names', () => {
      expect(AUTONOMOUS_CONVERSATION_APPS.has('trigger')).toBe(true)
      expect(AUTONOMOUS_CONVERSATION_APPS.has('task')).toBe(true)
      expect(AUTONOMOUS_CONVERSATION_APPS.has('support')).toBe(false)
    })
  })

  describe('isAutonomousConversation', () => {
    it('should return true for trigger conversations', () => {
      expect(isAutonomousConversation({ meta: { app: 'trigger' } })).toBe(true)
    })

    it('should return true for task conversations', () => {
      expect(isAutonomousConversation({ meta: { app: 'task' } })).toBe(true)
    })

    it('should return false for non-autonomous app names', () => {
      expect(isAutonomousConversation({ meta: { app: 'support' } })).toBe(false)
    })

    it('should return false when app is missing', () => {
      expect(isAutonomousConversation({ meta: {} })).toBe(false)
    })

    it('should return false when meta is nullish', () => {
      expect(isAutonomousConversation({ meta: null })).toBe(false)
      expect(isAutonomousConversation({ meta: undefined })).toBe(false)
    })
  })
})
