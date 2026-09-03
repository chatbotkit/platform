/* eslint-disable @typescript-eslint/no-require-imports */
const { isClientFile } = require('./lib/client-files')

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow importing build-frozen deployment-identity modules in client-bundle code',
      category: 'Best Practices',
    },
    schema: [
      {
        type: 'object',
        properties: {
          paths: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                source: { type: 'string' },
                reason: { type: 'string' },
              },
              required: ['source'],
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noRestrictedClientImport:
        "Client-bundle code must not import '{{source}}': {{reason}} A callsite that genuinely must opens the file with `/* eslint-disable custom-eslint-rules/no-restricted-client-imports -- <reason> */`.",
    },
  },

  create(context) {
    if (!isClientFile(context, context.getFilename())) {
      return {}
    }

    const options = context.options[0] || {}

    const restricted = new Map(
      (options.paths || []).map(({ source, reason }) => [
        source,
        reason || 'the module resolves deployment identity at build time.',
      ])
    )

    function check(node, source) {
      const reason = restricted.get(source)

      if (!reason) {
        return
      }

      context.report({
        node,
        messageId: 'noRestrictedClientImport',
        data: { source, reason },
      })
    }

    return {
      ImportDeclaration(node) {
        check(node, node.source.value)
      },

      ExportNamedDeclaration(node) {
        if (node.source) {
          check(node, node.source.value)
        }
      },

      ExportAllDeclaration(node) {
        check(node, node.source.value)
      },
    }
  },
}
