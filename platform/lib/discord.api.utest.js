import { fetchAPI } from '@/lib/discord.api'
import { SystemError } from '@/lib/error'
import fetch from '@/lib/fetch'
import { CONFLICT_CODE } from '@/lib/response'

jest.mock('@/lib/fetch')

describe('discord.api', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('fetchAPI', () => {
    const discordIntegration = { botToken: 'test-bot-token' }

    describe('GET requests', () => {
      it('should make GET request with authorization header', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ data: 'test' }),
        }

        fetch.mockResolvedValue(mockResponse)

        const result = await fetchAPI(discordIntegration, 'GET', 'users/@me')

        expect(fetch).toHaveBeenCalledWith(
          'https://discord.com/api/v10/users/@me',
          {
            method: 'GET',
            headers: {
              Authorization: 'Bot test-bot-token',
            },
            body: undefined,
          }
        )

        expect(result).toEqual({ data: 'test' })
      })

      it('should return parsed JSON for GET requests', async () => {
        const mockData = { id: '123', name: 'test-user' }
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue(mockData),
        }

        fetch.mockResolvedValue(mockResponse)

        const result = await fetchAPI(discordIntegration, 'GET', 'channels/123')

        expect(result).toEqual(mockData)
        expect(mockResponse.json).toHaveBeenCalled()
      })
    })

    describe('POST requests', () => {
      it('should make POST request with JSON body', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true }),
        }

        fetch.mockResolvedValue(mockResponse)

        const data = { content: 'test message' }
        const result = await fetchAPI(
          discordIntegration,
          'POST',
          'channels/123/messages',
          data
        )

        expect(fetch).toHaveBeenCalledWith(
          'https://discord.com/api/v10/channels/123/messages',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bot test-bot-token',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          }
        )

        expect(result).toEqual({ success: true })
      })

      it('should handle POST with complex data', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ id: 'new-message-id' }),
        }

        fetch.mockResolvedValue(mockResponse)

        const data = {
          content: 'test',
          embeds: [{ title: 'Test', description: 'Description' }],
          components: [],
        }

        await fetchAPI(
          discordIntegration,
          'POST',
          'channels/123/messages',
          data
        )

        expect(fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify(data),
          })
        )
      })
    })

    describe('PATCH requests', () => {
      it('should make PATCH request with JSON body', async () => {
        const mockResponse = {
          ok: true,
        }

        fetch.mockResolvedValue(mockResponse)

        const data = { name: 'updated-name' }

        await fetchAPI(discordIntegration, 'PATCH', 'channels/123', data)

        expect(fetch).toHaveBeenCalledWith(
          'https://discord.com/api/v10/channels/123',
          {
            method: 'PATCH',
            headers: {
              Authorization: 'Bot test-bot-token',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          }
        )
      })

      it('should not return JSON for PATCH requests', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn(),
        }

        fetch.mockResolvedValue(mockResponse)

        const result = await fetchAPI(
          discordIntegration,
          'PATCH',
          'channels/123',
          {}
        )

        expect(result).toBeUndefined()
        expect(mockResponse.json).not.toHaveBeenCalled()
      })
    })

    describe('DELETE requests', () => {
      it('should make DELETE request without body', async () => {
        const mockResponse = {
          ok: true,
        }

        fetch.mockResolvedValue(mockResponse)

        await fetchAPI(
          discordIntegration,
          'DELETE',
          'channels/123/messages/456'
        )

        expect(fetch).toHaveBeenCalledWith(
          'https://discord.com/api/v10/channels/123/messages/456',
          {
            method: 'DELETE',
            headers: {
              Authorization: 'Bot test-bot-token',
            },
            body: undefined,
          }
        )
      })

      it('should not return JSON for DELETE requests', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn(),
        }

        fetch.mockResolvedValue(mockResponse)

        const result = await fetchAPI(
          discordIntegration,
          'DELETE',
          'messages/123'
        )

        expect(result).toBeUndefined()
        expect(mockResponse.json).not.toHaveBeenCalled()
      })
    })

    describe('error handling', () => {
      it('should throw SystemError when response is not ok', async () => {
        const mockResponse = {
          ok: false,
          text: jest.fn().mockResolvedValue(
            JSON.stringify({
              message: 'Missing Access',
              code: 50001,
            })
          ),
        }

        fetch.mockResolvedValue(mockResponse)

        await expect(
          fetchAPI(discordIntegration, 'GET', 'channels/123')
        ).rejects.toThrow(SystemError)
      })

      it('should parse Discord error message correctly', async () => {
        const mockResponse = {
          ok: false,
          text: jest.fn().mockResolvedValue(
            JSON.stringify({
              message: '50001: Missing Access',
              code: 50001,
            })
          ),
        }

        fetch.mockResolvedValue(mockResponse)

        await expect(
          fetchAPI(discordIntegration, 'GET', 'channels/123')
        ).rejects.toThrow('Unexpected Discord API response:  Missing Access')
      })

      it('should handle error message without colon separator', async () => {
        const mockResponse = {
          ok: false,
          text: jest.fn().mockResolvedValue(
            JSON.stringify({
              message: 'Simple error message',
              code: 0,
            })
          ),
        }

        fetch.mockResolvedValue(mockResponse)

        await expect(
          fetchAPI(discordIntegration, 'POST', 'messages', {})
        ).rejects.toThrow(
          'Unexpected Discord API response: Simple error message'
        )
      })

      it('should use default message when message is missing', async () => {
        const mockResponse = {
          ok: false,
          text: jest.fn().mockResolvedValue(
            JSON.stringify({
              code: 50001,
            })
          ),
        }

        fetch.mockResolvedValue(mockResponse)

        await expect(
          fetchAPI(discordIntegration, 'GET', 'channels/123')
        ).rejects.toThrow('Unexpected Discord API response: -')
      })

      it('should throw error when response text is not valid JSON', async () => {
        const mockResponse = {
          ok: false,
          text: jest.fn().mockResolvedValue('Invalid JSON response'),
        }

        fetch.mockResolvedValue(mockResponse)

        await expect(
          fetchAPI(discordIntegration, 'GET', 'channels/123')
        ).rejects.toThrow('Cannot parse Discord API response')
      })

      it('should map Discord error code to status code', async () => {
        // Assuming statusToCodeMap has entries for Discord codes
        const mockResponse = {
          ok: false,
          text: jest.fn().mockResolvedValue(
            JSON.stringify({
              message: 'Rate limited',
              code: 429,
            })
          ),
        }

        fetch.mockResolvedValue(mockResponse)

        try {
          await fetchAPI(discordIntegration, 'POST', 'messages', {})
        } catch (error) {
          expect(error).toBeInstanceOf(SystemError)
          // code should be mapped from statusToCodeMap or default to CONFLICT_CODE
        }
      })

      it('should use CONFLICT_CODE as default when code not in map', async () => {
        const mockResponse = {
          ok: false,
          text: jest.fn().mockResolvedValue(
            JSON.stringify({
              message: 'Unknown error',
              code: 99999, // code not in map
            })
          ),
        }

        fetch.mockResolvedValue(mockResponse)

        try {
          await fetchAPI(discordIntegration, 'GET', 'test')
        } catch (error) {
          expect(error).toBeInstanceOf(SystemError)
          expect(error.code).toBe(CONFLICT_CODE)
        }
      })
    })

    describe('edge cases', () => {
      it('should handle empty data object for POST', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({}),
        }

        fetch.mockResolvedValue(mockResponse)

        await fetchAPI(discordIntegration, 'POST', 'test', {})

        expect(fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: '{}',
          })
        )
      })

      it('should handle different bot tokens', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({}),
        }

        fetch.mockResolvedValue(mockResponse)

        const integration = { botToken: 'different-token' }

        await fetchAPI(integration, 'GET', 'test')

        expect(fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: {
              Authorization: 'Bot different-token',
            },
          })
        )
      })

      it('should construct correct API URL', async () => {
        const mockResponse = {
          ok: true,
        }

        fetch.mockResolvedValue(mockResponse)

        await fetchAPI(discordIntegration, 'DELETE', 'guilds/123/members/456')

        expect(fetch).toHaveBeenCalledWith(
          'https://discord.com/api/v10/guilds/123/members/456',
          expect.any(Object)
        )
      })
    })
  })
})
