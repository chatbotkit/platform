// @note boot/CI-time validation, exposed at `@chatbotkit-dev/billing/assert`
// by convention. See packages/AGENTS.md.

/**
 * Throws when this module is not usable with the current environment. This
 * module sells nothing and has nothing to misconfigure, so it resolves.
 */
export async function assertConfigured(_input?: unknown): Promise<void> {}
