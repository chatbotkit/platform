import { ONE_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import memcache from '@/lib/memcache'

import {
  createRecallMeetingSession,
  deleteRecallMeetingSession,
  getRecallMeetingSession,
  updateRecallMeetingSession,
} from './recall.session'

jest.mock('@/lib/cuid', () => jest.fn(() => 'session-id-1'))

jest.mock('@/lib/memcache', () => ({
  setex: jest.fn(),
  get: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
}))

describe('recall.session', () => {
  const dateNowSpy = jest.spyOn(Date, 'now')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    dateNowSpy.mockRestore()
  })

  describe('createRecallMeetingSession', () => {
    it('creates and stores a new session with expected ttl', async () => {
      dateNowSpy.mockReturnValue(1700000000000)

      const result = await createRecallMeetingSession({
        recallIntegrationId: 'int-1',
        userId: 'user-1',
      })

      expect(memcache.setex).toHaveBeenCalledWith(
        'recall:session:session-id-1',
        ONE_HOUR_IN_SECONDS,
        {
          id: 'session-id-1',
          recallIntegrationId: 'int-1',
          userId: 'user-1',
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        }
      )
      expect(result).toEqual({
        id: 'session-id-1',
        recallIntegrationId: 'int-1',
        userId: 'user-1',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      })
    })
  })

  describe('getRecallMeetingSession', () => {
    it('returns null when session does not exist', async () => {
      memcache.get.mockResolvedValue(null)

      const result = await getRecallMeetingSession('missing-session')

      expect(memcache.get).toHaveBeenCalledWith('recall:session:missing-session')
      expect(memcache.expire).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })

    it('returns null when ttl refresh fails', async () => {
      const session = {
        id: 'session-1',
        recallIntegrationId: 'int-1',
        userId: 'user-1',
        createdAt: 100,
        updatedAt: 100,
      }

      memcache.get.mockResolvedValue(session)
      memcache.expire.mockResolvedValue(0)

      const result = await getRecallMeetingSession('session-1')

      expect(memcache.expire).toHaveBeenCalledWith(
        'recall:session:session-1',
        ONE_HOUR_IN_SECONDS
      )
      expect(result).toBeNull()
    })

    it('returns session when fetched and ttl refreshed', async () => {
      const session = {
        id: 'session-1',
        recallIntegrationId: 'int-1',
        userId: 'user-1',
        createdAt: 100,
        updatedAt: 100,
      }

      memcache.get.mockResolvedValue(session)
      memcache.expire.mockResolvedValue(1)

      const result = await getRecallMeetingSession('session-1')

      expect(result).toEqual(session)
    })
  })

  describe('updateRecallMeetingSession', () => {
    it('returns null when session cannot be loaded', async () => {
      memcache.get.mockResolvedValue(null)

      const result = await updateRecallMeetingSession('missing', {
        recallBotId: 'bot-1',
      })

      expect(result).toBeNull()
      expect(memcache.setex).not.toHaveBeenCalled()
    })

    it('merges patch, updates timestamp, and persists session', async () => {
      memcache.get.mockResolvedValue({
        id: 'session-1',
        recallIntegrationId: 'int-1',
        userId: 'user-1',
        createdAt: 100,
        updatedAt: 100,
      })
      memcache.expire.mockResolvedValue(1)
      dateNowSpy.mockReturnValue(200)

      const result = await updateRecallMeetingSession('session-1', {
        recallBotId: 'bot-99',
      })

      expect(memcache.setex).toHaveBeenCalledWith(
        'recall:session:session-1',
        ONE_HOUR_IN_SECONDS,
        {
          id: 'session-1',
          recallIntegrationId: 'int-1',
          userId: 'user-1',
          createdAt: 100,
          updatedAt: 200,
          recallBotId: 'bot-99',
        }
      )
      expect(result).toEqual({
        id: 'session-1',
        recallIntegrationId: 'int-1',
        userId: 'user-1',
        createdAt: 100,
        updatedAt: 200,
        recallBotId: 'bot-99',
      })
    })
  })

  describe('deleteRecallMeetingSession', () => {
    it('deletes session key from redis', async () => {
      await deleteRecallMeetingSession('session-xyz')

      expect(memcache.del).toHaveBeenCalledWith('recall:session:session-xyz')
    })
  })
})
