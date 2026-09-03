/**
 * @jest-environment node
 */

// @note the deployment-configuration gate.
//
// Every configuration seam that reads the environment parses its variable at
// module load with a strict schema, so a value that has drifted from the
// schema fails the boot rather than degrading silently. That is the right
// runtime behaviour, but on its own a boot failure is discovered by the
// deployment, not before it - and it only became a test failure when some
// other suite happened to import the seam without mocking it, which is
// coverage by accident: `@/config/admins` is mocked everywhere it appears, so
// nothing ever parsed its real value.
//
// This suite makes the gate explicit, and what it proves depends on the
// environment it runs in:
//
// - with no environment - a fresh clone, or CI on the public repository -
//   every seam falls back to its community default, so this asserts the
//   planless deployment still loads. That is a real assertion: it is the
//   configuration a self-hosted install starts from.
// - run with a deployment's environment loaded (`pnpm run with-env <environment>
//   test:unit`), it validates that deployment's actual values, ahead of the
//   deploy rather than during its boot - the same place type checking and
//   linting catch platform code.
//
// Add a row whenever a new seam reads deployment configuration. Loading is
// the assertion: the seam parses at import.
//
// @note what this does NOT prove: that the values are correct. It proves they
// parse. Seams that are deliberately open - portals and admins carry
// caller-defined keys - admins carry caller-defined keys - accept almost
// anything by design, so for those this is a smoke test rather than a gate.

interface Seam {
  /** The environment variable(s) the seam reads. */
  name: string

  load: () => Promise<unknown>
}

const SEAMS: Seam[] = [
  { name: 'LIMITS_CONFIG', load: () => import('@/config/limits') },
  { name: 'OVERRIDES_CONFIG', load: () => import('@/config/limits') },
  { name: 'ADMINS_CONFIG', load: () => import('@/config/admins') },
  {
    name: 'APP_APEX / PORTAL_APEX / SPACE_APEX / PARTNERS_APEX',
    load: () => import('@/config/apexes'),
  },
  {
    name: 'APP_MAIN_ORIGIN / APP_LABS_ORIGIN',
    load: () => import('@/config/origins'),
  },
  {
    name: 'SITE_URL / STATIC_URL / WIDGET_URL',
    load: () => import('@/config/site'),
  },
  {
    name: 'PLATFORM_MAX_TOKENS_PER_MONTH',
    load: () => import('@/config/platform'),
  },
  {
    name: 'AUTO_WIDGET_MODEL / AUTO_WIDGET_USER_ID / EXAMPLE_WIDGET_USER_ID',
    load: () => import('@/config/widget'),
  },
]

describe('deployment configuration', () => {
  describe.each(SEAMS)('$name', ({ load }) => {
    it('loads with this environment', async () => {
      await expect(load()).resolves.toBeDefined()
    })
  })
})
