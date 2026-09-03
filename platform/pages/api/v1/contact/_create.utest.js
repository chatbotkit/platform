/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './create'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      contact: {
        create: jest.fn(),
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
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
}))

describe('/api/v1/contact/create', () => {
  const session = { user: { id: 'user_1' } }
  const req = {}

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a contact with basic fields and returns the new id', async () => {
    prisma.contact.create.mockResolvedValue({ id: 'contact_1' })

    const body = {
      name: 'John Doe',
      description: 'A test contact',
      fingerprint: 'fp_abc123',
      email: 'john@example.com',
      phone: '+1234567890',
      nick: 'johnd',
      preferences: 'lang=en',
      meta: { source: 'test' },
    }

    const result = await handler(req, session, body)

    expect(result).toEqual({ status: 200, body: { id: 'contact_1' } })
    expect(prisma.contact.create).toHaveBeenCalledWith({
      data: {
        userId: 'user_1',
        name: 'John Doe',
        description: 'A test contact',
        fingerprint: 'fp_abc123',
        email: 'john@example.com',
        phone: '+1234567890',
        nick: 'johnd',
        preferences: 'lang=en',
        meta: { source: 'test' },
        verifiedAt: undefined,
      },
      select: { id: true },
    })
  })

  it('creates a contact with minimal fields', async () => {
    prisma.contact.create.mockResolvedValue({ id: 'contact_2' })

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 200, body: { id: 'contact_2' } })

    const createCall = prisma.contact.create.mock.calls[0][0]

    expect(createCall.data.userId).toBe('user_1')
  })

  it('converts a numeric verifiedAt timestamp to a Date object', async () => {
    prisma.contact.create.mockResolvedValue({ id: 'contact_3' })

    const timestamp = 1700000000000

    await handler(req, session, { verifiedAt: timestamp })

    const createCall = prisma.contact.create.mock.calls[0][0]

    // @note the handler wraps numeric verifiedAt in new Date()
    expect(createCall.data.verifiedAt).toEqual(new Date(timestamp))
  })

  it('passes null verifiedAt as explicit null (clears verification)', async () => {
    prisma.contact.create.mockResolvedValue({ id: 'contact_4' })

    await handler(req, session, { verifiedAt: null })

    const createCall = prisma.contact.create.mock.calls[0][0]

    // @note null explicitly clears the verifiedAt field
    expect(createCall.data.verifiedAt).toBeNull()
  })

  it('passes undefined verifiedAt when field is not present (no-op)', async () => {
    prisma.contact.create.mockResolvedValue({ id: 'contact_5' })

    await handler(req, session, {})

    const createCall = prisma.contact.create.mock.calls[0][0]

    // @note absent verifiedAt becomes undefined so prisma does not touch the field
    expect(createCall.data.verifiedAt).toBeUndefined()
  })

  it('sets userId from the session, not from the request body', async () => {
    prisma.contact.create.mockResolvedValue({ id: 'contact_6' })

    await handler(req, { user: { id: 'real_user_id' } }, {})

    const createCall = prisma.contact.create.mock.calls[0][0]

    expect(createCall.data.userId).toBe('real_user_id')
  })

  it('propagates database errors', async () => {
    prisma.contact.create.mockRejectedValue(
      new Error('unique constraint failed')
    )

    await expect(handler(req, session, {})).rejects.toThrow(
      'unique constraint failed'
    )
  })
})
