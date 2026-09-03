/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { RuleTester } = require('eslint')

const rule = require('./todo-by')

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
})

const options = [{ now: '2026-09-02T12:00:00Z' }]

ruleTester.run('todo-by', rule, {
  valid: [
    {
      name: 'future date in a line comment',
      code: '// @todo-by 2026-12-31 remove the fallback\nconst x = 1',
      options,
    },
    {
      name: 'today is not expired',
      code: '// @todo-by 2026-09-02 ships today\nconst x = 1',
      options,
    },
    {
      name: 'block comment and jsdoc',
      code: '/* @todo-by 2027-01-01 */\n/**\n * @todo-by 2027-01-01 drop the shim\n */\nconst x = 1',
      options,
    },
    {
      name: 'any case with a colon',
      code: '// @TODO-BY: 2027-01-01\nconst x = 1',
      options,
    },
    {
      name: 'plain todo is ignored',
      code: '// @todo fix this eventually\nconst x = 1',
      options,
    },
    {
      name: 'tag inside a string is ignored',
      code: "const x = '@todo-by 2000-01-01'",
      options,
    },
  ],
  invalid: [
    {
      name: 'missing date',
      code: '// @todo-by\nconst x = 1',
      options,
      errors: [{ messageId: 'missingDate', line: 1 }],
    },
    {
      name: 'first word is not a date',
      code: '// @todo-by soon 2027-01-01\nconst x = 1',
      options,
      errors: [{ messageId: 'badDate', data: { raw: 'soon' } }],
    },
    {
      name: 'loose date formats are rejected',
      code: '// @todo-by 2026-9-2\nconst x = 1',
      options,
      errors: [{ messageId: 'badDate', data: { raw: '2026-9-2' } }],
    },
    {
      name: 'impossible calendar date',
      code: '// @todo-by 2026-02-31\nconst x = 1',
      options,
      errors: [{ messageId: 'badDate', data: { raw: '2026-02-31' } }],
    },
    {
      name: 'expired date',
      code: '// @todo-by 2026-09-01 remove the fallback\nconst x = 1',
      options,
      errors: [
        {
          messageId: 'expired',
          data: { raw: '2026-09-01', days: '1' },
          line: 1,
        },
      ],
    },
    {
      name: 'two tags in one block comment',
      code: '/*\n * @todo-by 2020-01-01 a\n * @todo-by nope b\n */\nconst x = 1',
      options,
      errors: [{ messageId: 'expired' }, { messageId: 'badDate' }],
    },
  ],
})
