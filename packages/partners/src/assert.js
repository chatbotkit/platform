// @note boot-time validation, exposed at `@chatbotkit-dev/partners/assert` by
// convention so the configuration module itself stays pure data. See
// packages/AGENTS.md.

/**
 * @note unlike the model catalogue, an empty partner catalogue is a working
 * deployment: partners are an addition to the platform, not a prerequisite for
 * serving it. With none configured there are simply no partner hosts, so there
 * is nothing here that can be misconfigured.
 *
 * @returns {Promise<void>}
 */
export async function assertConfigured() {
  // pass
}
