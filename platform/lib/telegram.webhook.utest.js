/* eslint-disable @typescript-eslint/no-require-imports */
import { getTelegramIntegrationWebhook } from './telegram.webhook'

jest.mock('@/lib/host', () => ({
  getExternalAPIHostURL: jest.fn((path) => `https://api.example.com${path}`),
}))

describe('getTelegramIntegrationWebhook', () => {
  const { getExternalAPIHostURL } = require('@/lib/host')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should generate webhook URL with integration ID', () => {
      const integrationId = 'telegram-123'

      const result = getTelegramIntegrationWebhook(integrationId)

      expect(result).toBe(
        'https://api.example.com/v1/integration/telegram/telegram-123/webhook'
      )
      expect(getExternalAPIHostURL).toHaveBeenCalledWith(
        '/v1/integration/telegram/telegram-123/webhook'
      )
    })

    it('should handle different integration ID formats', () => {
      const integrationId = 'abc-def-123'

      const result = getTelegramIntegrationWebhook(integrationId)

      expect(result).toBe(
        'https://api.example.com/v1/integration/telegram/abc-def-123/webhook'
      )
    })

    it('should handle UUID-style integration IDs', () => {
      const integrationId = '550e8400-e29b-41d4-a716-446655440000'

      const result = getTelegramIntegrationWebhook(integrationId)

      expect(result).toBe(
        'https://api.example.com/v1/integration/telegram/550e8400-e29b-41d4-a716-446655440000/webhook'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle short integration IDs', () => {
      const integrationId = 'a'

      const result = getTelegramIntegrationWebhook(integrationId)

      expect(result).toBe(
        'https://api.example.com/v1/integration/telegram/a/webhook'
      )
    })

    it('should handle integration IDs with special characters', () => {
      const integrationId = 'test_123-xyz'

      const result = getTelegramIntegrationWebhook(integrationId)

      expect(result).toBe(
        'https://api.example.com/v1/integration/telegram/test_123-xyz/webhook'
      )
    })

    it('should handle empty string integration ID', () => {
      const integrationId = ''

      const result = getTelegramIntegrationWebhook(integrationId)

      expect(result).toBe(
        'https://api.example.com/v1/integration/telegram//webhook'
      )
    })

    it('should handle numeric integration IDs', () => {
      const integrationId = '12345'

      const result = getTelegramIntegrationWebhook(integrationId)

      expect(result).toBe(
        'https://api.example.com/v1/integration/telegram/12345/webhook'
      )
    })
  })

  describe('integration with getExternalAPIHostURL', () => {
    it('should call getExternalAPIHostURL with correct path format', () => {
      const integrationId = 'test-integration'

      getTelegramIntegrationWebhook(integrationId)

      expect(getExternalAPIHostURL).toHaveBeenCalledTimes(1)
      expect(getExternalAPIHostURL).toHaveBeenCalledWith(
        '/v1/integration/telegram/test-integration/webhook'
      )
    })

    it('should return whatever getExternalAPIHostURL returns', () => {
      const integrationId = 'test-id'
      const customUrl = 'https://custom.domain.com/webhook-path'

      getExternalAPIHostURL.mockReturnValueOnce(customUrl)

      const result = getTelegramIntegrationWebhook(integrationId)

      expect(result).toBe(customUrl)
    })
  })
})
