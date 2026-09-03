import fs from 'fs'
import path from 'path'

// @note conformity gate for the auxiliary trust boundary: no auxiliary ability
// route may use the anonymous `handler` / `multiHandler` wrappers (or the
// anonymous form of the SQL wrapper). Every route must be wrapped by
// `authenticatedHandler` / `authenticatedMultiHandler` so it requires a
// platform session. See pages/api/auxiliary/README.md.

const ROOT = path.resolve(__dirname, '..')

const SCAN_ROOTS = [
  'pages/api/auxiliary/skillset/ability',
  'pages/api/auxiliary/playground',
  'pages/api/auxiliary/dataset',
]

function walk(dir) {
  const files = []

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...walk(full))
    } else if (
      /\.(ts|js)$/.test(entry.name) &&
      !/\.(utest|itest|test)\./.test(entry.name) &&
      !entry.name.startsWith('_')
    ) {
      files.push(full)
    }
  }

  return files
}

function routeFiles() {
  return SCAN_ROOTS.flatMap((root) => walk(path.join(ROOT, root))).sort()
}

describe('auxiliary route conformity', () => {
  const files = routeFiles()

  it('finds the auxiliary routes', () => {
    expect(files.length).toBeGreaterThan(40)
  })

  it('has no route using the anonymous handler wrappers', () => {
    const offenders = []

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8')

      // @note the SQL routes import the default export of lib/auxiliary.sql
      // as `handler`; that wrapper is authenticated, so only the anonymous
      // names imported from lib/auxiliary.handler are offenders
      const usesSqlWrapper = /from '@\/lib\/auxiliary\.sql'/.test(source)

      if (
        /import \{[^}]*\b(handler|multiHandler)\b[^}]*\} from '@\/lib\/auxiliary\.handler'/.test(
          source
        ) ||
        (!usesSqlWrapper &&
          /^\s*export default (handler|multiHandler)\(/m.test(source))
      ) {
        offenders.push(path.relative(ROOT, file))
      }
    }

    expect(offenders).toEqual([])
  })

  it('has every route wrapped by an authenticating wrapper', () => {
    const offenders = []

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8')

      const authenticated =
        /\bauthenticated(Multi)?Handler\(/.test(source) ||
        // @note the SQL wrappers in lib/auxiliary.sql.ts delegate to
        // authenticatedHandler
        /from '@\/lib\/auxiliary\.sql'/.test(source) ||
        /\bwithSession\(/.test(source) ||
        /\bwithUserSession\(/.test(source)

      if (!authenticated) {
        offenders.push(path.relative(ROOT, file))
      }
    }

    expect(offenders).toEqual([])
  })

  it('keeps the SQL wrapper on the authenticated handler', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'lib/auxiliary.sql.ts'),
      'utf8'
    )

    expect(source).toMatch(/authenticatedHandler\(/)
    expect(source).not.toMatch(/[^d]handler\(schema/)
  })
})
