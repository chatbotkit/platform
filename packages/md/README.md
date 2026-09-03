# @chatbotkit-dev/md

The markdown family.

Seven modules that moved together because they were already close to self contained:

| Module | Purpose |
| ------ | ------- |
| `convert` | markdown to HTML |
| `split` | splitting a document into addressable parts |
| `chat` | rendering a conversation as markdown |
| `extract` | pulling structured pieces out of a document |
| `frontmatter` | reading and writing frontmatter |
| `linkify` | turning bare URLs into links |
| `table` | table helpers |

Each is importable on its own, for example `@chatbotkit-dev/md/convert`.

Extracted from `platform/lib/md.*`.
