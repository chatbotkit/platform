import { FileVisibility } from '@/prisma/types'

import { canManipulateFile, canUseFile } from '@/lib/file.access'

describe('file.access', () => {
  describe('canUseFile', () => {
    describe('basic functionality', () => {
      it('should allow owner to use their own file', () => {
        const userId = 'user-123'
        const file = {
          userId: 'user-123',
          visibility: FileVisibility.private,
        }

        expect(canUseFile(userId, file)).toBe(true)
      })

      it('should allow anyone to use public file', () => {
        const userId = 'user-456'
        const file = {
          userId: 'user-123',
          visibility: FileVisibility.public,
        }

        expect(canUseFile(userId, file)).toBe(true)
      })

      it('should deny non-owner access to private file', () => {
        const userId = 'user-456'
        const file = {
          userId: 'user-123',
          visibility: FileVisibility.private,
        }

        expect(canUseFile(userId, file)).toBe(false)
      })
    })

    describe('edge cases with null/undefined userId', () => {
      it('should deny access when userId is null and file is private', () => {
        const file = {
          userId: 'user-123',
          visibility: FileVisibility.private,
        }

        expect(canUseFile(null, file)).toBe(false)
      })

      it('should deny access when userId is undefined and file is private', () => {
        const file = {
          userId: 'user-123',
          visibility: FileVisibility.private,
        }

        expect(canUseFile(undefined, file)).toBe(false)
      })

      it('should allow access when userId is null but file is public', () => {
        const file = {
          userId: 'user-123',
          visibility: FileVisibility.public,
        }

        expect(canUseFile(null, file)).toBe(true)
      })

      it('should allow access when userId is undefined but file is public', () => {
        const file = {
          userId: 'user-123',
          visibility: FileVisibility.public,
        }

        expect(canUseFile(undefined, file)).toBe(true)
      })
    })

    describe('visibility variations', () => {
      it('should handle protected visibility as non-public', () => {
        const userId = 'user-456'
        const file = {
          userId: 'user-123',
          visibility: FileVisibility.protected,
        }

        expect(canUseFile(userId, file)).toBe(false)
      })

      it('should allow owner access regardless of visibility', () => {
        const userId = 'user-123'
        const visibilities = [
          FileVisibility.private,
          FileVisibility.protected,
          FileVisibility.public,
        ]

        visibilities.forEach((visibility) => {
          const file = { userId: 'user-123', visibility }

          expect(canUseFile(userId, file)).toBe(true)
        })
      })
    })
  })

  describe('canManipulateFile', () => {
    describe('basic functionality', () => {
      it('should allow owner to manipulate their own file', () => {
        const userId = 'user-123'
        const file = {
          userId: 'user-123',
          visibility: FileVisibility.private,
        }

        expect(canManipulateFile(userId, file)).toBe(true)
      })

      it('should deny non-owner manipulation even for public file', () => {
        const userId = 'user-456'
        const file = {
          userId: 'user-123',
          visibility: FileVisibility.public,
        }

        expect(canManipulateFile(userId, file)).toBe(false)
      })

      it('should deny manipulation when userId does not match', () => {
        const userId = 'user-456'
        const file = {
          userId: 'user-123',
          visibility: FileVisibility.private,
        }

        expect(canManipulateFile(userId, file)).toBe(false)
      })
    })

    describe('edge cases with null/undefined userId', () => {
      it('should deny manipulation when userId is null', () => {
        const file = {
          userId: 'user-123',
          visibility: FileVisibility.private,
        }

        expect(canManipulateFile(null, file)).toBe(false)
      })

      it('should deny manipulation when userId is undefined', () => {
        const file = {
          userId: 'user-123',
          visibility: FileVisibility.private,
        }

        expect(canManipulateFile(undefined, file)).toBe(false)
      })

      it('should deny manipulation even for public file when userId is null', () => {
        const file = {
          userId: 'user-123',
          visibility: FileVisibility.public,
        }

        expect(canManipulateFile(null, file)).toBe(false)
      })
    })

    describe('visibility independence', () => {
      it('should only check ownership regardless of visibility', () => {
        const userId = 'user-123'
        const visibilities = [
          FileVisibility.private,
          FileVisibility.protected,
          FileVisibility.public,
        ]

        visibilities.forEach((visibility) => {
          const file = { userId: 'user-123', visibility }

          expect(canManipulateFile(userId, file)).toBe(true)
        })
      })

      it('should deny manipulation for non-owner regardless of visibility', () => {
        const userId = 'user-456'
        const visibilities = [
          FileVisibility.private,
          FileVisibility.protected,
          FileVisibility.public,
        ]

        visibilities.forEach((visibility) => {
          const file = { userId: 'user-123', visibility }

          expect(canManipulateFile(userId, file)).toBe(false)
        })
      })
    })
  })

  describe('comparison between canUseFile and canManipulateFile', () => {
    it('should show manipulation is stricter than use for public files', () => {
      const ownerId = 'user-123'
      const nonOwnerId = 'user-456'
      const file = {
        userId: ownerId,
        visibility: FileVisibility.public,
      }

      // owner can both use and manipulate
      expect(canUseFile(ownerId, file)).toBe(true)
      expect(canManipulateFile(ownerId, file)).toBe(true)

      // non-owner can use public file but cannot manipulate
      expect(canUseFile(nonOwnerId, file)).toBe(true)
      expect(canManipulateFile(nonOwnerId, file)).toBe(false)
    })

    it('should show both deny access for private files to non-owner', () => {
      const nonOwnerId = 'user-456'
      const file = {
        userId: 'user-123',
        visibility: FileVisibility.private,
      }

      expect(canUseFile(nonOwnerId, file)).toBe(false)
      expect(canManipulateFile(nonOwnerId, file)).toBe(false)
    })
  })
})
