/* eslint-disable @typescript-eslint/no-require-imports */
module.exports = {
  rules: {
    'require-make-json-safe': require('./require-make-json-safe'),
    'require-safe-prisma-delete': require('./require-safe-prisma-delete'),
    'require-typed-sql': require('./require-typed-sql'),
    'require-custom-use-router': require('./require-custom-use-router'),
    'require-dispose-for-factory-result': require('./require-dispose-for-factory-result'),
    'no-plain-fetch-in-routes': require('./no-plain-fetch-in-routes'),
    'no-global-fetch': require('./no-global-fetch'),
    'directive-first': require('./directive-first'),
    'no-direct-documentation-links': require('./no-direct-documentation-links'),
    'no-direct-process-env': require('./no-direct-process-env'),
    'no-restricted-client-imports': require('./no-restricted-client-imports'),
    'require-transpiled-package': require('./require-transpiled-package'),
    'todo-by': require('./todo-by'),
  },
}
