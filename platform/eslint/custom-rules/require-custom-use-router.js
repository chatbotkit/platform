module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require default import of useRouter from @/hooks/useRouter instead of named import from next/navigation',
      category: 'Best Practices',
    },
    fixable: 'code',
    schema: [],
    messages: {
      requireCustomUseRouter:
        "Use default import 'useRouter' from '@/hooks/useRouter' instead of named import from 'next/navigation'",
    },
  },

  create(context) {
    return {
      ImportDeclaration(node) {
        // @note check if importing from next/navigation

        if (node.source.value !== 'next/navigation') {
          return
        }

        // @note check if useRouter is being imported

        const useRouterSpecifier = node.specifiers.find(
          (spec) =>
            spec.type === 'ImportSpecifier' &&
            spec.imported?.name === 'useRouter'
        )

        if (!useRouterSpecifier) {
          return
        }

        context.report({
          node: useRouterSpecifier,
          messageId: 'requireCustomUseRouter',
          fix(fixer) {
            const otherSpecifiers = node.specifiers.filter(
              (spec) => spec !== useRouterSpecifier
            )

            // @note if there are other imports from next/navigation, we need to split the import

            if (otherSpecifiers.length > 0) {
              const otherImports = otherSpecifiers
                .map((spec) => {
                  if (spec.type === 'ImportSpecifier') {
                    return spec.imported.name === spec.local.name
                      ? spec.imported.name
                      : `${spec.imported.name} as ${spec.local.name}`
                  } else if (spec.type === 'ImportDefaultSpecifier') {
                    return spec.local.name
                  }

                  return null
                })
                .filter(Boolean)
                .join(', ')

              const localName = useRouterSpecifier.local.name
              const importName =
                localName === 'useRouter'
                  ? 'useRouter'
                  : `useRouter as ${localName}`

              return [
                fixer.replaceText(
                  node,
                  `import { ${otherImports} } from 'next/navigation'`
                ),
                fixer.insertTextAfter(
                  node,
                  `\nimport ${importName} from '@/hooks/useRouter'`
                ),
              ]
            } else {
              // @note if useRouter is the only import, replace the entire import statement

              const localName = useRouterSpecifier.local.name
              const importName =
                localName === 'useRouter' ? 'useRouter' : `${localName}`

              return fixer.replaceText(
                node,
                `import ${importName} from '@/hooks/useRouter'`
              )
            }
          },
        })
      },
    }
  },
}
