/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { RuleTester } = require('eslint')

const rule = require('./directive-first')

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
})

ruleTester.run('directive-first', rule, {
  valid: [
    {
      name: 'directive first',
      code: "'use server'\nimport { a } from 'a'\nexport async function f() {}",
    },
    {
      name: 'directive first with a leading comment',
      code: "// @note server actions\n'use client'\nimport { a } from 'a'",
    },
    {
      name: 'two directives in the prologue',
      code: "'use strict'\n'use client'\nimport { a } from 'a'",
    },
    {
      name: 'function-level directive prologue',
      code: "import { a } from 'a'\nexport async function f() {\n  'use server'\n  return a\n}",
    },
    {
      name: 'string expression that is not a directive keyword',
      code: "import { a } from 'a'\n'use something else'\nfoo()",
    },
    {
      name: 'template literal is never a directive',
      code: "import { a } from 'a'\n`use server`",
    },
  ],
  invalid: [
    {
      name: 'use server after an import',
      code: "import { a } from 'a'\n'use server'\nexport async function f() {}",
      errors: [
        {
          messageId: 'directiveFirst',
          data: { directive: 'use server' },
          line: 2,
        },
      ],
    },
    {
      name: 'use client after a statement',
      code: "const x = 1\n'use client'",
      errors: [{ messageId: 'directiveFirst', data: { directive: 'use client' } }],
    },
    {
      name: 'use strict after an import',
      code: "import { a } from 'a'\n'use strict'",
      errors: [{ messageId: 'directiveFirst', data: { directive: 'use strict' } }],
    },
    {
      name: 'function-body directive after a statement',
      code: "function f() {\n  const x = 1\n  'use server'\n}",
      errors: [{ messageId: 'directiveFirst', data: { directive: 'use server' } }],
    },
  ],
})
