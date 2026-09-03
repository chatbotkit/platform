/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { canUseSecret } from '@/lib/secret.access'
import { revealSecretInstanceFromReferenceSecret } from '@/lib/secret.reference'
import { fastGetUserById } from '@/lib/user.get'

jest.mock('@/prisma/client', () => {
  const mockPrisma = mockDeep()

  return {
    __esModule: true,
    default: mockPrisma,
  }
})

jest.mock('@/prisma/types', () => ({
  SecretType: {
    reference: 'reference',
    plain: 'plain',
    basic: 'basic',
    bearer: 'bearer',
    oauth: 'oauth',
    template: 'template',
  },
}))

jest.mock('@/lib/secret.access', () => ({
  canUseSecret: jest.fn(),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

const { SecretType } = jest.requireMock('@/prisma/types')

describe('revealSecretInstanceFromReferenceSecret', () => {
  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
  })

  describe('Happy Path - Reference Secret Resolution', () => {
    it('should return the referenced secret when user has access', async () => {
      // Arrange
      const user = {
        id: 'user-123',
        email: 'user@example.com',
      }

      const referenceSecret = {
        id: 'reference-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: {
          id: 'target-secret-456',
          reference: 'target-secret-456',
        },
        user,
      }

      const targetSecret = {
        id: 'target-secret-456',
        userId: 'owner-789',
        type: SecretType.plain,
        config: {
          value: 'secret-value',
        },
      }

      // @ts-ignore - Mock method exists at runtime
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(targetSecret)
      canUseSecret.mockResolvedValue(true)

      // Act
      const result =
        await revealSecretInstanceFromReferenceSecret(referenceSecret)

      // Assert
      expect(result).toEqual({
        ...targetSecret,

        config: {
          ...targetSecret.config,
        },

        value: undefined,
      })
      expect(prisma.secret.findUniqueByIdentifier).toHaveBeenCalledWith(
        user,
        'target-secret-456'
      )
      expect(canUseSecret).toHaveBeenCalledWith(user, targetSecret)
    })

    it('should use reference field when id is not provided in config', async () => {
      // Arrange
      const user = {
        id: 'user-123',
        email: 'user@example.com',
      }

      const referenceSecret = {
        id: 'reference-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: {
          reference: 'target-secret-456',
        },
        user,
      }

      const targetSecret = {
        id: 'target-secret-456',
        userId: 'owner-789',
        type: SecretType.plain,
        config: { value: 'secret-value' },
      }

      // @ts-ignore - Mock method exists at runtime
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(targetSecret)
      canUseSecret.mockResolvedValue(true)

      // Act
      const result =
        await revealSecretInstanceFromReferenceSecret(referenceSecret)

      // Assert
      expect(result).toEqual({
        ...targetSecret,

        config: {
          ...targetSecret.config,
        },

        value: undefined,
      })
      expect(prisma.secret.findUniqueByIdentifier).toHaveBeenCalledWith(
        user,
        'target-secret-456'
      )
    })

    it('should return null when config is empty object (no fallback to secret id)', async () => {
      // Arrange
      const user = {
        id: 'user-123',
        email: 'user@example.com',
      }

      const referenceSecret = {
        id: 'reference-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: {},
        user,
      }

      // Act
      const result =
        await revealSecretInstanceFromReferenceSecret(referenceSecret)

      // Assert
      expect(result).toBeNull()
      expect(prisma.secret.findUniqueByIdentifier).not.toHaveBeenCalled()
    })

    it('should work with secret without embedded user, fetching user separately', async () => {
      // Arrange
      const referenceSecret = {
        id: 'reference-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: {
          reference: 'target-secret-456',
        },
      }

      const user = {
        id: 'user-123',
        email: 'user@example.com',
      }

      const targetSecret = {
        id: 'target-secret-456',
        userId: 'owner-789',
        type: SecretType.plain,
        config: { value: 'secret-value' },
      }

      fastGetUserById.mockResolvedValue(user)
      // @ts-ignore - Mock method exists at runtime
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(targetSecret)
      canUseSecret.mockResolvedValue(true)

      // Act
      const result =
        await revealSecretInstanceFromReferenceSecret(referenceSecret)

      // Assert
      expect(result).toEqual({
        ...targetSecret,

        config: {
          ...targetSecret.config,
        },

        value: undefined,
      })
      expect(fastGetUserById).toHaveBeenCalledWith('user-123')
      expect(canUseSecret).toHaveBeenCalledWith(user, targetSecret)
    })

    it('should handle params alias for parameters in config', async () => {
      // Arrange
      const user = {
        id: 'user-123',
        email: 'user@example.com',
      }

      const referenceSecret = {
        id: 'reference-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: {
          reference: 'target-secret-456',
          params: { key: 'value' },
        },
        user,
      }

      const targetSecret = {
        id: 'target-secret-456',
        userId: 'owner-789',
        type: SecretType.plain,
        config: { value: 'secret-value' },
      }

      // @ts-ignore - Mock method exists at runtime
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(targetSecret)
      canUseSecret.mockResolvedValue(true)

      // Act
      const result =
        await revealSecretInstanceFromReferenceSecret(referenceSecret)

      // Assert
      expect(result).toEqual({
        ...targetSecret,

        config: {
          ...targetSecret.config,

          key: 'value',
        },

        value: undefined,
      })
    })
  })

  describe('Alias Resolution - Identifier Forwarding', () => {
    it.each([
      ['@my-alias', 'own-account alias'],
      ['@@sibling-alias', 'sibling alias'],
      ['@user-alias@resource-alias', 'compound alias'],
      ['(My Secret Name)', 'name lookup'],
      ['plain-secret-id', 'plain id'],
    ])(
      'should forward the %s identifier (%s) to findUniqueByIdentifier',
      async (identifier) => {
        // Arrange
        const user = {
          id: 'user-123',
          parentId: 'parent-456',
          email: 'user@example.com',
        }

        const referenceSecret = {
          id: 'reference-secret-123',
          userId: 'user-123',
          type: SecretType.reference,
          config: {
            reference: identifier,
          },
          user,
        }

        const targetSecret = {
          id: 'resolved-secret-789',
          userId: 'owner-789',
          type: SecretType.plain,
          config: { value: 'secret-value' },
        }

        // @ts-ignore - Mock method exists at runtime
        prisma.secret.findUniqueByIdentifier.mockResolvedValue(targetSecret)
        canUseSecret.mockResolvedValue(true)

        // Act
        const result =
          await revealSecretInstanceFromReferenceSecret(referenceSecret)

        // Assert - the identifier is passed through verbatim; resolution is the
        // responsibility of findUniqueByIdentifier (covered by its own tests)
        expect(prisma.secret.findUniqueByIdentifier).toHaveBeenCalledWith(
          user,
          identifier
        )
        expect(result?.id).toBe('resolved-secret-789')
      }
    )
  })

  describe('Edge Cases - Non-Reference Secrets', () => {
    it('should return null for non-reference secret types', async () => {
      // Arrange
      const plainSecret = {
        id: 'plain-secret-123',
        userId: 'user-123',
        type: SecretType.plain,
        config: { value: 'secret-value' },
      }

      // Act
      const result = await revealSecretInstanceFromReferenceSecret(plainSecret)

      // Assert
      expect(result).toBeNull()
      expect(prisma.secret.findUniqueByIdentifier).not.toHaveBeenCalled()
      expect(canUseSecret).not.toHaveBeenCalled()
    })

    it.each([
      SecretType.plain,
      SecretType.basic,
      SecretType.bearer,
      SecretType.oauth,
      SecretType.template,
    ])('should return null for %s secret type', async (secretType) => {
      // Arrange
      const secret = {
        id: 'secret-123',
        userId: 'user-123',
        type: secretType,
        config: { value: 'secret-value' },
      }

      // Act
      const result = await revealSecretInstanceFromReferenceSecret(secret)

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('Error Conditions - Access Denied', () => {
    it('should return null when user cannot access the referenced secret', async () => {
      // Arrange
      const user = {
        id: 'user-123',
        email: 'user@example.com',
      }

      const referenceSecret = {
        id: 'reference-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: {
          reference: 'target-secret-456',
        },
        user,
      }

      const targetSecret = {
        id: 'target-secret-456',
        userId: 'owner-789',
        type: SecretType.plain,
        config: { value: 'secret-value' },
      }

      // @ts-ignore - Mock method exists at runtime
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(targetSecret)
      canUseSecret.mockResolvedValue(false)

      // Act
      const result =
        await revealSecretInstanceFromReferenceSecret(referenceSecret)

      // Assert
      expect(result).toBeNull()
      expect(canUseSecret).toHaveBeenCalledWith(user, targetSecret)
    })

    it('should return null when referenced secret does not exist', async () => {
      // Arrange
      const user = {
        id: 'user-123',
        email: 'user@example.com',
      }

      const referenceSecret = {
        id: 'reference-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: {
          reference: 'non-existent-secret',
        },
        user,
      }

      // @ts-ignore - Mock method exists at runtime
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(null)

      // Act
      const result =
        await revealSecretInstanceFromReferenceSecret(referenceSecret)

      // Assert
      expect(result).toBeNull()
      expect(canUseSecret).not.toHaveBeenCalled()
    })

    it('should return null when user is not found for secret without embedded user', async () => {
      // Arrange
      const referenceSecret = {
        id: 'reference-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: {
          reference: 'target-secret-456',
        },
      }

      fastGetUserById.mockResolvedValue(null)

      // Act
      const result =
        await revealSecretInstanceFromReferenceSecret(referenceSecret)

      // Assert - must short-circuit before touching the secret lookup, which
      // requires a non-null user
      expect(result).toBeNull()
      expect(fastGetUserById).toHaveBeenCalledWith('user-123')
      expect(prisma.secret.findUniqueByIdentifier).not.toHaveBeenCalled()
      expect(canUseSecret).not.toHaveBeenCalled()
    })
  })

  describe('Input Validation - Invalid Configurations', () => {
    it('should return null when config is null', async () => {
      // Arrange
      const referenceSecret = {
        id: 'reference-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: null,
      }

      // Act
      const result =
        await revealSecretInstanceFromReferenceSecret(referenceSecret)

      // Assert
      expect(result).toBeNull()
      expect(prisma.secret.findUniqueByIdentifier).not.toHaveBeenCalled()
    })

    it('should return null when config is undefined', async () => {
      // Arrange
      const referenceSecret = {
        id: 'reference-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: undefined,
      }

      // Act
      const result =
        await revealSecretInstanceFromReferenceSecret(referenceSecret)

      // Assert
      expect(result).toBeNull()
      expect(prisma.secret.findUniqueByIdentifier).not.toHaveBeenCalled()
    })

    it('should return null when neither id nor reference is provided in config', async () => {
      // Arrange
      const referenceSecret = {
        id: 'reference-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: {
          someOtherField: 'value',
        },
      }

      // Act
      const result =
        await revealSecretInstanceFromReferenceSecret(referenceSecret)

      // Assert
      expect(result).toBeNull()
      expect(prisma.secret.findUniqueByIdentifier).not.toHaveBeenCalled()
    })

    it('should handle empty string reference', async () => {
      // Arrange
      const referenceSecret = {
        id: 'reference-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: {
          reference: '',
        },
      }

      // Act
      const result =
        await revealSecretInstanceFromReferenceSecret(referenceSecret)

      // Assert
      expect(result).toBeNull()
      expect(prisma.secret.findUniqueByIdentifier).not.toHaveBeenCalled()
    })
  })

  describe('Complex Configuration Scenarios', () => {
    it('should prioritize explicit reference over id in config', async () => {
      // Arrange
      const user = {
        id: 'user-123',
        email: 'user@example.com',
      }

      const referenceSecret = {
        id: 'reference-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: {
          id: 'wrong-secret-456',
          reference: 'correct-secret-789',
        },
        user,
      }

      const targetSecret = {
        id: 'correct-secret-789',
        userId: 'owner-789',
        type: SecretType.plain,
        config: { value: 'secret-value' },
      }

      // @ts-ignore - Mock method exists at runtime
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(targetSecret)
      canUseSecret.mockResolvedValue(true)

      // Act
      const result =
        await revealSecretInstanceFromReferenceSecret(referenceSecret)

      // Assert
      expect(result).toEqual({
        ...targetSecret,

        config: {
          ...targetSecret.config,
        },

        value: undefined,
      })
      expect(prisma.secret.findUniqueByIdentifier).toHaveBeenCalledWith(
        user,
        'correct-secret-789'
      )
    })

    it('should prioritize parameters over params in config', async () => {
      // Arrange
      const user = {
        id: 'user-123',
        email: 'user@example.com',
      }

      const referenceSecret = {
        id: 'reference-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: {
          reference: 'target-secret-456',
          params: { old: 'value' },
          parameters: { new: 'value' },
        },
        user,
      }

      const targetSecret = {
        id: 'target-secret-456',
        userId: 'owner-789',
        type: SecretType.plain,
        config: { value: 'secret-value' },
      }

      // @ts-ignore - Mock method exists at runtime
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(targetSecret)
      canUseSecret.mockResolvedValue(true)

      // Act
      const result =
        await revealSecretInstanceFromReferenceSecret(referenceSecret)

      // Assert
      expect(result).toEqual({
        ...targetSecret,

        config: {
          ...targetSecret.config,

          new: 'value',
        },

        value: undefined,
      })
      // Note: The function accesses parameters but doesn't use them according to the @note comment
    })
  })

  describe('Config Override Priority - User Overrides Referenced', () => {
    it('should allow user config to override referenced secret config', async () => {
      // Arrange
      const user = {
        id: 'user-123',
        email: 'user@example.com',
      }

      // User's reference secret has a custom clientId from dynamic registration
      const referenceSecret = {
        id: 'user-ref-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: {
          reference: 'shared-oauth-456',
          clientId: 'user-dynamic-client-id',
          clientSecret: 'user-dynamic-client-secret',
        },
        user,
      }

      // Shared OAuth secret has default clientId
      const sharedSecret = {
        id: 'shared-oauth-456',
        userId: 'admin-789',
        type: SecretType.oauth,
        config: {
          clientId: 'shared-default-client-id',
          clientSecret: 'shared-default-client-secret',
          scope: 'read write',
        },
      }

      // @ts-ignore - Mock method exists at runtime
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(sharedSecret)
      canUseSecret.mockResolvedValue(true)

      // Act
      const result =
        await revealSecretInstanceFromReferenceSecret(referenceSecret)

      // Assert - User's clientId should NOT be overwritten by shared secret
      expect(result?.config?.clientId).toBe('user-dynamic-client-id')
      expect(result?.config?.clientSecret).toBe('user-dynamic-client-secret')
      // Shared scope should be included
      expect(result?.config?.scope).toBe('read write')
    })

    it('should not allow referenced secret to override reference field', async () => {
      // Arrange
      const user = {
        id: 'user-123',
        email: 'user@example.com',
      }

      const referenceSecret = {
        id: 'user-ref-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: {
          reference: 'shared-oauth-456',
        },
        user,
      }

      // Malicious shared secret tries to inject a different reference
      const sharedSecret = {
        id: 'shared-oauth-456',
        userId: 'admin-789',
        type: SecretType.oauth,
        config: {
          clientId: 'legit-client-id',
          reference: 'malicious-redirect-secret',
        },
      }

      // @ts-ignore - Mock method exists at runtime
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(sharedSecret)
      canUseSecret.mockResolvedValue(true)

      // Act
      const result =
        await revealSecretInstanceFromReferenceSecret(referenceSecret)

      // Assert - reference should not be in the resolved config or should be the original
      expect(result?.config?.reference).not.toBe('malicious-redirect-secret')
    })

    it('should not allow referenced secret to override secretId field', async () => {
      // Arrange
      const user = {
        id: 'user-123',
        email: 'user@example.com',
      }

      const referenceSecret = {
        id: 'user-ref-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: {
          reference: 'shared-oauth-456',
        },
        user,
      }

      // Malicious shared secret tries to inject secretId
      const sharedSecret = {
        id: 'shared-oauth-456',
        userId: 'admin-789',
        type: SecretType.oauth,
        config: {
          clientId: 'legit-client-id',
          secretId: 'malicious-secret-id',
        },
      }

      // @ts-ignore - Mock method exists at runtime
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(sharedSecret)
      canUseSecret.mockResolvedValue(true)

      // Act
      const result =
        await revealSecretInstanceFromReferenceSecret(referenceSecret)

      // Assert - secretId should not be in the resolved config
      expect(result?.config?.secretId).toBeUndefined()
    })

    it('should not allow referenced secret to override id field', async () => {
      // Arrange
      const user = {
        id: 'user-123',
        email: 'user@example.com',
      }

      const referenceSecret = {
        id: 'user-ref-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: {
          reference: 'shared-oauth-456',
        },
        user,
      }

      // Malicious shared secret tries to inject id
      const sharedSecret = {
        id: 'shared-oauth-456',
        userId: 'admin-789',
        type: SecretType.oauth,
        config: {
          clientId: 'legit-client-id',
          id: 'malicious-id',
        },
      }

      // @ts-ignore - Mock method exists at runtime
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(sharedSecret)
      canUseSecret.mockResolvedValue(true)

      // Act
      const result =
        await revealSecretInstanceFromReferenceSecret(referenceSecret)

      // Assert - id in config should not be the malicious value
      expect(result?.config?.id).not.toBe('malicious-id')
    })
  })

  describe('Database Error Handling', () => {
    it('should handle database errors when finding referenced secret', async () => {
      // Arrange
      const user = {
        id: 'user-123',
        email: 'user@example.com',
      }

      const referenceSecret = {
        id: 'reference-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: {
          reference: 'target-secret-456',
        },
        user,
      }

      // @ts-ignore - Mock method exists at runtime
      prisma.secret.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database connection failed')
      )

      // Act & Assert
      await expect(
        revealSecretInstanceFromReferenceSecret(referenceSecret)
      ).rejects.toThrow('Database connection failed')
    })

    it('should handle database errors when finding user', async () => {
      // Arrange
      const referenceSecret = {
        id: 'reference-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: {
          reference: 'target-secret-456',
        },
      }

      fastGetUserById.mockRejectedValue(new Error('User lookup failed'))

      // Act & Assert
      await expect(
        revealSecretInstanceFromReferenceSecret(referenceSecret)
      ).rejects.toThrow('User lookup failed')
    })

    it('should handle errors from canUseSecret', async () => {
      // Arrange
      const user = {
        id: 'user-123',
        email: 'user@example.com',
      }

      const referenceSecret = {
        id: 'reference-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: {
          reference: 'target-secret-456',
        },
        user,
      }

      const targetSecret = {
        id: 'target-secret-456',
        userId: 'owner-789',
        type: SecretType.plain,
        config: { value: 'secret-value' },
      }

      // @ts-ignore - Mock method exists at runtime
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(targetSecret)
      canUseSecret.mockRejectedValue(new Error('Access check failed'))

      // Act & Assert
      await expect(
        revealSecretInstanceFromReferenceSecret(referenceSecret)
      ).rejects.toThrow('Access check failed')
    })
  })

  describe('user config override priority', () => {
    it('should preserve user clientId when referenced secret also has clientId', async () => {
      // Bug: Same as template secrets - referenced secret config overwrites
      // user config instead of the other way around. After dynamic client
      // registration, user's clientId should take precedence.
      const user = {
        id: 'user-123',
        email: 'user@example.com',
      }

      const referenceSecret = {
        id: 'reference-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: {
          reference: 'shared-oauth-secret',
          clientId: 'user-registered-client-id', // User's clientId from registration
        },
        user,
      }

      const targetSecret = {
        id: 'shared-oauth-secret',
        userId: 'owner-789',
        type: SecretType.oauth,
        config: {
          clientId: 'shared-default-client-id', // Shared secret has a default clientId
          authorizationUrl: 'https://auth.example.com/authorize',
          tokenUrl: 'https://auth.example.com/token',
        },
      }

      prisma.secret.findUniqueByIdentifier.mockResolvedValue(targetSecret)
      canUseSecret.mockResolvedValue(true)

      const result =
        await revealSecretInstanceFromReferenceSecret(referenceSecret)

      // User's clientId should NOT be overwritten by referenced secret's clientId
      expect(result.config.clientId).toBe('user-registered-client-id')
      expect(result.config.authorizationUrl).toBe(
        'https://auth.example.com/authorize'
      )
    })

    it('should not allow referenced secret to override the reference property', async () => {
      // Security: The referenced secret config should NOT be able to inject
      // the `reference` property into the result. Both user's reference and
      // the shared secret's reference should be stripped from the output.
      const user = {
        id: 'user-123',
        email: 'user@example.com',
      }

      const referenceSecret = {
        id: 'reference-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: {
          reference: 'legitimate-secret',
          secretId: 'legitimate-secret',
          clientId: 'user-client-id',
        },
        user,
      }

      const targetSecret = {
        id: 'legitimate-secret',
        userId: 'owner-789',
        type: SecretType.oauth,
        config: {
          reference: 'malicious-redirect', // Should NOT appear in result
          secretId: 'malicious-redirect', // Should NOT appear in result
          authorizationUrl: 'https://auth.example.com/authorize',
        },
      }

      prisma.secret.findUniqueByIdentifier.mockResolvedValue(targetSecret)
      canUseSecret.mockResolvedValue(true)

      const result =
        await revealSecretInstanceFromReferenceSecret(referenceSecret)

      // Neither the user's reference nor the shared secret's reference should appear
      expect(result.config.reference).toBeUndefined()
      expect(result.config.secretId).toBeUndefined()
      // But user's allowed fields should still be there
      expect(result.config.clientId).toBe('user-client-id')
    })

    it('should only allow specific config fields to be overridden by user', async () => {
      // Security: revealSecretInstanceFromReferenceSecret should prevent
      // arbitrary user config fields from overriding referenced secret config
      const user = {
        id: 'user-123',
        email: 'user@example.com',
      }

      const referenceSecret = {
        id: 'reference-secret-123',
        userId: 'user-123',
        type: SecretType.reference,
        config: {
          reference: 'shared-oauth-secret',
          clientId: 'allowed-user-client-id',
          // Disallowed fields that should NOT override referenced secret config
          arbitraryField: 'user-arbitrary-value',
          dangerousConfig: 'user-dangerous-value',
        },
        user,
      }

      const targetSecret = {
        id: 'shared-oauth-secret',
        userId: 'owner-789',
        type: SecretType.oauth,
        config: {
          clientId: 'shared-client-id',
          arbitraryField: 'shared-arbitrary-value',
          dangerousConfig: 'shared-dangerous-value',
          authorizationUrl: 'https://auth.example.com/authorize',
        },
      }

      prisma.secret.findUniqueByIdentifier.mockResolvedValue(targetSecret)
      canUseSecret.mockResolvedValue(true)

      const result =
        await revealSecretInstanceFromReferenceSecret(referenceSecret)

      // Allowed field should be overridden by user
      expect(result.config.clientId).toBe('allowed-user-client-id')
      // Disallowed fields should NOT be overridden - referenced secret values preserved
      expect(result.config.arbitraryField).toBe('shared-arbitrary-value')
      expect(result.config.dangerousConfig).toBe('shared-dangerous-value')
    })
  })
})
