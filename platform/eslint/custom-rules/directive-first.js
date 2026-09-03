/* eslint-disable @typescript-eslint/no-require-imports */

// @note webpack (and React's server/client boundary transform) only honour
// `'use server'` / `'use client'` when they sit in the file's directive
// prologue - the run of string statements before anything else. An import
// hoisted above the string turns it into a plain expression statement and the
// production build fails with "The 'use server' directive must be at the top
// of the file", a 17-minute round trip that `next lint` can catch in seconds.

const DIRECTIVES = new Set(['use server', 'use client', 'use strict'])

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "Require 'use server' / 'use client' / 'use strict' to be a real directive - the first statement(s) of the file, before all imports",
      category: 'Possible Errors',
    },
    schema: [],
    messages: {
      directiveFirst:
        "'{{directive}}' must be the first statement in the file, before all imports",
    },
  },

  create(context) {
    return {
      ExpressionStatement(node) {
        const { expression } = node

        if (
          expression.type !== 'Literal' ||
          typeof expression.value !== 'string' ||
          !DIRECTIVES.has(expression.value)
        ) {
          return
        }

        // @note both espree and @typescript-eslint/parser stamp `directive` on
        // statements that are part of a prologue (Program or function body),
        // so a function-level 'use strict' / 'use server' passes here
        if (typeof node.directive === 'string') {
          return
        }

        context.report({
          node,
          messageId: 'directiveFirst',
          data: { directive: expression.value },
        })
      },
    }
  },
}
