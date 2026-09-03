// @note the community partner catalogue is deliberately empty.
//
// A partner is a commercial arrangement, not a platform feature: each entry
// names an account that exists in a particular deployment's database, a host
// that resolves to that deployment, and branding assets served from its public
// directory. None of that is portable, and a default full of partners nobody
// owns is worse than none - every host would route to an account that does not
// exist.
//
// So the platform ships the vocabulary (@chatbotkit-dev/partners-spec)
// and an empty catalogue, and a deployment supplies its own by overriding this
// package. See packages/AGENTS.md.
//
// @note this source is JavaScript rather than TypeScript, which is the one
// deliberate exception to the rule in packages/AGENTS.md. The catalogue is read
// by platform/next.config.d/partner.config.js to generate the per-partner
// rewrites, headers and redirects, and Node loads next.config.js directly - no
// bundler, no transpile - so a .ts entry point would fail to import at build
// time. The contract is still enforced: this package sets `checkJs`, so the
// annotation below is type checked against the spec by `pnpm check`, and the
// exported surface is declared in ./index.d.ts.

/** @type {import('@chatbotkit-dev/partners-spec').Partners} */
const partners = {}

export default partners
