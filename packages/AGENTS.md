# Packages

Shared code that the platform consumes as real dependencies. The complete tree
is published with the platform, so every package must work from a standalone
checkout. A package may also be published independently when its own manifest
and release configuration say so.

Some packages here are the public default half of a swappable module and can be
replaced at install time by a deployment-specific implementation. Those have
the extra requirements below.

## Nothing here may depend on an unpublished counterpart

Deployment operators may replace a public default with their own implementation.
That implementation is not part of this repository and must not be required to
understand, install or run the public package.

Three things must never appear in a public package - not in source, not in a
comment, not in a runtime message, not in a README:

| Never                                                              | Instead                         |
| ------------------------------------------------------------------ | ------------------------------- |
| a deployment-specific package's concrete name                      | the contract it satisfies       |
| an operator's service or directory name                            | what that class of backend does |
| the infrastructure behind one (a named VMM, orchestrator, or host) | the property that matters       |

The rule is about _identity_, not about technical detail. Explaining that a
backend which embeds server-side cannot be handed vectors is exactly the kind of
reasoning these files should carry. Naming the service that does it is what
turns a design note into a disclosure.

A public third-party library is not covered by this. `@chatbotkit-dev/memcache`
documents at length that its serialization is a deliberate port of a published
Redis client's, and it should: a reader can go and check that claim.

### The two places this leaks without anyone noticing

**Runtime messages.** `assertConfigured` and unsupported-operation errors are
written for whoever is deploying, so the temptation is to name the package they
should install. That string ends up in logs, in support tickets and in the
terminal of someone who has never heard of the private tree. Name the override
point and the contract:

```ts
'no batch backend is installed, so container jobs cannot run - override
@chatbotkit-dev/batch with a package whose default export satisfies
BatchProvider from @chatbotkit-dev/batch-spec'
```

**README override examples.** Use a placeholder rather than an implementation
from one deployment, and say what qualifies:

```yaml
overrides:
  '@chatbotkit-dev/<name>': npm:your-<name>-implementation@*
```

### Checking

Search for deployment-specific package scopes, service prefixes, repository
names and infrastructure nouns before publishing. This is especially important
for a new spec: a contract is usually written by someone who has just finished
reading an implementation, and that implementation's vocabulary comes along
with it.

## Source is TypeScript, tests are JavaScript

This split is deliberate, not an accident of history.

**Source files are TypeScript.** Every `.ts` file is type checked by
`pnpm check`, which is what makes a shared package safe to depend on: a change
to an exported signature fails at the call site rather than at runtime in
whichever site imported it. A package whose source is `.js` is not checked at
all — `checkJs` is off — so its exports are effectively untyped no matter how
much JSDoc it carries.

Typing means real types on the exported surface, not a `.ts` extension. JSDoc
annotations are **ignored** in a `.ts` file, so moving a documented `.js` file
across without writing its signatures silently turns every optional parameter
into a required one and breaks arity at every call site.

The same applies to JSDoc _cast expressions_, which are easier to miss because
the code still reads as though it asserts something:

```ts
// inert in a .ts file - the cast does nothing and the type is whatever was
// inferred, which here loses the inner wrapper's options entirely
export const fetchPlusPlus =
  /** @type {FetchFn<withTimeoutOptions & withRetryOptions>} */ (
    withRetry(withTimeout(fetch))
  )

// what it has to become
export const fetchPlusPlus = withRetry(withTimeout(fetch)) as FetchFn<
  withTimeoutOptions & withRetryOptions
>
```

Grep a converted file for `/** @type` before calling it done. Nothing warns you:
the file compiles, and the error surfaces at a call site in another package.

**Test files are JavaScript** — `*.test.js`, and `*.utest.js` in the sites.
Tests exercise the package the way a consumer does, including the shapes a
consumer can actually pass. Writing them in TypeScript makes the compiler reject
the wrong-on-purpose input a test exists to cover, so the test either gets
weakened until it type checks or acquires casts that assert away the very thing
under test. Tests are run, not compiled — see the `checkJs` note under Jest
configuration for what actually enforces that, and exclude `**/*.test.js` from
the package `tsconfig.json` so `pnpm check` does not pick them up either.

```
src/index.ts        <- TypeScript, type checked by `pnpm check`
src/index.test.js   <- JavaScript, run by `pnpm test`
```

**Two exceptions, and both are load-bearing.** `partners` has JavaScript source
because `platform/next.config.d/partner.config.js` reads the partner catalogue
and Node loads `next.config.js` directly, with no bundler and no transpile. A
`.ts` entry point there fails to import at build time, so renaming it breaks
`next build` rather than `pnpm check`. The contract is still enforced: the
package sets `checkJs`, its catalogue's JSDoc annotation is checked against
`partners-spec`, and the exported surface is declared in a hand-written
`src/index.d.ts`. Anything the catalogue imports at module scope inherits the
same constraint, which is why the mail transport in `packages/partners` defers
its `@chatbotkit-dev/email` import to send time.

The `observability` package's `next/config` entry point is JavaScript for the
same reason. `next.config.js` loads it directly before webpack exists, including
from the materialized `node_modules` tree produced by `pnpm deploy`. Its runtime
client and server entry points remain TypeScript because Next transpiles those.

Some older packages still have `.test.ts` files. They predate this rule; leave
them alone unless you are already rewriting the test, and do not add new ones.

## Jest configuration

A package's `jest.config.js` is three or four lines. Anything longer is usually
a workaround for something that already works.

```js
export default {
  preset: 'ts-jest/presets/js-with-ts-esm',
  roots: ['<rootDir>/src'],
  testEnvironment: '@chatbotkit-dev/jest-jsdom',
}
```

with `"test": "NODE_OPTIONS=--experimental-vm-modules jest"`.

**Never add a `moduleNameMapper` for a workspace package.** pnpm already
symlinks `@chatbotkit-dev/x` into the package's `node_modules`, and that
package's `exports` already points at `./src/index.ts`, so jest resolves it with
no help. A hand-written map is redundant on the day it is written and wrong
soon after: it has to be extended for every new dependency, and nothing fails
when an entry is stale, so entries rot in place. One such block shipped a
mapping for `@chatbotkit-dev/http` against a package actually named
`http-codes` — dead the moment it was written, silently.

**Use the CommonJS preset only when the tests need it.** Under the ESM preset
there is no `jest` global and no `jest.mock` hoisting; the ESM way is
`import { jest } from '@jest/globals'` plus `jest.unstable_mockModule`. Tests
that rely on hoisted `jest.mock` need the CommonJS preset instead, and the
config should say why:

```js
// @note CommonJS transform: these tests use `jest.mock` hoisting and the `jest`
// global, neither of which is available under the ESM preset.

export default {
  preset: 'ts-jest',
  roots: ['<rootDir>/src'],
  testEnvironment: '@chatbotkit-dev/jest-jsdom',

  transform: {
    '^.+\\.[jt]sx?$': [
      'ts-jest',
      {
        useESM: false,
        // @note transpile only. Type checking is the `check` script's job.
        isolatedModules: true,
        tsconfig: { module: 'commonjs', esModuleInterop: true, allowJs: true },
      },
    ],
  },
}
```

**`checkJs` defeats the tests-are-not-type-checked rule.** ts-jest compiles a
test with the package's own `tsconfig.json`, so `"checkJs": true` makes the ESM
preset type check `.test.js` files and reject exactly the loose fixtures a test
exists to hold. Since every source in a package is TypeScript, `checkJs` has
nothing legitimate left to check — leave it `false`.

## Everything in a package is TypeScript

Not just the entry point. A package with `index.ts` next to an unchecked
`helpers.js` gets no error when `helpers.js` stops matching how `index.ts` calls
it, which is the failure the extension was supposed to prevent.

There is a second reason, and it only bites in a materialized deployment.
**TypeScript does not read
`.js` files inside `node_modules`** - `maxNodeModuleJsDepth` defaults to `0`.
See the section below for why the local workspace does not expose the problem.

So a JavaScript source in a package is not a slightly-weaker package. It can
pass through workspace symlinks and fail after deployment packaging, with an
error that points at the importing application rather than the cause. If a file
is hard to type, that is a reason to type it carefully, not a reason to leave
it.

## Packages resolve differently after deployment packaging

This is the single most expensive thing to know about this repository, and it
has produced four separate CI failures that were all invisible on the branch.

Locally, pnpm **symlinks** a workspace package into `node_modules`. Its real
path is `packages/<name>/src/index.ts` — outside `node_modules` — so every tool
treats it as ordinary source.

The production packaging path runs `pnpm deploy --legacy`, which
**materialises** the same package at
`node_modules/.pnpm/@scope+name@file+packages+name_<hash>/…`. That
path contains `/node_modules/`, and every tool in the chain has a rule about not
processing `node_modules`:

| Tool             | The rule                  | What breaks                                                                       |
| ---------------- | ------------------------- | --------------------------------------------------------------------------------- |
| `tsc6`           | `maxNodeModuleJsDepth: 0` | a `.js` source in a package loses all its named exports                           |
| `jest`           | `transformIgnorePatterns` | a `.ts` source is fed to node raw: "Cannot use import statement outside a module" |
| `next` / webpack | `transpilePackages`       | "Module parse failed: Unexpected token" on the first `import type`                |

Two further traps in the same family:

- **Undeclared `@types/*` resolve by accident.** A package that uses typings it
  does not declare finds nothing locally, so the import degrades to `any` and is
  never checked. In the deploy layout, resolution walks into pnpm's hoist
  directory, finds the typings some _other_ package declared, and type checks the
  file for the first time — surfacing bugs that were always there. Declare every
  `@types/*` your source uses, in `dependencies` rather than `devDependencies`,
  because `pnpm deploy` prunes devDependencies of transitive workspace packages.
- **The `.pnpm` directory name is not a semver.** A workspace package appears as
  `@scope+name@file+packages+name_<hash>`, so allowlist patterns written as
  `\.pnpm/<pkg>@\d+\.\d+\.\d+` never match it.

### Verifying

`pnpm check`, `pnpm test` and `pnpm lint` all run in the local layout, so none
of them can see this class of failure. Reproduce the packaged layout directly:

```bash
pnpm deploy --legacy -F @chatbotkit/platform platform/build-artifacts
cd platform/build-artifacts
# then whichever of tsc6 / jest / next build is in question
```

Do this after moving code into a package, after adding a package to the
platform's dependencies, and after changing anything that names packages —
`transpilePackages`, `transformIgnorePatterns`, `.pnpmfile.cjs`. `pnpm deploy`
takes a few minutes; each of the four failures above cost considerably more.

`platform/build-artifacts` is not gitignored. Remove it when you are done.
