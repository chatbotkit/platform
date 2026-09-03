/* eslint-disable @typescript-eslint/no-require-imports */

function getStaticString(node) {
  if (!node) {
    return null
  }

  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value
  }

  if (node.type === 'TemplateLiteral') {
    return node.quasis
      .map((quasi, index) => {
        const expression = index < node.expressions.length ? '__DYNAMIC__' : ''

        return `${quasi.value.cooked}${expression}`
      })
      .join('')
  }

  if (node.type === 'BinaryExpression' && node.operator === '+') {
    const left = getStaticString(node.left)
    const right = getStaticString(node.right)

    if (left === null && right === null) {
      return null
    }

    return `${left ?? '__DYNAMIC__'}${right ?? '__DYNAMIC__'}`
  }

  if (node.type === 'JSXExpressionContainer') {
    return getStaticString(node.expression)
  }

  return null
}

function getDocumentationComponent(href) {
  if (
    /^(?:https?:)?\/\/docs\.cbk\.ai(?:[/?#]|$)/i.test(href) ||
    /^(?:https?:\/\/(?:www\.)?chatbotkit\.com)?\/manuals(?:[/?#]|$)/i.test(
      href
    ) ||
    /^\/manuals(?:[/?#]|$)/i.test(href)
  ) {
    return 'ManualLink'
  }

  if (
    /^(?:https?:\/\/(?:www\.)?chatbotkit\.com)?\/docs(?:[/?#]|$)/i.test(href) ||
    /^\/docs(?:[/?#]|$)/i.test(href)
  ) {
    return 'DocsLink'
  }

  return null
}

function getJSXElementName(node) {
  if (node.type === 'JSXIdentifier') {
    return node.name
  }

  return null
}

function isHrefProperty(node) {
  if (node.computed) {
    return getStaticString(node.key) === 'href'
  }

  return (
    (node.key.type === 'Identifier' && node.key.name === 'href') ||
    getStaticString(node.key) === 'href'
  )
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require centralized link components for product documentation and technical manuals',
      category: 'Possible Errors',
    },
    schema: [],
    messages: {
      useLinkComponent:
        'Use {{component}} instead of a direct documentation URL',
      useLinkHelper:
        'Use {{component}} or its URL helper instead of a direct documentation href',
    },
  },

  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.name !== 'href') {
          return
        }

        const href = getStaticString(node.value)
        const component = href && getDocumentationComponent(href)

        if (!component) {
          return
        }

        const elementName = getJSXElementName(node.parent.name)

        if (elementName === component) {
          return
        }

        context.report({
          node,
          messageId: 'useLinkComponent',
          data: { component },
        })
      },

      Property(node) {
        if (!isHrefProperty(node)) {
          return
        }

        const href = getStaticString(node.value)
        const component = href && getDocumentationComponent(href)

        if (!component) {
          return
        }

        context.report({
          node,
          messageId: 'useLinkHelper',
          data: { component },
        })
      },
    }
  },
}
