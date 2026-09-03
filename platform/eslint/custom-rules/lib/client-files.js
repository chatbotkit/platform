const { normalizeFilename, TEST_FILE_PATTERN } = require('./global-fetch')

// @note client-bundle code only: server code resolves the runtime
// environment, which is exactly right. In the browser these modules and
// reads compile to build-time values, freezing deployment identity into the
// bundle.
const CLIENT_PATTERNS = [
  /^components\//,
  /^hooks\//,
  /^embeds\//,
  /^layouts\//,
  /^templates\//,
  /^pages\//,
  /^app\//,
]

const SERVER_PATTERNS = [
  /^pages\/api\//,
  /^app\/api\//,
  /^app\/.+\/route\.tsx?$/,
  /^app\/.+\/server\.tsx?$/,
]

function isClientFile(context, filename) {
  const normalized = normalizeFilename(filename)

  if (TEST_FILE_PATTERN.test(normalized)) {
    return false
  }

  const cwd = normalizeFilename(
    typeof context.getCwd === 'function' ? context.getCwd() : context.cwd
  ).replace(/\/$/, '')

  const relative = normalized.startsWith(`${cwd}/`)
    ? normalized.slice(cwd.length + 1)
    : normalized.replace(/^\//, '')

  if (SERVER_PATTERNS.some((pattern) => pattern.test(relative))) {
    return false
  }

  return CLIENT_PATTERNS.some((pattern) => pattern.test(relative))
}

module.exports = { isClientFile }
