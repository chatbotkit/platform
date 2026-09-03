/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import {
  TRUSTED_NAMESPACE,
  UNTRUSTED_NAMESPACE,
  createContactFingerprint,
  ensureTrustedContact,
  ensureUntrustedContact,
} from './contact.create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    contact: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}))

describe('contact.create', () => {
  const mockUser = { id: 'user-123' }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createContactFingerprint', () => {
    it('should create fingerprint from parts array', () => {
      const fingerprint = createContactFingerprint(TRUSTED_NAMESPACE, [
        'john@example.com',
        'John Doe',
        '+1234567890',
      ])

      expect(fingerprint).toBeTruthy()
      expect(typeof fingerprint).toBe('string')
      expect(fingerprint.length).toBeGreaterThan(16)
      expect(fingerprint).toBe(fingerprint.toLowerCase())
    })

    it('should sort parts before hashing', () => {
      const fingerprint1 = createContactFingerprint(TRUSTED_NAMESPACE, [
        'a',
        'b',
        'c',
      ])
      const fingerprint2 = createContactFingerprint(TRUSTED_NAMESPACE, [
        'c',
        'b',
        'a',
      ])

      expect(fingerprint1).toBe(fingerprint2)
    })

    it('should create different fingerprints for different namespaces', () => {
      const parts = ['john@example.com', 'John Doe']
      const trustedFingerprint = createContactFingerprint(
        TRUSTED_NAMESPACE,
        parts
      )
      const untrustedFingerprint = createContactFingerprint(
        UNTRUSTED_NAMESPACE,
        parts
      )

      expect(trustedFingerprint).not.toBe(untrustedFingerprint)
    })

    it('should handle empty parts array', () => {
      const fingerprint = createContactFingerprint(TRUSTED_NAMESPACE, [])

      expect(fingerprint).toBeTruthy()
      expect(typeof fingerprint).toBe('string')
    })

    it('should handle null and undefined in parts', () => {
      const fingerprint = createContactFingerprint(TRUSTED_NAMESPACE, [
        'email@test.com',
        null,
        undefined,
        'name',
      ])

      expect(fingerprint).toBeTruthy()
      expect(typeof fingerprint).toBe('string')
    })

    it('should handle numbers and booleans in parts', () => {
      const fingerprint = createContactFingerprint(TRUSTED_NAMESPACE, [
        'email@test.com',
        123,
        true,
        false,
      ])

      expect(fingerprint).toBeTruthy()
      expect(typeof fingerprint).toBe('string')
    })
  })

  describe('ensureTrustedContact', () => {
    const mockContact = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
    }
    const mockFingerprint = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'

    it('should create new trusted contact with valid fingerprint', async () => {
      prisma.contact.findFirst.mockResolvedValue(null)
      prisma.contact.create.mockResolvedValue({
        id: 'contact-123',
        ...mockContact,
        fingerprint: mockFingerprint,
        verifiedAt: expect.any(Date),
        userId: mockUser.id,
      })

      const result = await ensureTrustedContact(
        mockUser,
        mockContact,
        mockFingerprint
      )

      expect(prisma.contact.findFirst).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          fingerprint: mockFingerprint,
        },
      })

      expect(prisma.contact.create).toHaveBeenCalledWith({
        data: {
          ...mockContact,
          fingerprint: mockFingerprint,
          verifiedAt: expect.any(Date),
          userId: mockUser.id,
        },
      })

      expect(result).toHaveProperty('id', 'contact-123')
      expect(result).toHaveProperty('fingerprint', mockFingerprint)
    })

    it('should return existing verified trusted contact', async () => {
      const existingContact = {
        id: 'contact-existing',
        ...mockContact,
        fingerprint: mockFingerprint,
        verifiedAt: new Date(),
        userId: mockUser.id,
      }

      prisma.contact.findFirst.mockResolvedValue(existingContact)

      const result = await ensureTrustedContact(
        mockUser,
        mockContact,
        mockFingerprint
      )

      expect(prisma.contact.findFirst).toHaveBeenCalledTimes(1)
      expect(prisma.contact.create).not.toHaveBeenCalled()
      expect(result).toEqual(existingContact)
    })

    it('should throw error if existing contact is not verified', async () => {
      const unverifiedContact = {
        id: 'contact-unverified',
        ...mockContact,
        fingerprint: mockFingerprint,
        verifiedAt: null,
        userId: mockUser.id,
      }

      prisma.contact.findFirst.mockResolvedValue(unverifiedContact)

      await expect(
        ensureTrustedContact(mockUser, mockContact, mockFingerprint)
      ).rejects.toThrow('Contact is not verified')

      expect(prisma.contact.create).not.toHaveBeenCalled()
    })

    it('should throw error if fingerprint is missing', async () => {
      await expect(
        ensureTrustedContact(mockUser, mockContact, '')
      ).rejects.toThrow()

      expect(prisma.contact.findFirst).not.toHaveBeenCalled()
      expect(prisma.contact.create).not.toHaveBeenCalled()
    })

    it('should throw error if fingerprint is too short', async () => {
      await expect(
        ensureTrustedContact(mockUser, mockContact, 'short')
      ).rejects.toThrow()

      expect(prisma.contact.findFirst).not.toHaveBeenCalled()
      expect(prisma.contact.create).not.toHaveBeenCalled()
    })

    it('should handle partial contact data', async () => {
      prisma.contact.findFirst.mockResolvedValue(null)
      prisma.contact.create.mockResolvedValue({
        id: 'contact-partial',
        name: 'Jane Doe',
        fingerprint: mockFingerprint,
        verifiedAt: expect.any(Date),
        userId: mockUser.id,
      })

      const partialContact = { name: 'Jane Doe' }

      const result = await ensureTrustedContact(
        mockUser,
        partialContact,
        mockFingerprint
      )

      expect(result).toHaveProperty('name', 'Jane Doe')
      expect(result).toHaveProperty('id', 'contact-partial')
    })
  })

  describe('ensureUntrustedContact', () => {
    const mockContact = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+0987654321',
      nick: 'jane123',
    }

    it('should create new untrusted contact', async () => {
      prisma.contact.findFirst.mockResolvedValue(null)
      prisma.contact.create.mockResolvedValue({
        id: 'contact-untrusted',
        ...mockContact,
        fingerprint: expect.any(String),
        userId: mockUser.id,
      })

      const result = await ensureUntrustedContact(mockUser, mockContact)

      expect(prisma.contact.findFirst).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          fingerprint: expect.any(String),
        },
      })

      expect(prisma.contact.create).toHaveBeenCalledWith({
        data: {
          ...mockContact,
          fingerprint: expect.any(String),
          userId: mockUser.id,
        },
      })

      expect(result).toHaveProperty('id', 'contact-untrusted')
    })

    it('should return existing unverified untrusted contact', async () => {
      const existingContact = {
        id: 'contact-existing-untrusted',
        ...mockContact,
        fingerprint: 'some-fingerprint',
        verifiedAt: null,
        userId: mockUser.id,
      }

      prisma.contact.findFirst.mockResolvedValue(existingContact)

      const result = await ensureUntrustedContact(mockUser, mockContact)

      expect(prisma.contact.findFirst).toHaveBeenCalledTimes(1)
      expect(prisma.contact.create).not.toHaveBeenCalled()
      expect(result).toEqual(existingContact)
    })

    it('should throw error if existing contact is verified', async () => {
      const verifiedContact = {
        id: 'contact-verified',
        ...mockContact,
        fingerprint: 'some-fingerprint',
        verifiedAt: new Date(),
        userId: mockUser.id,
      }

      prisma.contact.findFirst.mockResolvedValue(verifiedContact)

      await expect(
        ensureUntrustedContact(mockUser, mockContact)
      ).rejects.toThrow('Contact is verified')

      expect(prisma.contact.create).not.toHaveBeenCalled()
    })

    it('should generate fingerprint from contact fields', async () => {
      prisma.contact.findFirst.mockResolvedValue(null)
      prisma.contact.create.mockResolvedValue({
        id: 'contact-fingerprint-test',
        ...mockContact,
        fingerprint: expect.any(String),
        userId: mockUser.id,
      })

      await ensureUntrustedContact(mockUser, mockContact)

      const fingerprintUsed =
        prisma.contact.findFirst.mock.calls[0][0].where.fingerprint

      expect(fingerprintUsed).toBeTruthy()
      expect(fingerprintUsed.length).toBeGreaterThan(16)
    })

    it('should handle minimal contact data', async () => {
      prisma.contact.findFirst.mockResolvedValue(null)
      prisma.contact.create.mockResolvedValue({
        id: 'contact-minimal',
        name: 'Minimal User',
        fingerprint: expect.any(String),
        userId: mockUser.id,
      })

      const minimalContact = { name: 'Minimal User' }

      const result = await ensureUntrustedContact(mockUser, minimalContact)

      expect(result).toHaveProperty('name', 'Minimal User')
      expect(result).toHaveProperty('id', 'contact-minimal')
    })

    it('should create different fingerprints for different contact data', async () => {
      const contact1 = { name: 'User One', email: 'one@test.com' }
      const contact2 = { name: 'User Two', email: 'two@test.com' }

      prisma.contact.findFirst.mockResolvedValue(null)
      prisma.contact.create.mockResolvedValue({
        id: 'contact-test',
        fingerprint: 'test-fingerprint',
        userId: mockUser.id,
      })

      await ensureUntrustedContact(mockUser, contact1)

      const fingerprint1 =
        prisma.contact.findFirst.mock.calls[0][0].where.fingerprint

      jest.clearAllMocks()

      await ensureUntrustedContact(mockUser, contact2)

      const fingerprint2 =
        prisma.contact.findFirst.mock.calls[0][0].where.fingerprint

      expect(fingerprint1).not.toBe(fingerprint2)
    })
  })

  describe('namespace constants', () => {
    it('should have valid TRUSTED_NAMESPACE', () => {
      expect(TRUSTED_NAMESPACE).toBeTruthy()
      expect(typeof TRUSTED_NAMESPACE).toBe('string')
      expect(TRUSTED_NAMESPACE.length).toBeGreaterThan(16)
    })

    it('should have valid UNTRUSTED_NAMESPACE', () => {
      expect(UNTRUSTED_NAMESPACE).toBeTruthy()
      expect(typeof UNTRUSTED_NAMESPACE).toBe('string')
      expect(UNTRUSTED_NAMESPACE.length).toBeGreaterThan(16)
    })

    it('should have different namespace values', () => {
      expect(TRUSTED_NAMESPACE).not.toBe(UNTRUSTED_NAMESPACE)
    })
  })
})
