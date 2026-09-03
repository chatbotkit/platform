import yaml from 'js-yaml'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

function parseEnvironmentFile(content) {
  const parsed = yaml.load(content)

  if (!parsed || typeof parsed !== 'object') {
    return {}
  }

  if (parsed.env && typeof parsed.env === 'object') {
    return parsed.env
  }

  return parsed
}

function sanitizeEnvironmentVariables(input) {
  const result = {}

  for (const [key, value] of Object.entries(input)) {
    if (typeof key !== 'string' || key.length === 0 || key === 'sops') {
      continue
    }

    if (typeof value === 'string') {
      result[key] = value

      continue
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      result[key] = String(value)

      continue
    }

    // @note structured values (nested yaml maps/lists) collapse to compact
    // JSON, mirroring push-env-to-vercel.sh whose jq `tostring` does the same
    // on the Vercel path - the two pipelines must agree so a variable like a
    // routing table behaves identically locally and deployed
    if (value !== null && typeof value === 'object') {
      result[key] = JSON.stringify(value)
    }
  }

  return result
}

function readDecryptedEnvironmentFile(filePath) {
  const decryptResult = spawnSync('sops', ['-d', filePath], {
    encoding: 'utf8',
  })

  if (decryptResult.status === 0) {
    return decryptResult.stdout
  }

  // @note only a plaintext file may be read raw. An `.enc.yaml` that fails to
  // decrypt - a missing sops binary, a missing age key - must be a hard error,
  // because falling through would inject the ciphertext structure itself as
  // environment values and every downstream failure would point elsewhere.
  if (filePath.endsWith('.enc.yaml')) {
    fail(
      `could not decrypt ${filePath} (is sops installed and the age key available?): ${
        decryptResult.stderr || decryptResult.error?.message || 'unknown error'
      }`
    )
  }

  return fs.readFileSync(filePath, 'utf8')
}

function fail(message) {
  process.stderr.write(`[env] ${message}\n`)
  process.exit(1)
}

// @note environment files live outside the project folder so they stay
// private when the project tree is published - resolve them by walking up
// from the working directory looking for an `.environments` folder, with
// CBK_ENVIRONMENTS_DIR as an explicit override; the walk stops at the
// repository root
function resolveEnvironmentsDirs(startDir) {
  const dirs = []

  if (process.env.CBK_ENVIRONMENTS_DIR) {
    dirs.push(path.resolve(startDir, process.env.CBK_ENVIRONMENTS_DIR))
  }

  let currentDir = startDir

  for (;;) {
    dirs.push(path.join(currentDir, '.environments'))

    const parentDir = path.dirname(currentDir)

    if (
      parentDir === currentDir ||
      fs.existsSync(path.join(currentDir, '.git'))
    ) {
      break
    }

    currentDir = parentDir
  }

  return dirs
}

function resolveEnvironmentFilePath(projectDir, environmentName) {
  for (const environmentsDir of resolveEnvironmentsDirs(projectDir)) {
    for (const fileName of [
      `${environmentName}.enc.yaml`,
      `${environmentName}.yaml`,
    ]) {
      const candidatePath = path.join(environmentsDir, fileName)

      if (fs.existsSync(candidatePath)) {
        return candidatePath
      }
    }
  }

  return null
}

const requestedEnvironment = process.argv[2]
const requestedScript = process.argv[3]
// @note strip a leading '--' if present - the caller (pnpm) uses it as an
// argument separator, but we re-add it ourselves when spawning the sub-script
const rawScriptArguments = process.argv.slice(4)
const requestedScriptArguments =
  rawScriptArguments[0] === '--'
    ? rawScriptArguments.slice(1)
    : rawScriptArguments

if (!requestedEnvironment || !requestedScript) {
  fail('usage: pnpm run with-env <environment> <script> [script-args...]')
}

const projectDir = process.cwd()

// @note the environment argument may be a comma-separated list - e.g.
// `pnpm run with-env production,ops <script>` - layering each file over the previous
// one (later files win). This is how a script combines a deployment's runtime
// values with the operator-only credentials kept in `ops.enc.yaml`.
const requestedEnvironmentNames = requestedEnvironment
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean)

const environmentVariables = {}

for (const environmentName of requestedEnvironmentNames) {
  const environmentFilePath = resolveEnvironmentFilePath(
    projectDir,
    environmentName
  )

  if (!environmentFilePath) {
    fail(
      `missing environment file for "${environmentName}". expected ${environmentName}.enc.yaml or ${environmentName}.yaml in an .environments folder at or above ${projectDir}`
    )
  }

  Object.assign(
    environmentVariables,
    sanitizeEnvironmentVariables(
      parseEnvironmentFile(readDecryptedEnvironmentFile(environmentFilePath))
    )
  )
}

const childEnvironment = {
  ...process.env,
  ...environmentVariables,

  // @note the first name is the base deployment; layered extras (like `ops`)
  // add credentials but do not change which environment the child believes it
  // is running against.
  BUILD_ENVIRONMENT: requestedEnvironmentNames[0],
}

const runtimeResult = spawnSync(
  'pnpm',
  ['run', requestedScript, ...requestedScriptArguments],
  {
    stdio: 'inherit',
    env: childEnvironment,
  }
)

if (runtimeResult.error) {
  fail(runtimeResult.error.message)
}

process.exit(runtimeResult.status ?? 1)
