module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require safe delete methods instead of direct prisma delete calls',
      category: 'Best Practices',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          models: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                deleteFunction: {
                  type: 'string',
                  description: 'Name of the safe delete function to use',
                },
                deleteManyFunction: {
                  type: 'string',
                  description:
                    'Name of the safe deleteMany function to use (optional, from same import path)',
                },
                importPath: {
                  type: 'string',
                  description: 'Import path for the delete function',
                },
              },
              required: ['deleteFunction', 'importPath'],
            },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      requireSafeDeleteMethod:
        'Use {{deleteFunction}}() method instead of direct prisma.{{model}}.delete() or tx.{{model}}.delete() calls',
      requireSafeDeleteManyMethod:
        'Use {{deleteManyFunction}}() method instead of direct prisma.{{model}}.deleteMany() or tx.{{model}}.deleteMany() calls',
    },
  },

  create(context) {
    const options = context.options[0] || {}
    const models = options.models || {}

    // track which delete functions are already imported
    const importedFunctions = new Set()

    // @note helper function to check if a delete function is already imported

    function checkForDeleteImport(node, deleteFunction) {
      // check for import statement: import { deleteFunction } from '...'

      if (node.type === 'ImportDeclaration') {
        const hasNamedImport = node.specifiers.some(
          (spec) =>
            spec.type === 'ImportSpecifier' &&
            spec.imported?.name === deleteFunction
        )

        if (hasNamedImport) {
          importedFunctions.add(deleteFunction)
        }

        return
      }

      // check for require statement: const { deleteFunction } = require('...')
      if (
        node.type === 'VariableDeclaration' &&
        node.declarations.some((decl) => {
          if (
            decl.init?.type === 'CallExpression' &&
            decl.init.callee?.name === 'require' &&
            decl.id?.type === 'ObjectPattern'
          ) {
            return decl.id.properties.some(
              (prop) =>
                prop.type === 'Property' && prop.key?.name === deleteFunction
            )
          }

          return false
        })
      ) {
        importedFunctions.add(deleteFunction)
      }
    }

    return {
      // check for existing imports at the top of the file

      Program(node) {
        importedFunctions.clear()

        // check all top-level statements for delete function imports

        node.body.forEach((statement) => {
          Object.values(models).forEach((config) => {
            checkForDeleteImport(statement, config.deleteFunction)

            if (config.deleteManyFunction) {
              checkForDeleteImport(statement, config.deleteManyFunction)
            }
          })
        })
      },

      // detect calls to prisma.<model>.delete/deleteMany or tx.<model>.delete/deleteMany

      CallExpression(node) {
        // check for prisma.<model>.delete or tx.<model>.delete pattern
        // @note we also check for tx (transaction context) to catch prisma.$transaction usage

        if (
          node.callee?.type === 'MemberExpression' &&
          node.callee.object?.type === 'MemberExpression'
        ) {
          const methodName = node.callee.property?.name
          const objectNode = node.callee.object.object
          const objectName = objectNode?.name
          const modelName = node.callee.object.property?.name

          // @note check for both prisma and tx patterns - tx is the common variable name in prisma.$transaction callbacks
          const isPrismaOrTx =
            (objectName === 'prisma' || objectName === 'tx') &&
            objectNode?.type === 'Identifier'

          // check if this is a delete call
          if (
            isPrismaOrTx &&
            methodName === 'delete' &&
            modelName &&
            models[modelName]
          ) {
            const { deleteFunction, importPath } = models[modelName]

            context.report({
              node,
              messageId: 'requireSafeDeleteMethod',
              data: {
                deleteFunction,
                model: modelName,
              },
              fix(fixer) {
                const sourceCode = context.getSourceCode()
                const fixes = []

                // @note replace prisma/tx.<model>.delete with safe delete function

                const argsText =
                  node.arguments.length > 0
                    ? sourceCode
                        .getText()
                        .slice(
                          node.arguments[0].range[0],
                          node.arguments[node.arguments.length - 1].range[1]
                        )
                    : ''

                fixes.push(
                  fixer.replaceText(node, `${deleteFunction}(${argsText})`)
                )

                // @note add import statement if delete function is not already imported

                if (!importedFunctions.has(deleteFunction)) {
                  const program = sourceCode.ast
                  const firstNode = program.body[0]

                  const importStatement = `import { ${deleteFunction} } from '${importPath}'\n`

                  if (firstNode) {
                    fixes.push(
                      fixer.insertTextBefore(firstNode, importStatement)
                    )
                  }
                }

                return fixes
              },
            })
          }

          // check if this is a deleteMany call
          if (
            isPrismaOrTx &&
            methodName === 'deleteMany' &&
            modelName &&
            models[modelName] &&
            models[modelName].deleteManyFunction
          ) {
            const { deleteManyFunction, importPath } = models[modelName]

            context.report({
              node,
              messageId: 'requireSafeDeleteManyMethod',
              data: {
                deleteManyFunction,
                model: modelName,
              },
              fix(fixer) {
                const sourceCode = context.getSourceCode()
                const fixes = []

                // @note replace prisma/tx.<model>.deleteMany with safe deleteMany function

                const argsText =
                  node.arguments.length > 0
                    ? sourceCode
                        .getText()
                        .slice(
                          node.arguments[0].range[0],
                          node.arguments[node.arguments.length - 1].range[1]
                        )
                    : ''

                fixes.push(
                  fixer.replaceText(node, `${deleteManyFunction}(${argsText})`)
                )

                // @note add import statement if deleteMany function is not already imported

                if (!importedFunctions.has(deleteManyFunction)) {
                  const program = sourceCode.ast
                  const firstNode = program.body[0]

                  const importStatement = `import { ${deleteManyFunction} } from '${importPath}'\n`

                  if (firstNode) {
                    fixes.push(
                      fixer.insertTextBefore(firstNode, importStatement)
                    )
                  }
                }

                return fixes
              },
            })
          }
        }
      },
    }
  },
}
