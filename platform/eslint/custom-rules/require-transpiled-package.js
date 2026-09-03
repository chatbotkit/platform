/* eslint-disable @typescript-eslint/no-require-imports */
const { normalizeFilename } = require('./lib/global-fetch')
const {
  TRANSPILE_CONFIG,
  packageNameOf,
  subpathOf,
  createDiskResolver,
  createStaticResolver,
} = require('./lib/transpiled-packages')

// @note a workspace package whose manifest points straight at `src/index.ts`
// is only usable by Next when it is listed in `transpilePackages`; otherwise
// webpack tries to parse the TypeScript as JavaScript and the production
// build dies with "Module parse failed: Unexpected token" deep in
// node_modules. Type-only imports are erased before webpack sees them, so
// they are ignored.

const TEST_FILE_PATTERN = /\.(utest|itest|test|spec)\.[cm]?[jt]sx?$/

function resolverFor(context) {
  const options = context.options[0]

  if (options && (options.transpiled || options.sourceOnly)) {
    return createStaticResolver(options)
  }

  const cwd = normalizeFilename(
    typeof context.getCwd === 'function' ? context.getCwd() : context.cwd
  ).replace(/\/$/, '')

  return createDiskResolver(cwd)
}

function isInApp(context, filename) {
  const normalized = normalizeFilename(filename)

  if (TEST_FILE_PATTERN.test(normalized)) {
    return false
  }

  const cwd = normalizeFilename(
    typeof context.getCwd === 'function' ? context.getCwd() : context.cwd
  ).replace(/\/$/, '')

  // @note RuleTester hands over `<input>`; treat unrooted names as in-app
  return !normalized.startsWith('/') || normalized.startsWith(`${cwd}/`)
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require every imported package that ships TypeScript source to be listed in the `packages` array of next.config.d/transpile.config.js',
      category: 'Possible Errors',
    },
    schema: [
      {
        type: 'object',
        properties: {
          transpiled: { type: 'array', items: { type: 'string' } },
          sourceOnly: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      notTranspiled:
        "{{name}} ships TypeScript source; add it to `packages` in " +
        TRANSPILE_CONFIG +
        " or Next's webpack build fails",
    },
  },

  create(context) {
    if (!isInApp(context, context.getFilename())) {
      return {}
    }

    const resolver = resolverFor(context)

    function check(sourceNode) {
      if (
        !sourceNode ||
        sourceNode.type !== 'Literal' ||
        typeof sourceNode.value !== 'string'
      ) {
        return
      }

      const name = packageNameOf(sourceNode.value)

      if (!name) {
        return
      }

      if (
        resolver.isSourceOnly(name, subpathOf(sourceNode.value, name)) &&
        !resolver.isTranspiled(name)
      ) {
        context.report({
          node: sourceNode,
          messageId: 'notTranspiled',
          data: { name },
        })
      }
    }

    return {
      ImportDeclaration(node) {
        if (node.importKind === 'type') {
          return
        }

        check(node.source)
      },

      ExportNamedDeclaration(node) {
        if (node.exportKind === 'type') {
          return
        }

        check(node.source)
      },

      ExportAllDeclaration(node) {
        if (node.exportKind === 'type') {
          return
        }

        check(node.source)
      },

      ImportExpression(node) {
        check(node.source)
      },

      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require' &&
          node.arguments.length === 1
        ) {
          check(node.arguments[0])
        }
      },
    }
  },
}
