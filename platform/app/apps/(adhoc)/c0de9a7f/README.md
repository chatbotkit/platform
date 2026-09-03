# Factory (`c0de9a7f`)

Spin up **multiple factories** - each a self-provisioning agent for a GitHub
organisation, driven by tasks. A factory **is a blueprint**: its own bot,
skillset, shell sandbox, GitHub App connection, workspace, and tasks.

## Model

Resource aliases are unique **per user** (`@@unique([userId, alias])`), so each
factory is a distinct blueprint aliased `f-<key>` whose resources are aliased
`f-<key>-<role>` (bot, skillset, workspace, github; abilities carry no alias).
The blueprint carries `meta.app` so the app can list only its own factories.

The template is the source of truth and **re-applied on every factory open**
(`getFactory` → `factory.ts#ensureFactory`), so structural changes propagate.
It's safe because user-owned values are preserved on re-apply: credentials
(`value`/`privateKey`/`webhookSecret`) via `UNMANAGED_FIELDS`, and the bot
`model` + integration `appId` via `$default(...)` seed markers (written on
create, skipped on update - see `lib/blueprint.import.ts`).

## Layout

- `page.tsx` / `components.jsx` - the **factory gallery**: list, create (dialog
  from the top-bar `New factory` button via `AppNavExtra`), rename, delete.
- `[factory]/layout.jsx` - dynamic sidebar (`setSidebarItems`: All factories +
  this factory's Tasks / Playbooks / Settings). `[factory]` is the `f-<key>`
  alias.
- `[factory]/page.tsx` + `components.jsx` - **Tasks** master-detail (list left,
  run log right; `New task` dialog in the top bar).
- `[factory]/playbooks/` - full-screen playbook editor (`MarkdownInput`).
- `[factory]/settings/` - GitHub App connection (`RevealTextarea` / `RevealToken`
  / `WebhookSetupSection`, mirroring `pages/integrations/github/[id]`). An
  `Expando` walks through creating the App and the exact repository/org
  permissions to grant (tailored to the two GitHub abilities; webhooks not
  needed as the factory is task-driven).

## Provisioning

`factory.ts#createFactory` creates a blueprint (`blueprint.create` with alias +
`meta.app`), imports `factory-template.ts#buildTemplate(factory)` into it once,
then seeds starter playbooks. Server actions address the factory's resources by
`@f-<key>-<role>` (see `const.ts#factoryAliases`).

The GitHub connection is a **GitHub App**: App id + private key + webhook secret
on the integration (validated by `/setup`). There is **no separate credential
secret** - the GitHub abilities reference the integration directly by token:
`github/api/call[by-id]` (authenticated REST) and
`github/repository/token/create[by-id]` (mint a short-lived repo token for git
in the shell). Shell is one `pack/shell` ability bound to the workspace. `appId`
is a `$default('')` seed so a re-apply never blanks the user's value.

## Notes / gotchas

- The bot `model` in the template is a knob; keep it a valid catalogue id.
- Long, org-wide task runs can hit the task-engine queue timeout; prefer many
  scoped tasks (the agent can self-schedule via `task/create`).
- `showHeader={false}` (needed for the full-screen Tasks/Playbooks) means
  `#app-nav-title` is absent, so the factory name is shown as the sidebar
  section title rather than via `AppNavTitle`; `#app-nav-extra` + the profile
  icon still render.
