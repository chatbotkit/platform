// @note a kill-switch comment: the tag carries an ISO date and the moment it
// passes, lint fails until the todo is addressed or the date is pushed.

const TAG = /@todo-by\b[:\s]*(\S*)/gi

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const DAY_MS = 86_400_000

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require @todo-by comments to carry an ISO date and fail once that date has passed',
      category: 'Possible Errors',
    },
    schema: [
      {
        type: 'object',
        properties: {
          now: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingDate: '@todo-by needs a YYYY-MM-DD date as its first word',
      badDate: '@todo-by date "{{raw}}" is not a valid YYYY-MM-DD date',
      expired:
        '@todo-by {{raw}} has passed ({{days}} day(s) ago) - address this todo or push the date',
    },
  },

  create(context) {
    const nowOption = context.options[0]?.now

    // @note compare whole UTC days so a deadline stays valid through its own date
    const today = new Date(
      (nowOption ? new Date(nowOption) : new Date())
        .toISOString()
        .slice(0, 10) + 'T00:00:00Z'
    )

    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          for (const match of comment.value.matchAll(TAG)) {
            const raw = match[1]

            if (!raw) {
              context.report({ loc: comment.loc, messageId: 'missingDate' })

              continue
            }

            const parsed = ISO_DATE.test(raw)
              ? new Date(`${raw}T00:00:00Z`)
              : new Date(NaN)

            // @note Date accepts 2026-02-31 by rolling over; round-tripping catches it
            if (
              Number.isNaN(parsed.getTime()) ||
              parsed.toISOString().slice(0, 10) !== raw
            ) {
              context.report({
                loc: comment.loc,
                messageId: 'badDate',
                data: { raw },
              })

              continue
            }

            if (parsed < today) {
              const days = Math.round((today - parsed) / DAY_MS)

              context.report({
                loc: comment.loc,
                messageId: 'expired',
                data: { raw, days: String(days) },
              })
            }
          }
        }
      },
    }
  },
}
