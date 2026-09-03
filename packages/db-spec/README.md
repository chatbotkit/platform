# @chatbotkit-dev/db-spec

The database contract, laid out like an implementation: `prisma/schema.prisma`
is THE schema - the one hand-edited source - with the shared analytics SQL and
the zod generator config beside it.

Every implementation derives its own `prisma/` from this one by importing the
renderers from `@chatbotkit-dev/db-spec/derive` in a small script of its own.
The direction is deliberate: this package does not know who implements it.
Implementations depend on the spec, never the reverse.

## Changing the schema

1. Edit `prisma/schema.prisma`
2. `pnpm -r derive` - every implementation re-derives itself; outputs are
   committed, so the change shows up in review on every engine it affects
3. Push and generate through the platform as usual (`pnpm db` in `platform`) -
   each implementation also re-derives automatically at the start of its own
   `db:push` and `db:gen`, so a stale schema cannot reach a database or a
   generated client

The blueprint stays MySQL-complete on purpose - the engine-specific information
only flows downhill, so deriving is subtractive. The 48 queries in `prisma/sql`
are shared by every engine: `?` placeholders and `DATE()` work on MySQL and
SQLite alike. Keep them free of engine-specific expressions - dates are computed
by the caller and passed as parameters.

## Why `zod` is pinned exactly

The Json column shapes this package exports are zod schema *instances*, and the
platform passes them into code that checks `instanceof` against its own zod. Two
resolved zod versions mean two instances and a failure that reads as "not a Zod
schema" far from the cause. The exact pin keeps this package on the platform's
resolved version - if the platform upgrades zod, bump this pin in the same
change.
