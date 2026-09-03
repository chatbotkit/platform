/**
 * @jest-environment node
 *
 * Drift guard for blueprint resource deletion.
 *
 * When a blueprint is deleted with `deleteResources: true`, EVERY model that
 * declares a `blueprint` relation must actually be removed - otherwise a
 * newly-added integration silently leaks its rows (orphaned via `SetNull`).
 *
 * Rather than trust a hand-maintained list, this test RUNS `deleteBlueprint`
 * against a recording prisma mock (with the real bot/dataset/skillset/space
 * delete helpers) and records which models had `delete`/`deleteMany` called. It
 * then reads schema.prisma for the authoritative set of `blueprint` relations
 * and asserts each one was reached - unless the database removes it via
 * `onDelete: Cascade`, or it is a documented intentional orphan.
 *
 * Add an integration and forget to delete it, and this test - not production -
 * tells you.
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { deleteBlueprint } from './blueprint.delete'

import fs from 'fs'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

// @note only the external store is mocked - the real bot/dataset/skillset/space
// helpers run so their prisma delete calls are recorded. getStore is what
// deleteDataset reaches out to; everything else stays real.
jest.mock('./store.types', () => ({
  getStore: jest.fn().mockResolvedValue({ deleteDataset: jest.fn() }),
}))

// @note the schema lives in the installed database module now - resolving it
// through the package name keeps this test working whichever module is
// installed
const SCHEMA_PATH = require.resolve('@chatbotkit-dev/db/schema')

/**
 * SetNull blueprint relations we deliberately leave in place (the row survives,
 * its `blueprintId` is nulled). `Context` is per-contact runtime memory, not a
 * template resource. This is the ONLY thing that must be declared by hand -
 * "deliberately kept" is a human decision a test cannot infer from a delete not
 * happening.
 */
const INTENTIONALLY_ORPHANED = ['context']

/**
 * Prisma lowercases only the first character of a model name to form the client
 * delegate (e.g. `OAuthConnection` -> `oAuthConnection`).
 */
function toDelegate(model) {
  return model.charAt(0).toLowerCase() + model.slice(1)
}

/**
 * Parse schema.prisma and return `{ [model]: onDeleteMode }` for every model
 * that declares a `blueprint Blueprint(?) @relation(...)` field.
 */
function parseBlueprintRelations(schema) {
  const relations = {}

  let currentModel = null

  for (const rawLine of schema.split('\n')) {
    const line = rawLine.trim()

    if (line.startsWith('//')) {
      continue
    }

    const modelMatch = rawLine.match(/^model\s+(\w+)\s*\{/)

    if (modelMatch) {
      currentModel = modelMatch[1]

      continue
    }

    if (currentModel && rawLine.startsWith('}')) {
      currentModel = null

      continue
    }

    if (!currentModel) {
      continue
    }

    const relationMatch = line.match(
      /^blueprint\s+Blueprint\??\s+@relation\(.*onDelete:\s*(\w+)/
    )

    if (relationMatch) {
      relations[currentModel] = relationMatch[1]
    }
  }

  return relations
}

describe('blueprint delete coverage', () => {
  const relations = parseBlueprintRelations(
    fs.readFileSync(SCHEMA_PATH, 'utf8')
  )

  // models whose delete/deleteMany was reached during the run below
  const reached = new Set()

  beforeAll(async () => {
    mockReset(prisma)
    reached.clear()

    // record every delete/deleteMany on the (proxied) transaction client,
    // across the main transaction AND the helpers' own transactions
    const recordingTx = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === '$executeRaw') {
            return () => Promise.resolve()
          }

          if (typeof prop !== 'string') {
            return undefined
          }

          return {
            // helpers null the relation scalar on Conversation before deleting;
            // updateMany is not a delete, so it is recorded as reached-noop
            updateMany: () => Promise.resolve({ count: 0 }),
            delete: () => {
              reached.add(prop)

              return Promise.resolve()
            },
            deleteMany: () => {
              reached.add(prop)

              return Promise.resolve()
            },
          }
        },
      }
    )

    prisma.$transaction.mockImplementation(async (callback) =>
      callback(recordingTx)
    )

    // the helpers only delete when the resource actually exists, so return a
    // stub for every fetch the delete performs
    for (const model of Object.keys(relations)) {
      const delegate = toDelegate(model)

      prisma[delegate]?.findMany?.mockResolvedValue?.([{ id: `${delegate}-1` }])
    }

    // deleteDataset fetches the record (with its store) before deleting
    prisma.dataset.findUnique.mockResolvedValue({
      id: 'dataset-1',
    })

    await deleteBlueprint(
      { id: 'blueprint-1', userId: 'user-1' },
      { deleteResources: true }
    )
  })

  it('parses a sane, non-empty set of blueprint relations from the schema', () => {
    // sanity: guards against a broken parser silently passing everything
    expect(Object.keys(relations).length).toBeGreaterThan(20)
    expect(relations.Bot).toBe('SetNull')
    expect(relations.HubBlueprintPage).toBe('Cascade')
  })

  it('actually reached a delete for a non-trivial number of models', () => {
    // guards against a mock that silently short-circuits the whole run
    expect(reached.size).toBeGreaterThan(25)
  })

  it('deletes every blueprint-related model (or DB-cascades / intentionally orphans it)', () => {
    const leaks = []

    for (const [model, mode] of Object.entries(relations)) {
      const delegate = toDelegate(model)

      // the database removes these for us when the blueprint row is deleted
      if (mode === 'Cascade') {
        continue
      }

      // deliberately preserved as standalone data
      if (INTENTIONALLY_ORPHANED.includes(delegate)) {
        continue
      }

      if (!reached.has(delegate)) {
        leaks.push(delegate)
      }
    }

    expect({
      hint: 'these blueprint-scoped models are not deleted on deleteResources; add a tx.<model>.deleteMany (or a helper) in deleteBlueprint, or add to INTENTIONALLY_ORPHANED with a reason',
      leaks,
    }).toEqual({
      hint: expect.any(String),
      leaks: [],
    })
  })

  it('reached the previously-missing integrations, objects and oauth', () => {
    // regression: these were orphaned before the gap was closed
    for (const delegate of [
      'githubIntegration',
      'microsoftteamsIntegration',
      'googlechatIntegration',
      'instagramIntegration',
      'avatarIntegration',
      'anamIntegration',
      'recallIntegration',
      'oAuthConnection',
      'space',
      'task',
      'policy',
    ]) {
      expect(reached.has(delegate)).toBe(true)
    }
  })

  it('the intentional orphans are real SetNull relations that we never delete', () => {
    for (const delegate of INTENTIONALLY_ORPHANED) {
      const model = Object.keys(relations).find(
        (m) => toDelegate(m) === delegate
      )

      // it must genuinely be a blueprint relation...
      expect(model).toBeDefined()
      // ...that is SetNull (not a Cascade we mislabelled)...
      expect(relations[model]).not.toBe('Cascade')
      // ...and we really do leave it alone
      expect(reached.has(delegate)).toBe(false)
    }
  })
})
