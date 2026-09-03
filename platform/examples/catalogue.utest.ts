/**
 * @jest-environment node
 *
 * The catalogue is authored by hand, and every blueprint example is materialised
 * by the same import engine that clones a blueprint. That engine validates each
 * resource with the category's zod schema, and zod *strips* keys it does not
 * know rather than rejecting them - so a field that is not a real column does
 * not fail loudly, it silently never gets written.
 *
 * That is exactly how the catalogue came to ship 33 scheduled triggers whose
 * instructions lived in a `triggerPrompt` field that is not a column on any
 * model: the prompts went nowhere, and (before the endpoint was moved onto the
 * import engine) the triggers themselves failed to create and were swallowed.
 *
 * These tests make an unwritable field a build failure instead of a silent drop.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  categoryRegistry,
  parseCategoryArrayResources,
  planImportOrder,
} from '@/lib/blueprint.import'

import examplesData from '@/examples'

jest.mock('@/prisma/client', () => ({ __esModule: true, default: {} }))

jest.mock('@/lib/space.storage', () => ({
  __esModule: true,
  uploadStorageFile: jest.fn(),
}))

jest.mock('@/lib/file.storage', () => ({
  __esModule: true,
  uploadFileObject: jest.fn(),
}))

/**
 * The categories the example clone endpoint deliberately drops before importing.
 * OAuth connections hold third-party tokens: they are reference-only and are
 * never copied (the blueprint clone endpoint leaves them out of its buckets for
 * the same reason, and the import engine has no category for them).
 */
const SKIPPED_CATEGORIES = new Set(['oAuthConnection'])

type CatalogueNode = { type: string; data: Record<string, unknown> }

/** The field names a category's schema will actually persist. */
function writableFields(schema: unknown): Set<string> {
  // @note unwrap the .partial()/.omit() wrappers down to the object shape
  let s: any = schema

  while (s && !s.shape && s._def?.schema) {
    s = s._def.schema
  }

  return new Set<string>(s?.shape ? Object.keys(s.shape) : [])
}

const blueprintExamples = (examplesData as any[]).filter(
  (example) => example?.blueprint?.resources
)

/** Mirrors how the clone endpoint turns a catalogue entry into an import payload. */
function payloadFor(example: any): Record<string, Record<string, unknown>[]> {
  const payload: Record<string, Record<string, unknown>[]> = {}

  for (const [token, node] of Object.entries(
    example.blueprint.resources as Record<string, CatalogueNode>
  )) {
    if (SKIPPED_CATEGORIES.has(node.type)) {
      continue
    }

    payload[node.type] ||= []
    payload[node.type].push({ id: token, ...node.data })
  }

  return payload
}

describe('example catalogue', () => {
  it('has blueprint examples to check', () => {
    expect(blueprintExamples.length).toBeGreaterThan(0)
  })

  it.each(blueprintExamples.map((example) => [example.slug, example]))(
    '%s: every authored field is one the import engine can write',
    (_slug, example) => {
      const parsed = parseCategoryArrayResources(payloadFor(example))

      if (!parsed.ok) {
        throw new Error(
          `resources did not parse (${parsed.reason}): ${JSON.stringify(
            parsed.issues
          )}`
        )
      }

      const unwritable: string[] = []

      for (const node of parsed.nodesById.values()) {
        const entry = (categoryRegistry as Record<string, { schema: unknown }>)[
          node.category
        ]

        const allowed = writableFields(entry?.schema)

        for (const field of Object.keys(node.data)) {
          if (!allowed.has(field)) {
            // @note zod would strip this silently and the value would be lost
            unwritable.push(`${node.category}.${field}`)
          }
        }
      }

      expect([...new Set(unwritable)]).toEqual([])
    }
  )

  it.each(blueprintExamples.map((example) => [example.slug, example]))(
    '%s: resources form an importable graph',
    (_slug, example) => {
      const parsed = parseCategoryArrayResources(payloadFor(example))

      if (!parsed.ok) {
        throw new Error(`resources did not parse (${parsed.reason})`)
      }

      // @note throws on a cycle, and resolves the reference order the import
      // relies on - a catalogue entry that cannot be ordered cannot be cloned
      expect(() => planImportOrder(parsed.nodesById)).not.toThrow()
    }
  )

  it('uses a known category for every resource it ships', () => {
    const unknown = new Set<string>()

    for (const example of blueprintExamples) {
      for (const node of Object.values(
        example.blueprint.resources as Record<string, CatalogueNode>
      )) {
        if (SKIPPED_CATEGORIES.has(node.type)) {
          continue
        }

        if (!(categoryRegistry as Record<string, unknown>)[node.type]) {
          unknown.add(node.type)
        }
      }
    }

    expect([...unknown]).toEqual([])
  })

  // @note there is deliberately no "a scheduled trigger must carry instructions"
  // check here. When a trigger fires, the queue hands the model
  // `{ name, description, meta }` and tells it to execute the enclosed
  // instructions - but a bare wake-up trigger, whose logic lives entirely in the
  // bot's backstory, is a legitimate design and several examples use it. What
  // matters is that whatever the author *does* write lands in a real column,
  // which the field check above enforces.
})
