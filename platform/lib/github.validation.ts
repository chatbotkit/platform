/**
 * Represents a parsed entry from a GitHub allowFrom list.
 */
type AllowFromEntry =
  | { type: 'login'; login: string }
  | { type: 'owner'; owner: string }
  | { type: 'repo'; owner: string; repo: string }
  | { type: 'collaborators' }
  | { type: 'wildcard' }

/**
 * Mirrors the `GithubIntegration.allowFrom` column default so the settings form
 * can show what a new integration will get. The column is the source of truth -
 * keep this in step with schema.prisma.
 *
 * GitHub differs from the other channels in that an installed App receives
 * events from every actor who can comment - on a public repository that is
 * anyone with a GitHub account - so a wildcard default would let strangers
 * summon the bot on the owner's account.
 */
export const GITHUB_DEFAULT_ALLOW_FROM = '@collaborators'

/**
 * The reserved entry that matches by repository standing rather than by name.
 */
const COLLABORATORS_TOKEN = 'collaborators'

/**
 * The `author_association` values that count as repository standing.
 *
 * @note `CONTRIBUTOR` is deliberately excluded: it only means the actor has had
 * a pull request merged at some point, which is not a trust signal - a drive-by
 * contributor from years ago would qualify. `FIRST_TIME_CONTRIBUTOR`,
 * `MANNEQUIN` and `NONE` are likewise untrusted.
 */
const COLLABORATOR_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])

/**
 * Returns true if the string is a syntactically valid GitHub login.
 *
 * @note logins are alphanumeric with single hyphens, cannot begin or end with a
 * hyphen, and are at most 39 characters.
 */
function isGithubLogin(value: string): boolean {
  return /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(value)
}

/**
 * Returns true if the string is a syntactically valid GitHub repository name.
 */
function isGithubRepoName(value: string): boolean {
  return /^[a-z\d._-]{1,100}$/i.test(value)
}

/**
 * Parses a single allowFrom entry string into a structured form.
 *
 * Supported formats:
 * - `*`               - wildcard, allow all senders
 * - `@collaborators`  - anyone GitHub reports as OWNER, MEMBER or COLLABORATOR
 * - `@octocat`        - match by login (case-insensitive)
 * - `octocat`         - raw login, same as `@octocat`
 * - `chatbotkit/*`    - any repository under an owner
 * - `chatbotkit/docs` - one specific repository
 *
 * @note `@collaborators` is reserved. To allowlist a user whose login happens to
 * be `collaborators`, write it without the `@` prefix.
 *
 * @note login matching is advisory: GitHub logins can be renamed and a freed
 * login can be claimed by someone else. `@collaborators` and repository entries
 * lean on GitHub's own permission model and do not have that weakness.
 */
function parseAllowFromEntry(entry: string): AllowFromEntry | null {
  entry = entry.trim()

  if (!entry) {
    return null
  }

  if (entry === '*') {
    return { type: 'wildcard' }
  }

  if (entry.startsWith('@')) {
    const rest = entry.slice(1)

    if (!rest) {
      return null
    }

    if (rest.toLowerCase() === COLLABORATORS_TOKEN) {
      return { type: 'collaborators' }
    }

    if (isGithubLogin(rest)) {
      return { type: 'login', login: rest.toLowerCase() }
    }

    return null
  }

  if (entry.includes('/')) {
    const parts = entry.split('/')

    if (parts.length !== 2) {
      return null
    }

    const [owner, repo] = parts

    if (!isGithubLogin(owner)) {
      return null
    }

    if (repo === '*') {
      return { type: 'owner', owner: owner.toLowerCase() }
    }

    if (!isGithubRepoName(repo)) {
      return null
    }

    return {
      type: 'repo',
      owner: owner.toLowerCase(),
      repo: repo.toLowerCase(),
    }
  }

  if (isGithubLogin(entry)) {
    return { type: 'login', login: entry.toLowerCase() }
  }

  return null
}

/**
 * Parses the `allowFrom` field value (newline or comma-separated string)
 * into a list of structured entries. Invalid or blank entries are silently
 * skipped.
 */
export function parseGithubAllowFrom(input: string): AllowFromEntry[] {
  return input
    .split(/[\n,]+/)
    .map(parseAllowFromEntry)
    .filter((entry): entry is AllowFromEntry => entry !== null)
}

/**
 * Checks whether a summoning sender is permitted by the allowFrom list.
 *
 * - Empty list → deny all (secure by default; use `*` to allow everyone)
 * - Otherwise → allow if ANY entry matches the sender or the repository
 *
 * @param sender.login             The commenter's GitHub login
 * @param sender.authorAssociation The comment's `author_association`
 * @param sender.owner             The repository owner the event came from
 * @param sender.repo              The repository name the event came from
 * @param entries                  Parsed entries from `parseGithubAllowFrom`
 *
 * @note empty list means deny all - use '*' to explicitly allow everyone
 */
export function githubSenderIsAllowed(
  sender: {
    login?: string
    authorAssociation?: string
    owner?: string
    repo?: string
  },
  entries: AllowFromEntry[]
): boolean {
  const { login, authorAssociation, owner, repo } = sender

  if (entries.length === 0) {
    return false
  }

  return entries.some((entry) => {
    switch (entry.type) {
      case 'wildcard':
        return true

      case 'collaborators':
        return (
          authorAssociation !== undefined &&
          COLLABORATOR_ASSOCIATIONS.has(authorAssociation.toUpperCase())
        )

      case 'login':
        return login !== undefined && login.toLowerCase() === entry.login

      case 'owner':
        return owner !== undefined && owner.toLowerCase() === entry.owner

      case 'repo':
        return (
          owner !== undefined &&
          repo !== undefined &&
          owner.toLowerCase() === entry.owner &&
          repo.toLowerCase() === entry.repo
        )
    }
  })
}
