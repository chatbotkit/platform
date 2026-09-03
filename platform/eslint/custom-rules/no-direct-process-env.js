/* eslint-disable @typescript-eslint/no-require-imports */
const { isClientFile } = require('./lib/client-files')

// @note reads inside these functions execute on the server even though the
// file ships to the client
const SERVER_FUNCTION_NAMES = new Set([
  'getServerSideProps',
  'getStaticProps',
  'getStaticPaths',
  'getInitialProps',
  'generateMetadata',
  'generateStaticParams',
])

const DEFAULT_ALLOWED_NAMES = new Set(['NODE_ENV'])

const DEFAULT_ALLOWED_PATTERN = /^NEXT_PUBLIC_/

function isProcessEnv(node) {
  return (
    node.type === 'MemberExpression' &&
    node.object.type === 'Identifier' &&
    node.object.name === 'process' &&
    ((node.property.type === 'Identifier' && node.property.name === 'env') ||
      (node.property.type === 'Literal' && node.property.value === 'env'))
  )
}

function getEnvName(property, computed) {
  if (!computed && property.type === 'Identifier') {
    return property.name
  }

  if (computed && property.type === 'Literal') {
    return String(property.value)
  }

  return null
}

function functionName(node) {
  if (node.type === 'FunctionDeclaration' && node.id) {
    return node.id.name
  }

  const parent = node.parent

  if (!parent) {
    return null
  }

  if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
    return parent.id.name
  }

  if (
    parent.type === 'Property' &&
    !parent.computed &&
    parent.key.type === 'Identifier'
  ) {
    return parent.key.name
  }

  if (
    parent.type === 'MethodDefinition' &&
    !parent.computed &&
    parent.key.type === 'Identifier'
  ) {
    return parent.key.name
  }

  if (
    parent.type === 'AssignmentExpression' &&
    parent.left.type === 'MemberExpression' &&
    !parent.left.computed &&
    parent.left.property.type === 'Identifier'
  ) {
    return parent.left.property.name
  }

  return null
}

function isInsideServerFunction(node) {
  // @note a wrapped export (`export const getStaticProps = withX(async …)`)
  // still names the server function on an enclosing declarator, so walking
  // every ancestor covers both the plain and the wrapped forms

  for (let current = node; current; current = current.parent) {
    if (
      current.type === 'FunctionDeclaration' ||
      current.type === 'FunctionExpression' ||
      current.type === 'ArrowFunctionExpression'
    ) {
      const name = functionName(current)

      if (name && SERVER_FUNCTION_NAMES.has(name)) {
        return true
      }
    }

    if (
      current.type === 'VariableDeclarator' &&
      current.id.type === 'Identifier' &&
      SERVER_FUNCTION_NAMES.has(current.id.name)
    ) {
      return true
    }
  }

  return false
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow direct process.env reads in client-bundle code; use the config seams and hooks instead',
      category: 'Best Practices',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allow: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noDirectProcessEnv:
        "Client-bundle code must not read process.env.{{name}} directly - the value freezes at build. Use the config seams ('@/config/site', '@/config/apexes') or the hooks in '@/hooks/useHostname'. A read that genuinely must stay opens the file with `/* eslint-disable custom-eslint-rules/no-direct-process-env -- <reason> */`.",
      noBareProcessEnv:
        'Client-bundle code must not pass, spread, alias or enumerate process.env - it is empty in the browser and bypasses the per-name checks. Read the specific names through the config seams or hooks instead.',
    },
  },

  create(context) {
    if (!isClientFile(context, context.getFilename())) {
      return {}
    }

    const options = context.options[0] || {}

    const allowed = new Set([
      ...DEFAULT_ALLOWED_NAMES,
      ...(options.allow || []),
    ])

    function check(node, name) {
      if (name && (allowed.has(name) || DEFAULT_ALLOWED_PATTERN.test(name))) {
        return
      }

      if (isInsideServerFunction(node)) {
        return
      }

      context.report({
        node,
        messageId: 'noDirectProcessEnv',
        data: { name: name || '<computed>' },
      })
    }

    function checkBare(node) {
      if (isInsideServerFunction(node)) {
        return
      }

      context.report({
        node,
        messageId: 'noBareProcessEnv',
      })
    }

    return {
      MemberExpression(node) {
        // @note a bare `process.env` used as a value - passed, spread,
        // aliased, enumerated - leaks every variable at once and bypasses the
        // per-name checks
        if (isProcessEnv(node)) {
          const parent = node.parent

          const isPropertyRead =
            parent.type === 'MemberExpression' && parent.object === node

          const isDestructured =
            parent.type === 'VariableDeclarator' &&
            parent.init === node &&
            parent.id.type === 'ObjectPattern'

          if (!isPropertyRead && !isDestructured) {
            checkBare(node)
          }

          return
        }

        if (!isProcessEnv(node.object)) {
          return
        }

        check(node, getEnvName(node.property, node.computed))
      },

      VariableDeclarator(node) {
        if (
          !node.init ||
          !isProcessEnv(node.init) ||
          node.id.type !== 'ObjectPattern'
        ) {
          return
        }

        for (const property of node.id.properties) {
          if (
            property.type === 'Property' &&
            !property.computed &&
            property.key.type === 'Identifier'
          ) {
            check(property, property.key.name)
          }
        }
      },
    }
  },
}
