import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { getRelatedUsers } from '@/lib/user.relation'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

describe('user.relation', () => {
  beforeEach(() => {
    mockReset(prisma)
  })

  describe('getRelatedUsers', () => {
    describe('basic functionality', () => {
      it('should return sibling users from parent relationship', async () => {
        const userId = 'user-123'

        prisma.user.findUnique.mockResolvedValue({
          id: userId,
          parent: {
            id: 'parent-1',
            children: [
              { id: 'user-123' },
              { id: 'sibling-1' },
              { id: 'sibling-2' },
            ],
          },
          children: [],
        })

        const result = await getRelatedUsers({ id: userId })

        expect(result).toEqual([
          { id: 'parent-1' },
          { id: 'sibling-1' },
          { id: 'sibling-2' },
        ])
        expect(result).not.toContainEqual({ id: userId })
      })

      it('should return child users', async () => {
        const userId = 'parent-123'

        prisma.user.findUnique.mockResolvedValue({
          id: userId,
          parent: null,
          children: [{ id: 'child-1' }, { id: 'child-2' }, { id: 'child-3' }],
        })

        const result = await getRelatedUsers({ id: userId })

        expect(result).toEqual([
          { id: 'child-1' },
          { id: 'child-2' },
          { id: 'child-3' },
        ])
      })

      it('should combine siblings and children', async () => {
        const userId = 'user-123'

        prisma.user.findUnique.mockResolvedValue({
          id: userId,
          parent: {
            id: 'parent-1',
            children: [{ id: 'user-123' }, { id: 'sibling-1' }],
          },
          children: [{ id: 'child-1' }, { id: 'child-2' }],
        })

        const result = await getRelatedUsers({ id: userId })

        expect(result).toHaveLength(4)
        expect(result).toEqual([
          { id: 'parent-1' },
          { id: 'sibling-1' },
          { id: 'child-1' },
          { id: 'child-2' },
        ])
        expect(result).not.toContainEqual({ id: userId })
      })
    })

    describe('filtering out requesting user', () => {
      it('should filter out requesting user from sibling list', async () => {
        const userId = 'user-456'

        prisma.user.findUnique.mockResolvedValue({
          id: userId,
          parent: {
            id: 'parent-1',
            children: [
              { id: 'user-456' },
              { id: 'other-1' },
              { id: 'other-2' },
            ],
          },
          children: [],
        })

        const result = await getRelatedUsers({ id: userId })

        expect(result).not.toContainEqual({ id: userId })
        expect(result).toHaveLength(3)
      })

      it('should not filter children or siblings with same partial id match', async () => {
        const userId = 'user-1'

        prisma.user.findUnique.mockResolvedValue({
          id: userId,
          parent: {
            id: 'parent-1',
            children: [{ id: 'user-1' }, { id: 'user-10' }, { id: 'user-100' }],
          },
          children: [{ id: 'user-11' }],
        })

        const result = await getRelatedUsers({ id: userId })

        expect(result).toEqual([
          { id: 'parent-1' },
          { id: 'user-10' },
          { id: 'user-100' },
          { id: 'user-11' },
        ])
      })
    })

    describe('users with no relationships', () => {
      it('should return empty array for user with no parent or children', async () => {
        const userId = 'isolated-user'

        prisma.user.findUnique.mockResolvedValue({
          id: userId,
          parent: null,
          children: [],
        })

        const result = await getRelatedUsers({ id: userId })

        expect(result).toEqual([])
      })

      it('should return parent for only child with no siblings', async () => {
        const userId = 'only-child'

        prisma.user.findUnique.mockResolvedValue({
          id: userId,
          parent: {
            id: 'parent-1',
            children: [{ id: 'only-child' }],
          },
          children: [],
        })

        const result = await getRelatedUsers({ id: userId })

        expect(result).toEqual([{ id: 'parent-1' }])
      })
    })

    describe('edge cases and null handling', () => {
      it('should handle null parent relationship', async () => {
        const userId = 'user-789'

        prisma.user.findUnique.mockResolvedValue({
          id: userId,
          parent: null,
          children: [{ id: 'child-1' }],
        })

        const result = await getRelatedUsers({ id: userId })

        expect(result).toEqual([{ id: 'child-1' }])
      })

      it('should handle empty children array', async () => {
        const userId = 'user-999'

        prisma.user.findUnique.mockResolvedValue({
          id: userId,
          parent: {
            id: 'parent-1',
            children: [{ id: 'user-999' }, { id: 'sibling-1' }],
          },
          children: [],
        })

        const result = await getRelatedUsers({ id: userId })

        expect(result).toEqual([{ id: 'parent-1' }, { id: 'sibling-1' }])
      })

      it('should handle null user result', async () => {
        const userId = 'nonexistent-user'

        prisma.user.findUnique.mockResolvedValue(null)

        const result = await getRelatedUsers({ id: userId })

        expect(result).toEqual([])
      })

      it('should handle undefined parent.children', async () => {
        const userId = 'user-invalid'

        prisma.user.findUnique.mockResolvedValue({
          id: userId,
          parent: {},
          children: [{ id: 'child-1' }],
        })

        const result = await getRelatedUsers({ id: userId })

        expect(result).toEqual([{ id: 'child-1' }])
      })
    })

    describe('parent relationship', () => {
      it('should include the parent user in related users', async () => {
        const userId = 'child-user'
        const parentId = 'parent-user'

        prisma.user.findUnique.mockResolvedValue({
          id: userId,
          parent: {
            id: parentId,
            children: [{ id: userId }, { id: 'sibling-1' }],
          },
          children: [],
        })

        const result = await getRelatedUsers({ id: userId })

        expect(result).toContainEqual({ id: parentId })
        expect(result).toContainEqual({ id: 'sibling-1' })
        expect(result).not.toContainEqual({ id: userId })
      })

      it('should include parent even when user is only child', async () => {
        const userId = 'only-child'
        const parentId = 'parent-user'

        prisma.user.findUnique.mockResolvedValue({
          id: userId,
          parent: {
            id: parentId,
            children: [{ id: userId }],
          },
          children: [],
        })

        const result = await getRelatedUsers({ id: userId })

        expect(result).toEqual([{ id: parentId }])
      })
    })

    describe('prisma query verification', () => {
      it('should call findUnique with correct parameters', async () => {
        const userId = 'test-user'

        prisma.user.findUnique.mockResolvedValue({
          id: userId,
          parent: null,
          children: [],
        })

        await getRelatedUsers({ id: userId })

        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: { id: userId },
          select: {
            id: true,
            parent: {
              select: {
                id: true,
                children: { select: { id: true } },
              },
            },
            children: { select: { id: true } },
          },
          cacheStrategy: {
            ttl: 60,
            swr: 60,
          },
        })
      })

      it('should be called exactly once', async () => {
        const userId = 'single-call-test'

        prisma.user.findUnique.mockResolvedValue({
          id: userId,
          parent: null,
          children: [],
        })

        await getRelatedUsers({ id: userId })

        expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)
      })
    })

    describe('complex relationship scenarios', () => {
      it('should handle large sibling group', async () => {
        const userId = 'user-middle'
        const siblings = Array.from({ length: 20 }, (_, i) => ({
          id: `sibling-${i}`,
        }))

        prisma.user.findUnique.mockResolvedValue({
          id: userId,
          parent: {
            id: 'parent-1',
            children: [{ id: userId }, ...siblings],
          },
          children: [],
        })

        const result = await getRelatedUsers({ id: userId })

        expect(result).toHaveLength(21)
        expect(result).toContainEqual({ id: 'parent-1' })
        expect(result).not.toContainEqual({ id: userId })
      })

      it('should handle user with many children', async () => {
        const userId = 'parent-many'
        const children = Array.from({ length: 15 }, (_, i) => ({
          id: `child-${i}`,
        }))

        prisma.user.findUnique.mockResolvedValue({
          id: userId,
          parent: null,
          children: children,
        })

        const result = await getRelatedUsers({ id: userId })

        expect(result).toHaveLength(15)
        expect(result).toEqual(children)
      })

      it('should handle both many siblings and many children', async () => {
        const userId = 'user-complex'
        const siblings = Array.from({ length: 5 }, (_, i) => ({
          id: `sibling-${i}`,
        }))
        const children = Array.from({ length: 8 }, (_, i) => ({
          id: `child-${i}`,
        }))

        prisma.user.findUnique.mockResolvedValue({
          id: userId,
          parent: {
            id: 'parent-1',
            children: [{ id: userId }, ...siblings],
          },
          children: children,
        })

        const result = await getRelatedUsers({ id: userId })

        expect(result).toHaveLength(14)
        expect(result[0]).toEqual({ id: 'parent-1' })
        expect(result.slice(1, 6)).toEqual(siblings)
        expect(result.slice(6)).toEqual(children)
      })
    })
  })
})
