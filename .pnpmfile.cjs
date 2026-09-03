/**
 * @note Install-time dependency fixups for the platform core. When this
 * folder is installed standalone (e.g. the public repository) pnpm loads the
 * exported `hooks` directly. An enclosing workspace can import
 * `createReadPackage` and pass its own path prefix because the `file:`/`link:`
 * stub specifiers resolve relative to the install root rather than this file.
 *
 * @see https://pnpm.io/pnpmfile#hooksreadpackagepkg-context
 */

/**
 * Creates a readPackage hook with stub paths resolved against the given
 * install-root-relative prefix ('' when platform is the install root,
 * 'platform/' when this folder is embedded in another workspace).
 *
 * @param {string} pathPrefix
 * @returns {(pkg: object) => object}
 */
function createReadPackage(pathPrefix) {
  // @note Packages that incorrectly declare peer dependencies as
  // devDependencies. pnpm's strict isolation prevents these packages from
  // accessing their implicit dependencies, so the missing peerDependencies
  // are injected at install time.

  // @note guard against the single most destructive mistake available in this
  // folder: running `pnpm install` here while the folder sits inside an
  // enclosing workspace. pnpm would faithfully install the standalone
  // workspace in place, clobbering the enclosing workspace's module links and
  // splitting singletons like react into two instances. The pnpmfile is the
  // only hook pnpm loads before touching disk, so the refusal happens before
  // any damage. The empty path prefix identifies this folder as the active
  // install root; the enclosing workspace imports this hook with its own path
  // prefix. Other exemptions are --lockfile-only (writes no modules) and
  // PLATFORM_NESTED_INSTALL=1 for deliberate vendored setups.
  let installOwnershipValidated = false

  function validateInstallOwnership() {
    if (installOwnershipValidated) {
      return
    }

    installOwnershipValidated = true

    const fs = require('node:fs')
    const path = require('node:path')

    const here = __dirname
    const cwd = process.cwd()

    const installCommand = ['install', 'i', 'add', 'update', 'up'].some((c) =>
      process.argv.includes(c)
    )

    const nested = fs.existsSync(path.join(here, '..', 'pnpm-workspace.yaml'))
    const inHere = cwd === here || cwd.startsWith(here + path.sep)
    const platformOwnsInstall = pathPrefix === ''

    if (
      platformOwnsInstall &&
      nested &&
      inHere &&
      installCommand &&
      !process.argv.includes('--lockfile-only') &&
      !process.env.PLATFORM_NESTED_INSTALL
    ) {
      throw new Error(
        'Refusing to install in place: this folder sits inside an enclosing pnpm workspace whose install owns these directories. Install from the workspace root instead, or use `docker compose up` for an isolated dev environment. Set PLATFORM_NESTED_INSTALL=1 to override for a deliberate vendored setup.'
      )
    }
  }

  const missingPeerDependenciesMap = {
    // @note tailwind-gradient-mask-image requires 'tailwindcss/plugin' but
    // declares tailwindcss as a devDependency instead of peerDependency. With
    // multiple tailwindcss versions in the workspace, pnpm cannot hoist it
    // publicly, causing "Cannot find module 'tailwindcss/plugin'" errors.
    // @see https://github.com/juhanakristian/tailwind-gradient-mask-image/issues

    'tailwind-gradient-mask-image': {
      tailwindcss: '*',
    },

    // @note @metascraper/helpers uses re2 but doesn't declare it as a peer
    // dependency. We use a local shim at stubs/re2 to avoid native
    // compilation issues.

    '@metascraper/helpers': {
      re2: `file:${pathPrefix}stubs/re2`,
    },
  }

  // @note Packages whose dependencies need to be overridden with stubs or
  // alternative implementations. This is used when a package imports a
  // dependency that causes build issues (e.g., ESM-only packages in webpack)
  // but that functionality is not actually needed.

  const dependencyOverridesMap = {
    // @note officeparser imports pdfjs-dist at the top level for PDF parsing,
    // but pdfjs-dist is ESM-only and causes webpack bundling issues in
    // Next.js. We use officeparser only for docx/pptx/xlsx parsing (not
    // PDF), so we stub out pdfjs-dist with an empty implementation at
    // stubs/pdfjs-dist.

    officeparser: {
      'pdfjs-dist': `link:${pathPrefix}stubs/pdfjs-dist`,
    },
  }

  return function readPackage(pkg) {
    validateInstallOwnership()

    // inject missing peer dependencies for packages that incorrectly declare them
    {
      const missingPeerDependencies = missingPeerDependenciesMap[pkg.name] || {}

      for (const [peerPackage, peerVersion] of Object.entries(
        missingPeerDependencies
      )) {
        pkg.peerDependencies = pkg.peerDependencies || {}
        pkg.peerDependencies[peerPackage] = peerVersion
      }
    }

    // override dependencies with stubs or alternative implementations
    {
      const dependencyOverrides = dependencyOverridesMap[pkg.name] || {}

      for (const [depPackage, depVersion] of Object.entries(
        dependencyOverrides
      )) {
        if (pkg.dependencies?.[depPackage]) {
          pkg.dependencies[depPackage] = depVersion
        }
      }
    }

    return pkg
  }
}

module.exports = {
  createReadPackage,
  hooks: {
    readPackage: createReadPackage(''),
  },
}
