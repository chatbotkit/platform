/* eslint-disable @typescript-eslint/no-require-imports */
import { getSessionForUserId, userToSessionUser } from './user.session'

jest.mock('@/lib/user.get', () => {
  const originalModule = jest.requireActual('@/lib/user.get')

  return {
    ...originalModule,

    fastGetUserById: jest.fn(),
  }
})

jest.mock('@/lib/cuid', () => ({
  __esModule: true,
  default: jest.fn(() => 'mock-cuid'),
}))

const { fastGetUserById } = require('@/lib/user.get')

describe('userToSessionUser', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should convert a user row to a session user', () => {
    const user = {
      id: 'user-123',
      email: 'test@example.com',
      parentId: null,
    }

    const result = userToSessionUser(user)

    expect(result).toEqual({
      id: 'user-123',
      email: 'test@example.com',
      parentId: null,
    })
  })

  it('should carry parentId for a child user', () => {
    const user = {
      id: 'child-123',
      email: 'child@example.com',
      parentId: 'parent-456',
    }

    const result = userToSessionUser(user)

    expect(result.parentId).toBe('parent-456')
  })

  it('should normalise missing parentId to null', () => {
    // @note null, never undefined - the session user is a loaded row, and
    // plan resolution reads undefined parentId as "not loaded, re-fetch"
    const result = userToSessionUser({
      id: 'user-124',
      email: 'test@example.com',
    })

    expect(result.parentId).toBeNull()
  })

  it('should carry no billing columns', () => {
    // @note billing columns deliberately do not ride in sessions - anything
    // resolving a plan or a subscription reads the account row itself
    const result = userToSessionUser({
      id: 'user-125',
      email: 'test@example.com',
      billingCustomerId: 'cus_123',
      billingSubscriptionId: 'sub_123',
      billingSubscriptionStatus: 'active',
      parentId: null,
    })

    expect(Object.keys(result).sort()).toEqual(['email', 'id', 'parentId'])
  })

  it('should not modify the original user object', () => {
    const user = {
      id: 'user-111',
      email: 'test@example.com',
      parentId: null,
      extraField: 'should not be in result',
    }

    const originalUser = { ...user }

    userToSessionUser(user)

    expect(user).toEqual(originalUser)
  })
})

describe('getSessionForUserId', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    billingCustomerId: 'cus_123',
    billingSubscriptionId: 'sub_123',
    billingSubscriptionStatus: 'active',
    parentId: null,
  }

  it('should return a session when user is found', async () => {
    fastGetUserById.mockResolvedValue(mockUser)

    const session = await getSessionForUserId('user-123')

    expect(session.id).toBe('mock-cuid')
    expect(session.user.id).toBe('user-123')
    expect(session.user.email).toBe('test@example.com')
    expect(session.options).toEqual({})
    expect(session.expires).toBeDefined()
  })

  it('should call fastGetUserById with the given userId', async () => {
    fastGetUserById.mockResolvedValue(mockUser)

    await getSessionForUserId('user-123')

    expect(fastGetUserById).toHaveBeenCalledWith('user-123')
  })

  it('should throw when user is not found', async () => {
    fastGetUserById.mockResolvedValue(null)

    await expect(getSessionForUserId('nonexistent')).rejects.toThrow(
      'User not found: nonexistent'
    )
  })

  it('should not expose billing columns on the session user', async () => {
    fastGetUserById.mockResolvedValue(mockUser)

    const session = await getSessionForUserId('user-123')

    expect(session.user.billingCustomerId).toBeUndefined()
    expect(session.user.billingSubscriptionId).toBeUndefined()
    expect(session.user.billingSubscriptionStatus).toBeUndefined()
    expect(session.user.parentId).toBeNull()
  })
})
