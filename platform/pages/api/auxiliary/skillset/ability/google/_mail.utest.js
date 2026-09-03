/* eslint-disable @typescript-eslint/no-require-imports */
import handlers, {
  DRAFT_CREATE_HANDLER_NAME,
  DRAFT_DELETE_HANDLER_NAME,
  DRAFT_FETCH_HANDLER_NAME,
  DRAFT_LIST_HANDLER_NAME,
  DRAFT_SEND_HANDLER_NAME,
  LABEL_CREATE_HANDLER_NAME,
  LABEL_DELETE_HANDLER_NAME,
  LABEL_LIST_HANDLER_NAME,
  MESSAGE_FETCH_HANDLER_NAME,
  MESSAGE_LABEL_HANDLER_NAME,
  MESSAGE_LIST_HANDLER_NAME,
  MESSAGE_SEND_HANDLER_NAME,
  MESSAGE_TRASH_HANDLER_NAME,
  THREAD_FETCH_HANDLER_NAME,
  THREAD_LIST_HANDLER_NAME,
  THREAD_TRASH_HANDLER_NAME,
  USER_PROFILE_FETCH_HANDLER_NAME,
  draftCreateSchema,
  draftDeleteSchema,
  draftFetchSchema,
  draftListSchema,
  draftSendSchema,
  labelCreateSchema,
  labelDeleteSchema,
  labelListSchema,
  messageFetchSchema,
  messageLabelSchema,
  messageListSchema,
  messageSendSchema,
  messageTrashSchema,
  threadFetchSchema,
  threadListSchema,
  threadTrashSchema,
  userProfileFetchSchema,
} from '@/pages/api/auxiliary/skillset/ability/google/mail'

jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedMultiHandler: jest.fn((handlersMap) => {
    // @note return an object with the handler functions for direct testing
    const result = {}

    for (const [name, handler] of Object.entries(handlersMap)) {
      // @note every auxiliary route is authenticated; bind a mock session so
      // the tests keep calling the inner function as (parameters, headers)
      result[name] = (parameters, headers) =>
        handler.fn({ user: { id: 'test-user-id' } }, parameters, headers)
    }

    return result
  }),
}))

jest.mock('@/lib/debug', () => jest.fn(() => ({ log: jest.fn() })))

jest.mock('@/lib/call', () => {
  const mockCall = jest.fn()

  mockCall.getCallError = jest.fn((response) =>
    Promise.resolve(new Error(`API Error: ${response.status}`))
  )

  return {
    __esModule: true,
    default: mockCall,
    getCallError: mockCall.getCallError,
  }
})

jest.mock('@/lib/response', () => ({
  throwNotAuthenticated: jest.fn(() => {
    throw new Error('Not authenticated')
  }),
}))

jest.mock('@chatbotkit-dev/file-html/parse', () => ({
  html2text: jest.fn((html) => {
    if (!html) {
      return ''
    }

    return html.replace(/<[^>]*>/g, '')
  }),
}))

jest.mock('mimetext', () => ({
  createMimeMessage: jest.fn(() => ({
    setSender: jest.fn(),
    setRecipient: jest.fn(),
    setSubject: jest.fn(),
    setHeader: jest.fn(),
    addMessage: jest.fn(),
    addAttachment: jest.fn(),
    asEncoded: jest.fn(() => 'encoded-mime-message'),
  })),
}))

const mockCall = require('@/lib/call').default
const mimetext = require('mimetext')

const lastMimeMessage = () =>
  mimetext.createMimeMessage.mock.results.at(-1).value

const mockUserProfile = (emailAddress = 'sender@example.com') => {
  mockCall.mockResolvedValueOnce({
    ok: true,
    json: jest.fn().mockResolvedValue({
      emailAddress,
    }),
  })
}

describe('Google Mail Handlers', () => {
  const mockHeaders = new Headers()

  mockHeaders.set('x-access-token', 'Bearer test-token')

  beforeEach(() => {
    jest.clearAllMocks()

    mockCall.mockReset()
  })

  describe('Handler Names', () => {
    it('should export correct handler names', () => {
      expect(USER_PROFILE_FETCH_HANDLER_NAME).toBe('user/profile/fetch')
      expect(DRAFT_CREATE_HANDLER_NAME).toBe('draft/create')
      expect(DRAFT_FETCH_HANDLER_NAME).toBe('draft/fetch')
      expect(DRAFT_LIST_HANDLER_NAME).toBe('draft/list')
      expect(DRAFT_SEND_HANDLER_NAME).toBe('draft/send')
      expect(DRAFT_DELETE_HANDLER_NAME).toBe('draft/delete')
      expect(MESSAGE_FETCH_HANDLER_NAME).toBe('message/fetch')
      expect(MESSAGE_LIST_HANDLER_NAME).toBe('message/list')
      expect(MESSAGE_SEND_HANDLER_NAME).toBe('message/send')
      expect(MESSAGE_TRASH_HANDLER_NAME).toBe('message/trash')
      expect(MESSAGE_LABEL_HANDLER_NAME).toBe('message/label')
      expect(THREAD_FETCH_HANDLER_NAME).toBe('thread/fetch')
      expect(THREAD_LIST_HANDLER_NAME).toBe('thread/list')
      expect(THREAD_TRASH_HANDLER_NAME).toBe('thread/trash')
      expect(LABEL_LIST_HANDLER_NAME).toBe('label/list')
      expect(LABEL_CREATE_HANDLER_NAME).toBe('label/create')
      expect(LABEL_DELETE_HANDLER_NAME).toBe('label/delete')
    })

    it('should register all handlers', () => {
      expect(handlers).toHaveProperty(USER_PROFILE_FETCH_HANDLER_NAME)
      expect(handlers).toHaveProperty(DRAFT_CREATE_HANDLER_NAME)
      expect(handlers).toHaveProperty(DRAFT_FETCH_HANDLER_NAME)
      expect(handlers).toHaveProperty(DRAFT_LIST_HANDLER_NAME)
      expect(handlers).toHaveProperty(DRAFT_SEND_HANDLER_NAME)
      expect(handlers).toHaveProperty(DRAFT_DELETE_HANDLER_NAME)
      expect(handlers).toHaveProperty(MESSAGE_FETCH_HANDLER_NAME)
      expect(handlers).toHaveProperty(MESSAGE_LIST_HANDLER_NAME)
      expect(handlers).toHaveProperty(MESSAGE_SEND_HANDLER_NAME)
      expect(handlers).toHaveProperty(MESSAGE_TRASH_HANDLER_NAME)
      expect(handlers).toHaveProperty(MESSAGE_LABEL_HANDLER_NAME)
      expect(handlers).toHaveProperty(THREAD_FETCH_HANDLER_NAME)
      expect(handlers).toHaveProperty(THREAD_LIST_HANDLER_NAME)
      expect(handlers).toHaveProperty(THREAD_TRASH_HANDLER_NAME)
      expect(handlers).toHaveProperty(LABEL_LIST_HANDLER_NAME)
      expect(handlers).toHaveProperty(LABEL_CREATE_HANDLER_NAME)
      expect(handlers).toHaveProperty(LABEL_DELETE_HANDLER_NAME)
    })
  })

  describe('Schemas', () => {
    describe('draftCreateSchema', () => {
      it('should accept valid draft create parameters', () => {
        const validData = {
          to: 'test@example.com',
          subject: 'Test Subject',
          content: 'Test content',
        }

        const result = draftCreateSchema.safeParse(validData)

        expect(result.success).toBe(true)
      })

      it('should accept optional threadId', () => {
        const validData = {
          threadId: 'thread-123',
          to: 'test@example.com',
          subject: 'Test Subject',
          content: 'Test content',
        }

        const result = draftCreateSchema.safeParse(validData)

        expect(result.success).toBe(true)
      })

      it('should accept optional attachments', () => {
        const validData = {
          to: 'test@example.com',
          subject: 'Test Subject',
          content: 'Test content',
          attachments: 'https://example.com/file.pdf',
        }

        const result = draftCreateSchema.safeParse(validData)

        expect(result.success).toBe(true)
      })

      it('should reject missing required fields', () => {
        const invalidData = {
          subject: 'Test Subject',
        }

        const result = draftCreateSchema.safeParse(invalidData)

        expect(result.success).toBe(false)
      })

      it('should reject invalid recipient email', () => {
        const invalidData = {
          to: 'not-an-email',
          subject: 'Test Subject',
          content: 'Test content',
        }

        const result = draftCreateSchema.safeParse(invalidData)

        expect(result.success).toBe(false)
      })

      it('should accept multiple recipient emails', () => {
        const validData = {
          to: 'first@example.com, second@example.com',
          subject: 'Test Subject',
          content: 'Test content',
        }

        const result = draftCreateSchema.safeParse(validData)

        expect(result.success).toBe(true)
      })

      it('should reject recipient list containing invalid email', () => {
        const invalidData = {
          to: 'first@example.com, invalid-email',
          subject: 'Test Subject',
          content: 'Test content',
        }

        const result = draftCreateSchema.safeParse(invalidData)

        expect(result.success).toBe(false)
      })
    })

    describe('draftFetchSchema', () => {
      it('should accept valid draft fetch parameters', () => {
        const validData = { id: 'draft-123' }

        const result = draftFetchSchema.safeParse(validData)

        expect(result.success).toBe(true)
      })

      it('should reject missing id', () => {
        const invalidData = {}

        const result = draftFetchSchema.safeParse(invalidData)

        expect(result.success).toBe(false)
      })
    })

    describe('messageFetchSchema', () => {
      it('should accept valid message fetch parameters', () => {
        const validData = { id: 'message-123' }

        const result = messageFetchSchema.safeParse(validData)

        expect(result.success).toBe(true)
      })

      it('should reject missing id', () => {
        const invalidData = {}

        const result = messageFetchSchema.safeParse(invalidData)

        expect(result.success).toBe(false)
      })
    })

    describe('messageListSchema', () => {
      it('should accept valid message list parameters', () => {
        const validData = {
          q: 'from:sender@example.com',
          maxResults: 10,
        }

        const result = messageListSchema.safeParse(validData)

        expect(result.success).toBe(true)
      })

      it('should use default values for optional fields', () => {
        const validData = {}

        const result = messageListSchema.safeParse(validData)

        expect(result.success).toBe(true)
        expect(result.data.maxResults).toBe(25)
        expect(result.data.returnMessageText).toBe(false)
        expect(result.data.filterPending).toBe(false)
      })

      it('should reject invalid maxResults', () => {
        const invalidData = { maxResults: 0 }

        const result = messageListSchema.safeParse(invalidData)

        expect(result.success).toBe(false)
      })
    })

    describe('messageSendSchema', () => {
      it('should accept valid message send parameters', () => {
        const validData = {
          to: 'recipient@example.com',
          subject: 'Test Email',
          content: 'Hello, this is a test email.',
        }

        const result = messageSendSchema.safeParse(validData)

        expect(result.success).toBe(true)
      })

      it('should reject invalid recipient email', () => {
        const invalidData = {
          to: 'invalid-recipient',
          subject: 'Test Email',
          content: 'Hello, this is a test email.',
        }

        const result = messageSendSchema.safeParse(invalidData)

        expect(result.success).toBe(false)
      })

      it('should accept multiple recipient emails', () => {
        const validData = {
          to: 'recipient@example.com, team@example.com',
          subject: 'Test Email',
          content: 'Hello, this is a test email.',
        }

        const result = messageSendSchema.safeParse(validData)

        expect(result.success).toBe(true)
      })

      it('should reject recipient list containing invalid email', () => {
        const invalidData = {
          to: 'recipient@example.com, invalid-email',
          subject: 'Test Email',
          content: 'Hello, this is a test email.',
        }

        const result = messageSendSchema.safeParse(invalidData)

        expect(result.success).toBe(false)
      })

      it('should accept optional threadId for replies', () => {
        const validData = {
          threadId: 'thread-456',
          to: 'recipient@example.com',
          subject: 'Re: Test Email',
          content: 'This is a reply.',
        }

        const result = messageSendSchema.safeParse(validData)

        expect(result.success).toBe(true)
      })
    })

    describe('threadFetchSchema', () => {
      it('should accept valid thread fetch parameters', () => {
        const validData = { id: 'thread-789' }

        const result = threadFetchSchema.safeParse(validData)

        expect(result.success).toBe(true)
      })
    })

    describe('threadListSchema', () => {
      it('should accept valid thread list parameters', () => {
        const validData = {
          q: 'label:inbox',
          maxResults: 50,
          returnMessageText: true,
          filterPending: true,
        }

        const result = threadListSchema.safeParse(validData)

        expect(result.success).toBe(true)
      })

      it('should use default values', () => {
        const result = threadListSchema.safeParse({})

        expect(result.success).toBe(true)
        expect(result.data.maxResults).toBe(25)
        expect(result.data.returnMessageText).toBe(false)
        expect(result.data.filterPending).toBe(false)
      })
    })

    describe('userProfileFetchSchema', () => {
      it('should accept empty object', () => {
        const result = userProfileFetchSchema.safeParse({})

        expect(result.success).toBe(true)
      })
    })

    describe('draftListSchema', () => {
      it('should accept valid draft list parameters', () => {
        const validData = {
          q: 'to:test@example.com',
          maxResults: 10,
        }

        const result = draftListSchema.safeParse(validData)

        expect(result.success).toBe(true)
      })

      it('should use default maxResults', () => {
        const result = draftListSchema.safeParse({})

        expect(result.success).toBe(true)
        expect(result.data.maxResults).toBe(25)
      })
    })

    describe('draftSendSchema', () => {
      it('should accept valid draft send parameters', () => {
        const validData = { id: 'draft-123' }

        const result = draftSendSchema.safeParse(validData)

        expect(result.success).toBe(true)
      })

      it('should reject missing id', () => {
        const result = draftSendSchema.safeParse({})

        expect(result.success).toBe(false)
      })
    })

    describe('draftDeleteSchema', () => {
      it('should accept valid draft delete parameters', () => {
        const validData = { id: 'draft-to-delete' }

        const result = draftDeleteSchema.safeParse(validData)

        expect(result.success).toBe(true)
      })

      it('should reject missing id', () => {
        const result = draftDeleteSchema.safeParse({})

        expect(result.success).toBe(false)
      })
    })

    describe('messageTrashSchema', () => {
      it('should accept valid message trash parameters', () => {
        const validData = { id: 'msg-to-trash' }

        const result = messageTrashSchema.safeParse(validData)

        expect(result.success).toBe(true)
      })

      it('should reject missing id', () => {
        const result = messageTrashSchema.safeParse({})

        expect(result.success).toBe(false)
      })
    })

    describe('messageLabelSchema', () => {
      it('should accept valid message label parameters', () => {
        const validData = { id: 'msg-123', addLabelId: 'Label_123' }

        const result = messageLabelSchema.safeParse(validData)

        expect(result.success).toBe(true)
      })

      it('should accept without addLabelId', () => {
        const validData = { id: 'msg-123' }

        const result = messageLabelSchema.safeParse(validData)

        expect(result.success).toBe(true)
      })

      it('should reject missing id', () => {
        const result = messageLabelSchema.safeParse({ addLabelId: 'Label_123' })

        expect(result.success).toBe(false)
      })
    })

    describe('threadTrashSchema', () => {
      it('should accept valid thread trash parameters', () => {
        const validData = { id: 'thread-to-trash' }

        const result = threadTrashSchema.safeParse(validData)

        expect(result.success).toBe(true)
      })

      it('should reject missing id', () => {
        const result = threadTrashSchema.safeParse({})

        expect(result.success).toBe(false)
      })
    })

    describe('labelListSchema', () => {
      it('should accept empty object', () => {
        const result = labelListSchema.safeParse({})

        expect(result.success).toBe(true)
      })
    })

    describe('labelCreateSchema', () => {
      it('should accept valid label create parameters', () => {
        const validData = { name: 'My New Label' }

        const result = labelCreateSchema.safeParse(validData)

        expect(result.success).toBe(true)
      })

      it('should reject missing name', () => {
        const result = labelCreateSchema.safeParse({})

        expect(result.success).toBe(false)
      })
    })

    describe('labelDeleteSchema', () => {
      it('should accept valid label delete parameters', () => {
        const validData = { id: 'Label_123' }

        const result = labelDeleteSchema.safeParse(validData)

        expect(result.success).toBe(true)
      })

      it('should reject missing id', () => {
        const result = labelDeleteSchema.safeParse({})

        expect(result.success).toBe(false)
      })
    })
  })

  describe('Authentication', () => {
    it('should throw error when access token is missing', async () => {
      const headersWithoutToken = new Headers()

      const parameters = { id: 'message-123' }

      await expect(
        handlers[MESSAGE_FETCH_HANDLER_NAME](parameters, headersWithoutToken)
      ).rejects.toThrow('Not authenticated')
    })

    it('should use access token from headers', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 'message-123',
          threadId: 'thread-123',
          snippet: 'Test snippet',
          payload: {
            headers: [
              { name: 'Subject', value: 'Test Subject' },
              { name: 'From', value: 'sender@example.com' },
              { name: 'To', value: 'recipient@example.com' },
            ],
          },
        }),
      })

      const parameters = { id: 'message-123' }

      await handlers[MESSAGE_FETCH_HANDLER_NAME](parameters, mockHeaders)

      expect(mockCall).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      )
    })
  })

  describe('Draft Handlers', () => {
    describe('draft/create', () => {
      it('should create a draft successfully', async () => {
        mockUserProfile()

        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'draft-new-123',
            threadId: 'thread-new-123',
          }),
        })

        const parameters = {
          to: 'recipient@example.com',
          subject: 'New Draft',
          content: 'Draft content here',
        }

        const result = await handlers[DRAFT_CREATE_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result).toHaveProperty('id', 'draft-new-123')
        expect(result).toHaveProperty('link')
        expect(result.link).toContain('thread-new-123')

        expect(lastMimeMessage().setSender).toHaveBeenCalledWith(
          'sender@example.com'
        )
      })

      it('should create draft with threadId for reply', async () => {
        mockUserProfile()

        // @note next call: GET thread metadata to extract reply headers
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'existing-thread-123',
            messages: [
              {
                id: 'msg-1',
                payload: {
                  headers: [
                    { name: 'Message-ID', value: '<parent@example.com>' },
                    { name: 'Subject', value: 'Original Subject' },
                  ],
                },
              },
            ],
          }),
        })

        // @note final call: POST draft create
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'draft-reply-123',
            threadId: 'existing-thread-123',
          }),
        })

        const parameters = {
          threadId: 'existing-thread-123',
          to: 'recipient@example.com',
          subject: 'Re: Original Subject',
          content: 'Reply content',
        }

        const result = await handlers[DRAFT_CREATE_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result.id).toBe('draft-reply-123')

        const draftCreateCall = mockCall.mock.calls.find(
          ([url]) => typeof url === 'string' && url.endsWith('/drafts')
        )

        expect(draftCreateCall).toBeDefined()
        expect(draftCreateCall[1].body).toContain('existing-thread-123')

        const mime = lastMimeMessage()

        expect(mime.setSender).toHaveBeenCalledWith('sender@example.com')
        expect(mime.setHeader).toHaveBeenCalledWith(
          'In-Reply-To',
          '<parent@example.com>'
        )
        expect(mime.setHeader).toHaveBeenCalledWith(
          'References',
          '<parent@example.com>'
        )
      })

      it('should preserve and extend References chain when replying', async () => {
        mockUserProfile()

        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'thread-deep',
            messages: [
              {
                id: 'older',
                payload: {
                  headers: [
                    { name: 'Message-ID', value: '<older@example.com>' },
                  ],
                },
              },
              {
                id: 'newer',
                payload: {
                  headers: [
                    { name: 'Message-ID', value: '<newer@example.com>' },
                    {
                      name: 'References',
                      value: '<root@example.com> <older@example.com>',
                    },
                  ],
                },
              },
            ],
          }),
        })

        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'draft-reply-deep',
            threadId: 'thread-deep',
          }),
        })

        await handlers[DRAFT_CREATE_HANDLER_NAME](
          {
            threadId: 'thread-deep',
            to: 'recipient@example.com',
            subject: 'Re: Deep',
            content: 'reply',
          },
          mockHeaders
        )

        const mime = lastMimeMessage()

        expect(mime.setHeader).toHaveBeenCalledWith(
          'In-Reply-To',
          '<newer@example.com>'
        )
        expect(mime.setHeader).toHaveBeenCalledWith(
          'References',
          '<root@example.com> <older@example.com> <newer@example.com>'
        )
      })

      it('should not set reply headers when no threadId', async () => {
        mockUserProfile()

        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'draft-fresh',
            threadId: 'thread-fresh',
          }),
        })

        await handlers[DRAFT_CREATE_HANDLER_NAME](
          {
            to: 'recipient@example.com',
            subject: 'Fresh',
            content: 'no thread',
          },
          mockHeaders
        )

        const mime = lastMimeMessage()

        expect(mime.setHeader).not.toHaveBeenCalled()
      })

      it('should still create draft when thread metadata fetch fails', async () => {
        mockUserProfile()

        // @note thread fetch fails - we should fall back to creating without reply headers
        mockCall.mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: jest.fn().mockResolvedValue({ error: 'Not Found' }),
        })

        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'draft-no-headers',
            threadId: 'broken-thread',
          }),
        })

        const result = await handlers[DRAFT_CREATE_HANDLER_NAME](
          {
            threadId: 'broken-thread',
            to: 'recipient@example.com',
            subject: 'Re: Whatever',
            content: 'content',
          },
          mockHeaders
        )

        expect(result.id).toBe('draft-no-headers')

        const mime = lastMimeMessage()

        expect(mime.setHeader).not.toHaveBeenCalled()
      })

      it('should handle API error during draft creation', async () => {
        mockUserProfile()

        mockCall.mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: jest.fn().mockResolvedValue({ error: 'Bad Request' }),
        })

        const parameters = {
          to: 'recipient@example.com',
          subject: 'Test',
          content: 'Content',
        }

        await expect(
          handlers[DRAFT_CREATE_HANDLER_NAME](parameters, mockHeaders)
        ).rejects.toThrow()
      })

      it('should return fallback link when no threadId returned', async () => {
        mockUserProfile()

        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'draft-no-thread',
            threadId: null,
          }),
        })

        const parameters = {
          to: 'recipient@example.com',
          subject: 'Test',
          content: 'Content',
        }

        const result = await handlers[DRAFT_CREATE_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result.link).toBe('https://mail.google.com/mail/ca/u/0/#drafts')
      })
    })

    describe('draft/fetch', () => {
      it('should fetch a draft successfully', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'draft-123',
            message: {
              id: 'message-in-draft',
              threadId: 'thread-draft-123',
              snippet: 'Draft preview text',
              payload: {
                headers: [
                  { name: 'Subject', value: 'Draft Subject' },
                  { name: 'From', value: 'me@example.com' },
                  { name: 'To', value: 'recipient@example.com' },
                ],
                parts: [
                  {
                    mimeType: 'text/plain',
                    body: { data: 'RHJhZnQgYm9keQ==' }, // "Draft body" base64
                  },
                ],
              },
            },
          }),
        })

        const parameters = { id: 'draft-123' }

        const result = await handlers[DRAFT_FETCH_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result).toHaveProperty('draft')
        expect(result.draft).toHaveProperty('link')
        expect(result.draft.link).toContain('drafts')
        expect(result.draft).not.toHaveProperty('snippet')
      })

      it('should call correct API endpoint', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'draft-123',
            message: {
              id: 'msg-123',
              threadId: 'thread-123',
              snippet: 'snippet',
              payload: {},
            },
          }),
        })

        const parameters = { id: 'draft-abc-xyz' }

        await handlers[DRAFT_FETCH_HANDLER_NAME](parameters, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          expect.stringContaining('/drafts/draft-abc-xyz'),
          expect.any(Object)
        )
      })

      it('should handle fetch error', async () => {
        mockCall.mockResolvedValueOnce({
          ok: false,
          status: 404,
        })

        const parameters = { id: 'nonexistent-draft' }

        await expect(
          handlers[DRAFT_FETCH_HANDLER_NAME](parameters, mockHeaders)
        ).rejects.toThrow()
      })
    })

    describe('draft/list', () => {
      it('should list drafts successfully', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            drafts: [
              { id: 'draft-1', message: { id: 'msg-1' } },
              { id: 'draft-2', message: { id: 'msg-2' } },
            ],
          }),
        })

        const parameters = { maxResults: 10 }

        const result = await handlers[DRAFT_LIST_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result).toHaveProperty('drafts')
        expect(result.drafts).toHaveLength(2)
      })

      it('should apply search query', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ drafts: [] }),
        })

        const parameters = { q: 'to:test@example.com' }

        await handlers[DRAFT_LIST_HANDLER_NAME](parameters, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          expect.stringContaining('q=to%3Atest%40example.com'),
          expect.any(Object)
        )
      })

      it('should handle API error', async () => {
        mockCall.mockResolvedValueOnce({
          ok: false,
          status: 500,
        })

        const parameters = {}

        await expect(
          handlers[DRAFT_LIST_HANDLER_NAME](parameters, mockHeaders)
        ).rejects.toThrow()
      })
    })

    describe('draft/send', () => {
      it('should send a draft successfully', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'sent-msg-123',
            threadId: 'thread-123',
          }),
        })

        const parameters = { id: 'draft-123' }

        const result = await handlers[DRAFT_SEND_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result).toHaveProperty('id', 'sent-msg-123')
      })

      it('should call correct API endpoint', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ id: 'msg-123' }),
        })

        const parameters = { id: 'draft-to-send' }

        await handlers[DRAFT_SEND_HANDLER_NAME](parameters, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          expect.stringContaining('/drafts/send'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('draft-to-send'),
          })
        )
      })

      it('should handle send error', async () => {
        mockCall.mockResolvedValueOnce({
          ok: false,
          status: 400,
        })

        const parameters = { id: 'invalid-draft' }

        await expect(
          handlers[DRAFT_SEND_HANDLER_NAME](parameters, mockHeaders)
        ).rejects.toThrow()
      })
    })

    describe('draft/delete', () => {
      it('should delete a draft successfully', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({}),
        })

        const parameters = { id: 'draft-to-delete' }

        const result = await handlers[DRAFT_DELETE_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result).toHaveProperty('success', true)
      })

      it('should call correct API endpoint with DELETE method', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({}),
        })

        const parameters = { id: 'draft-xyz' }

        await handlers[DRAFT_DELETE_HANDLER_NAME](parameters, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          expect.stringContaining('/drafts/draft-xyz'),
          expect.objectContaining({
            method: 'DELETE',
          })
        )
      })

      it('should handle delete error', async () => {
        mockCall.mockResolvedValueOnce({
          ok: false,
          status: 404,
        })

        const parameters = { id: 'nonexistent-draft' }

        await expect(
          handlers[DRAFT_DELETE_HANDLER_NAME](parameters, mockHeaders)
        ).rejects.toThrow()
      })
    })
  })

  describe('User Profile Handlers', () => {
    describe('user/profile/fetch', () => {
      it('should fetch user profile successfully', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            emailAddress: 'user@example.com',
            messagesTotal: 1000,
            threadsTotal: 500,
            historyId: '12345',
          }),
        })

        const parameters = {}

        const result = await handlers[USER_PROFILE_FETCH_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result).toHaveProperty('emailAddress', 'user@example.com')
      })

      it('should call correct API endpoint', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            emailAddress: 'user@example.com',
          }),
        })

        const parameters = {}

        await handlers[USER_PROFILE_FETCH_HANDLER_NAME](parameters, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          'https://gmail.googleapis.com/gmail/v1/users/me/profile',
          expect.any(Object)
        )
      })

      it('should handle fetch error', async () => {
        mockCall.mockResolvedValueOnce({
          ok: false,
          status: 401,
        })

        const parameters = {}

        await expect(
          handlers[USER_PROFILE_FETCH_HANDLER_NAME](parameters, mockHeaders)
        ).rejects.toThrow()
      })
    })
  })

  describe('Message Handlers', () => {
    describe('message/fetch', () => {
      it('should fetch a message successfully', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'msg-123',
            threadId: 'thread-123',
            snippet: 'Message preview',
            payload: {
              headers: [
                { name: 'Subject', value: 'Test Email' },
                { name: 'From', value: 'sender@example.com' },
                { name: 'To', value: 'me@example.com' },
                { name: 'Reply-To', value: 'reply@example.com' },
              ],
              parts: [
                {
                  mimeType: 'text/plain',
                  body: { data: 'SGVsbG8gV29ybGQ=' }, // "Hello World" base64
                },
              ],
            },
            labelIds: ['INBOX', 'UNREAD'],
          }),
        })

        const parameters = { id: 'msg-123' }

        const result = await handlers[MESSAGE_FETCH_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result).toHaveProperty('message')
        expect(result.message).toHaveProperty('id', 'msg-123')
        expect(result.message).toHaveProperty('subject', 'Test Email')
        expect(result.message).toHaveProperty('from', 'sender@example.com')
        expect(result.message).toHaveProperty('to', 'me@example.com')
        expect(result.message).toHaveProperty('replyTo', 'reply@example.com')
        expect(result.message).toHaveProperty('link')
        expect(result.message.link).toContain('inbox')
        expect(result.message).not.toHaveProperty('snippet')
      })

      it('should include format=full in request', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'msg-123',
            threadId: 'thread-123',
            snippet: 'snippet',
            payload: {},
          }),
        })

        const parameters = { id: 'msg-123' }

        await handlers[MESSAGE_FETCH_HANDLER_NAME](parameters, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          expect.stringContaining('format=full'),
          expect.any(Object)
        )
      })

      it('should handle message with HTML body only', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'msg-html',
            threadId: 'thread-html',
            snippet: 'HTML message',
            payload: {
              headers: [{ name: 'Subject', value: 'HTML Email' }],
              parts: [
                {
                  mimeType: 'text/html',
                  body: { data: 'PHA+SGVsbG88L3A+' }, // "<p>Hello</p>" base64
                },
              ],
            },
          }),
        })

        const parameters = { id: 'msg-html' }

        const result = await handlers[MESSAGE_FETCH_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result.message).toHaveProperty('body')
      })

      it('should handle unsubscribe header', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'msg-unsub',
            threadId: 'thread-unsub',
            snippet: 'Newsletter',
            payload: {
              headers: [
                { name: 'Subject', value: 'Newsletter' },
                {
                  name: 'List-Unsubscribe',
                  value: '<mailto:unsub@example.com>',
                },
              ],
            },
          }),
        })

        const parameters = { id: 'msg-unsub' }

        const result = await handlers[MESSAGE_FETCH_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result.message.unsubscribe).toBe(true)
      })

      it('should handle message without unsubscribe header', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'msg-no-unsub',
            threadId: 'thread-no-unsub',
            snippet: 'Regular email',
            payload: {
              headers: [{ name: 'Subject', value: 'Personal Email' }],
            },
          }),
        })

        const parameters = { id: 'msg-no-unsub' }

        const result = await handlers[MESSAGE_FETCH_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result.message.unsubscribe).toBe(false)
      })
    })

    describe('message/list', () => {
      it('should list messages successfully', async () => {
        // First call: list messages
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            messages: [
              { id: 'msg-1', threadId: 'thread-1' },
              { id: 'msg-2', threadId: 'thread-2' },
            ],
          }),
        })

        // Subsequent calls: fetch each message
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'msg-1',
            threadId: 'thread-1',
            snippet: 'First message',
            payload: {
              headers: [{ name: 'Subject', value: 'Email 1' }],
            },
          }),
        })

        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'msg-2',
            threadId: 'thread-2',
            snippet: 'Second message',
            payload: {
              headers: [{ name: 'Subject', value: 'Email 2' }],
            },
          }),
        })

        const parameters = { maxResults: 10 }

        const result = await handlers[MESSAGE_LIST_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result).toHaveProperty('messages')
        expect(result.messages).toHaveLength(2)
        expect(result.messages[0]).toHaveProperty('link')
      })

      it('should apply search query', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ messages: [] }),
        })

        const parameters = { q: 'from:important@example.com', maxResults: 5 }

        await handlers[MESSAGE_LIST_HANDLER_NAME](parameters, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          expect.stringContaining('q=from%3Aimportant%40example.com'),
          expect.any(Object)
        )
      })

      it('should apply maxResults parameter', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ messages: [] }),
        })

        const parameters = { maxResults: 15 }

        await handlers[MESSAGE_LIST_HANDLER_NAME](parameters, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          expect.stringContaining('maxResults=15'),
          expect.any(Object)
        )
      })

      it('should handle empty message list', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({}),
        })

        const parameters = { q: 'nonexistent-query' }

        const result = await handlers[MESSAGE_LIST_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result.messages).toEqual([])
      })

      it('should apply filterPending query modifier', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ messages: [] }),
        })

        const parameters = { filterPending: true }

        await handlers[MESSAGE_LIST_HANDLER_NAME](parameters, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          expect.stringContaining('category%3Apersonal'),
          expect.any(Object)
        )
      })

      it('should combine filterPending with custom query', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ messages: [] }),
        })

        const parameters = { q: 'label:work', filterPending: true }

        await handlers[MESSAGE_LIST_HANDLER_NAME](parameters, mockHeaders)

        const calledUrl = mockCall.mock.calls[0][0]

        expect(calledUrl).toContain('label%3Awork')
        expect(calledUrl).toContain('category%3Apersonal')
      })

      it('should return message when thread fetch returns 404 in filterPending mode', async () => {
        // mock the message list call
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            messages: [{ id: 'msg-1', threadId: 'thread-1' }],
          }),
        })

        // mock the thread fetch returning 404 (thread not found)
        mockCall.mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: jest.fn().mockResolvedValue({
            error: { code: 404, message: 'Requested entity was not found.' },
          }),
        })

        // mock the message detail fetch
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'msg-1',
            threadId: 'thread-1',
            snippet: 'Test snippet',
            payload: { headers: [] },
          }),
        })

        const parameters = { filterPending: true }

        // should not crash even though thread returned 404
        const result = await handlers[MESSAGE_LIST_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result.messages).toHaveLength(1)
        expect(result.messages[0].id).toBe('msg-1')
      })

      it('should return full message text when returnMessageText is true', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            messages: [{ id: 'msg-1', threadId: 'thread-1' }],
          }),
        })

        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'msg-1',
            threadId: 'thread-1',
            snippet: 'Preview text',
            payload: {
              headers: [{ name: 'Subject', value: 'Test' }],
              parts: [
                {
                  mimeType: 'text/plain',
                  body: { data: 'RnVsbCBtZXNzYWdlIGJvZHk=' }, // "Full message body"
                },
              ],
            },
          }),
        })

        const parameters = { returnMessageText: true }

        const result = await handlers[MESSAGE_LIST_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result.messages[0]).toHaveProperty('body')
        expect(result.messages[0]).not.toHaveProperty('snippet')
      })

      it('should return snippet when returnMessageText is false', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            messages: [{ id: 'msg-1', threadId: 'thread-1' }],
          }),
        })

        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'msg-1',
            threadId: 'thread-1',
            snippet: 'Preview text',
            payload: {
              headers: [{ name: 'Subject', value: 'Test' }],
              parts: [
                {
                  mimeType: 'text/plain',
                  body: { data: 'RnVsbCBtZXNzYWdlIGJvZHk=' },
                },
              ],
            },
          }),
        })

        const parameters = { returnMessageText: false }

        const result = await handlers[MESSAGE_LIST_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result.messages[0]).toHaveProperty('snippet')
        expect(result.messages[0]).not.toHaveProperty('body')
      })
    })

    describe('message/send', () => {
      it('should send a message successfully', async () => {
        mockUserProfile()

        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'sent-msg-123',
          }),
        })

        const parameters = {
          to: 'recipient@example.com',
          subject: 'Test Send',
          content: 'This is a test message.',
        }

        const result = await handlers[MESSAGE_SEND_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result).toHaveProperty('id', 'sent-msg-123')
        expect(lastMimeMessage().setSender).toHaveBeenCalledWith(
          'sender@example.com'
        )
      })

      it('should send reply to existing thread', async () => {
        mockUserProfile()

        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'existing-thread',
            messages: [
              {
                id: 'parent',
                payload: {
                  headers: [
                    { name: 'Message-ID', value: '<parent@example.com>' },
                  ],
                },
              },
            ],
          }),
        })

        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'reply-msg-123',
          }),
        })

        const parameters = {
          threadId: 'existing-thread',
          to: 'recipient@example.com',
          subject: 'Re: Original',
          content: 'This is a reply.',
        }

        const result = await handlers[MESSAGE_SEND_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result.id).toBe('reply-msg-123')

        const sendCall = mockCall.mock.calls.find(
          ([url]) => typeof url === 'string' && url.endsWith('/messages/send')
        )

        expect(sendCall).toBeDefined()
        expect(sendCall[1].body).toContain('existing-thread')

        const mime = lastMimeMessage()

        expect(mime.setSender).toHaveBeenCalledWith('sender@example.com')
        expect(mime.setHeader).toHaveBeenCalledWith(
          'In-Reply-To',
          '<parent@example.com>'
        )
        expect(mime.setHeader).toHaveBeenCalledWith(
          'References',
          '<parent@example.com>'
        )
      })

      it('should call correct API endpoint', async () => {
        mockUserProfile()

        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ id: 'msg-123' }),
        })

        const parameters = {
          to: 'test@example.com',
          subject: 'Test',
          content: 'Content',
        }

        await handlers[MESSAGE_SEND_HANDLER_NAME](parameters, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
          expect.any(Object)
        )
      })

      it('should handle send error', async () => {
        mockUserProfile()

        mockCall.mockResolvedValueOnce({
          ok: false,
          status: 403,
        })

        const parameters = {
          to: 'recipient@example.com',
          subject: 'Test',
          content: 'Content',
        }

        await expect(
          handlers[MESSAGE_SEND_HANDLER_NAME](parameters, mockHeaders)
        ).rejects.toThrow()
      })
    })

    describe('message/trash', () => {
      it('should trash a message successfully', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'msg-123',
            labelIds: ['TRASH'],
          }),
        })

        const parameters = { id: 'msg-123' }

        const result = await handlers[MESSAGE_TRASH_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result).toHaveProperty('id', 'msg-123')
        expect(result).toHaveProperty('labelIds')
      })

      it('should call correct API endpoint with POST method', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ id: 'msg-xyz' }),
        })

        const parameters = { id: 'msg-xyz' }

        await handlers[MESSAGE_TRASH_HANDLER_NAME](parameters, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          expect.stringContaining('/messages/msg-xyz/trash'),
          expect.objectContaining({
            method: 'POST',
          })
        )
      })

      it('should handle trash error', async () => {
        mockCall.mockResolvedValueOnce({
          ok: false,
          status: 404,
        })

        const parameters = { id: 'nonexistent-msg' }

        await expect(
          handlers[MESSAGE_TRASH_HANDLER_NAME](parameters, mockHeaders)
        ).rejects.toThrow()
      })
    })

    describe('message/label', () => {
      it('should add label to a message successfully', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'msg-123',
            labelIds: ['INBOX', 'Label_123'],
          }),
        })

        const parameters = { id: 'msg-123', addLabelId: 'Label_123' }

        const result = await handlers[MESSAGE_LABEL_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result).toHaveProperty('id', 'msg-123')
        expect(result).toHaveProperty('labelIds')
      })

      it('should call correct API endpoint with POST method', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ id: 'msg-abc' }),
        })

        const parameters = { id: 'msg-abc', addLabelId: 'IMPORTANT' }

        await handlers[MESSAGE_LABEL_HANDLER_NAME](parameters, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          expect.stringContaining('/messages/msg-abc/modify'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('IMPORTANT'),
          })
        )
      })

      it('should handle label without addLabelId', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ id: 'msg-123' }),
        })

        const parameters = { id: 'msg-123' }

        const result = await handlers[MESSAGE_LABEL_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result).toHaveProperty('id', 'msg-123')
      })

      it('should handle label error', async () => {
        mockCall.mockResolvedValueOnce({
          ok: false,
          status: 400,
        })

        const parameters = { id: 'msg-123', addLabelId: 'InvalidLabel' }

        await expect(
          handlers[MESSAGE_LABEL_HANDLER_NAME](parameters, mockHeaders)
        ).rejects.toThrow()
      })
    })
  })

  describe('Thread Handlers', () => {
    describe('thread/fetch', () => {
      it('should fetch a thread successfully', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'thread-123',
            messages: [
              {
                id: 'msg-1',
                threadId: 'thread-123',
                snippet: 'First message',
                payload: {
                  headers: [{ name: 'Subject', value: 'Thread Subject' }],
                },
              },
              {
                id: 'msg-2',
                threadId: 'thread-123',
                snippet: 'Second message',
                payload: {
                  headers: [{ name: 'Subject', value: 'Re: Thread Subject' }],
                },
              },
            ],
          }),
        })

        const parameters = { id: 'thread-123' }

        const result = await handlers[THREAD_FETCH_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result).toHaveProperty('thread')
        expect(result.thread).toHaveProperty('messages')
        expect(result.thread.messages).toHaveLength(2)
        expect(result.thread).toHaveProperty('link')
        expect(result.thread.link).toContain('thread-123')
      })

      it('should include format=full in request', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'thread-123',
            messages: [],
          }),
        })

        const parameters = { id: 'thread-123' }

        await handlers[THREAD_FETCH_HANDLER_NAME](parameters, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          expect.stringContaining('format=full'),
          expect.any(Object)
        )
      })

      it('should handle thread with no messages', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'empty-thread',
            messages: null,
          }),
        })

        const parameters = { id: 'empty-thread' }

        const result = await handlers[THREAD_FETCH_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result.thread.messages).toEqual([])
      })

      it('should handle fetch error', async () => {
        mockCall.mockResolvedValueOnce({
          ok: false,
          status: 404,
        })

        const parameters = { id: 'nonexistent-thread' }

        await expect(
          handlers[THREAD_FETCH_HANDLER_NAME](parameters, mockHeaders)
        ).rejects.toThrow()
      })
    })

    describe('thread/list', () => {
      it('should list threads successfully', async () => {
        // First call: list threads
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            threads: [
              { id: 'thread-1', snippet: 'Thread 1 preview' },
              { id: 'thread-2', snippet: 'Thread 2 preview' },
            ],
          }),
        })

        // Subsequent calls: fetch each thread
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'thread-1',
            messages: [
              {
                id: 'msg-1',
                threadId: 'thread-1',
                snippet: 'Message 1',
                payload: { headers: [{ name: 'Subject', value: 'Thread 1' }] },
              },
            ],
          }),
        })

        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'thread-2',
            messages: [
              {
                id: 'msg-2',
                threadId: 'thread-2',
                snippet: 'Message 2',
                payload: { headers: [{ name: 'Subject', value: 'Thread 2' }] },
              },
            ],
          }),
        })

        const parameters = { maxResults: 10 }

        const result = await handlers[THREAD_LIST_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result).toHaveProperty('threads')
        expect(result.threads).toHaveLength(2)
        expect(result.threads[0]).toHaveProperty('link')
      })

      it('should apply search query', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ threads: [] }),
        })

        const parameters = { q: 'subject:important', maxResults: 5 }

        await handlers[THREAD_LIST_HANDLER_NAME](parameters, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          expect.stringContaining('q=subject%3Aimportant'),
          expect.any(Object)
        )
      })

      it('should handle empty thread list', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({}),
        })

        const parameters = {}

        const result = await handlers[THREAD_LIST_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result.threads).toEqual([])
      })

      it('should apply filterPending query modifier', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ threads: [] }),
        })

        const parameters = { filterPending: true }

        await handlers[THREAD_LIST_HANDLER_NAME](parameters, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          expect.stringContaining('category%3Apersonal'),
          expect.any(Object)
        )
      })

      it('should return full message text when returnMessageText is true', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            threads: [{ id: 'thread-1', snippet: 'Preview' }],
          }),
        })

        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'thread-1',
            messages: [
              {
                id: 'msg-1',
                threadId: 'thread-1',
                snippet: 'Preview text',
                payload: {
                  headers: [{ name: 'Subject', value: 'Test' }],
                  parts: [
                    {
                      mimeType: 'text/plain',
                      body: { data: 'RnVsbCB0ZXh0' }, // "Full text"
                    },
                  ],
                },
              },
            ],
          }),
        })

        const parameters = { returnMessageText: true }

        const result = await handlers[THREAD_LIST_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result.threads[0].messages[0]).toHaveProperty('body')
        expect(result.threads[0].messages[0]).not.toHaveProperty('snippet')
      })

      it('should return snippet when returnMessageText is false', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            threads: [{ id: 'thread-1', snippet: 'Preview' }],
          }),
        })

        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'thread-1',
            messages: [
              {
                id: 'msg-1',
                threadId: 'thread-1',
                snippet: 'Preview text',
                payload: {
                  headers: [{ name: 'Subject', value: 'Test' }],
                  parts: [
                    {
                      mimeType: 'text/plain',
                      body: { data: 'RnVsbCB0ZXh0' },
                    },
                  ],
                },
              },
            ],
          }),
        })

        const parameters = { returnMessageText: false }

        const result = await handlers[THREAD_LIST_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result.threads[0].messages[0]).toHaveProperty('snippet')
        expect(result.threads[0].messages[0]).not.toHaveProperty('body')
      })
    })

    describe('thread/trash', () => {
      it('should trash a thread successfully', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'thread-123',
          }),
        })

        const parameters = { id: 'thread-123' }

        const result = await handlers[THREAD_TRASH_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result).toHaveProperty('id', 'thread-123')
      })

      it('should call correct API endpoint with POST method', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ id: 'thread-xyz' }),
        })

        const parameters = { id: 'thread-xyz' }

        await handlers[THREAD_TRASH_HANDLER_NAME](parameters, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          expect.stringContaining('/threads/thread-xyz/trash'),
          expect.objectContaining({
            method: 'POST',
          })
        )
      })

      it('should handle trash error', async () => {
        mockCall.mockResolvedValueOnce({
          ok: false,
          status: 404,
        })

        const parameters = { id: 'nonexistent-thread' }

        await expect(
          handlers[THREAD_TRASH_HANDLER_NAME](parameters, mockHeaders)
        ).rejects.toThrow()
      })
    })
  })

  describe('Label Handlers', () => {
    describe('label/list', () => {
      it('should list labels successfully', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            labels: [
              { id: 'INBOX', name: 'INBOX', type: 'system' },
              { id: 'SENT', name: 'SENT', type: 'system' },
              { id: 'Label_123', name: 'Work', type: 'user' },
              { id: 'Label_456', name: 'Personal', type: 'user' },
            ],
          }),
        })

        const parameters = {}

        const result = await handlers[LABEL_LIST_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        // @note should filter out system labels
        expect(result).toHaveLength(2)
        expect(result[0]).toHaveProperty('id', 'Label_123')
        expect(result[0]).toHaveProperty('name', 'Work')
      })

      it('should call correct API endpoint', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ labels: [] }),
        })

        const parameters = {}

        await handlers[LABEL_LIST_HANDLER_NAME](parameters, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          'https://gmail.googleapis.com/gmail/v1/users/me/labels',
          expect.any(Object)
        )
      })

      it('should handle empty labels', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({}),
        })

        const parameters = {}

        const result = await handlers[LABEL_LIST_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result).toEqual([])
      })

      it('should handle list error', async () => {
        mockCall.mockResolvedValueOnce({
          ok: false,
          status: 500,
        })

        const parameters = {}

        await expect(
          handlers[LABEL_LIST_HANDLER_NAME](parameters, mockHeaders)
        ).rejects.toThrow()
      })
    })

    describe('label/create', () => {
      it('should create a label successfully', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 'Label_new',
            name: 'New Label',
            type: 'user',
          }),
        })

        const parameters = { name: 'New Label' }

        const result = await handlers[LABEL_CREATE_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result).toHaveProperty('id', 'Label_new')
        expect(result).toHaveProperty('name', 'New Label')
      })

      it('should call correct API endpoint with POST method', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ id: 'Label_xyz' }),
        })

        const parameters = { name: 'Test Label' }

        await handlers[LABEL_CREATE_HANDLER_NAME](parameters, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          'https://gmail.googleapis.com/gmail/v1/users/me/labels',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Test Label'),
          })
        )
      })

      it('should set visibility options', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ id: 'Label_xyz' }),
        })

        const parameters = { name: 'Test Label' }

        await handlers[LABEL_CREATE_HANDLER_NAME](parameters, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.stringContaining('labelShow'),
          })
        )
      })

      it('should handle create error', async () => {
        mockCall.mockResolvedValueOnce({
          ok: false,
          status: 400,
        })

        const parameters = { name: 'Invalid Label' }

        await expect(
          handlers[LABEL_CREATE_HANDLER_NAME](parameters, mockHeaders)
        ).rejects.toThrow()
      })
    })

    describe('label/delete', () => {
      it('should delete a label successfully', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({}),
        })

        const parameters = { id: 'Label_to_delete' }

        const result = await handlers[LABEL_DELETE_HANDLER_NAME](
          parameters,
          mockHeaders
        )

        expect(result).toHaveProperty('success', true)
      })

      it('should call correct API endpoint with DELETE method', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({}),
        })

        const parameters = { id: 'Label_xyz' }

        await handlers[LABEL_DELETE_HANDLER_NAME](parameters, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          expect.stringContaining('/labels/Label_xyz'),
          expect.objectContaining({
            method: 'DELETE',
          })
        )
      })

      it('should handle delete error', async () => {
        mockCall.mockResolvedValueOnce({
          ok: false,
          status: 404,
        })

        const parameters = { id: 'nonexistent-label' }

        await expect(
          handlers[LABEL_DELETE_HANDLER_NAME](parameters, mockHeaders)
        ).rejects.toThrow()
      })
    })
  })

  describe('Message Parsing (getMessageDetails)', () => {
    it('should extract headers correctly', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 'msg-headers',
          threadId: 'thread-headers',
          snippet: 'Test',
          payload: {
            headers: [
              { name: 'Subject', value: 'Important Subject' },
              { name: 'From', value: 'John Doe <john@example.com>' },
              { name: 'To', value: 'Jane Doe <jane@example.com>' },
              { name: 'Reply-To', value: 'noreply@example.com' },
            ],
          },
        }),
      })

      const result = await handlers[MESSAGE_FETCH_HANDLER_NAME](
        { id: 'msg-headers' },
        mockHeaders
      )

      expect(result.message.subject).toBe('Important Subject')
      expect(result.message.from).toBe('John Doe <john@example.com>')
      expect(result.message.to).toBe('Jane Doe <jane@example.com>')
      expect(result.message.replyTo).toBe('noreply@example.com')
    })

    it('should handle case-insensitive headers', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 'msg-case',
          threadId: 'thread-case',
          snippet: 'Test',
          payload: {
            headers: [
              { name: 'SUBJECT', value: 'Upper Case Subject' },
              { name: 'from', value: 'lowercase@example.com' },
              { name: 'TO', value: 'RECIPIENT@example.com' },
            ],
          },
        }),
      })

      const result = await handlers[MESSAGE_FETCH_HANDLER_NAME](
        { id: 'msg-case' },
        mockHeaders
      )

      expect(result.message.subject).toBe('Upper Case Subject')
      expect(result.message.from).toBe('lowercase@example.com')
      expect(result.message.to).toBe('RECIPIENT@example.com')
    })

    it('should handle nested MIME parts', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 'msg-nested',
          threadId: 'thread-nested',
          snippet: 'Multipart',
          payload: {
            headers: [{ name: 'Subject', value: 'Multipart Email' }],
            parts: [
              {
                mimeType: 'multipart/alternative',
                parts: [
                  {
                    mimeType: 'text/plain',
                    body: { data: 'UGxhaW4gdGV4dA==' }, // "Plain text"
                  },
                  {
                    mimeType: 'text/html',
                    body: { data: 'PGI+Qm9sZDwvYj4=' }, // "<b>Bold</b>"
                  },
                ],
              },
            ],
          },
        }),
      })

      const result = await handlers[MESSAGE_FETCH_HANDLER_NAME](
        { id: 'msg-nested' },
        mockHeaders
      )

      expect(result.message).toHaveProperty('body')
    })

    it('should handle message with body in payload directly', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 'msg-direct-body',
          threadId: 'thread-direct',
          snippet: 'Direct body',
          payload: {
            headers: [{ name: 'Subject', value: 'Simple Email' }],
            body: { data: 'RGlyZWN0IGJvZHkgY29udGVudA==' }, // "Direct body content"
          },
        }),
      })

      const result = await handlers[MESSAGE_FETCH_HANDLER_NAME](
        { id: 'msg-direct-body' },
        mockHeaders
      )

      expect(result.message.body).toBe('Direct body content')
    })

    it('should include labelIds', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 'msg-labels',
          threadId: 'thread-labels',
          snippet: 'Labeled message',
          labelIds: ['INBOX', 'IMPORTANT', 'STARRED'],
          payload: {
            headers: [{ name: 'Subject', value: 'Labeled Email' }],
          },
        }),
      })

      const result = await handlers[MESSAGE_FETCH_HANDLER_NAME](
        { id: 'msg-labels' },
        mockHeaders
      )

      expect(result.message.labelIds).toEqual(['INBOX', 'IMPORTANT', 'STARRED'])
    })

    it('should handle missing payload gracefully', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 'msg-no-payload',
          threadId: 'thread-no-payload',
          snippet: 'No payload',
        }),
      })

      const result = await handlers[MESSAGE_FETCH_HANDLER_NAME](
        { id: 'msg-no-payload' },
        mockHeaders
      )

      expect(result.message).toHaveProperty('id', 'msg-no-payload')
      expect(result.message.subject).toBeUndefined()
      expect(result.message.from).toBeUndefined()
    })
  })
})
