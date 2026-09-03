/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './clone'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      widgetIntegration: {
        findUniqueByIdentifier: jest.fn(),
        create: jest.fn(),
      },
      widgetIntegrationFileAttachment: {
        createMany: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

const session = { user: { id: 'user_1' } }
const req = { query: { widgetIntegrationId: 'widget_1' } }

function makeWidget(overrides = {}) {
  return {
    id: 'widget_1',
    userId: 'user_1',
    name: 'My Widget',
    description: 'A widget',
    blueprintId: 'bp_1',
    botId: 'bot_1',
    theme: { color: 'blue' },
    layout: 'standard',
    title: 'Chat',
    intro: 'Hello!',
    initial: 'Hi there',
    placeholder: 'Type here...',
    origin: 'https://example.com',
    sessionDuration: 3600,
    language: 'en',
    plugins: [],
    stream: true,
    verbose: false,
    tools: [],
    unfurl: false,
    math: false,
    carousel: false,
    form: null,
    attachments: true,
    autoScroll: true,
    startFirst: false,
    contactCollection: null,
    exportConversation: false,
    restartConversation: true,
    maximize: false,
    messagePeek: null,
    voiceIn: false,
    voiceOut: false,
    poweredBy: true,
    meta: { custom: 'value' },
    files: [],
    ...overrides,
  }
}

describe('POST /api/v1/integration/widget/[widgetIntegrationId]/clone', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('successful clone', () => {
    it('should return the id of the newly created widget', async () => {
      const source = makeWidget()

      prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(source)
      prisma.widgetIntegration.create.mockResolvedValue({ id: 'widget_new' })
      prisma.widgetIntegrationFileAttachment.createMany.mockResolvedValue({})

      const result = await handler(req, session, {})

      expect(result.status).toBe(200)
      expect(result.body).toEqual({ id: 'widget_new' })
    })

    it('should copy all configurable fields from the source widget', async () => {
      const source = makeWidget()

      prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(source)
      prisma.widgetIntegration.create.mockResolvedValue({ id: 'widget_new' })
      prisma.widgetIntegrationFileAttachment.createMany.mockResolvedValue({})

      await handler(req, session, {})

      const createCall = prisma.widgetIntegration.create.mock.calls[0][0]
      const data = createCall.data

      expect(data.userId).toBe('user_1')
      expect(data.name).toBe(source.name)
      expect(data.description).toBe(source.description)
      expect(data.blueprintId).toBe(source.blueprintId)
      expect(data.botId).toBe(source.botId)
      expect(data.theme).toBe(source.theme)
      expect(data.layout).toBe(source.layout)
      expect(data.title).toBe(source.title)
      expect(data.intro).toBe(source.intro)
      expect(data.initial).toBe(source.initial)
      expect(data.placeholder).toBe(source.placeholder)
      expect(data.origin).toBe(source.origin)
      expect(data.sessionDuration).toBe(source.sessionDuration)
      expect(data.language).toBe(source.language)
      expect(data.plugins).toBe(source.plugins)
      expect(data.stream).toBe(source.stream)
      expect(data.verbose).toBe(source.verbose)
      expect(data.tools).toBe(source.tools)
      expect(data.unfurl).toBe(source.unfurl)
      expect(data.math).toBe(source.math)
      expect(data.carousel).toBe(source.carousel)
      expect(data.form).toBe(source.form)
      expect(data.attachments).toBe(source.attachments)
      expect(data.autoScroll).toBe(source.autoScroll)
      expect(data.startFirst).toBe(source.startFirst)
      expect(data.contactCollection).toBe(source.contactCollection)
      expect(data.exportConversation).toBe(source.exportConversation)
      expect(data.restartConversation).toBe(source.restartConversation)
      expect(data.maximize).toBe(source.maximize)
      expect(data.messagePeek).toBe(source.messagePeek)
      expect(data.voiceIn).toBe(source.voiceIn)
      expect(data.voiceOut).toBe(source.voiceOut)
      expect(data.poweredBy).toBe(source.poweredBy)
      expect(data.meta).toBe(source.meta)
    })

    it('should not copy the source widget id into the clone', async () => {
      const source = makeWidget()

      prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(source)
      prisma.widgetIntegration.create.mockResolvedValue({ id: 'widget_new' })
      prisma.widgetIntegrationFileAttachment.createMany.mockResolvedValue({})

      await handler(req, session, {})

      const createCall = prisma.widgetIntegration.create.mock.calls[0][0]

      // @note the clone must not inherit the source widget's own id
      expect(createCall.data.id).toBeUndefined()
    })

    it('should copy file attachments to the cloned widget', async () => {
      const source = makeWidget({
        files: [
          { fileId: 'file_1', type: 'background' },
          { fileId: 'file_2', type: 'logo' },
        ],
      })

      prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(source)
      prisma.widgetIntegration.create.mockResolvedValue({ id: 'widget_new' })
      prisma.widgetIntegrationFileAttachment.createMany.mockResolvedValue({})

      await handler(req, session, {})

      expect(
        prisma.widgetIntegrationFileAttachment.createMany
      ).toHaveBeenCalledWith({
        data: [
          {
            widgetIntegrationId: 'widget_new',
            fileId: 'file_1',
            type: 'background',
          },
          { widgetIntegrationId: 'widget_new', fileId: 'file_2', type: 'logo' },
        ],
      })
    })

    it('should not call createMany when the source widget has no files', async () => {
      const source = makeWidget({ files: [] })

      prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(source)
      prisma.widgetIntegration.create.mockResolvedValue({ id: 'widget_new' })
      prisma.widgetIntegrationFileAttachment.createMany.mockResolvedValue({})

      await handler(req, session, {})

      expect(
        prisma.widgetIntegrationFileAttachment.createMany
      ).toHaveBeenCalledWith({ data: [] })
    })

    it('should look up the widget by identifier from the URL param', async () => {
      const source = makeWidget()

      prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(source)
      prisma.widgetIntegration.create.mockResolvedValue({ id: 'widget_new' })
      prisma.widgetIntegrationFileAttachment.createMany.mockResolvedValue({})

      await handler(req, session, {})

      expect(
        prisma.widgetIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(session.user, 'widget_1', {
        include: { files: true },
      })
    })
  })

  describe('authorization', () => {
    it('should return 404 when the widget does not exist', async () => {
      prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(req, session, {})

      expect(result.status).toBe(404)
      expect(prisma.widgetIntegration.create).not.toHaveBeenCalled()
    })

    it('should return 403 when the requesting user does not own the widget', async () => {
      const source = makeWidget({ userId: 'other_user' })

      prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(source)

      const result = await handler(req, session, {})

      expect(result.status).toBe(403)
      expect(prisma.widgetIntegration.create).not.toHaveBeenCalled()
    })
  })

  describe('error propagation', () => {
    it('should propagate database errors from findUniqueByIdentifier', async () => {
      prisma.widgetIntegration.findUniqueByIdentifier.mockRejectedValue(
        new Error('DB down')
      )

      await expect(handler(req, session, {})).rejects.toThrow('DB down')
    })

    it('should propagate database errors from create', async () => {
      const source = makeWidget()

      prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(source)
      prisma.widgetIntegration.create.mockRejectedValue(
        new Error('Create failed')
      )

      await expect(handler(req, session, {})).rejects.toThrow('Create failed')
    })
  })
})
