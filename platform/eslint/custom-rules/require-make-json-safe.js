module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require makeJsonSafe wrapper for props in Next.js page functions',
      category: 'Best Practices',
    },
    fixable: 'code',
    schema: [],
    messages: {
      requireMakeJsonSafe:
        'Props object in Next.js page functions should be wrapped in makeJsonSafe()',
    },
  },

  create(context) {
    let isInPageFunction = false
    let functionName = null
    let hasMakeJsonSafeImport = false

    // @note helper function to check if makeJsonSafe is already imported

    function checkForMakeJsonSafeImport(node) {
      // check for import statement: import { makeJsonSafe } from '...'

      if (node.type === 'ImportDeclaration') {
        const hasNamedImport = node.specifiers.some(
          (spec) =>
            spec.type === 'ImportSpecifier' &&
            spec.imported?.name === 'makeJsonSafe'
        )

        if (hasNamedImport) {
          hasMakeJsonSafeImport = true
        }

        return
      }

      // check for require statement: const { makeJsonSafe } = require('...')
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
                prop.type === 'Property' && prop.key?.name === 'makeJsonSafe'
            )
          }

          return false
        })
      ) {
        hasMakeJsonSafeImport = true
      }
    }

    return {
      // check for existing imports at the top of the file

      Program(node) {
        hasMakeJsonSafeImport = false

        // check all top-level statements for makeJsonSafe imports

        node.body.forEach(checkForMakeJsonSafeImport)
      },

      // detect if we're inside getServerSideProps or getStaticProps

      FunctionDeclaration(node) {
        if (
          node.id?.name === 'getServerSideProps' ||
          node.id?.name === 'getStaticProps'
        ) {
          isInPageFunction = true
          functionName = node.id.name
        }
      },

      ArrowFunctionExpression(node) {
        // handle arrow functions assigned to getServerSideProps/getStaticProps

        const parent = node.parent

        if (
          parent?.type === 'VariableDeclarator' &&
          (parent.id?.name === 'getServerSideProps' ||
            parent.id?.name === 'getStaticProps')
        ) {
          isInPageFunction = true
          functionName = parent.id.name
        }
      },

      FunctionExpression(node) {
        // handle function expressions assigned to getServerSideProps/getStaticProps

        let parent = node.parent

        // handle direct assignments

        if (
          parent?.type === 'AssignmentExpression' &&
          parent.left?.property?.name &&
          (parent.left.property.name === 'getServerSideProps' ||
            parent.left.property.name === 'getStaticProps')
        ) {
          isInPageFunction = true
          functionName = parent.left.property.name

          return
        }

        // handle variable declarations

        if (
          parent?.type === 'VariableDeclarator' &&
          (parent.id?.name === 'getServerSideProps' ||
            parent.id?.name === 'getStaticProps')
        ) {
          isInPageFunction = true
          functionName = parent.id.name

          return
        }

        // handle wrapped functions (like withCache)

        if (parent?.type === 'CallExpression') {
          // look at the parent of the call expression

          const grandParent = parent.parent

          if (
            grandParent?.type === 'VariableDeclarator' &&
            (grandParent.id?.name === 'getServerSideProps' ||
              grandParent.id?.name === 'getStaticProps')
          ) {
            isInPageFunction = true
            functionName = grandParent.id.name

            return
          }

          // handle export const getServerSideProps = withCache(...)

          if (
            grandParent?.type === 'AssignmentExpression' &&
            grandParent.left?.property?.name &&
            (grandParent.left.property.name === 'getServerSideProps' ||
              grandParent.left.property.name === 'getStaticProps')
          ) {
            isInPageFunction = true
            functionName = grandParent.left.property.name

            return
          }
        }
      },

      'FunctionDeclaration:exit'(node) {
        if (
          node.id?.name === 'getServerSideProps' ||
          node.id?.name === 'getStaticProps'
        ) {
          isInPageFunction = false
          functionName = null
        }
      },

      'ArrowFunctionExpression:exit'(node) {
        const parent = node.parent

        if (
          parent?.type === 'VariableDeclarator' &&
          (parent.id?.name === 'getServerSideProps' ||
            parent.id?.name === 'getStaticProps')
        ) {
          isInPageFunction = false
          functionName = null
        }
      },

      'FunctionExpression:exit'(node) {
        let parent = node.parent

        if (
          parent?.type === 'AssignmentExpression' &&
          parent.left?.property?.name &&
          (parent.left.property.name === 'getServerSideProps' ||
            parent.left.property.name === 'getStaticProps')
        ) {
          isInPageFunction = false
          functionName = null

          return
        }

        if (
          parent?.type === 'VariableDeclarator' &&
          (parent.id?.name === 'getServerSideProps' ||
            parent.id?.name === 'getStaticProps')
        ) {
          isInPageFunction = false
          functionName = null

          return
        }

        // handle wrapped functions

        if (parent?.type === 'CallExpression') {
          const grandParent = parent.parent

          if (
            grandParent?.type === 'VariableDeclarator' &&
            (grandParent.id?.name === 'getServerSideProps' ||
              grandParent.id?.name === 'getStaticProps')
          ) {
            isInPageFunction = false
            functionName = null

            return
          }

          if (
            grandParent?.type === 'AssignmentExpression' &&
            grandParent.left?.property?.name &&
            (grandParent.left.property.name === 'getServerSideProps' ||
              grandParent.left.property.name === 'getStaticProps')
          ) {
            isInPageFunction = false
            functionName = null

            return
          }
        }
      },

      ReturnStatement(node) {
        // only check returns inside page functions

        if (!isInPageFunction) {
          return
        }

        if (node.argument?.type !== 'ObjectExpression') {
          return
        }

        const returnObject = node.argument

        const propsProperty = returnObject.properties.find(
          (prop) =>
            prop.type === 'Property' &&
            prop.key?.name === 'props' &&
            prop.value?.type === 'ObjectExpression'
        )

        if (!propsProperty) {
          return
        }

        const propsValue = propsProperty.value

        // check if props value is already wrapped in makeJsonSafe

        if (
          propsValue.type === 'CallExpression' &&
          propsValue.callee?.name === 'makeJsonSafe'
        ) {
          return // already wrapped
        }

        context.report({
          node: propsProperty.value,
          messageId: 'requireMakeJsonSafe',

          fix(fixer) {
            const sourceCode = context.getSourceCode()
            const propsText = sourceCode.getText(propsValue)
            const fixes = []

            // add the makeJsonSafe wrapper

            fixes.push(
              fixer.replaceText(propsValue, `makeJsonSafe(${propsText})`)
            )

            // @note add import statement if makeJsonSafe is not already imported

            if (!hasMakeJsonSafeImport) {
              const program = sourceCode.ast
              const firstNode = program.body[0]

              // @todo determine the correct import path - might need configuration

              const importStatement =
                "import { makeJsonSafe } from '@/lib/struct'\n"

              if (firstNode) {
                fixes.push(fixer.insertTextBefore(firstNode, importStatement))
              }
            }

            return fixes
          },
        })
      },
    }
  },
}
