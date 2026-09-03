/**
 * @file constraints.ts
 *
 * The column size limits this engine imposes, in bytes.
 *
 * @note SQLite's own, not MySQL's. Deriving strips the native types, so
 * `@db.VarChar(191)`, `@db.Text` and `@db.MediumText` are all a plain TEXT
 * column here, and SQLite does not enforce a declared VARCHAR length at all.
 * What is left is one engine-wide ceiling, `SQLITE_MAX_LENGTH`, which the three
 * constants below therefore share. They are deliberately not the numbers the
 * MySQL implementation exports - that is the point of each implementation
 * declaring its own.
 *
 * @note bytes, not characters. Callers measure encoded length - a multi-byte
 * character costs more than one.
 *
 * @note the ceiling is a build-time option, not a format limit. 1e9 is the
 * default every stock build ships with, including the one better-sqlite3
 * bundles; a build that lowered it would need this file lowered to match.
 *
 * @note a consequence worth knowing: this database accepts values the MySQL
 * implementation would reject, so a row written here need not fit there. Data
 * that has to survive the move must be held to the stricter limits by whatever
 * moves it - these constants describe the engine, and cannot describe both.
 */

/**
 * `SQLITE_MAX_LENGTH` - the max size of any TEXT or BLOB value.
 */
const SQLITE_MAX_LENGTH = 1000000000

/**
 * The max length of what the blueprint declares `@db.VarChar(191)`, stored here
 * as an unconstrained TEXT column.
 */
export const MAX_DB_STRING_BYTES_LENGTH = SQLITE_MAX_LENGTH

/**
 * The max length of what the blueprint declares `@db.Text`, stored here as an
 * unconstrained TEXT column.
 */
export const MAX_DB_TEXT_BYTES_LENGTH = SQLITE_MAX_LENGTH

/**
 * The max length of what the blueprint declares `@db.MediumText`, stored here
 * as an unconstrained TEXT column.
 */
export const MAX_DB_MEDIUMTEXT_BYTES_LENGTH = SQLITE_MAX_LENGTH
