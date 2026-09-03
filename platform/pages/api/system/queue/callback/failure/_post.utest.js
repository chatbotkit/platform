/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import handler from './post'

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

jest.mock('@/lib/queue', () => ({
  withQueue: (fn) => fn,
}))

// @note the failed-delivery store moved behind the queue module - forgetting a
// delivery that can never succeed is the one thing the platform does with it,
// so it is the one thing on the contract.
jest.mock('@chatbotkit-dev/queue', () => ({
  __esModule: true,

  default: {
    discardFailedDeliveries: jest.fn(),
  },
}))

jest.mock('@/lib/request', () => ({
  parseRequestJson: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  ok: jest.fn(() => ({ status: 200 })),
}))

jest.mock('@/lib/debug', () => {
  const debug = jest.fn(() => ({
    log: jest.fn(() => ({ log: jest.fn() })),
  }))

  return {
    __esModule: true,
    default: debug,
  }
})

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('POST /api/system/queue/callback/failure', () => {
  const getDeleteDlqMessages = () =>
    require('@chatbotkit-dev/queue').default.discardFailedDeliveries
  const getParseRequestJson = () => require('@/lib/request').parseRequestJson
  const getOk = () => require('@/lib/response').ok

  const mockReq = {}

  beforeEach(() => {
    jest.clearAllMocks()
    getOk().mockReturnValue({ status: 200 })
  })

  function setupRequest({ status, dlqId, body = null, header = {} }) {
    getParseRequestJson().mockResolvedValue({ status, dlqId, body, header })
  }

  describe('4xx errors - should delete DLQ message to prevent infinite retries', () => {
    it.each([401, 402, 403])(
      'should delete DLQ message for %i (auth/payment error)',
      async (status) => {
        const dlqId = `dlq-${status}`

        setupRequest({ status, dlqId })

        await handler(mockReq)

        expect(getDeleteDlqMessages()).toHaveBeenCalledWith([dlqId])
        expect(getDeleteDlqMessages()).toHaveBeenCalledTimes(1)
      }
    )

    it('should delete DLQ message for 404 (not found)', async () => {
      setupRequest({ status: 404, dlqId: 'dlq-404' })

      await handler(mockReq)

      expect(getDeleteDlqMessages()).toHaveBeenCalledWith(['dlq-404'])
    })

    it('should delete DLQ message for 409 (conflict)', async () => {
      setupRequest({ status: 409, dlqId: 'dlq-409' })

      await handler(mockReq)

      expect(getDeleteDlqMessages()).toHaveBeenCalledWith(['dlq-409'])
    })

    it('should delete DLQ message for 429 (rate limit exceeded)', async () => {
      setupRequest({ status: 429, dlqId: 'dlq-429' })

      await handler(mockReq)

      expect(getDeleteDlqMessages()).toHaveBeenCalledWith(['dlq-429'])
    })
  })

  describe('5xx errors - should NOT delete DLQ message (allow queue to retry)', () => {
    it.each([500, 502, 503, 504])(
      'should not delete DLQ message for status %i',
      async (status) => {
        setupRequest({ status, dlqId: `dlq-${status}` })

        await handler(mockReq)

        expect(getDeleteDlqMessages()).not.toHaveBeenCalled()
      }
    )

    it('should not delete DLQ message for 501', async () => {
      setupRequest({ status: 501, dlqId: 'dlq-501' })

      await handler(mockReq)

      expect(getDeleteDlqMessages()).not.toHaveBeenCalled()
    })
  })

  describe('non-error status codes - should not delete DLQ message', () => {
    it.each([200, 201, 301, 302, 400])(
      'should not delete DLQ message for status %i',
      async (status) => {
        setupRequest({ status, dlqId: `dlq-${status}` })

        await handler(mockReq)

        expect(getDeleteDlqMessages()).not.toHaveBeenCalled()
      }
    )
  })

  describe('return value', () => {
    it('should return ok() for a 4xx client error', async () => {
      setupRequest({ status: 404, dlqId: 'dlq-ok-check' })
      getDeleteDlqMessages().mockResolvedValue(undefined)

      const result = await handler(mockReq)

      expect(getOk()).toHaveBeenCalled()
      expect(result).toEqual({ status: 200 })
    })

    it('should return ok() even for a 5xx server error', async () => {
      setupRequest({ status: 500, dlqId: 'dlq-500' })

      const result = await handler(mockReq)

      expect(getOk()).toHaveBeenCalled()
      expect(result).toEqual({ status: 200 })
    })

    it('should return ok() for an unrecognized status code', async () => {
      setupRequest({ status: 200, dlqId: 'dlq-200' })

      const result = await handler(mockReq)

      expect(getOk()).toHaveBeenCalled()
      expect(result).toEqual({ status: 200 })
    })
  })

  describe('body handling', () => {
    it('should handle base64-encoded body alongside 404 deletion', async () => {
      const bodyText = 'error: resource not found'
      const base64Body = Buffer.from(bodyText).toString('base64')

      setupRequest({ status: 404, dlqId: 'dlq-body', body: base64Body })

      await handler(mockReq)

      // The 404 branch should still delete the DLQ message regardless of body
      expect(getDeleteDlqMessages()).toHaveBeenCalledWith(['dlq-body'])
    })

    it('should handle null body without error', async () => {
      setupRequest({ status: 500, dlqId: 'dlq-nobody', body: null })

      await expect(handler(mockReq)).resolves.not.toThrow()

      // 5xx should not delete from DLQ
      expect(getDeleteDlqMessages()).not.toHaveBeenCalled()
    })

    it('should handle missing body key without error', async () => {
      getParseRequestJson().mockResolvedValue({
        status: 401,
        dlqId: 'dlq-nobody2',
        header: {},
        // body is intentionally absent
      })

      await handler(mockReq)

      expect(getDeleteDlqMessages()).toHaveBeenCalledWith(['dlq-nobody2'])
    })
  })

  describe('DLQ ID is passed correctly', () => {
    it('should pass the exact dlqId from the request to the queue', async () => {
      const specificDlqId = 'dlq-abc-123-xyz'

      setupRequest({ status: 401, dlqId: specificDlqId })

      await handler(mockReq)

      expect(getDeleteDlqMessages()).toHaveBeenCalledWith([specificDlqId])
    })

    it('should pass a single-element array containing the dlqId', async () => {
      setupRequest({ status: 409, dlqId: 'dlq-single' })

      await handler(mockReq)

      const callArgs = getDeleteDlqMessages().mock.calls[0][0]

      expect(callArgs).toHaveLength(1)
      expect(callArgs[0]).toBe('dlq-single')
    })
  })
})
