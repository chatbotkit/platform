/* eslint-disable no-console */

/**
 * @file derive.js
 *
 * The renderers each database implementation uses to derive its own
 * `prisma/schema.prisma` from this package's blueprint.
 *
 * @note the direction matters. This package does not know who implements it and
 * must not - implementations depend on the spec, never the reverse. So there is
 * no target list here: each implementation carries a small derive script that
 * imports these renderers and writes into its own tree. Run them all with
 * `pnpm -r derive`, and each module also derives automatically at the start of
 * its own `db:push` and `db:gen`, so a stale schema cannot reach a database or
 * a generated client.
 *
 * The blueprint stays MySQL-complete on purpose: the engine-specific
 * information (which strings are `@db.Text`, the expression defaults TEXT
 * columns force) only flows downhill, so deriving is subtractive and no
 * annotation convention is needed.
 *
 * SQLite differs in exactly four ways, each rejected by a different layer of
 * Prisma's tooling (validate, generate, db push - none catches the others'):
 *
 *   native types    `@db.Text` and friends are refused by the sqlite connector.
 *                   Removed; a bare `String` is already TEXT there.
 *
 *   defaults        a TEXT column on MySQL cannot take a plain default, which
 *                   is what `dbgenerated("(_utf8mb4\\'...\\')")` works around,
 *                   spelled exactly as MySQL stores the expression so that
 *                   `migrate diff` against a live database stays quiet. SQLite
 *                   takes the plain literal, so the workaround is unwound.
 *
 *   delete rules    `NoAction` is not implemented for sqlite under
 *                   `relationMode = "prisma"`. `Restrict` is the nearest
 *                   behaviour, and nothing consults these at runtime - the only
 *                   user-delete path is raw SQL that bypasses the emulation.
 *
 *   provider        mysql becomes sqlite.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'

const SPEC_PRISMA = path.join(
  path.dirname(url.fileURLToPath(import.meta.url)),
  '..',
  'prisma'
)

const HEADER = `// GENERATED - do not edit.
//
// The source is prisma/schema.prisma in @chatbotkit-dev/db-spec - that is the
// one hand-edited schema, and this file is derived from it by this package's
// \`pnpm derive\` (see @chatbotkit-dev/db-spec/derive for exactly what this
// engine changes). Edit the source, then run \`pnpm -r derive\`.

`

/**
 * The MySQL render: the blueprint verbatim.
 *
 * @note being a copy is the safety argument, not laziness - it makes the
 * derived schema checkably byte-identical to what production has always run.
 *
 * @param {string} source
 * @returns {string}
 */
export function renderMysql(source) {
  return source
}

/**
 * @param {string} source
 * @returns {string}
 */
export function renderSqlite(source) {
  return source
    .split('\n')
    .map((line) => {
      // @note comments are rewritten like everything else - a commented-out
      // field must stay valid for this engine when uncommented, and the
      // patterns are token-anchored so prose never matches them
      return line
        .replace(/\s*@db\.\w+(\([^)]*\))?/g, '')
        .replace(
          /@default\(dbgenerated\("\(_utf8mb4\\\\'(.*?)\\\\'\)"\)\)/g,
          '@default("$1")'
        )
        .replace(
          'onDelete: NoAction, onUpdate: NoAction',
          'onDelete: Restrict, onUpdate: Restrict'
        )
        .replace('onDelete: NoAction', 'onDelete: Restrict')
        .replace(/provider\s*=\s*"mysql"/, 'provider     = "sqlite"')
    })
    .join('\n')
}

/**
 * Derives an implementation's prisma directory from the blueprint.
 *
 * Writes the rendered schema and copies the shared SQL and the zod generator
 * config alongside it, which is everything TypedSQL and the generators resolve
 * relative to the schema.
 *
 * @param {object} options
 * @param {string} options.prismaDir - the implementation's prisma directory
 * @param {(source: string) => string} options.render - the engine's renderer
 * @returns {Promise<void>}
 */
export async function derive({ prismaDir, render }) {
  const source = await fs.readFile(
    path.join(SPEC_PRISMA, 'schema.prisma'),
    'utf8'
  )

  // @note the source file opens with a note describing itself as the one
  // hand-edited schema - true there, false in anything derived from it. Strip
  // the leading comment block; the derived header names the source instead.
  const lines = source.split('\n')

  let body = 0

  while (
    body < lines.length &&
    (lines[body].trim() === '' || lines[body].trimStart().startsWith('//'))
  ) {
    body += 1
  }

  const stripped = lines.slice(body).join('\n')

  await fs.mkdir(path.join(prismaDir, 'sql'), { recursive: true })

  await fs.writeFile(
    path.join(prismaDir, 'schema.prisma'),
    HEADER + render(stripped)
  )

  const sqlDir = path.join(SPEC_PRISMA, 'sql')

  for (const file of await fs.readdir(sqlDir)) {
    await fs.copyFile(
      path.join(sqlDir, file),
      path.join(prismaDir, 'sql', file)
    )
  }

  await fs.copyFile(
    path.join(SPEC_PRISMA, 'zod-generator.config.json'),
    path.join(prismaDir, 'zod-generator.config.json')
  )

  console.log(`derived ${path.relative(process.cwd(), prismaDir)}`)
}
