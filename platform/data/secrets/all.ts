import '@/lib/scope.server'

import { standardEntries as platformStandardEntries } from '@chatbotkit-dev/secrets-platform'

import standard from '@/data/secrets/catalogue/standard.yaml'

export type SecretTemplate = (typeof standard)[keyof typeof standard]

// @note the platform secret catalogue contributes its own standard entries, so
// that offering a platform hosted credential is one change in one place. With
// the community catalogue installed this contributes nothing.

const all: Record<string, SecretTemplate> = {
  ...standard,
  ...platformStandardEntries,
}

export default all
