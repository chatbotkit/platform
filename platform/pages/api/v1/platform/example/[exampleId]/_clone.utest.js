/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

// @note the example catalogue is swapped per test by mutating this array in
// place - the handler holds the same reference through its default import
const mockExamples = []

jest.mock('@/examples', () => ({
  __esModule: true,
  default: mockExamples,
}))

jest.mock('@/prisma/client', () => {
  const client = {
    blueprint: { create: jest.fn(), update: jest.fn() },
    bot: { create: jest.fn() },
    skillset: { create: jest.fn() },
    space: { create: jest.fn() },
    ability: { create: jest.fn() },
    secret: { create: jest.fn() },
    dataset: { create: jest.fn() },
    file: { create: jest.fn() },
    triggerIntegration: { create: jest.fn() },
    widgetIntegration: { create: jest.fn() },
  }

  // @note the blueprint path now writes through the import engine, inside one
  // transaction. Running the callback against the same client keeps every
  // assertion below on `prisma.<model>.create`, and still exercises the real
  // atomicity contract: a throw anywhere aborts the whole clone.
  client.$transaction = (fn) => fn(client)

  return { __esModule: true, default: client }
})

const uploadStorageFile = jest.fn()

jest.mock('@/lib/space.storage', () => ({
  __esModule: true,
  uploadStorageFile: (...args) => uploadStorageFile(...args),
}))

const uploadFileObject = jest.fn()

jest.mock('@/lib/file.storage', () => ({
  __esModule: true,
  uploadFileObject: (...args) => uploadFileObject(...args),
}))

// @note wrappers are pass-throughs so `handler` is the raw (req, session, body) fn
jest.mock('@/lib/method', () => ({ withPost: (fn) => fn }))
jest.mock('@/lib/session.handler', () => ({ withSession: (fn) => fn }))
jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: { object: jest.fn().mockReturnThis() },
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: (req, name) => req.query[name],
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  unprocessableEntity: (message) => ({ status: 422, body: message }),
  conflict: () => ({ status: 409 }),
}))

// @note the import engine reports a malformed catalogue entry by capturing and
// returning 409; stub the capture so a deliberate failure does not page anyone
jest.mock('@/lib/error', () => {
  const actual = jest.requireActual('@/lib/error')

  return { ...actual, captureException: jest.fn() }
})

// @note only used by the legacy (non-blueprint) path; stubbed so imports resolve
jest.mock('@/lib/store.types', () => ({ getStore: jest.fn() }))
jest.mock('@/lib/record', () => ({ createRecord: jest.fn() }))

// @note real topologicalSort, nameToType and UnexpectedStateError - ordering,
// content-type derivation and the heading-vs-reference distinction are the
// behaviour under test, not something to fake

const mockSession = { user: { id: 'user-1' } }

// @note required lazily (after the mock consts above are initialized) so the
// `@/examples` factory can safely read `mockExamples`
let handler

function reqFor(slug) {
  return { query: { exampleId: slug } }
}

function setExamples(...examples) {
  mockExamples.length = 0
  mockExamples.push(...examples)
}

// A blueprint example exercising the three things that can go wrong on clone:
// a reference placeholder (bot -> skillset), a backstory full of markdown
// headings (must not read as references), and a space carrying seed `$files`.
function blueprintExample() {
  return {
    slug: 'test-example',
    title: 'Test Example',
    description: 'Test Description',
    blueprint: {
      resources: {
        '#skillset:::abc123': {
          type: 'skillset',
          data: { name: 'My Skillset', description: 'A skillset' },
        },
        '#space:::sp1': {
          type: 'space',
          data: {
            name: 'My Space',
            description: '',
            $files: [
              { path: '.skills/demo/SKILL.md', content: '# hi' },
              { path: '.skills/demo/run.py', content: 'print(1)' },
            ],
          },
        },
        '#bot:::def456': {
          type: 'bot',
          data: {
            name: 'My Bot',
            description: 'A bot',
            // @note markdown headings starting with '#' must NOT be detected as
            // unresolved references
            backstory:
              '# PRIMARY IDENTITY SECTION\nYou are an assistant.\n## Rules\nBe helpful.',
            skillsetId: '#skillset:::abc123',
          },
        },
      },
      positions: {
        '#bot:::def456': { x: 1, y: 2 },
        '#skillset:::abc123': { x: 3, y: 4 },
        '#space:::sp1': { x: 5, y: 6 },
      },
      notes: {},
    },
  }
}

const createAs = (id) => (args) =>
  Promise.resolve({
    id,
    name: args.data.name ?? '',
    description: args.data.description ?? '',
  })

beforeEach(() => {
  jest.clearAllMocks()

  handler = require('./clone').default

  setExamples(blueprintExample())

  prisma.blueprint.create.mockResolvedValue({
    id: 'blueprint-1',
    name: 'Test Example',
    description: 'Test Description',
  })
  prisma.blueprint.update.mockResolvedValue({})

  prisma.skillset.create.mockImplementation(createAs('skillset-1'))
  prisma.space.create.mockImplementation(createAs('space-1'))
  prisma.bot.create.mockImplementation(createAs('bot-1'))
  prisma.dataset.create.mockImplementation(createAs('dataset-1'))
  prisma.ability.create.mockImplementation(createAs('ability-1'))
  prisma.secret.create.mockImplementation(createAs('secret-1'))
  prisma.file.create.mockImplementation(createAs('file-1'))
  prisma.triggerIntegration.create.mockImplementation(createAs('trigger-1'))
  prisma.widgetIntegration.create.mockImplementation(createAs('widget-1'))
})

describe('platform example clone', () => {
  describe('guards', () => {
    it('returns 404 when the example slug is unknown', async () => {
      const result = await handler(reqFor('does-not-exist'), mockSession, {})

      expect(result).toEqual({ status: 404 })
      expect(prisma.blueprint.create).not.toHaveBeenCalled()
    })

    it('rejects a project example (files array) with a 422', async () => {
      // @note 422, not 400 - the request is well formed and the slug is a real,
      // listed example. It is the entry that cannot be cloned, not the request
      // that is malformed, and no fix to the request would make it succeed.
      setExamples({
        slug: 'a-project',
        title: 'Project',
        description: '',
        files: [{ path: 'index.js', content: '' }],
      })

      const result = await handler(reqFor('a-project'), mockSession, {})

      expect(result.status).toBe(422)
      expect(prisma.blueprint.create).not.toHaveBeenCalled()
    })

    it('rejects a hub example rather than cloning nothing into an empty bot', async () => {
      // @note a hub example points at a published hub page and carries no
      // blueprint, backstory or model of its own. Without the guard it falls
      // through to the legacy path, which would create a project holding a bot
      // with an empty backstory and an empty model - both columns default to
      // '', so nothing would throw and the caller would get silent junk.
      setExamples({
        slug: 'coder',
        title: 'Agentic Coder',
        description: 'An autonomous coding agent.',
        hub: { type: 'blueprint', ref: 'coder' },
      })

      const result = await handler(reqFor('coder'), mockSession, {})

      expect(result.status).toBe(422)
      expect(result.body).toContain('/hub/blueprints/coder')

      expect(prisma.blueprint.create).not.toHaveBeenCalled()
      expect(prisma.bot.create).not.toHaveBeenCalled()
    })
  })

  describe('blueprint clone', () => {
    it('creates the blueprint and every resource under the caller', async () => {
      const result = await handler(reqFor('test-example'), mockSession, {})

      expect(result.status).toBe(200)

      expect(prisma.blueprint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Test Example',
            userId: 'user-1',
          }),
        })
      )

      for (const model of ['skillset', 'space', 'bot']) {
        expect(prisma[model].create).toHaveBeenCalledTimes(1)
        expect(prisma[model].create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              blueprintId: 'blueprint-1',
              userId: 'user-1',
            }),
          })
        )
      }

      expect(result.body.resources.blueprint[0].id).toBe('blueprint-1')
      expect(result.body.resources.bot[0].id).toBe('bot-1')
    })

    it('rewires a reference placeholder to the freshly created id', async () => {
      await handler(reqFor('test-example'), mockSession, {})

      // the bot's `#skillset:::abc123` placeholder resolves to the created id
      expect(prisma.bot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ skillsetId: 'skillset-1' }),
        })
      )
    })

    it('does not treat backstory markdown headings as unresolved references', async () => {
      // a `#`-prefixed heading must not throw an UnexpectedStateError
      await expect(
        handler(reqFor('test-example'), mockSession, {})
      ).resolves.toMatchObject({ status: 200 })
    })

    it('seeds the space $files into storage with a name-derived content type', async () => {
      await handler(reqFor('test-example'), mockSession, {})

      expect(uploadStorageFile).toHaveBeenCalledTimes(2)
      expect(uploadStorageFile).toHaveBeenCalledWith({
        spaceId: 'space-1',
        path: '.skills/demo/SKILL.md',
        body: '# hi',
        contentType: 'text/markdown',
      })
      expect(uploadStorageFile).toHaveBeenCalledWith({
        spaceId: 'space-1',
        path: '.skills/demo/run.py',
        body: 'print(1)',
        contentType: 'text/plain',
      })
    })

    it('strips $files from the space create payload (not a persisted column)', async () => {
      await handler(reqFor('test-example'), mockSession, {})

      const { data } = prisma.space.create.mock.calls[0][0]

      expect(data).not.toHaveProperty('$files')
      expect(data).toEqual(
        expect.objectContaining({
          name: 'My Space',
          blueprintId: 'blueprint-1',
        })
      )
    })

    it('does not touch storage when the space has no $files', async () => {
      const example = blueprintExample()

      delete example.blueprint.resources['#space:::sp1'].data.$files

      setExamples(example)

      await handler(reqFor('test-example'), mockSession, {})

      expect(prisma.space.create).toHaveBeenCalledTimes(1)
      expect(uploadStorageFile).not.toHaveBeenCalled()
    })

    it('remaps canvas positions from placeholder ids onto the created ids', async () => {
      await handler(reqFor('test-example'), mockSession, {})

      expect(prisma.blueprint.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'blueprint-1' },
          data: {
            config: {
              positions: {
                'bot-1': { x: 1, y: 2 },
                'skillset-1': { x: 3, y: 4 },
                'space-1': { x: 5, y: 6 },
              },
              notes: {},
            },
          },
        })
      )
    })
  })

  describe('scheduled triggers', () => {
    // @note the regression this suite exists for. A trigger node used to be
    // written with a bare `prisma.create` inside a swallow-all catch: it carried
    // an authored `triggerPrompt` (not a column) and no `secret` (required), so
    // the create threw and the trigger silently never existed. It must now be
    // created - and must land dormant, because an example is authored by us and
    // the account cloning it never asked for a cron.
    function triggerExample(data) {
      return {
        slug: 'trigger-example',
        title: 'Trigger Example',
        description: '',
        blueprint: {
          resources: {
            '#bot:::b1': { type: 'bot', data: { name: 'Bot' } },
            '#triggerIntegration:::t1': {
              type: 'triggerIntegration',
              data: {
                name: 'Daily Sweep',
                description: 'Wake up and sweep.',
                botId: '#bot:::b1',
                schedule: '0 8 * * *',
                timezone: 'Europe/London',
                ...data,
              },
            },
          },
          positions: {},
          notes: {},
        },
      }
    }

    it('creates the trigger instead of silently dropping it', async () => {
      setExamples(triggerExample())

      const result = await handler(reqFor('trigger-example'), mockSession, {})

      expect(result.status).toBe(200)
      expect(prisma.triggerIntegration.create).toHaveBeenCalledTimes(1)
      expect(result.body.resources.triggerIntegration[0].id).toBe('trigger-1')
    })

    it('clones the trigger dormant, keeping the timezone', async () => {
      setExamples(triggerExample())

      await handler(reqFor('trigger-example'), mockSession, {})

      const { data } = prisma.triggerIntegration.create.mock.calls[0][0]

      // @note nulling `schedule` is the only thing that stops the sweeps: they
      // select on it, and a named interval fires off `lastTriggerAt` without
      // ever consulting `nextTriggerAt`
      expect(data.schedule).toBeNull()
      expect(data.timezone).toBe('Europe/London')
    })

    it('mints the trigger secret the catalogue cannot carry', async () => {
      setExamples(triggerExample())

      await handler(reqFor('trigger-example'), mockSession, {})

      const { data } = prisma.triggerIntegration.create.mock.calls[0][0]

      // @note `secret` is required and no example ships one - the create used to
      // throw on exactly this and be swallowed
      expect(data.secret).toEqual(expect.any(String))
      expect(data.secret.length).toBeGreaterThan(0)
    })

    it('drops an authored field that is not a column rather than failing', async () => {
      // @note a stale catalogue entry must not take the whole clone down; the
      // engine validates it away, and examples/catalogue.utest.ts is what stops
      // one being authored in the first place
      setExamples(triggerExample({ triggerPrompt: 'do the thing' }))

      const result = await handler(reqFor('trigger-example'), mockSession, {})

      expect(result.status).toBe(200)

      const { data } = prisma.triggerIntegration.create.mock.calls[0][0]

      expect(data).not.toHaveProperty('triggerPrompt')
    })
  })

  describe('file contents', () => {
    it('seeds $text into the new file object storage', async () => {
      setExamples({
        slug: 'file-example',
        title: 'File Example',
        description: '',
        blueprint: {
          resources: {
            '#file:::f1': {
              type: 'file',
              data: {
                name: 'HEARTBEAT.md',
                description: 'The checklist.',
                $text: '# HEARTBEAT\n',
              },
            },
          },
          positions: {},
          notes: {},
        },
      })

      const result = await handler(reqFor('file-example'), mockSession, {})

      expect(result.status).toBe(200)

      // @note a File row has no body column - without this the content an
      // example ships would have nowhere to land
      expect(uploadFileObject).toHaveBeenCalledWith('file-1', '# HEARTBEAT\n', {
        contentType: 'text/markdown',
      })

      const { data } = prisma.file.create.mock.calls[0][0]

      expect(data).not.toHaveProperty('$text')
    })
  })

  describe('oauth connections', () => {
    it('skips the reference-only node and still clones the rest', async () => {
      // @note oauth connections hold third-party tokens and are never copied.
      // The node is dropped and the clone policy nulls the reference to it, so
      // the example still materialises rather than failing on an unknown category.
      setExamples({
        slug: 'oauth-example',
        title: 'OAuth Example',
        description: '',
        blueprint: {
          resources: {
            '#oAuthConnection:::o1': {
              type: 'oAuthConnection',
              data: { name: 'Google Workspace Login', issuer: 'https://x' },
            },
            '#bot:::b1': { type: 'bot', data: { name: 'Bot' } },
          },
          positions: {},
          notes: {},
        },
      })

      const result = await handler(reqFor('oauth-example'), mockSession, {})

      expect(result.status).toBe(200)
      expect(result.body.resources).not.toHaveProperty('oAuthConnection')
      expect(prisma.bot.create).toHaveBeenCalledTimes(1)
    })
  })

  describe('legacy (non-blueprint) clone', () => {
    it('wraps a widget example in a blueprint named after the example', async () => {
      setExamples({
        slug: 'legacy-widget',
        title: 'Legacy Widget',
        description: 'A widget example',
        backstory: 'You are helpful.',
        model: 'gpt-4',
        theme: 'default',
        intro: 'Hi',
      })

      const result = await handler(reqFor('legacy-widget'), mockSession, {})

      expect(result.status).toBe(200)

      expect(prisma.blueprint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Legacy Widget',
            description: 'A widget example',
            userId: 'user-1',
          }),
        })
      )

      expect(prisma.bot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ blueprintId: 'blueprint-1' }),
        })
      )

      expect(prisma.widgetIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            botId: 'bot-1',
            blueprintId: 'blueprint-1',
          }),
        })
      )

      expect(result.body.resources.blueprint[0].id).toBe('blueprint-1')
      expect(result.body.resources.bot[0].id).toBe('bot-1')
      expect(result.body.resources.widgetIntegration[0].id).toBe('widget-1')
    })

    it('assigns every legacy resource (dataset, skillset, ability, secret) to the blueprint', async () => {
      setExamples({
        slug: 'legacy-full',
        title: 'Legacy Full',
        description: 'A full legacy example',
        backstory: 'You are helpful.',
        model: 'gpt-4',
        dataset: { name: 'My Dataset', description: '', records: [] },
        skillset: {
          name: 'My Skillset',
          description: '',
          abilities: [{ name: 'a', description: '', instruction: 'do a' }],
        },
        secrets: [{ name: 's', description: '', value: 'v' }],
      })

      const result = await handler(reqFor('legacy-full'), mockSession, {})

      expect(result.status).toBe(200)

      for (const model of ['dataset', 'skillset', 'ability', 'secret', 'bot']) {
        expect(prisma[model].create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              blueprintId: 'blueprint-1',
              userId: 'user-1',
            }),
          })
        )
      }

      expect(result.body.resources.blueprint[0].id).toBe('blueprint-1')
    })
  })
})
