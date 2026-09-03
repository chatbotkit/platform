import {
  githubSenderIsAllowed,
  parseGithubAllowFrom,
} from './github.validation'

describe('parseGithubAllowFrom', () => {
  it('parses empty input', () => {
    expect(parseGithubAllowFrom('')).toEqual([])
    expect(parseGithubAllowFrom('   ')).toEqual([])
    expect(parseGithubAllowFrom('\n\n')).toEqual([])
  })

  it('parses wildcard', () => {
    expect(parseGithubAllowFrom('*')).toEqual([{ type: 'wildcard' }])
  })

  it('parses the reserved collaborators token', () => {
    expect(parseGithubAllowFrom('@collaborators')).toEqual([
      { type: 'collaborators' },
    ])
  })

  it('parses the collaborators token case-insensitively', () => {
    expect(parseGithubAllowFrom('@COLLABORATORS')).toEqual([
      { type: 'collaborators' },
    ])
  })

  it('treats a bare `collaborators` as a login, not the reserved token', () => {
    expect(parseGithubAllowFrom('collaborators')).toEqual([
      { type: 'login', login: 'collaborators' },
    ])
  })

  it('parses prefixed logins', () => {
    expect(parseGithubAllowFrom('@octocat')).toEqual([
      { type: 'login', login: 'octocat' },
    ])
  })

  it('parses bare logins', () => {
    expect(parseGithubAllowFrom('octocat')).toEqual([
      { type: 'login', login: 'octocat' },
    ])
  })

  it('lowercases logins', () => {
    expect(parseGithubAllowFrom('@OctoCat')).toEqual([
      { type: 'login', login: 'octocat' },
    ])
  })

  it('parses logins containing hyphens', () => {
    expect(parseGithubAllowFrom('@octo-cat')).toEqual([
      { type: 'login', login: 'octo-cat' },
    ])
  })

  it('parses an owner wildcard', () => {
    expect(parseGithubAllowFrom('chatbotkit/*')).toEqual([
      { type: 'owner', owner: 'chatbotkit' },
    ])
  })

  it('parses a specific repository', () => {
    expect(parseGithubAllowFrom('chatbotkit/docs')).toEqual([
      { type: 'repo', owner: 'chatbotkit', repo: 'docs' },
    ])
  })

  it('parses repositories with dots and underscores', () => {
    expect(parseGithubAllowFrom('chatbotkit/my_repo.js')).toEqual([
      { type: 'repo', owner: 'chatbotkit', repo: 'my_repo.js' },
    ])
  })

  it('splits on commas and newlines', () => {
    expect(
      parseGithubAllowFrom('@octocat,chatbotkit/*\n@collaborators')
    ).toEqual([
      { type: 'login', login: 'octocat' },
      { type: 'owner', owner: 'chatbotkit' },
      { type: 'collaborators' },
    ])
  })

  it('trims surrounding whitespace', () => {
    expect(parseGithubAllowFrom('  @octocat  ,  chatbotkit/docs  ')).toEqual([
      { type: 'login', login: 'octocat' },
      { type: 'repo', owner: 'chatbotkit', repo: 'docs' },
    ])
  })

  it('skips invalid entries', () => {
    expect(parseGithubAllowFrom('@')).toEqual([])
    expect(parseGithubAllowFrom('-bad')).toEqual([])
    expect(parseGithubAllowFrom('bad-')).toEqual([])
    expect(parseGithubAllowFrom('has space')).toEqual([])
    expect(parseGithubAllowFrom('a/b/c')).toEqual([])
    expect(parseGithubAllowFrom('@user@host')).toEqual([])
  })

  it('skips invalid entries but keeps valid neighbours', () => {
    expect(parseGithubAllowFrom('@octocat,has space,chatbotkit/*')).toEqual([
      { type: 'login', login: 'octocat' },
      { type: 'owner', owner: 'chatbotkit' },
    ])
  })

  it('rejects a login longer than 39 characters', () => {
    expect(parseGithubAllowFrom(`@${'a'.repeat(40)}`)).toEqual([])
    expect(parseGithubAllowFrom(`@${'a'.repeat(39)}`)).toEqual([
      { type: 'login', login: 'a'.repeat(39) },
    ])
  })
})

describe('githubSenderIsAllowed', () => {
  const sender = {
    login: 'octocat',
    authorAssociation: 'NONE',
    owner: 'chatbotkit',
    repo: 'docs',
  }

  it('denies when the list is empty', () => {
    expect(githubSenderIsAllowed(sender, [])).toBe(false)
  })

  it('denies when the list is empty even for the repository owner', () => {
    expect(
      githubSenderIsAllowed({ ...sender, authorAssociation: 'OWNER' }, [])
    ).toBe(false)
  })

  it('allows anyone on a wildcard', () => {
    expect(githubSenderIsAllowed(sender, parseGithubAllowFrom('*'))).toBe(true)
  })

  it('allows a matching login', () => {
    expect(
      githubSenderIsAllowed(sender, parseGithubAllowFrom('@octocat'))
    ).toBe(true)
  })

  it('denies a non-matching login', () => {
    expect(
      githubSenderIsAllowed(sender, parseGithubAllowFrom('@someone-else'))
    ).toBe(false)
  })

  it('matches logins case-insensitively', () => {
    expect(
      githubSenderIsAllowed(
        { ...sender, login: 'OctoCat' },
        parseGithubAllowFrom('@octocat')
      )
    ).toBe(true)
  })

  it.each(['OWNER', 'MEMBER', 'COLLABORATOR'])(
    'allows %s on @collaborators',
    (authorAssociation) => {
      expect(
        githubSenderIsAllowed(
          { ...sender, authorAssociation },
          parseGithubAllowFrom('@collaborators')
        )
      ).toBe(true)
    }
  )

  it.each([
    'CONTRIBUTOR',
    'FIRST_TIME_CONTRIBUTOR',
    'FIRST_TIMER',
    'MANNEQUIN',
    'NONE',
  ])('denies %s on @collaborators', (authorAssociation) => {
    expect(
      githubSenderIsAllowed(
        { ...sender, authorAssociation },
        parseGithubAllowFrom('@collaborators')
      )
    ).toBe(false)
  })

  it('denies @collaborators when the association is missing', () => {
    expect(
      githubSenderIsAllowed(
        { ...sender, authorAssociation: undefined },
        parseGithubAllowFrom('@collaborators')
      )
    ).toBe(false)
  })

  it('allows any repository under a matching owner wildcard', () => {
    expect(
      githubSenderIsAllowed(sender, parseGithubAllowFrom('chatbotkit/*'))
    ).toBe(true)
  })

  it('denies a repository under a different owner', () => {
    expect(
      githubSenderIsAllowed(sender, parseGithubAllowFrom('someone-else/*'))
    ).toBe(false)
  })

  it('allows an exactly matching repository', () => {
    expect(
      githubSenderIsAllowed(sender, parseGithubAllowFrom('chatbotkit/docs'))
    ).toBe(true)
  })

  it('denies a different repository under the same owner', () => {
    expect(
      githubSenderIsAllowed(sender, parseGithubAllowFrom('chatbotkit/other'))
    ).toBe(false)
  })

  it('allows if any entry matches', () => {
    expect(
      githubSenderIsAllowed(
        sender,
        parseGithubAllowFrom('@nobody,someone-else/*,@octocat')
      )
    ).toBe(true)
  })

  it('denies when no entry matches', () => {
    expect(
      githubSenderIsAllowed(
        sender,
        parseGithubAllowFrom('@nobody,someone-else/*,@collaborators')
      )
    ).toBe(false)
  })

  it('denies when the list contains only invalid entries', () => {
    expect(
      githubSenderIsAllowed(sender, parseGithubAllowFrom('has space,@'))
    ).toBe(false)
  })
})
