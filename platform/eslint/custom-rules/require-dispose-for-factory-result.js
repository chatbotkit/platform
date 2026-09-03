module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require factory-created disposable resources to be disposed in a finally block',
      category: 'Best Practices',
    },
    schema: [
      {
        type: 'object',
        properties: {
          factories: {
            type: 'array',
            items: { type: 'string' },
          },
          disposeMethod: {
            type: 'string',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      requireDispose:
        "Dispose '{{name}}' with '{{name}}.{{disposeMethod}}()' in a finally block after creating it with {{factory}}().",
    },
  },

  create(context) {
    const options = context.options[0] || {}
    const factories = new Set(options.factories || [])
    const disposeMethod = options.disposeMethod || 'dispose'

    if (factories.size === 0) {
      return {}
    }

    const scopeStack = []

    function getCurrentScope() {
      return scopeStack[scopeStack.length - 1] || null
    }

    function enterScope() {
      scopeStack.push({
        resources: new Map(),
      })
    }

    function exitScope() {
      const scope = scopeStack.pop()

      if (!scope) {
        return
      }

      for (const resource of scope.resources.values()) {
        if (resource.disposed) {
          continue
        }

        context.report({
          node: resource.node,
          messageId: 'requireDispose',
          data: {
            name: resource.name,
            factory: resource.factory,
            disposeMethod,
          },
        })
      }
    }

    function unwrapAwaitExpression(node) {
      return node?.type === 'AwaitExpression' ? node.argument : node
    }

    function getFactoryName(node) {
      const expression = unwrapAwaitExpression(node)

      if (expression?.type !== 'CallExpression') {
        return null
      }

      const callee = expression.callee

      if (callee?.type === 'Identifier' && factories.has(callee.name)) {
        return callee.name
      }

      return null
    }

    function isDisposeCall(node, name) {
      const expression = unwrapAwaitExpression(node)

      if (expression?.type !== 'CallExpression') {
        return false
      }

      const callee = expression.callee

      return (
        callee?.type === 'MemberExpression' &&
        callee.object?.type === 'Identifier' &&
        callee.object.name === name &&
        callee.property?.type === 'Identifier' &&
        callee.property.name === disposeMethod
      )
    }

    function walk(node, visitor) {
      if (!node || typeof node !== 'object') {
        return
      }

      if (visitor(node) === false) {
        return
      }

      for (const [key, value] of Object.entries(node)) {
        if (key === 'parent') {
          continue
        }

        if (Array.isArray(value)) {
          for (const child of value) {
            walk(child, visitor)
          }
        } else {
          walk(value, visitor)
        }
      }
    }

    function markDisposedResources(finalizer) {
      const scope = getCurrentScope()

      if (!scope || scope.resources.size === 0 || !finalizer) {
        return
      }

      walk(finalizer, (node) => {
        for (const [name, resource] of scope.resources.entries()) {
          if (isDisposeCall(node, name)) {
            resource.disposed = true
          }
        }
      })
    }

    return {
      Program: enterScope,
      'Program:exit': exitScope,

      FunctionDeclaration: enterScope,
      'FunctionDeclaration:exit': exitScope,
      FunctionExpression: enterScope,
      'FunctionExpression:exit': exitScope,
      ArrowFunctionExpression: enterScope,
      'ArrowFunctionExpression:exit': exitScope,

      VariableDeclarator(node) {
        const scope = getCurrentScope()

        if (!scope || node.id?.type !== 'Identifier') {
          return
        }

        const factory = getFactoryName(node.init)

        if (!factory) {
          return
        }

        scope.resources.set(node.id.name, {
          node,
          name: node.id.name,
          factory,
          disposed: false,
        })
      },

      TryStatement(node) {
        markDisposedResources(node.finalizer)
      },
    }
  },
}
