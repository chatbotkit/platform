// @note this module now lives in @chatbotkit-dev/fetch so that code outside this
// application uses the same retry and timeout policy rather than reimplementing
// it.
//
// @todo migrate callers to import '@chatbotkit-dev/fetch' directly and delete
// this shim. It exists only so that the move did not touch every import site at
// once.

export * from '@chatbotkit-dev/fetch'
export { default } from '@chatbotkit-dev/fetch'
