const RAW_QUERY_METHODS = new Set(['$queryRaw', '$queryRawUnsafe'])

/**
 * Flags untyped raw SQL reads (`$queryRaw`, `$queryRawUnsafe`) and steers them
 * to Prisma TypedSQL (`$queryRawTyped` + a `prisma/sql/*.sql` file).
 *
 * Untyped raw SQL is neither type-checked nor centralised, which makes a future
 * database swap harder to reason about. TypedSQL keeps every query in one place
 * with generated types. For the rare cases that genuinely cannot be expressed
 * with TypedSQL (a dynamic `IN (...)` list, dynamic identifiers), disable this
 * rule on the line with a short reason - that comment then doubles as the
 * catalogue of intentional raw SQL.
 */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require TypedSQL ($queryRawTyped) instead of untyped raw SQL reads',
      category: 'Best Practices',
    },
    schema: [],
    messages: {
      useTypedSql:
        'Use prisma.$queryRawTyped with a query in prisma/sql/*.sql instead of {{method}}. If this query genuinely cannot be expressed with TypedSQL (dynamic IN-list or identifiers), add an eslint-disable-next-line custom-eslint-rules/require-typed-sql with a reason.',
    },
  },

  create(context) {
    // @note the tagged-template form (prisma.$queryRaw`...`) is a
    // TaggedTemplateExpression while the unsafe/function form
    // (prisma.$queryRawUnsafe(...)) is a CallExpression - report on the member
    // expression at the heart of each.

    function checkMemberExpression(node, memberExpression) {
      if (memberExpression?.type !== 'MemberExpression') {
        return
      }

      const method = memberExpression.property?.name

      if (!method || !RAW_QUERY_METHODS.has(method)) {
        return
      }

      context.report({
        node,
        messageId: 'useTypedSql',
        data: { method },
      })
    }

    return {
      TaggedTemplateExpression(node) {
        checkMemberExpression(node, node.tag)
      },

      CallExpression(node) {
        checkMemberExpression(node, node.callee)
      },
    }
  },
}
