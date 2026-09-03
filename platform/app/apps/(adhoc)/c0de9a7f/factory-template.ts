/**
 * The embedded Factory blueprint, in the designer **export** shape, as a
 * function of the factory's alias so each factory gets its own per-user-unique
 * resource aliases.
 *
 * `factory.ts` hands the result to the import endpoint. It is a map of
 * `#type:::localId` nodes (blueprint-local cross-reference tokens - resolved
 * anywhere they appear, including inside an ability's `instruction` string).
 * Every resource carries a stable `f-<key>-<role>` alias - the server addresses
 * bot/skillset/space/integration by it, and it is also the reconcile key, so a
 * re-apply matches each resource (including abilities) and updates it in place
 * instead of creating duplicates.
 *
 * ## GitHub
 *
 * The connection is a **GitHub App integration** (`githubIntegration`) that
 * holds the App id + private key + webhook secret (set on the Settings page).
 * The GitHub abilities reference the integration directly by token - there is no
 * separate credential secret: `github/api/call[by-id]` makes authenticated REST
 * calls, and `github/repository/token/create[by-id]` mints short-lived,
 * repo-scoped installation tokens for git/CLI work in the shell.
 *
 * Credential-shaped fields are blank; the Settings page fills them. `appId` is a
 * managed field, so it is a `$default('')` seed marker - blank on create,
 * preserved on re-apply (`privateKey`/`webhookSecret` are UNMANAGED and survive
 * re-apply too).
 */
import { factoryAliases } from './const'

/**
 * Marks a field as a seed-only default: the import writes it on create but skips
 * it on re-apply, so re-syncing this template never overwrites a value the user
 * has since changed (see `$default` handling in `lib/blueprint.import.ts`).
 */
const $default = (value: unknown) => ({ $default: value })

export interface TemplateNode {
  type: string
  data: Record<string, unknown>
}

export interface Template {
  resources: Record<string, TemplateNode>
}

const BACKSTORY = `## Role & Mission

You are a Factory agent - an autonomous engineering agent operating across a connected GitHub organisation. Your job is to carry out well-scoped operational tasks against the organisation's repositories: create and evolve repositories, write and ship code, triage issues, review and shepherd pull requests, audit dependencies, and keep documentation honest.

You are driven by **tasks** - each is either a recurring responsibility on a schedule or a one-off job to run once. Read the task's description carefully; it is your objective for the run.

## GitHub access

The organisation is connected via a **GitHub App installation**. You have two GitHub tools:

- **Call GitHub API** - make authenticated REST calls to any endpoint (issues, pull requests, repositories, ...), bounded by the App's permissions and installed repositories. Use this for most GitHub work.
- **Create GitHub Repository Token** - mint a short-lived, repository-scoped installation access token to hand to git/CLI in your shell (clone, push). Use this only when you need raw git.

Then operate in the shell, e.g. \`git clone https://x-access-token:$TOKEN@github.com/OWNER/REPO\`. **Never print a token, never write it to a file, never commit it.**

## Shell

You have a sandbox with a bash shell (plus common runtimes) and network access - install your shell tools when you need them. Use it to clone repositories, run analysers, run tests, and prepare diffs.

## Research

Use web search and fetch to check upstream advisories, changelogs, and library docs before acting.

## Workspace & tasks

Your workspace holds operating playbooks (scope, standards) - read them at the start of every task and keep them current. You can create follow-up tasks for yourself to split a large job or establish a standing check.

## Operating rules

- **Read before you write.** Never open a pull request or push a change you have not reproduced or verified.
- **Small, reviewable changes.** One concern per pull request, clear title, description states the why.
- **Never force-push, never delete branches or repositories, never rewrite history** unless a task explicitly authorises a specific such operation.
- **Finish or hand off.** Summarise what you did and what remains; if blocked, say so clearly.

## Tone & style

Precise, evidence-based, concise. Link to the specific commits, issues, and pull requests you acted on.`

/**
 * Builds the factory blueprint template for a given factory alias.
 */
export function buildTemplate(factory: string): Template {
  const alias = factoryAliases(factory)

  return {
    resources: {
      '#bot:::factorybot': {
        type: 'bot',
        data: {
          alias: alias.bot,
          datasetId: null,
          skillsetId: '#skillset:::factoryskill',
          name: 'Factory Agent',
          description: '',
          backstory: BACKSTORY,
          // @note seed-only default - written on create, preserved on re-apply
          // so the user's choice in Settings survives. Keep it a valid catalogue
          // id (an unrecognised model 500s bot display, ).
          model: $default('glm-5.2'),
          privacy: false,
          moderation: false,
          visibility: 'private',
          meta: null,
        },
      },

      '#skillset:::factoryskill': {
        type: 'skillset',
        data: {
          alias: alias.skillset,
          name: 'Factory Skillset',
          description: '',
          state: 'enabled',
          visibility: 'private',
          meta: null,
        },
      },

      '#space:::factoryspace': {
        type: 'space',
        data: {
          alias: alias.workspace,
          contactId: null,
          name: 'Factory Workspace',
          description: '',
          meta: null,
        },
      },

      // --- GitHub App integration (holds the credentials; blank until Settings) ---

      '#githubIntegration:::factorygh': {
        type: 'githubIntegration',
        data: {
          alias: alias.github,
          botId: '#bot:::factorybot',
          name: 'Factory',
          description: '',
          // seed-only: blank on create, preserved on re-apply (set in Settings).
          appId: $default(''),
          privateKey: '',
          webhookSecret: '',
          contactCollection: false,
          sessionDuration: null,
          meta: null,
        },
      },

      // --- GitHub tools (reference the integration directly, by token) ---

      '#ability:::factoryghapi': {
        type: 'ability',
        data: {
          alias: `${factory}-ability-github-api`,
          skillsetId: '#skillset:::factoryskill',
          linkedSecretId: null,
          linkedFileId: null,
          linkedBotId: null,
          linkedSpaceId: null,
          name: 'Call GitHub API',
          description:
            'Makes an authenticated call to any GitHub REST API endpoint. Bounded by the App permissions and installed repositories.',
          instruction: `template: github/api/call[by-id]
params:
  githubIntegrationId: '#githubIntegration:::factorygh'
  method: ''
  path: ''`,
          state: 'enabled',
          meta: {},
        },
      },

      '#ability:::factoryghtoken': {
        type: 'ability',
        data: {
          alias: `${factory}-ability-github-token`,
          skillsetId: '#skillset:::factoryskill',
          linkedSecretId: null,
          linkedFileId: null,
          linkedBotId: null,
          linkedSpaceId: null,
          name: 'Create GitHub Repository Token',
          description:
            'Mints a short-lived installation access token scoped to a repository, for handing to a CLI or git client.',
          instruction: `template: github/repository/token/create[by-id]
params:
  githubIntegrationId: '#githubIntegration:::factorygh'
  repository: ''`,
          state: 'enabled',
          meta: {},
        },
      },

      // --- shell (installed into the conversation; bound to the workspace) ---

      '#ability:::factoryshell': {
        type: 'ability',
        data: {
          alias: `${factory}-ability-shell`,
          skillsetId: '#skillset:::factoryskill',
          linkedSecretId: null,
          linkedFileId: null,
          linkedBotId: null,
          linkedSpaceId: '#space:::factoryspace',
          name: 'Install Shell Tools',
          description:
            'Installs shell tools into the conversation to execute commands and scripts.',
          instruction: 'template: "pack/shell"',
          state: 'enabled',
          meta: {},
        },
      },

      // --- research ---

      '#ability:::factorysearchweb': {
        type: 'ability',
        data: {
          alias: `${factory}-ability-search-web`,
          skillsetId: '#skillset:::factoryskill',
          linkedSecretId: null,
          linkedFileId: null,
          linkedBotId: null,
          linkedSpaceId: null,
          name: 'Search Web',
          description: 'Search the web for specific keywords.',
          instruction: 'template: "search/web"',
          state: 'enabled',
          meta: {},
        },
      },

      '#ability:::factoryfetchweb': {
        type: 'ability',
        data: {
          alias: `${factory}-ability-fetch-web`,
          skillsetId: '#skillset:::factoryskill',
          linkedSecretId: null,
          linkedFileId: null,
          linkedBotId: null,
          linkedSpaceId: null,
          name: 'Fetch Web Page',
          description:
            'Fetch the content of a web page using a URL and convert it to text.',
          instruction: 'template: "fetch/text/get"',
          state: 'enabled',
          meta: {},
        },
      },

      // --- workspace: playbooks (same space the UI edits) ---

      '#ability:::factoryspacerw': {
        type: 'ability',
        data: {
          alias: `${factory}-ability-space-rw`,
          skillsetId: '#skillset:::factoryskill',
          linkedSecretId: null,
          linkedFileId: null,
          linkedBotId: null,
          linkedSpaceId: '#space:::factoryspace',
          name: 'Read/Write Space Storage File',
          description:
            'Read or write content to a file in the space storage. Use mode "read" to read, or "write" to write.',
          instruction: 'template: "space/storage/rw"',
          state: 'enabled',
          meta: {},
        },
      },

      // --- self-scheduling ---

      '#ability:::factorytaskcreate': {
        type: 'ability',
        data: {
          alias: `${factory}-ability-task-create`,
          skillsetId: '#skillset:::factoryskill',
          linkedSecretId: null,
          linkedFileId: null,
          linkedBotId: null,
          linkedSpaceId: null,
          name: 'Create Task',
          description:
            'Create a task for yourself - run now, at a specific date-time, or on a recurring schedule.',
          instruction: 'template: "task/create"',
          state: 'enabled',
          meta: {},
        },
      },
    },
  }
}
