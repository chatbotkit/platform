import fetch from '@/lib/fetch'

import {
  listTwilioIncomingPhoneNumbers,
  sendTwilioCall,
  sendTwilioMessage,
  updateTwilioCall,
} from './twilio.api'

jest.mock('@/lib/fetch')

describe('twilio.api', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('sendTwilioMessage', () => {
    const validConfig = {
      accountSid: 'ACtest123',
      authToken: 'auth-token-secret',
      from: '+12025551234',
      to: '+14155552671',
    }

    describe('missing configuration - silent skip', () => {
      it('returns without calling fetch when accountSid is missing', async () => {
        await sendTwilioMessage({
          ...validConfig,
          accountSid: null,
          message: { type: 'text', text: 'Hello' },
        })

        expect(fetch).not.toHaveBeenCalled()
      })

      it('returns without calling fetch when authToken is missing', async () => {
        await sendTwilioMessage({
          ...validConfig,
          authToken: null,
          message: { type: 'text', text: 'Hello' },
        })

        expect(fetch).not.toHaveBeenCalled()
      })

      it('returns without calling fetch when from is missing', async () => {
        await sendTwilioMessage({
          ...validConfig,
          from: undefined,
          message: { type: 'text', text: 'Hello' },
        })

        expect(fetch).not.toHaveBeenCalled()
      })

      it('returns without calling fetch when to is missing', async () => {
        await sendTwilioMessage({
          ...validConfig,
          to: undefined,
          message: { type: 'text', text: 'Hello' },
        })

        expect(fetch).not.toHaveBeenCalled()
      })
    })

    describe('address validation', () => {
      it('throws for an invalid from address', async () => {
        await expect(
          sendTwilioMessage({
            ...validConfig,
            from: 'not-a-phone-number',
            message: { type: 'text', text: 'Hello' },
          })
        ).rejects.toThrow('Invalid Twilio message address')
      })

      it('throws for an invalid to address', async () => {
        await expect(
          sendTwilioMessage({
            ...validConfig,
            to: 'not-a-phone-number',
            message: { type: 'text', text: 'Hello' },
          })
        ).rejects.toThrow('Invalid Twilio message address')
      })

      it('attaches structured data to the error on invalid address', async () => {
        let thrownError

        try {
          await sendTwilioMessage({
            ...validConfig,
            to: 'invalid',
            message: { type: 'text', text: 'Hello' },
          })
        } catch (e) {
          thrownError = e
        }

        expect(thrownError).toBeDefined()
        expect(thrownError.data).toMatchObject({
          code: 'INVALID_TWILIO_ADDRESS',
        })
      })
    })

    describe('successful text message', () => {
      beforeEach(() => {
        fetch.mockResolvedValueOnce({ ok: true })
      })

      it('calls Twilio Messages API with POST', async () => {
        await sendTwilioMessage({
          ...validConfig,
          message: { type: 'text', text: 'Hello world' },
        })

        expect(fetch).toHaveBeenCalledWith(
          `https://api.twilio.com/2010-04-01/Accounts/${validConfig.accountSid}/Messages.json`,
          expect.objectContaining({ method: 'POST' })
        )
      })

      it('sends Body parameter for text message', async () => {
        await sendTwilioMessage({
          ...validConfig,
          message: { type: 'text', text: 'Hello world' },
        })

        const body = fetch.mock.calls[0][1].body
        const params = new URLSearchParams(body)

        expect(params.get('Body')).toBe('Hello world')
        expect(params.get('MediaUrl')).toBeNull()
      })

      it('sends From and To parameters', async () => {
        await sendTwilioMessage({
          ...validConfig,
          message: { type: 'text', text: 'Test' },
        })

        const body = fetch.mock.calls[0][1].body
        const params = new URLSearchParams(body)

        // @note normalized E.164 values
        expect(params.get('From')).toBe('+12025551234')
        expect(params.get('To')).toBe('+14155552671')
      })

      it('uses Basic auth header with accountSid:authToken', async () => {
        await sendTwilioMessage({
          ...validConfig,
          message: { type: 'text', text: 'Test' },
        })

        const { headers } = fetch.mock.calls[0][1]

        expect(headers['Authorization']).toMatch(/^Basic /)

        // @note verify the encoded credentials contain the accountSid
        const decoded = Buffer.from(
          headers['Authorization'].replace('Basic ', ''),
          'base64'
        ).toString()

        expect(decoded).toBe(
          `${validConfig.accountSid}:${validConfig.authToken}`
        )
      })
    })

    describe('successful image message', () => {
      beforeEach(() => {
        fetch.mockResolvedValueOnce({ ok: true })
      })

      it('sends MediaUrl parameter for image message', async () => {
        const imageUrl = 'https://example.com/image.jpg'

        await sendTwilioMessage({
          ...validConfig,
          message: { type: 'image', image: imageUrl },
        })

        const body = fetch.mock.calls[0][1].body
        const params = new URLSearchParams(body)

        expect(params.get('MediaUrl')).toBe(imageUrl)
        expect(params.get('Body')).toBeNull()
      })
    })

    describe('API error handling', () => {
      it('throws with Twilio error code and message from JSON response', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () =>
            JSON.stringify({
              code: 21211,
              message: 'The From phone number is not a valid phone number',
            }),
        })

        await expect(
          sendTwilioMessage({
            ...validConfig,
            message: { type: 'text', text: 'Hello' },
          })
        ).rejects.toThrow('Twilio API failed: 400 - code 21211')
      })

      it('throws with status code when response body is empty', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: async () => '',
        })

        await expect(
          sendTwilioMessage({
            ...validConfig,
            message: { type: 'text', text: 'Hello' },
          })
        ).rejects.toThrow('Twilio API failed: 503')
      })

      it('attaches structured error data on API failure', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () =>
            JSON.stringify({ code: 21408, message: 'Permission to send SMS' }),
        })

        let thrownError

        try {
          await sendTwilioMessage({
            ...validConfig,
            message: { type: 'text', text: 'Hello' },
          })
        } catch (e) {
          thrownError = e
        }

        expect(thrownError).toBeDefined()
        expect(thrownError.data).toMatchObject({
          status: 400,
          code: 21408,
          messageType: 'text',
        })
      })

      it('includes from and to in error data for debugging', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () => JSON.stringify({ message: 'error' }),
        })

        let thrownError

        try {
          await sendTwilioMessage({
            ...validConfig,
            message: { type: 'text', text: 'Hello' },
          })
        } catch (e) {
          thrownError = e
        }

        expect(thrownError.data).toMatchObject({
          from: '+12025551234',
          to: '+14155552671',
        })
      })
    })

    describe('alphanumeric sender', () => {
      it('accepts alphanumeric sender when allowAlphanumericSender is true (from)', async () => {
        fetch.mockResolvedValueOnce({ ok: true })

        // @note normalizeTwilioMessageAddress allows alphanumeric senders
        // for the "from" address - test this path via sendTwilioMessage

        await expect(
          sendTwilioMessage({
            ...validConfig,
            from: 'MyBrand',
            message: { type: 'text', text: 'Hello' },
          })
        ).resolves.toBeUndefined()

        const body = fetch.mock.calls[0][1].body
        const params = new URLSearchParams(body)

        expect(params.get('From')).toBe('MyBrand')
      })
    })
  })

  describe('sendTwilioCall', () => {
    const validConfig = {
      accountSid: 'ACtest456',
      authToken: 'call-auth-token',
      from: '+12025551234',
      to: '+14155552671',
    }

    describe('missing configuration - silent skip', () => {
      it('returns without calling fetch when accountSid is missing', async () => {
        await sendTwilioCall({
          ...validConfig,
          accountSid: null,
          twiml: '<Response><Say>Hello</Say></Response>',
        })

        expect(fetch).not.toHaveBeenCalled()
      })

      it('returns without calling fetch when to is missing', async () => {
        await sendTwilioCall({
          ...validConfig,
          to: undefined,
          twiml: '<Response><Say>Hello</Say></Response>',
        })

        expect(fetch).not.toHaveBeenCalled()
      })
    })

    describe('address validation', () => {
      it('throws for an invalid from address', async () => {
        await expect(
          sendTwilioCall({
            ...validConfig,
            from: 'invalid',
            twiml: '<Response><Say>Hello</Say></Response>',
          })
        ).rejects.toThrow('Invalid Twilio call address')
      })

      it('attaches structured data with INVALID_TWILIO_CALL_ADDRESS code', async () => {
        let thrownError

        try {
          await sendTwilioCall({
            ...validConfig,
            to: 'invalid',
            twiml: '<Response><Say>Hello</Say></Response>',
          })
        } catch (e) {
          thrownError = e
        }

        expect(thrownError.data).toMatchObject({
          code: 'INVALID_TWILIO_CALL_ADDRESS',
        })
      })
    })

    describe('successful call', () => {
      beforeEach(() => {
        fetch.mockResolvedValueOnce({ ok: true })
      })

      it('calls Twilio Calls API with POST', async () => {
        await sendTwilioCall({
          ...validConfig,
          twiml: '<Response><Say>Hello</Say></Response>',
        })

        expect(fetch).toHaveBeenCalledWith(
          `https://api.twilio.com/2010-04-01/Accounts/${validConfig.accountSid}/Calls.json`,
          expect.objectContaining({ method: 'POST' })
        )
      })

      it('sends Twiml, From, and To parameters', async () => {
        const twiml = '<Response><Say>Hello world</Say></Response>'

        await sendTwilioCall({ ...validConfig, twiml })

        const body = fetch.mock.calls[0][1].body
        const params = new URLSearchParams(body)

        expect(params.get('Twiml')).toBe(twiml)
        expect(params.get('From')).toBe('+12025551234')
        expect(params.get('To')).toBe('+14155552671')
      })

      it('uses Basic auth header', async () => {
        await sendTwilioCall({
          ...validConfig,
          twiml: '<Response><Say>Test</Say></Response>',
        })

        const { headers } = fetch.mock.calls[0][1]

        expect(headers['Authorization']).toMatch(/^Basic /)
      })
    })

    describe('API error handling', () => {
      it('throws with Twilio error code and message from JSON response', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () =>
            JSON.stringify({ code: 21217, message: 'Invalid phone number' }),
        })

        await expect(
          sendTwilioCall({
            ...validConfig,
            twiml: '<Response><Say>Test</Say></Response>',
          })
        ).rejects.toThrow('Twilio Call API failed: 400 - code 21217')
      })

      it('attaches structured error data including from and to', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () =>
            JSON.stringify({ code: 21217, message: 'Invalid phone number' }),
        })

        let thrownError

        try {
          await sendTwilioCall({
            ...validConfig,
            twiml: '<Response><Say>Test</Say></Response>',
          })
        } catch (e) {
          thrownError = e
        }

        expect(thrownError.data).toMatchObject({
          status: 400,
          code: 21217,
          from: '+12025551234',
          to: '+14155552671',
        })
      })

      it('throws with status only when response body is empty', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => '',
        })

        await expect(
          sendTwilioCall({
            ...validConfig,
            twiml: '<Response><Say>Test</Say></Response>',
          })
        ).rejects.toThrow('Twilio Call API failed: 500')
      })
    })
  })

  describe('updateTwilioCall', () => {
    const validConfig = {
      accountSid: 'ACtest789',
      authToken: 'update-auth-token',
      callSid: 'CA1234567890abcdef1234567890abcdef',
      url: 'https://example.test/respond?body=twiml',
    }

    describe('missing configuration - silent skip', () => {
      it('returns without calling fetch when accountSid is missing', async () => {
        await updateTwilioCall({
          ...validConfig,
          accountSid: null,
        })

        expect(fetch).not.toHaveBeenCalled()
      })

      it('returns without calling fetch when callSid is missing', async () => {
        await updateTwilioCall({
          ...validConfig,
          callSid: undefined,
        })

        expect(fetch).not.toHaveBeenCalled()
      })
    })

    describe('successful call update', () => {
      beforeEach(() => {
        fetch.mockResolvedValueOnce({ ok: true })
      })

      it('calls Twilio Calls API with POST for the target call SID', async () => {
        await updateTwilioCall(validConfig)

        expect(fetch).toHaveBeenCalledWith(
          `https://api.twilio.com/2010-04-01/Accounts/${validConfig.accountSid}/Calls/${validConfig.callSid}.json`,
          expect.objectContaining({ method: 'POST' })
        )
      })

      it('sends Url and Method parameters', async () => {
        await updateTwilioCall(validConfig)

        const body = fetch.mock.calls[0][1].body
        const params = new URLSearchParams(body)

        expect(params.get('Url')).toBe(validConfig.url)
        expect(params.get('Method')).toBe('POST')
      })

      it('sends Status parameter when completing a call', async () => {
        await updateTwilioCall({
          accountSid: validConfig.accountSid,
          authToken: validConfig.authToken,
          callSid: validConfig.callSid,
          status: 'completed',
        })

        const body = fetch.mock.calls[0][1].body
        const params = new URLSearchParams(body)

        expect(params.get('Status')).toBe('completed')
        expect(params.get('Url')).toBeNull()
        expect(params.get('Method')).toBeNull()
      })
    })

    describe('API error handling', () => {
      it('throws with Twilio error code and message from JSON response', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () =>
            JSON.stringify({ code: 21220, message: 'Invalid call SID' }),
        })

        await expect(updateTwilioCall(validConfig)).rejects.toThrow(
          'Twilio Call Update API failed: 400 - code 21220'
        )
      })
    })
  })

  describe('listTwilioIncomingPhoneNumbers', () => {
    const validConfig = {
      accountSid: 'ACtestabc',
      authToken: 'list-auth-token',
    }

    describe('missing configuration - silent skip', () => {
      it('returns [] without calling fetch when accountSid is missing', async () => {
        const result = await listTwilioIncomingPhoneNumbers({
          ...validConfig,
          accountSid: null,
        })

        expect(result).toEqual([])
        expect(fetch).not.toHaveBeenCalled()
      })

      it('returns [] without calling fetch when authToken is missing', async () => {
        const result = await listTwilioIncomingPhoneNumbers({
          ...validConfig,
          authToken: null,
        })

        expect(result).toEqual([])
        expect(fetch).not.toHaveBeenCalled()
      })
    })

    describe('successful lookup', () => {
      it('calls the IncomingPhoneNumbers API with Basic auth', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ incoming_phone_numbers: [] }),
        })

        await listTwilioIncomingPhoneNumbers(validConfig)

        const [url, options] = fetch.mock.calls[0]

        expect(url).toContain(
          `https://api.twilio.com/2010-04-01/Accounts/${validConfig.accountSid}/IncomingPhoneNumbers.json`
        )
        expect(options.method).toBe('GET')
        expect(options.headers['Authorization']).toMatch(/^Basic /)
      })

      it('returns the phone_number values from the response', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            incoming_phone_numbers: [
              { phone_number: '+12025551234' },
              { phone_number: '+14155552671' },
            ],
          }),
        })

        const result = await listTwilioIncomingPhoneNumbers(validConfig)

        expect(result).toEqual(['+12025551234', '+14155552671'])
      })

      it('filters out entries without a string phone_number', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            incoming_phone_numbers: [
              { phone_number: '+12025551234' },
              { phone_number: null },
              {},
            ],
          }),
        })

        const result = await listTwilioIncomingPhoneNumbers(validConfig)

        expect(result).toEqual(['+12025551234'])
      })

      it('returns [] when incoming_phone_numbers is missing', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })

        const result = await listTwilioIncomingPhoneNumbers(validConfig)

        expect(result).toEqual([])
      })
    })

    describe('API error handling', () => {
      it('throws with Twilio error code and message from JSON response', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () =>
            JSON.stringify({ code: 20003, message: 'Authentication failed' }),
        })

        await expect(
          listTwilioIncomingPhoneNumbers(validConfig)
        ).rejects.toThrow(
          'Twilio Incoming Phone Numbers API failed: 401 - code 20003'
        )
      })
    })
  })
})
