import { getContextContact } from '@/lib/context.store'

import { getBareContextContact } from './contact.context'

jest.mock('@/lib/context.store', () => ({
  getContextContact: jest.fn(),
}))

describe('getBareContextContact', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns null when context contact is missing', () => {
    getContextContact.mockReturnValue(null)

    expect(getBareContextContact()).toBeNull()
  })

  it('returns only bare contact fields when context contact exists', () => {
    getContextContact.mockReturnValue({
      id: 'contact-id',
      userId: 'user-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      verifiedAt: new Date(),
      meta: { a: 1 },
      preferences: { b: 2 },
      fingerprint: 'fp',
      name: 'John',
      description: 'desc',
      email: 'john@example.com',
      phone: '+1234567',
      nick: 'johnny',
    })

    expect(getBareContextContact()).toEqual({
      fingerprint: 'fp',
      name: 'John',
      description: 'desc',
      email: 'john@example.com',
      phone: '+1234567',
      nick: 'johnny',
    })
  })
})
