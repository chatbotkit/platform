// @note object storage lives in @chatbotkit-dev/storage, written against the
// contract in @chatbotkit-dev/storage-spec.
//
// `@/lib/storage` is the seam application code imports, which makes this file
// the place to customize: either swap the package for a deployment-specific
// implementation via pnpm overrides, or - when working from a copy of the
// source - extend or replace the behaviour right here. Either way the contract
// stays the one the spec defines, and call sites are none the wiser.

export * from '@chatbotkit-dev/storage'
