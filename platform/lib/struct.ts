// @note this module now lives in @chatbotkit-dev/struct so that code outside
// this application can use it rather than reimplementing it.
//
// @todo migrate callers to import '@chatbotkit-dev/struct' directly and delete
// this shim. It exists only so that the move did not touch every import site at
// once.

export * from '@chatbotkit-dev/struct'
