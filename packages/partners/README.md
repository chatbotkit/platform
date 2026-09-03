# @chatbotkit-dev/partners

The community partner catalogue.

Empty, and deliberately so. A partner names an account that exists in one deployment's database, a
host that resolves to that deployment, and branding served from its public directory - none of which
is portable. The platform runs fine without any: with no partners configured there are simply no
partner hosts.

Partner entries may also define shared portal configuration under `portals`, keyed by an exact slug
or a slug pattern containing `*`. Those defaults and any custom `domain` are resolved only for
portals owned by that partner account or one of its child accounts. A portal under an unrelated
account cannot claim the configuration by choosing a matching slug.

Swappable: a deployment with partners of its own replaces this package. See
`packages/AGENTS.md`.

## No vendors here

A partner's `email` is the transport that delivers its mail, not the name of a provider. A whitelabel
partner sends as its own domain, so the catalogue names that identity and hands the platform something
it can `send` through - the platform renders the message and calls it. Which vendor carries it is the
email module's business (`createEmailTransport` in `@chatbotkit-dev/email-spec`), and neither the
platform nor this contract names one.

## Why the source is JavaScript

Every other package here is TypeScript, as `packages/AGENTS.md` requires. This one is not, and the
exception is deliberate: `platform/next.config.d/partner.config.js` reads the catalogue to generate
the per-partner rewrites, headers and redirects, and Node loads `next.config.js` directly - no
bundler, no transpile - so a `.ts` entry point would fail to import at build time.

The contract is still enforced. The package sets `checkJs`, so the catalogue's JSDoc annotation is
type checked against the spec by `pnpm check`, and the exported surface is declared by hand in
`src/index.d.ts`.
