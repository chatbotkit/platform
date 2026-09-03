// @note this module now lives in @chatbotkit-dev/pii, a swappable module. The
// community package detects nothing and passes text through; deployments can
// replace it with an implementation that performs PII detection. The platform
// therefore carries neither a vendor client nor vendor-specific configuration.
//
// @todo migrate callers to import '@chatbotkit-dev/pii' directly and delete
// this shim. It exists only so that the move did not touch every import site at
// once.

export * from '@chatbotkit-dev/pii'
