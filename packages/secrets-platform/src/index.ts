import type {
  PlatformSecretCatalogue,
  StandardTemplateEntries,
} from '@chatbotkit-dev/secrets-platform-spec'

export type * from '@chatbotkit-dev/secrets-platform-spec'

// @note the community catalogue is empty by design. A deployment offering
// platform hosted credentials replaces this package with its own
// implementation, which must satisfy the contract in
// @chatbotkit-dev/secrets-platform-spec.
//
// Consumers must treat a missing template as a supported state rather than an
// error: `findSecretTemplate` in the platform already returns null when the
// catalogue has no entry for a requested template.

const secrets: PlatformSecretCatalogue = {}

export default secrets

// @note the standard catalogue entries this catalogue contributes. Nothing,
// because there is nothing to expose.

export const standardEntries: StandardTemplateEntries = {}

/**
 * @note the community catalogue is empty, so there is nothing that can be
 * misconfigured.
 */
export async function assertConfigured(): Promise<void> {
  // pass
}
