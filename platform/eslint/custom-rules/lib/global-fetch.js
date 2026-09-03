// @note shared by `no-plain-fetch-in-routes` and `no-global-fetch`: a call to
// the bare global `fetch` is one whose callee is the identifier `fetch` and
// resolves to no import or declaration in any enclosing scope. Environment
// globals show up as variables without definitions, so `defs` is the tell.

function getScope(context, node) {
  const sourceCode = context.sourceCode ?? context.getSourceCode()

  return typeof sourceCode.getScope === 'function'
    ? sourceCode.getScope(node)
    : context.getScope()
}

function isBareGlobalFetchCall(context, node) {
  if (node.callee?.type !== 'Identifier' || node.callee.name !== 'fetch') {
    return false
  }

  for (let scope = getScope(context, node); scope; scope = scope.upper) {
    const variable = scope.set.get('fetch')

    if (variable && variable.defs.length > 0) {
      return false
    }
  }

  return true
}

const TEST_FILE_PATTERN = /\.(utest|test|spec)\.[cm]?[jt]sx?$/

function normalizeFilename(filename) {
  return filename.split('\\').join('/')
}

module.exports = { isBareGlobalFetchCall, normalizeFilename, TEST_FILE_PATTERN }
