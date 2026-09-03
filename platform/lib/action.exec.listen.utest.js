import { executeListenAction } from '@/lib/action.exec.listen'
import defer from '@/lib/defer'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import { createTranscriptionResponse } from '@/lib/model.provider.openai'
import { recordAudioTokenUsage, recordAudioUsage } from '@/lib/usage.record'
import { fastGetUserById } from '@/lib/user.get'

jest.mock('@/lib/limit.core', () => ({
  accountLimitsOk: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/model.provider.openai', () => ({
  createTranscriptionResponse: jest.fn(),
}))

jest.mock('@/lib/usage.record', () => ({
  recordAudioTokenUsage: jest.fn(),
  recordAudioUsage: jest.fn(),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

jest.mock('@/lib/defer', () => jest.fn().mockImplementation((fn) => fn))

jest.mock('@/lib/fetch', () => jest.fn())

describe('action.exec.listen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('executeListenAction', () => {
    const mockOptions = {
      userId: 'user-123',
      linkedResources: {},
      contextResources: {
        blueprintId: 'blueprint-456',
        skillsetId: 'skillset-789',
        abilityId: 'ability-012',
      },
    }

    beforeEach(() => {
      fastGetUserById.mockResolvedValue({ id: 'user-123' })
      accountLimitsOk.mockResolvedValue(true)
      logEvent.mockResolvedValue(undefined)
    })

    describe('user validation', () => {
      it('should throw error when user not found', async () => {
        fastGetUserById.mockResolvedValue(null)

        await expect(
          executeListenAction('https://example.com/audio.mp3', {}, mockOptions)
        ).rejects.toThrow('User not found')
      })

      it('should return error when account limits exceeded', async () => {
        accountLimitsOk.mockResolvedValue(false)

        const result = await executeListenAction(
          'https://example.com/audio.mp3',
          {},
          mockOptions
        )

        expect(result).toEqual({
          error: 'You have reached your token limit.',
        })
      })
    })

    describe('URL processing', () => {
      it('should process single audio URL', async () => {
        const audioUrl = 'https://example.com/audio.mp3'

        const mockBlob = new Blob(['fake audio data'], { type: 'audio/mpeg' })
        const mockResponse = {
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        }

        fetch.mockResolvedValueOnce(mockResponse)

        createTranscriptionResponse.mockResolvedValueOnce({
          text: 'This is a test audio transcription',
          usage: {
            totalTokens: 150,
          },
        })

        const result = await executeListenAction(audioUrl, {}, mockOptions)

        expect(result).toEqual({
          result: ['This is a test audio transcription'],
        })

        expect(fetch).toHaveBeenCalledWith(audioUrl, undefined)
        expect(createTranscriptionResponse).toHaveBeenCalledWith({
          audio: mockBlob,
          instructions: undefined,
          model: 'gpt-4o-transcribe',
          user: 'user-123',
        })
        expect(recordAudioTokenUsage).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          count: 150,
          model: 'gpt-4o-transcribe',
          meta: {
            reason: 'action/listen',
          },
          references: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
        })
        expect(recordAudioUsage).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          count: 1,
          model: 'gpt-4o-transcribe',
          meta: { reason: 'action/listen' },
          references: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
        })
      })

      it('should process multiple audio URLs', async () => {
        const input =
          'https://example.com/audio1.mp3 and https://example.com/audio2.wav'

        const mockBlob1 = new Blob(['fake audio data 1'], {
          type: 'audio/mpeg',
        })
        const mockBlob2 = new Blob(['fake audio data 2'], { type: 'audio/wav' })

        fetch
          .mockResolvedValueOnce({
            ok: true,
            blob: jest.fn().mockResolvedValue(mockBlob1),
          })
          .mockResolvedValueOnce({
            ok: true,
            blob: jest.fn().mockResolvedValue(mockBlob2),
          })

        createTranscriptionResponse
          .mockResolvedValueOnce({
            text: 'Transcription of first audio',
            usage: { totalTokens: 100 },
          })
          .mockResolvedValueOnce({
            text: 'Transcription of second audio',
            usage: { totalTokens: 120 },
          })

        const result = await executeListenAction(input, {}, mockOptions)

        expect(result).toEqual({
          result: [
            'Transcription of first audio',
            'and',
            'Transcription of second audio',
          ],
        })

        expect(fetch).toHaveBeenCalledTimes(2)
        expect(createTranscriptionResponse).toHaveBeenCalledTimes(2)
        expect(recordAudioTokenUsage).toHaveBeenCalledTimes(2)
        expect(recordAudioUsage).toHaveBeenCalledTimes(2)
      })

      it('should handle mixed text and URLs', async () => {
        const input =
          'Listen to this audio: https://example.com/audio.mp3 and tell me what you hear.'

        const mockBlob = new Blob(['fake audio data'], { type: 'audio/mpeg' })

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        })

        createTranscriptionResponse.mockResolvedValueOnce({
          text: 'A beautiful melody',
          usage: { totalTokens: 80 },
        })

        const result = await executeListenAction(input, {}, mockOptions)

        expect(result).toEqual({
          result: [
            'Listen to this audio:',
            'A beautiful melody',
            'and tell me what you hear.',
          ],
        })

        expect(fetch).toHaveBeenCalledWith('https://example.com/audio.mp3', undefined)
      })

      it('should preserve non-URL text parts', async () => {
        const input = 'This is just text with no URLs.'

        const result = await executeListenAction(input, {}, mockOptions)

        expect(result).toEqual({
          result: ['This is just text with no URLs.'],
        })

        expect(fetch).not.toHaveBeenCalled()
        expect(createTranscriptionResponse).not.toHaveBeenCalled()
      })

      it('should handle empty input', async () => {
        const result = await executeListenAction('', {}, mockOptions)

        expect(result).toEqual({
          result: [],
        })

        expect(fetch).not.toHaveBeenCalled()
        expect(createTranscriptionResponse).not.toHaveBeenCalled()
      })
    })

    describe('parameter handling', () => {
      it('should pass instructions parameter', async () => {
        const audioUrl = 'https://example.com/audio.mp3'
        const params = { instructions: 'Transcribe this audio carefully' }

        const mockBlob = new Blob(['fake audio data'], { type: 'audio/mpeg' })

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        })

        createTranscriptionResponse.mockResolvedValueOnce({
          text: 'Careful transcription of the audio',
          usage: { totalTokens: 120 },
        })

        await executeListenAction(audioUrl, params, mockOptions)

        expect(createTranscriptionResponse).toHaveBeenCalledWith({
          audio: mockBlob,
          instructions: 'Transcribe this audio carefully',
          model: 'gpt-4o-transcribe',
          user: 'user-123',
        })
      })

      it('should handle instruction parameter (singular)', async () => {
        const audioUrl = 'https://example.com/audio.mp3'
        const params = { instruction: 'Include timestamps' }

        const mockBlob = new Blob(['fake audio data'], { type: 'audio/mpeg' })

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        })

        createTranscriptionResponse.mockResolvedValueOnce({
          text: '[0:00] This is the transcription [0:05]',
          usage: { totalTokens: 90 },
        })

        await executeListenAction(audioUrl, params, mockOptions)

        expect(createTranscriptionResponse).toHaveBeenCalledWith({
          audio: mockBlob,
          instructions: 'Include timestamps',
          model: 'gpt-4o-transcribe',
          user: 'user-123',
        })
      })

      it('should handle directions parameter', async () => {
        const audioUrl = 'https://example.com/audio.mp3'
        const params = { directions: 'Focus on technical terms' }

        const mockBlob = new Blob(['fake audio data'], { type: 'audio/mpeg' })

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        })

        createTranscriptionResponse.mockResolvedValueOnce({
          text: 'Technical transcription with specialized vocabulary',
          usage: { totalTokens: 110 },
        })

        await executeListenAction(audioUrl, params, mockOptions)

        expect(createTranscriptionResponse).toHaveBeenCalledWith({
          audio: mockBlob,
          instructions: 'Focus on technical terms',
          model: 'gpt-4o-transcribe',
          user: 'user-123',
        })
      })

      it('should handle direction parameter', async () => {
        const audioUrl = 'https://example.com/audio.mp3'
        const params = { direction: 'Identify speakers' }

        const mockBlob = new Blob(['fake audio data'], { type: 'audio/mpeg' })

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        })

        createTranscriptionResponse.mockResolvedValueOnce({
          text: 'Speaker 1: Hello. Speaker 2: Hi there.',
          usage: { totalTokens: 95 },
        })

        await executeListenAction(audioUrl, params, mockOptions)

        expect(createTranscriptionResponse).toHaveBeenCalledWith({
          audio: mockBlob,
          instructions: 'Identify speakers',
          model: 'gpt-4o-transcribe',
          user: 'user-123',
        })
      })

      it('should prioritize instructions over other parameters', async () => {
        const audioUrl = 'https://example.com/audio.mp3'
        const params = {
          instructions: 'Primary instruction',
          instruction: 'Secondary instruction',
          directions: 'Tertiary direction',
          direction: 'Quaternary direction',
        }

        const mockBlob = new Blob(['fake audio data'], { type: 'audio/mpeg' })

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        })

        createTranscriptionResponse.mockResolvedValueOnce({
          text: 'Following primary instruction',
          usage: { totalTokens: 100 },
        })

        await executeListenAction(audioUrl, params, mockOptions)

        expect(createTranscriptionResponse).toHaveBeenCalledWith({
          audio: mockBlob,
          instructions: 'Primary instruction',
          model: 'gpt-4o-transcribe',
          user: 'user-123',
        })
      })
    })

    describe('error handling', () => {
      it('should handle fetch errors gracefully', async () => {
        const audioUrl = 'https://example.com/broken-audio.mp3'

        fetch.mockRejectedValueOnce(new Error('Network error'))

        const result = await executeListenAction(audioUrl, {}, mockOptions)

        expect(result).toEqual({
          result: [], // URL part is skipped due to error
        })

        expect(fetch).toHaveBeenCalledWith(audioUrl, undefined)
        expect(createTranscriptionResponse).not.toHaveBeenCalled()
      })

      it('should handle blob conversion errors', async () => {
        const audioUrl = 'https://example.com/audio.mp3'

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest
            .fn()
            .mockRejectedValue(new Error('Blob conversion failed')),
        })

        const result = await executeListenAction(audioUrl, {}, mockOptions)

        expect(result).toEqual({
          result: [], // URL part is skipped due to error
        })

        expect(createTranscriptionResponse).not.toHaveBeenCalled()
      })

      it('should handle non-ok response status', async () => {
        const audioUrl = 'https://example.com/404-audio.mp3'

        fetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
        })

        const result = await executeListenAction(audioUrl, {}, mockOptions)

        expect(result).toEqual({
          result: [], // URL part is skipped due to non-ok status
        })

        expect(createTranscriptionResponse).not.toHaveBeenCalled()
      })

      it('should continue processing other URLs when one fails', async () => {
        const input =
          'https://example.com/broken.mp3 and https://example.com/working.mp3'

        // First URL fails, second succeeds
        fetch
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce({
            ok: true,
            blob: jest
              .fn()
              .mockResolvedValue(
                new Blob(['working audio'], { type: 'audio/mpeg' })
              ),
          })

        createTranscriptionResponse.mockResolvedValueOnce({
          text: 'Working audio transcription',
          usage: { totalTokens: 80 },
        })

        const result = await executeListenAction(input, {}, mockOptions)

        expect(result).toEqual({
          result: ['and', 'Working audio transcription'],
        })

        expect(fetch).toHaveBeenCalledTimes(2)
        expect(createTranscriptionResponse).toHaveBeenCalledTimes(1)
      })

      it('should handle transcription service errors', async () => {
        const audioUrl = 'https://example.com/audio.mp3'

        const mockBlob = new Blob(['audio data'], { type: 'audio/mpeg' })

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        })

        createTranscriptionResponse.mockRejectedValueOnce(
          new Error('Transcription service error')
        )

        const result = await executeListenAction(audioUrl, {}, mockOptions)

        expect(result).toEqual({
          result: [], // URL part is skipped due to transcription error
        })

        expect(fetch).toHaveBeenCalledWith(audioUrl, undefined)
        expect(createTranscriptionResponse).toHaveBeenCalledWith({
          audio: mockBlob,
          instructions: undefined,
          model: 'gpt-4o-transcribe',
          user: 'user-123',
        })
      })
    })

    describe('event logging', () => {
      it('should log listen event with correct parameters', async () => {
        const params = { testParam: 'value' }

        await executeListenAction('Just text', params, mockOptions)

        expect(logEvent).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          type: 'action.listen',
          relations: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
          meta: params,
        })
      })

      it('should handle missing linkedResources gracefully', async () => {
        const optionsWithoutResources = { userId: 'user-123' }
        const params = { testParam: 'value' }

        await executeListenAction('Just text', params, optionsWithoutResources)

        expect(logEvent).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          type: 'action.listen',
          relations: {
            blueprintId: undefined,
            skillsetId: undefined,
            abilityId: undefined,
          },
          meta: params,
        })
      })
    })

    describe('defer usage', () => {
      it('should defer token usage recording', async () => {
        const audioUrl = 'https://example.com/audio.mp3'

        const mockBlob = new Blob(['fake audio data'], { type: 'audio/mpeg' })

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        })

        createTranscriptionResponse.mockResolvedValueOnce({
          text: 'Audio transcription',
          usage: { totalTokens: 200 },
        })

        await executeListenAction(audioUrl, {}, mockOptions)

        expect(defer).toHaveBeenCalled()
        expect(recordAudioTokenUsage).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          count: 200,
          model: 'gpt-4o-transcribe',
          meta: { reason: 'action/listen' },
          references: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
        })
        expect(recordAudioUsage).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          count: 1,
          model: 'gpt-4o-transcribe',
          meta: { reason: 'action/listen' },
          references: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
        })
      })
    })

    describe('integration tests', () => {
      it('should handle complete listen flow', async () => {
        const mockBlob = new Blob(['audio data'], { type: 'audio/mpeg' })

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        })

        createTranscriptionResponse.mockResolvedValueOnce({
          text: 'A detailed audio transcription',
          usage: { totalTokens: 150 },
        })

        const result = await executeListenAction(
          'Transcribe this audio: https://example.com/test.mp3',
          { instructions: 'Be detailed' },
          {
            userId: 'user-123',
            linkedResources: {
              blueprintId: 'blueprint-456',
              skillsetId: 'skillset-789',
              abilityId: 'ability-012',
            },
          }
        )

        expect(result).toEqual({
          result: ['Transcribe this audio:', 'A detailed audio transcription'],
        })

        expect(fastGetUserById).toHaveBeenCalledWith('user-123')
        expect(accountLimitsOk).toHaveBeenCalledWith({ id: 'user-123' }, [
          'token',
          'audio',
        ])
        expect(logEvent).toHaveBeenCalled()
        expect(fetch).toHaveBeenCalledWith('https://example.com/test.mp3', undefined)
        expect(createTranscriptionResponse).toHaveBeenCalledWith({
          audio: mockBlob,
          instructions: 'Be detailed',
          model: 'gpt-4o-transcribe',
          user: 'user-123',
        })
        expect(defer).toHaveBeenCalled()
        expect(recordAudioTokenUsage).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          count: 150,
          model: 'gpt-4o-transcribe',
          meta: {
            reason: 'action/listen',
          },
          references: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
        })
        expect(recordAudioUsage).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          count: 1,
          model: 'gpt-4o-transcribe',
          meta: { reason: 'action/listen' },
          references: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
        })
      })
    })

    describe('edge cases', () => {
      it('should handle zero token usage', async () => {
        const audioUrl = 'https://example.com/audio.mp3'

        const mockBlob = new Blob(['no tokens'], { type: 'audio/mpeg' })

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        })

        createTranscriptionResponse.mockResolvedValueOnce({
          text: 'No token transcription',
          usage: { totalTokens: 0 },
        })

        const result = await executeListenAction(audioUrl, {}, mockOptions)

        expect(recordAudioTokenUsage).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          count: 0,
          model: 'gpt-4o-transcribe',
          meta: {
            reason: 'action/listen',
          },
          references: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
        })
        expect(recordAudioUsage).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          count: 1,
          model: 'gpt-4o-transcribe',
          meta: { reason: 'action/listen' },
          references: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
        })
        expect(result.result).toEqual(['No token transcription'])
      })

      it('should handle URLs with query parameters', async () => {
        const audioUrl =
          'https://example.com/audio.mp3?format=high&duration=long'

        const mockBlob = new Blob(['query audio'], { type: 'audio/mpeg' })

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        })

        createTranscriptionResponse.mockResolvedValueOnce({
          text: 'Parameterized audio transcription',
          usage: { totalTokens: 110 },
        })

        const result = await executeListenAction(audioUrl, {}, mockOptions)

        expect(result).toEqual({
          result: ['Parameterized audio transcription'],
        })

        expect(fetch).toHaveBeenCalledWith(audioUrl, undefined)
      })

      it('should handle special characters in non-URL text', async () => {
        const input =
          '特殊字符 🎵 "audio" & <listen> this: https://example.com/audio.mp3'

        const mockBlob = new Blob(['special chars'], { type: 'audio/mpeg' })

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        })

        createTranscriptionResponse.mockResolvedValueOnce({
          text: 'Special characters audio',
          usage: { totalTokens: 75 },
        })

        const result = await executeListenAction(input, {}, mockOptions)

        expect(result).toEqual({
          result: [
            '特殊字符 🎵 "audio" & <listen> this:',
            'Special characters audio',
          ],
        })
      })

      it('should handle very long audio URLs', async () => {
        const longUrl =
          'https://example.com/very-long-audio-file-name-with-lots-of-parameters.mp3?param1=value1&param2=value2&param3=value3'

        const mockBlob = new Blob(['long url audio'], { type: 'audio/mpeg' })

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        })

        createTranscriptionResponse.mockResolvedValueOnce({
          text: 'Long URL audio transcription',
          usage: { totalTokens: 95 },
        })

        const result = await executeListenAction(longUrl, {}, mockOptions)

        expect(result).toEqual({
          result: ['Long URL audio transcription'],
        })

        expect(fetch).toHaveBeenCalledWith(longUrl, undefined)
      })

      it('should handle different audio formats', async () => {
        const audioFormats = [
          'https://example.com/audio.mp3',
          'https://example.com/audio.wav',
          'https://example.com/audio.m4a',
          'https://example.com/audio.ogg',
        ]

        for (const [index, audioUrl] of audioFormats.entries()) {
          const mockBlob = new Blob([`audio data ${index}`], {
            type: `audio/${audioUrl.split('.').pop()}`,
          })

          fetch.mockResolvedValueOnce({
            ok: true,
            blob: jest.fn().mockResolvedValue(mockBlob),
          })

          createTranscriptionResponse.mockResolvedValueOnce({
            text: `Transcription ${index + 1}`,
            usage: { totalTokens: 50 + index * 10 },
          })
        }

        for (const audioUrl of audioFormats) {
          const result = await executeListenAction(audioUrl, {}, mockOptions)

          expect(result.result).toHaveLength(1)
          expect(result.result[0]).toContain('Transcription')
        }

        expect(fetch).toHaveBeenCalledTimes(audioFormats.length)
        expect(createTranscriptionResponse).toHaveBeenCalledTimes(
          audioFormats.length
        )
      })
    })
  })
})
