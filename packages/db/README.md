# @chatbotkit-dev/db

The community database: SQLite in a file. The schema is derived from the
blueprint in `@chatbotkit-dev/db-spec`; the client is generated against a file
database this package creates itself, so generation needs nothing provisioned
and nothing reachable.

## Environment

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | A `file:` url, e.g. `file:./data/cbk.db` |

## Known differences from the MySQL module

- `DATE(...)` expression columns in the analytics queries come back as
  `'YYYY-MM-DD'` strings (typed loosely), where MySQL returns `Date` objects.
  Plain columns are identical. Affects the date-bucketed usage/report series
  only.
- Writes are as concurrent as SQLite is - fine for a single-process deployment,
  which is what this module is for.
