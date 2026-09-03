/**
 * @jest-environment node
 */
import { logEvent } from '@/lib/log'

import {
  getIntegrationApiErrorMeta,
  logIntegrationApiError,
} from './integration.api.error'

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

describe('integration.api.error', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getIntegrationApiErrorMeta', () => {
    it('returns normalized meta for Error with string code and data', () => {
      const error = new Error('request failed')

      error.code = 'BAD_REQUEST'
      error.data = { detail: 'invalid payload' }

      expect(getIntegrationApiErrorMeta(error)).toEqual({
        name: 'Error',
        message: 'request failed',
        code: 'BAD_REQUEST',
        data: { detail: 'invalid payload' },
      })
    })

    it('omits non-string code and undefined fields', () => {
      const error = new Error('boom')

      error.code = 500

      expect(getIntegrationApiErrorMeta(error)).toEqual({
        name: 'Error',
        message: 'boom',
      })
    })

    it('handles non-error values', () => {
      expect(getIntegrationApiErrorMeta('oops')).toEqual({ message: 'oops' })
      expect(getIntegrationApiErrorMeta(null)).toEqual({ message: 'null' })
    })
  })

  describe('logIntegrationApiError', () => {
    it('logs event with normalized relations and metadata', async () => {
      const error = new Error('api failed')

      error.code = 'E_API'

      await logIntegrationApiError({
        userId: 'user-1',
        type: 'integration.recall.sync.error',
        name: 'recall sync failed',
        description: 'sync request failed',
        relations: {
          integrationId: 'integration-1',
          optional: undefined,
        },
        operation: 'sync',
        error,
        meta: {
          retryable: true,
          optional: undefined,
        },
      })

      expect(logEvent).toHaveBeenCalledWith({
        user: { id: 'user-1' },
        type: 'integration.recall.sync.error',
        name: 'recall sync failed',
        description: 'sync request failed',
        relations: {
          integrationId: 'integration-1',
        },
        meta: {
          operation: 'sync',
          error: {
            name: 'Error',
            message: 'api failed',
            code: 'E_API',
          },
          retryable: true,
        },
      })
    })
  })
})
