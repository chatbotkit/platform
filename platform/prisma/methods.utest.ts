import { withMethods } from './methods'

const mockFindUnique = jest.fn()
const mockFindFirst = jest.fn()
const mockUserFindUnique = jest.fn()

jest.mock('@prisma/client/extension', () => ({
  Prisma: {
    getExtensionContext: () => ({
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      $parent: {
        user: {
          findUnique: mockUserFindUnique,
        },
      },
    }),
  },
}))

const methods = withMethods()

const { findUniqueByIdentifier } = methods.model.$allModels
const { findUniqueByIdentifier: findUniqueUserByIdentifier } =
  methods.model.user

const call = (
  user: { id: string; parentId?: string | null },
  identifier: string,
  args?: object
) => findUniqueByIdentifier.call({} as any, user, identifier, args)

const callUser = (
  user: { id: string; parentId?: string | null },
  identifier: string,
  args?: object
) => findUniqueUserByIdentifier.call({} as any, user, identifier, args)

const user = { id: 'user-1' }
const userWithParent = { id: 'user-1', parentId: 'parent-1' }

beforeEach(() => {
  mockFindUnique.mockResolvedValue({ id: 'record-1' })
  mockFindFirst.mockResolvedValue({ id: 'record-1' })
  mockUserFindUnique.mockResolvedValue({ id: 'sibling-1' })
})

describe('findUniqueByIdentifier', () => {
  describe('@alias - user-scoped alias lookup', () => {
    it('queries by userId_alias composite index', async () => {
      await call(user, '@my-alias')

      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_alias: { userId: 'user-1', alias: 'my-alias' } },
        })
      )
    })

    it('trims whitespace around the alias', async () => {
      await call(user, '@  my-alias  ')

      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_alias: { userId: 'user-1', alias: 'my-alias' } },
        })
      )
    })

    it('throws when alias is empty', async () => {
      await expect(call(user, '@')).rejects.toThrow('Alias is required')
    })

    it('throws when alias is only whitespace', async () => {
      await expect(call(user, '@   ')).rejects.toThrow('Alias is required')
    })
  })

  describe('@user-alias@resource-alias - sibling-scoped compound lookup', () => {
    it('resolves user by alias under shared parent then finds resource', async () => {
      await call(userWithParent, '@sibling@my-resource')

      expect(mockUserFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { parentId_alias: { parentId: 'parent-1', alias: 'sibling' } },
          select: { id: true },
        })
      )

      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_alias: { userId: 'sibling-1', alias: 'my-resource' },
          },
        })
      )
    })

    it('throws when user has no parentId', async () => {
      await expect(call(user, '@sibling@my-resource')).rejects.toThrow(
        'Parent ID is required'
      )
    })

    it('throws when user alias part is empty', async () => {
      await expect(call(userWithParent, '@')).rejects.toThrow(
        'Alias is required'
      )
    })

    it('throws when resource alias part is empty', async () => {
      await expect(call(userWithParent, '@sibling@')).rejects.toThrow(
        'Resource alias is required'
      )
    })

    it('throws when sibling user is not found', async () => {
      mockUserFindUnique.mockResolvedValue(null)

      await expect(
        call(userWithParent, '@unknown@my-resource')
      ).rejects.toThrow('User with alias "unknown" not found')
    })

    it('does not resolve users outside the shared parent namespace', async () => {
      await call(userWithParent, '@sibling@my-resource')

      expect(mockUserFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { parentId_alias: { parentId: 'parent-1', alias: 'sibling' } },
        })
      )

      // parentId from user object, not from identifier string
      expect(mockUserFindUnique).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: expect.anything() }),
        })
      )
    })
  })

  describe('@@alias - parent-scoped alias lookup', () => {
    it('queries by userId_alias using parentId', async () => {
      await call(userWithParent, '@@parent-alias')

      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_alias: { userId: 'parent-1', alias: 'parent-alias' },
          },
        })
      )
    })

    it('throws when alias is empty', async () => {
      await expect(call(userWithParent, '@@')).rejects.toThrow(
        'Alias is required'
      )
    })

    it('throws when user has no parentId', async () => {
      await expect(call(user, '@@some-alias')).rejects.toThrow(
        'Parent ID is required'
      )
    })
  })

  describe('(name) - user-scoped name lookup', () => {
    it('queries by userId and name', async () => {
      await call(user, '(my name)')

      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', name: 'my name' },
        })
      )
    })

    it('throws when name is empty', async () => {
      await expect(call(user, '()')).rejects.toThrow('Name is required')
    })

    it('throws when name is only whitespace', async () => {
      await expect(call(user, '(   )')).rejects.toThrow('Name is required')
    })
  })

  describe('bare id - id lookup', () => {
    // @note bare-id lookups intentionally do not scope by userId; the caller
    // is responsible for ensuring the resource belongs to the user. See the
    // matching @note in prisma/methods.ts.

    it('queries by id without userId scoping', async () => {
      await call(user, 'some-record-id')

      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'some-record-id' },
        })
      )
    })

    it('never adds a userId filter on bare id lookups', async () => {
      await call(user, 'some-record-id')

      expect(mockFindUnique).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: expect.anything() }),
        })
      )
    })
  })

  describe('guard conditions', () => {
    it('throws when user id is missing', async () => {
      await expect(call({ id: '' }, 'some-id')).rejects.toThrow()
    })

    it('throws when identifier is empty', async () => {
      await expect(call(user, '')).rejects.toThrow()
    })

    it('passes args through to the query', async () => {
      const include = { children: true }

      await call(user, '@my-alias', { include })

      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ include })
      )
    })
  })
})

describe('findUniqueByIdentifier - user model override', () => {
  describe('@user@resource - compound form (unsupported)', () => {
    it('throws when compound identifier is used', async () => {
      await expect(callUser(user, '@sibling@user')).rejects.toThrow(
        'Compound @user@resource identifier is not supported on the User model'
      )
    })

    it('throws regardless of whether parentId is present', async () => {
      await expect(
        callUser(userWithParent, '@sibling@user')
      ).rejects.toThrow(
        'Compound @user@resource identifier is not supported on the User model'
      )
    })
  })

  describe('@alias - user by alias (parentId = caller id)', () => {
    it('uses parentId_alias index with caller id as parentId', async () => {
      await callUser(user, '@my-user')

      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            parentId_alias: { parentId: 'user-1', alias: 'my-user' },
          },
        })
      )
    })

    it('never uses userId_alias index', async () => {
      await callUser(user, '@my-user')

      expect(mockFindUnique).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId_alias: expect.anything() }),
        })
      )
    })

    it('throws when alias is empty', async () => {
      await expect(callUser(user, '@')).rejects.toThrow('Alias is required')
    })
  })

  describe('@@alias - sibling user by alias (parentId = caller parentId)', () => {
    it('uses parentId_alias index with parentId as parentId', async () => {
      await callUser(userWithParent, '@@sibling-alias')

      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            parentId_alias: { parentId: 'parent-1', alias: 'sibling-alias' },
          },
        })
      )
    })

    it('throws when user has no parentId', async () => {
      await expect(callUser(user, '@@sibling-alias')).rejects.toThrow(
        'Parent ID is required'
      )
    })

    it('throws when alias is empty', async () => {
      await expect(callUser(userWithParent, '@@')).rejects.toThrow(
        'Alias is required'
      )
    })
  })

  describe('(name) - user by name', () => {
    it('scopes by parentId not userId', async () => {
      await callUser(user, '(acme corp)')

      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { parentId: 'user-1', name: 'acme corp' },
        })
      )
    })

    it('never uses userId field', async () => {
      await callUser(user, '(acme corp)')

      expect(mockFindFirst).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: expect.anything() }),
        })
      )
    })

    it('throws when name is empty', async () => {
      await expect(callUser(user, '()')).rejects.toThrow('Name is required')
    })
  })

  describe('bare id - user by id', () => {
    // @note like the $allModels version, bare-id lookups on the User model
    // do not scope by parentId; the caller is responsible for ensuring the
    // user belongs to them. See the matching @note in prisma/methods.ts.

    it('queries by id without parentId scoping', async () => {
      await callUser(user, 'some-user-id')

      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'some-user-id' },
        })
      )
    })

    it('never uses userId field', async () => {
      await callUser(user, 'some-user-id')

      expect(mockFindUnique).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: expect.anything() }),
        })
      )
    })
  })

  describe('guard conditions', () => {
    it('throws when user id is missing', async () => {
      await expect(callUser({ id: '' }, 'some-id')).rejects.toThrow()
    })

    it('throws when identifier is empty', async () => {
      await expect(callUser(user, '')).rejects.toThrow()
    })

    it('passes args through to the query', async () => {
      const include = { children: true }

      await callUser(user, '@my-user', { include })

      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ include })
      )
    })
  })
})

describe('compatibility - user override vs $allModels must differ on index names', () => {
  it('@alias: user override uses parentId_alias, $allModels uses userId_alias', async () => {
    await callUser(user, '@alias-x')

    const userCall = mockFindUnique.mock.calls.at(-1)![0]

    expect(userCall.where).toHaveProperty('parentId_alias')
    expect(userCall.where).not.toHaveProperty('userId_alias')

    mockFindUnique.mockClear()

    await call(user, '@alias-x')

    const genericCall = mockFindUnique.mock.calls.at(-1)![0]

    expect(genericCall.where).toHaveProperty('userId_alias')
    expect(genericCall.where).not.toHaveProperty('parentId_alias')
  })

  it('bare id: neither override scopes by userId or parentId', async () => {
    // @note both implementations intentionally leave bare-id lookups
    // unscoped - the caller is responsible for ownership checks.

    await callUser(user, 'record-id')

    const userCall = mockFindUnique.mock.calls.at(-1)![0]

    expect(userCall.where).toEqual({ id: 'record-id' })
    expect(userCall.where).not.toHaveProperty('parentId')
    expect(userCall.where).not.toHaveProperty('userId')

    mockFindUnique.mockClear()

    await call(user, 'record-id')

    const genericCall = mockFindUnique.mock.calls.at(-1)![0]

    expect(genericCall.where).toEqual({ id: 'record-id' })
    expect(genericCall.where).not.toHaveProperty('userId')
    expect(genericCall.where).not.toHaveProperty('parentId')
  })

  it('@user@resource: user override throws, $allModels resolves', async () => {
    await expect(callUser(userWithParent, '@sibling@resource')).rejects.toThrow(
      'Compound @user@resource identifier is not supported on the User model'
    )

    // $allModels resolves it (sibling user lookup then resource lookup)
    await expect(
      call(userWithParent, '@sibling@resource')
    ).resolves.toBeDefined()
  })

  it('(name): user override uses parentId, $allModels uses userId', async () => {
    await callUser(user, '(test name)')

    const userCall = mockFindFirst.mock.calls.at(-1)![0]

    expect(userCall.where).toHaveProperty('parentId', 'user-1')
    expect(userCall.where).not.toHaveProperty('userId')

    mockFindFirst.mockClear()

    await call(user, '(test name)')

    const genericCall = mockFindFirst.mock.calls.at(-1)![0]

    expect(genericCall.where).toHaveProperty('userId', 'user-1')
    expect(genericCall.where).not.toHaveProperty('parentId')
  })
})
