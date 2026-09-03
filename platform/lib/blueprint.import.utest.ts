/**
 * @jest-environment node
 */
import {
  ImportError,
  type ResourceNode,
  buildDependencies,
  categoryRegistry,
  deepEqual,
  findReusableBlueprintByResourceAliases,
  getEnsurableAlias,
  importBlueprintResources,
  nullifyUnresolvedReferences,
  parseCategoryArrayResources,
  parseExportDocument,
  planImportOrder,
  resolveEmbeddedTokenReferences,
  resolveImportPolicy,
} from './blueprint.import'

import {
  FULL_EXPORT_BUCKETS,
  exportResourceCategoryMap,
  exportResourceDocument,
} from './blueprint.export'

let cuidIndex = 0

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    blueprint: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/cuid', () => ({
  cuid: jest.fn(() => {
    cuidIndex += 1

    return `cuid-${cuidIndex}`
  }),
}))

const uploadStorageFile = jest.fn()

jest.mock('@/lib/space.storage', () => ({
  __esModule: true,
  uploadStorageFile: (...args: unknown[]) => uploadStorageFile(...args),
}))

const uploadFileObject = jest.fn()

jest.mock('@/lib/file.storage', () => ({
  __esModule: true,
  uploadFileObject: (...args: unknown[]) => uploadFileObject(...args),
}))

// @note an alias validator shaped like the joi `aliasSchema` the route passes
const aliasValidator = {
  validate: (alias: string) =>
    /^[a-z0-9-]+$/.test(alias) ? {} : { error: new Error('invalid') },
}

function nodesFrom(
  resources: Record<string, unknown>
): Map<string, ResourceNode> {
  const parsed = parseCategoryArrayResources(resources)

  if (!parsed.ok) {
    throw new Error(`expected ok parse, got ${parsed.reason}`)
  }

  return parsed.nodesById
}

beforeEach(() => {
  jest.clearAllMocks()
  cuidIndex = 0
})

describe('resolveImportPolicy', () => {
  it('maps each named policy to fixed knobs', () => {
    expect(resolveImportPolicy('sync')).toEqual({
      alias: 'upsert',
      refs: 'external',
      schedules: 'preserve',
    })
    expect(resolveImportPolicy('clone')).toEqual({
      alias: 'strip',
      refs: 'strip',
      schedules: 'disable',
    })
    expect(resolveImportPolicy('restore')).toEqual({
      alias: 'upsert',
      refs: 'internal',
      schedules: 'preserve',
    })
  })

  it('is the only policy that disables schedules', () => {
    // @note a copy landing in an account that did not author it must never start
    // firing on its own; the caller's own document (sync/restore) keeps its cadence
    expect(resolveImportPolicy('clone').schedules).toBe('disable')
    expect(resolveImportPolicy('sync').schedules).toBe('preserve')
    expect(resolveImportPolicy('restore').schedules).toBe('preserve')
  })
})

describe('getEnsurableAlias', () => {
  it('returns the alias for the caller-own @alias form', () => {
    expect(getEnsurableAlias('@sdr', aliasValidator)).toBe('sdr')
  })

  it('rejects a raw id, parent @@alias, and compound @user@resource', () => {
    expect(getEnsurableAlias('bp_123', aliasValidator)).toBeNull()
    expect(getEnsurableAlias('@@team', aliasValidator)).toBeNull()
    expect(getEnsurableAlias('@user@resource', aliasValidator)).toBeNull()
  })

  it('rejects an alias that fails validation', () => {
    expect(getEnsurableAlias('@Not Valid', aliasValidator)).toBeNull()
  })
})

describe('parseCategoryArrayResources', () => {
  it('parses category arrays into deduplicated nodes', () => {
    const parsed = parseCategoryArrayResources({
      bot: [{ id: 'b1', name: 'Bot', description: '' }],
      dataset: [{ id: 'd1', name: 'Data', description: '' }],
    })

    expect(parsed.ok).toBe(true)

    if (parsed.ok) {
      expect(parsed.nodesById.size).toBe(2)
      expect(parsed.nodesById.get('b1')).toMatchObject({
        category: 'bot',
        type: 'Bot',
        refKey: 'bot',
      })
    }
  })

  it('rejects an unsupported category as invalid', () => {
    const parsed = parseCategoryArrayResources({ nope: [{ id: 'x' }] })

    expect(parsed).toMatchObject({ ok: false, reason: 'invalid' })

    if (!parsed.ok) {
      expect(parsed.issues[0]).toMatchObject({
        category: 'nope',
        error: 'unsupported_resource_category',
      })
    }
  })

  it('rejects a non-array category and a missing id', () => {
    expect(parseCategoryArrayResources({ bot: {} })).toMatchObject({
      ok: false,
      reason: 'invalid',
    })
    expect(parseCategoryArrayResources({ bot: [{ name: 'x' }] })).toMatchObject(
      { ok: false, reason: 'invalid' }
    )
  })

  it('reports an empty payload', () => {
    expect(parseCategoryArrayResources({})).toMatchObject({
      ok: false,
      reason: 'empty',
    })
  })

  it('reports duplicate ids', () => {
    const parsed = parseCategoryArrayResources({
      bot: [
        { id: 'dup', name: 'A', description: '' },
        { id: 'dup', name: 'B', description: '' },
      ],
    })

    expect(parsed).toMatchObject({ ok: false, reason: 'duplicate' })

    if (!parsed.ok) {
      expect(parsed.issues[0]).toMatchObject({
        id: 'dup',
        error: 'duplicate_resource_id',
      })
    }
  })

  it('peels a $files directive off a space node and out of its data', () => {
    const parsed = parseCategoryArrayResources({
      space: [
        {
          id: 's1',
          name: '',
          $files: [{ path: '.skills/demo/SKILL.md', content: '# hi' }],
        },
      ],
    })

    expect(parsed.ok).toBe(true)

    if (parsed.ok) {
      const node = parsed.nodesById.get('s1')

      expect(node?.seedSpaceFiles).toEqual([
        { path: '.skills/demo/SKILL.md', content: '# hi' },
      ])
      expect(node?.data).not.toHaveProperty('$files')
    }
  })

  it('peels a $text directive off a file node and out of its data', () => {
    const parsed = parseCategoryArrayResources({
      file: [{ id: 'f1', name: 'HEARTBEAT.md', $text: '# beat' }],
    })

    expect(parsed.ok).toBe(true)

    if (parsed.ok) {
      const node = parsed.nodesById.get('f1')

      expect(node?.seedFileText).toBe('# beat')
      expect(node?.data).not.toHaveProperty('$text')
    }
  })

  it('rejects $text on a non-file category', () => {
    const parsed = parseCategoryArrayResources({
      bot: [{ id: 'b1', name: 'Bot', description: '', $text: 'nope' }],
    })

    expect(parsed.ok).toBe(false)

    if (!parsed.ok) {
      expect(parsed.issues[0]).toMatchObject({
        error: 'unsupported_file_text',
      })
    }
  })

  it('rejects a malformed $text (not a non-empty string)', () => {
    const parsed = parseCategoryArrayResources({
      file: [{ id: 'f1', name: 'a.md', $text: 123 }],
    })

    expect(parsed.ok).toBe(false)

    if (!parsed.ok) {
      expect(parsed.issues[0]).toMatchObject({ error: 'invalid_file_text' })
    }
  })

  it('rejects $files on a non-space category', () => {
    const parsed = parseCategoryArrayResources({
      bot: [
        {
          id: 'b1',
          name: 'Bot',
          description: '',
          $files: [{ path: 'a', content: 'b' }],
        },
      ],
    })

    expect(parsed).toMatchObject({ ok: false, reason: 'invalid' })

    if (!parsed.ok) {
      expect(parsed.issues[0]).toMatchObject({
        category: 'bot',
        error: 'unsupported_space_files',
      })
    }
  })

  it('rejects a malformed $files (entry missing content)', () => {
    const parsed = parseCategoryArrayResources({
      space: [{ id: 's1', name: '', $files: [{ path: '.skills/x' }] }],
    })

    expect(parsed).toMatchObject({ ok: false, reason: 'invalid' })

    if (!parsed.ok) {
      expect(parsed.issues[0]).toMatchObject({
        category: 'space',
        error: 'invalid_space_files',
      })
    }
  })
})

describe('parseExportDocument', () => {
  it('parses a token-keyed document, keeping the token as the node id', () => {
    const parsed = parseExportDocument({
      resources: {
        '#bot:::local-1': {
          type: 'Bot',
          data: { name: 'Bot', description: '' },
        },
      },
    })

    expect(parsed.ok).toBe(true)

    if (parsed.ok) {
      expect(parsed.nodesById.has('#bot:::local-1')).toBe(true)
      expect(parsed.nodesById.get('#bot:::local-1')).toMatchObject({
        category: 'bot',
      })
    }
  })

  it('rejects an unknown resource type', () => {
    const parsed = parseExportDocument({
      resources: {
        '#nope:::x': { type: 'Nope', data: {} },
      },
    })

    expect(parsed).toMatchObject({ ok: false, reason: 'invalid' })
  })
})

describe('buildDependencies / planImportOrder', () => {
  it('derives structured and embedded-token dependencies', () => {
    const nodesById = nodesFrom({
      dataset: [{ id: 'd1', name: 'D', description: '' }],
      bot: [
        {
          id: 'b1',
          name: 'B',
          description: 'see #skillset:::s1',
          datasetId: 'd1',
        },
      ],
      skillset: [{ id: '#skillset:::s1', name: 'S', description: '' }],
    })

    const { dependencies, importedNodeIds } = buildDependencies(nodesById)

    expect(importedNodeIds.has('b1')).toBe(true)
    expect(dependencies.b1).toEqual(
      expect.arrayContaining(['d1', '#skillset:::s1'])
    )
  })

  it('orders dependencies before dependents', () => {
    const nodesById = nodesFrom({
      dataset: [{ id: 'd1', name: 'D', description: '' }],
      bot: [{ id: 'b1', name: 'B', description: '', datasetId: 'd1' }],
    })

    const { sortedNodeIds } = planImportOrder(nodesById)

    expect(sortedNodeIds.indexOf('d1')).toBeLessThan(
      sortedNodeIds.indexOf('b1')
    )
  })

  it('throws a structured ImportError on a cycle', () => {
    const nodesById = nodesFrom({
      bot: [{ id: 'b1', name: 'B', description: '', datasetId: 'd1' }],
      dataset: [{ id: 'd1', name: 'D', description: '', botId: 'b1' }],
    })

    try {
      planImportOrder(nodesById)

      throw new Error('expected planImportOrder to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ImportError)
      expect((error as ImportError).details.issues.length).toBeGreaterThan(0)
    }
  })

  it('does not treat a scalar config *Id as a dependency when it collides with a node id', () => {
    // @note `phoneNumberId` is an external provider id, not a blueprint
    // reference; even when its value coincides with another node's id it must
    // not create a (phantom) dependency edge
    const nodesById = nodesFrom({
      whatsappIntegration: [
        { id: 'w1', name: 'W', description: '', phoneNumberId: 'd1' },
      ],
      dataset: [{ id: 'd1', name: 'D', description: '' }],
    })

    const { dependencies } = buildDependencies(nodesById)

    expect(dependencies.w1).not.toContain('d1')
  })

  it('does not fabricate a cycle from reciprocal scalar *Id collisions', () => {
    // @note two scalar config ids that happen to reference each other's node id
    // are not references, so there is no real cycle to detect
    const nodesById = nodesFrom({
      whatsappIntegration: [
        { id: 'x', name: 'X', description: '', phoneNumberId: 'y' },
      ],
      twilioIntegration: [
        { id: 'y', name: 'Y', description: '', phoneNumberId: 'x' },
      ],
    })

    expect(() => planImportOrder(nodesById)).not.toThrow()
  })
})

describe('categoryRegistry', () => {
  it("'portals' aliases to the Portal type/refKey like 'portal'", () => {
    expect(categoryRegistry.portals).toMatchObject({
      type: 'Portal',
      refKey: 'portal',
    })
  })

  it('registers resource categories emitted by blueprint export', () => {
    expect(categoryRegistry.policy).toMatchObject({
      type: 'Policy',
      refKey: 'policy',
    })
    expect(categoryRegistry.googlechatIntegration).toMatchObject({
      type: 'GooglechatIntegration',
      refKey: 'googlechatIntegration',
    })
    expect(categoryRegistry.microsoftteamsIntegration).toMatchObject({
      type: 'MicrosoftteamsIntegration',
      refKey: 'microsoftteamsIntegration',
    })
  })

  it('keeps widget cloneable config while dropping source ownership', () => {
    const parsed = categoryRegistry.widgetIntegration.schema.parse({
      name: 'Widget',
      theme: 'dark',
      layout: 'popup',
      origin: 'https://example.com',
      plugins: '[]',
      tools: true,
      blueprintId: 'source-blueprint',
    })

    expect(parsed).toMatchObject({
      name: 'Widget',
      theme: 'dark',
      layout: 'popup',
      origin: 'https://example.com',
      plugins: '[]',
      tools: true,
    })
    expect(parsed).not.toHaveProperty('blueprintId')
  })

  it('preserves a usage policy config intact', () => {
    const config = {
      metric: 'tokens',
      threshold: 100000,
      windowInSeconds: 86400,
      actions: { block: { durationInSeconds: 86400 } },
    }

    const parsed = categoryRegistry.policy.schema.parse({
      name: 'Daily token budget',
      type: 'usage',
      config,
    })

    expect(parsed.config).toEqual(config)
  })

  it('rejects a usage policy whose config does not match the usage shape', () => {
    const result = categoryRegistry.policy.schema.safeParse({
      name: 'Daily token budget',
      type: 'usage',
      config: {},
    })

    expect(result.success).toBe(false)
  })

  it('validates a policy config as retention when type is omitted', () => {
    const parsed = categoryRegistry.policy.schema.parse({
      name: 'Retention',
      config: { expiresInDays: 30 },
    })

    expect(parsed.config).toEqual({ expiresInDays: 30 })
  })
})

describe('importBlueprintResources', () => {
  const user = { id: 'user-1' }
  const target = { id: 'bp-1', userId: 'user-1', alias: 'sdr' }

  function makeTx() {
    return {
      bot: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(({ data }: { data: { id: string } }) =>
          Promise.resolve({ id: data.id, name: 'Bot', description: '' })
        ),
        update: jest.fn().mockResolvedValue({
          id: 'bot-existing',
          name: 'Bot',
          description: '',
        }),
      },
      blueprint: { findMany: jest.fn().mockResolvedValue([]) },
    }
  }

  async function run(
    tx: unknown,
    resources: Record<string, unknown>,
    policy: 'sync' | 'clone' | 'restore'
  ) {
    const nodesById = nodesFrom(resources)
    const plan = planImportOrder(nodesById)

    return importBlueprintResources({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tx: tx as any,
      user,
      targetBlueprint: target,
      nodesById,
      sortedNodeIds: plan.sortedNodeIds,
      importedNodeIds: plan.importedNodeIds,
      policy,
    })
  }

  it('creates a fresh resource under the sync policy', async () => {
    const tx = makeTx()

    const result = await run(
      tx,
      { bot: [{ id: 'local-bot', name: 'Bot', description: '' }] },
      'sync'
    )

    expect(tx.bot.create).toHaveBeenCalledTimes(1)
    expect(result.resources.bot).toEqual([
      { id: 'cuid-1', name: 'Bot', description: '' },
    ])
    expect(result.idMap.get('local-bot')).toBe('cuid-1')
  })

  it('updates an alias match under the sync policy', async () => {
    const tx = makeTx()

    tx.bot.findMany.mockResolvedValue([
      { id: 'bot-existing', blueprintId: 'bp-1', alias: 'sdr-bot' },
    ])

    await run(
      tx,
      {
        bot: [
          {
            id: 'local-bot',
            alias: 'sdr-bot',
            name: 'Bot',
            description: 'changed',
          },
        ],
      },
      'sync'
    )

    expect(tx.bot.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'bot-existing' } })
    )
    expect(tx.bot.create).not.toHaveBeenCalled()
  })

  it('writes a $default seed field on create (unwrapped)', async () => {
    const tx = makeTx()

    await run(
      tx,
      {
        bot: [
          {
            id: 'local-bot',
            name: 'Bot',
            description: '',
            model: { $default: 'glm-5.2' },
          },
        ],
      },
      'sync'
    )

    expect(tx.bot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ model: 'glm-5.2' }),
      })
    )
  })

  it('skips a $default seed field on update (preserves the user value)', async () => {
    const tx = makeTx()

    tx.bot.findMany.mockResolvedValue([
      { id: 'bot-existing', blueprintId: 'bp-1', alias: 'sdr-bot' },
    ])

    await run(
      tx,
      {
        bot: [
          {
            id: 'local-bot',
            alias: 'sdr-bot',
            name: 'Bot',
            description: 'changed',
            model: { $default: 'glm-5.2' },
          },
        ],
      },
      'sync'
    )

    expect(tx.bot.create).not.toHaveBeenCalled()
    expect(tx.bot.update).toHaveBeenCalledTimes(1)

    const { data } = tx.bot.update.mock.calls[0][0] as {
      data: Record<string, unknown>
    }

    // the seed field is stripped on update, other fields still reconcile
    expect(data).not.toHaveProperty('model')
    expect(data).toEqual(expect.objectContaining({ description: 'changed' }))
  })

  it('writes $files into space storage when a space is created', async () => {
    const tx = {
      space: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(({ data }: { data: { id: string } }) =>
          Promise.resolve({ id: data.id, name: '', description: '' })
        ),
        update: jest.fn(),
      },
      blueprint: { findMany: jest.fn().mockResolvedValue([]) },
    }

    await run(
      tx,
      {
        space: [
          {
            id: 'local-space',
            name: '',
            $files: [
              { path: '.skills/demo/SKILL.md', content: 'hello' },
              { path: '.skills/demo/run.py', content: 'print(1)' },
            ],
          },
        ],
      },
      'sync'
    )

    expect(tx.space.create).toHaveBeenCalledTimes(1)
    // @note the seeds are written as part of the import, keyed by the new space
    // id, with the content type derived from each file name (not hard-coded)
    expect(uploadStorageFile).toHaveBeenCalledTimes(2)
    expect(uploadStorageFile).toHaveBeenNthCalledWith(1, {
      spaceId: 'cuid-1',
      path: '.skills/demo/SKILL.md',
      body: 'hello',
      contentType: 'text/markdown',
    })
    expect(uploadStorageFile).toHaveBeenNthCalledWith(2, {
      spaceId: 'cuid-1',
      path: '.skills/demo/run.py',
      body: 'print(1)',
      contentType: 'text/plain',
    })
  })

  it('does not re-seed $files when a space is updated (alias match)', async () => {
    const tx = {
      space: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'space-existing', blueprintId: 'bp-1', alias: 'ops' },
          ]),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          id: 'space-existing',
          name: '',
          description: '',
        }),
      },
      blueprint: { findMany: jest.fn().mockResolvedValue([]) },
    }

    await run(
      tx,
      {
        space: [
          {
            id: 'local-space',
            alias: 'ops',
            name: 'changed',
            $files: [{ path: '.skills/demo/SKILL.md', content: 'hello' }],
          },
        ],
      },
      'sync'
    )

    expect(tx.space.create).not.toHaveBeenCalled()
    expect(uploadStorageFile).not.toHaveBeenCalled()
  })

  it('writes $text into file storage when a file is created', async () => {
    const tx = {
      file: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(({ data }: { data: { id: string } }) =>
          Promise.resolve({ id: data.id, name: '', description: '' })
        ),
        update: jest.fn(),
      },
      blueprint: { findMany: jest.fn().mockResolvedValue([]) },
    }

    await run(
      tx,
      {
        file: [{ id: 'local-file', name: 'HEARTBEAT.md', $text: '# beat' }],
      },
      'sync'
    )

    expect(tx.file.create).toHaveBeenCalledTimes(1)

    // @note a File row carries no body - without this the content a template
    // ships would have nowhere to land. The content type comes from the name.
    expect(uploadFileObject).toHaveBeenCalledTimes(1)
    expect(uploadFileObject).toHaveBeenCalledWith('cuid-1', '# beat', {
      contentType: 'text/markdown',
    })
  })

  it('does not re-seed $text when a file is updated (alias match)', async () => {
    const tx = {
      file: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'file-existing', blueprintId: 'bp-1', alias: 'heartbeat' },
          ]),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          id: 'file-existing',
          name: '',
          description: '',
        }),
      },
      blueprint: { findMany: jest.fn().mockResolvedValue([]) },
    }

    await run(
      tx,
      {
        file: [
          {
            id: 'local-file',
            alias: 'heartbeat',
            name: 'HEARTBEAT.md',
            $text: '# beat',
          },
        ],
      },
      'sync'
    )

    expect(tx.file.create).not.toHaveBeenCalled()
    expect(uploadFileObject).not.toHaveBeenCalled()
  })

  it('strips the alias and always creates under the clone policy', async () => {
    const tx = makeTx()

    // @note an existing alias match would update under sync; clone must ignore it
    tx.bot.findMany.mockResolvedValue([
      { id: 'bot-existing', blueprintId: 'bp-1', alias: 'sdr-bot' },
    ])

    await run(
      tx,
      {
        bot: [
          {
            id: 'local-bot',
            alias: 'sdr-bot',
            name: 'Bot',
            description: '',
          },
        ],
      },
      'clone'
    )

    // never looks up existing aliases under strip
    expect(tx.bot.findMany).not.toHaveBeenCalled()
    expect(tx.bot.update).not.toHaveBeenCalled()
    expect(tx.bot.create).toHaveBeenCalledTimes(1)

    const createData = tx.bot.create.mock.calls[0][0].data

    expect(createData).not.toHaveProperty('alias')
  })

  it('rejects an alias that lives in another active aliased blueprint (sync)', async () => {
    const tx = makeTx()

    tx.bot.findMany.mockResolvedValue([
      { id: 'bot-other', blueprintId: 'bp-other', alias: 'sdr-bot' },
    ])
    tx.blueprint.findMany.mockResolvedValue([
      { id: 'bp-other', alias: 'other' },
    ])

    await expect(
      run(
        tx,
        {
          bot: [
            { id: 'local-bot', alias: 'sdr-bot', name: 'Bot', description: '' },
          ],
        },
        'sync'
      )
    ).rejects.toBeInstanceOf(ImportError)

    expect(tx.bot.create).not.toHaveBeenCalled()
  })

  it('rejects an external reference that does not exist (sync)', async () => {
    const tx = {
      bot: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
      dataset: { findUnique: jest.fn().mockResolvedValue(null) },
      blueprint: { findMany: jest.fn().mockResolvedValue([]) },
    }

    await expect(
      run(
        tx,
        {
          bot: [
            { id: 'b1', name: 'Bot', description: '', datasetId: 'ext-ds' },
          ],
        },
        'sync'
      )
    ).rejects.toBeInstanceOf(ImportError)

    expect(tx.dataset.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ext-ds' } })
    )
    expect(tx.bot.create).not.toHaveBeenCalled()
  })

  it('nulls (does not carry or access-check) cross-tenant references under the clone policy', async () => {
    const tx = {
      bot: {
        findMany: jest.fn(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        create: jest.fn((args: any) =>
          Promise.resolve({ id: args.data.id, name: 'Bot', description: '' })
        ),
        update: jest.fn(),
      },
      dataset: { findUnique: jest.fn() },
      blueprint: { findMany: jest.fn() },
    }

    await run(
      tx,
      {
        bot: [{ id: 'b1', name: 'Bot', description: '', datasetId: 'ext-ds' }],
      },
      'clone'
    )

    // @note `ext-ds` is not part of the cloned set, so it points at the source
    // owner - the clone must null it rather than carry the cross-tenant FK, and
    // (since it is nulled) never needs an access check
    expect(tx.dataset.findUnique).not.toHaveBeenCalled()
    expect(tx.bot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ datasetId: null }),
      })
    )
  })

  it('keeps a reference that resolves to a co-cloned resource under the clone policy', async () => {
    const tx = {
      bot: {
        findMany: jest.fn(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        create: jest.fn((args: any) =>
          Promise.resolve({
            id: `new-${args.data.id}`,
            name: 'X',
            description: '',
          })
        ),
        update: jest.fn(),
      },
      dataset: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        create: jest.fn((args: any) =>
          Promise.resolve({ id: 'new-ds', name: 'DS', description: '' })
        ),
      },
      blueprint: { findMany: jest.fn() },
    }

    await run(
      tx,
      {
        dataset: [{ id: 'ds-1', name: 'DS', description: '' }],
        bot: [{ id: 'bot-1', name: 'Bot', description: '', datasetId: 'ds-1' }],
      },
      'clone'
    )

    // the dataset is cloned too, so the bot's datasetId re-wires to the new id
    expect(tx.bot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ datasetId: 'new-ds' }),
      })
    )
  })

  it('upserts by alias and skips external-ref checks under the restore policy', async () => {
    const tx = {
      bot: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'bot-existing', blueprintId: 'bp-1', alias: 'sdr-bot' },
          ]),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          id: 'bot-existing',
          name: 'Bot',
          description: '',
        }),
      },
      dataset: { findUnique: jest.fn() },
      blueprint: { findMany: jest.fn() },
    }

    await run(
      tx,
      {
        bot: [
          {
            id: 'b1',
            alias: 'sdr-bot',
            name: 'Bot',
            description: 'changed',
            datasetId: 'ext-ds',
          },
        ],
      },
      'restore'
    )

    // restore = alias upsert (so it matches + updates) + internal refs (no check)
    expect(tx.bot.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'bot-existing' } })
    )
    expect(tx.bot.create).not.toHaveBeenCalled()
    expect(tx.dataset.findUnique).not.toHaveBeenCalled()
  })

  it('mints an access token when creating an mcpserver integration', async () => {
    const tx = {
      mcpserverIntegration: {
        findMany: jest.fn(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        create: jest.fn((args: any) =>
          Promise.resolve({ id: args.data.id, name: 'M', description: '' })
        ),
        update: jest.fn(),
      },
      blueprint: { findMany: jest.fn() },
    }

    await run(
      tx,
      { mcpserverIntegration: [{ id: 'm1', name: 'M', description: '' }] },
      'sync'
    )

    const data = tx.mcpserverIntegration.create.mock.calls[0][0].data

    expect(typeof data.accessToken).toBe('string')
    expect(data.accessToken.length).toBeGreaterThan(0)
  })

  it('mints a token when creating a notion integration', async () => {
    const tx = {
      notionIntegration: {
        findMany: jest.fn(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        create: jest.fn((args: any) =>
          Promise.resolve({ id: args.data.id, name: 'N', description: '' })
        ),
        update: jest.fn(),
      },
      blueprint: { findMany: jest.fn() },
    }

    await run(
      tx,
      { notionIntegration: [{ id: 'n1', name: 'N', description: '' }] },
      'sync'
    )

    const data = tx.notionIntegration.create.mock.calls[0][0].data

    expect(typeof data.token).toBe('string')
    expect(data.token.length).toBeGreaterThan(0)
  })

  it('preserves nested secret config when updating aliased secrets', async () => {
    const tx = {
      secret: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'secret-existing',
            blueprintId: 'bp-1',
            alias: 'oauth-secret',
            name: 'Existing Secret',
          },
        ]),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          id: 'secret-existing',
          name: 'OAuth Secret',
          description: '',
        }),
      },
      blueprint: { findMany: jest.fn().mockResolvedValue([]) },
    }

    await run(
      tx,
      {
        secret: [
          {
            id: 'secret-1',
            alias: 'oauth-secret',
            name: 'OAuth Secret',
            description: '',
            value: 'top-level-secret',
            config: {
              clientId: 'client-id',
              clientSecret: 'nested-client-secret',
              password: 'nested-password',
            },
          },
        ],
      },
      'sync'
    )

    const data = tx.secret.update.mock.calls[0][0].data

    expect(data).not.toHaveProperty('value')
    expect(data).not.toHaveProperty('config')
  })

  it('preserves credential fields when updating aliased integrations', async () => {
    const tx = {
      anamIntegration: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'anam-existing', blueprintId: 'bp-1', alias: 'anam' },
          ]),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          id: 'anam-existing',
          name: 'Anam',
          description: '',
        }),
      },
      recallIntegration: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'recall-existing', blueprintId: 'bp-1', alias: 'recall' },
          ]),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          id: 'recall-existing',
          name: 'Recall',
          description: '',
        }),
      },
      twilioIntegration: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'twilio-existing', blueprintId: 'bp-1', alias: 'twilio' },
          ]),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          id: 'twilio-existing',
          name: 'Twilio',
          description: '',
        }),
      },
      googlechatIntegration: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'google-existing', blueprintId: 'bp-1', alias: 'google' },
          ]),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          id: 'google-existing',
          name: 'Google Chat',
          description: '',
        }),
      },
      microsoftteamsIntegration: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'teams-existing', blueprintId: 'bp-1', alias: 'teams' },
          ]),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          id: 'teams-existing',
          name: 'Teams',
          description: '',
        }),
      },
      mcpserverIntegration: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'mcp-existing', blueprintId: 'bp-1', alias: 'mcp' },
          ]),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          id: 'mcp-existing',
          name: 'MCP',
          description: '',
        }),
      },
      oAuthConnection: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'oauth-connection',
          userId: 'user-1',
        }),
      },
      blueprint: { findMany: jest.fn().mockResolvedValue([]) },
    }

    await run(
      tx,
      {
        anamIntegration: [
          {
            id: 'anam-1',
            alias: 'anam',
            name: 'Anam',
            description: '',
            apiKey: 'anam-api-key',
          },
        ],
        recallIntegration: [
          {
            id: 'recall-1',
            alias: 'recall',
            name: 'Recall',
            description: '',
            apiKey: 'recall-api-key',
          },
        ],
        twilioIntegration: [
          {
            id: 'twilio-1',
            alias: 'twilio',
            name: 'Twilio',
            description: '',
            authToken: 'twilio-auth-token',
          },
        ],
        googlechatIntegration: [
          {
            id: 'google-1',
            alias: 'google',
            name: 'Google Chat',
            description: '',
            serviceAccountKey: '{"private_key":"secret"}',
          },
        ],
        microsoftteamsIntegration: [
          {
            id: 'teams-1',
            alias: 'teams',
            name: 'Teams',
            description: '',
            botFrameworkAppSecret: 'teams-secret',
            tenantId: 'tenant-id',
          },
        ],
        mcpserverIntegration: [
          {
            id: 'mcp-1',
            alias: 'mcp',
            name: 'MCP',
            description: '',
            oAuthConnectionId: 'oauth-connection',
          },
        ],
      },
      'sync'
    )

    expect(tx.anamIntegration.update.mock.calls[0][0].data).not.toHaveProperty(
      'apiKey'
    )
    expect(
      tx.recallIntegration.update.mock.calls[0][0].data
    ).not.toHaveProperty('apiKey')
    expect(
      tx.twilioIntegration.update.mock.calls[0][0].data
    ).not.toHaveProperty('authToken')
    expect(
      tx.googlechatIntegration.update.mock.calls[0][0].data
    ).not.toHaveProperty('serviceAccountKey')
    expect(
      tx.microsoftteamsIntegration.update.mock.calls[0][0].data
    ).not.toHaveProperty('botFrameworkAppSecret')
    expect(
      tx.microsoftteamsIntegration.update.mock.calls[0][0].data
    ).not.toHaveProperty('tenantId')
    expect(
      tx.mcpserverIntegration.update.mock.calls[0][0].data
    ).not.toHaveProperty('oAuthConnectionId')
    expect(tx.oAuthConnection.findUnique).not.toHaveBeenCalled()
  })

  it('does not reuse a discovered blueprint owned by another user', async () => {
    const client = {
      bot: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'b1', alias: 'sdr-bot', blueprintId: 'bp-x' },
          ]),
      },
      blueprint: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'bp-x',
          userId: 'other-user',
          alias: 'sdr',
        }),
      },
    }

    const nodesById = nodesFrom({
      bot: [{ id: 'n1', alias: 'sdr-bot', name: 'B', description: '' }],
    })

    const result = await findReusableBlueprintByResourceAliases(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      nodesById,
      'user-1'
    )

    expect(result.blueprint).toBeNull()
  })
})

describe('deepEqual', () => {
  it('compares dates by value, not reference (a changed date is not equal)', () => {
    expect(deepEqual(new Date('2020-01-01'), new Date('2020-01-01'))).toBe(true)
    expect(deepEqual(new Date('2020-01-01'), new Date('2021-01-01'))).toBe(
      false
    )
    expect(deepEqual(new Date('2020-01-01'), '2020-01-01')).toBe(false)
  })

  it('is key-order independent for objects and order-sensitive for arrays', () => {
    expect(
      deepEqual({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })
    ).toBe(true)
    expect(deepEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false)
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(deepEqual({ x: null }, { x: undefined })).toBe(false)
  })
})

describe('resolveEmbeddedTokenReferences', () => {
  it('replaces embedded tokens longest-first so a prefix never corrupts', () => {
    const resolved = new Map([
      ['#ability:::a-1', 'AAA'],
      ['#ability:::a-10', 'BBB'],
    ])

    const out = resolveEmbeddedTokenReferences(
      { note: 'see #ability:::a-1 then #ability:::a-10' },
      resolved
    )

    expect(out.note).toBe('see AAA then BBB')
  })

  it('ignores non-token local ids (no substring replacement in prose)', () => {
    const out = resolveEmbeddedTokenReferences(
      { note: 'plain abc text' },
      new Map([['abc', 'XYZ']])
    )

    expect(out.note).toBe('plain abc text')
  })
})

describe('nullifyUnresolvedReferences', () => {
  it('nulls unresolved resource references without touching scalar id fields', () => {
    const out = nullifyUnresolvedReferences(
      {
        botId: 'source-owner-bot',
        phoneNumberId: 'phone-number-from-provider',
        personaId: 'avatar-provider-persona',
      },
      {
        bot: new Map(),
      }
    )

    expect(out.botId).toBeNull()
    expect(out.phoneNumberId).toBe('phone-number-from-provider')
    expect(out.personaId).toBe('avatar-provider-persona')
  })

  it('nulls unresolved resource references but preserves config scalars', () => {
    const maps = { dataset: new Map([['new-ds', 'new-ds']]) }

    const out = nullifyUnresolvedReferences(
      {
        datasetId: 'new-ds', // a clonable-category ref that resolved: kept
        oAuthConnectionId: 'oac-of-another-user', // reference type, unresolved: nulled
        phoneNumberId: '15551234567', // ends in Id but is config: kept
        appId: 'app-7', // config scalar: kept
        name: 'Integration', // not a *Id: kept
      },
      maps
    )

    expect(out.datasetId).toBe('new-ds')
    expect(out.oAuthConnectionId).toBeNull()
    expect(out.phoneNumberId).toBe('15551234567')
    expect(out.appId).toBe('app-7')
    expect(out.name).toBe('Integration')
  })
})

describe('importBlueprintResources - cloned schedules land dormant', () => {
  const user = { id: 'user-1' }
  const target = { id: 'bp-1', userId: 'user-1', alias: null }

  function makeScheduledTx() {
    // @note the written row is the assertion target here, so `data` stays an
    // open record rather than the `{ id }` shape the other suites narrow to
    const delegate = (name: string) => ({
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: data.id as string, name, description: '' })
      ),
      update: jest.fn().mockResolvedValue({
        id: 'existing',
        name,
        description: '',
      }),
    })

    return {
      task: delegate('Task'),
      triggerIntegration: delegate('Trigger'),
      blueprint: { findMany: jest.fn().mockResolvedValue([]) },
    }
  }

  async function run(
    tx: unknown,
    resources: Record<string, unknown>,
    policy: 'sync' | 'clone' | 'restore'
  ) {
    const nodesById = nodesFrom(resources)
    const plan = planImportOrder(nodesById)

    return importBlueprintResources({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tx: tx as any,
      user,
      targetBlueprint: target,
      nodesById,
      sortedNodeIds: plan.sortedNodeIds,
      importedNodeIds: plan.importedNodeIds,
      policy,
    })
  }

  it('nulls a cloned trigger cadence, keeping the timezone', async () => {
    const tx = makeScheduledTx()

    await run(
      tx,
      {
        triggerIntegration: [
          {
            id: 'local-trigger',
            name: 'Daily Follow-up Sweep',
            schedule: '0 8 * * *',
            timezone: 'Europe/London',
          },
        ],
      },
      'clone'
    )

    const { data } = tx.triggerIntegration.create.mock.calls[0][0]

    expect(data.schedule).toBeNull()

    // @note inert without a schedule, and correct again if the owner re-enables it
    expect(data.timezone).toBe('Europe/London')
  })

  it('nulls a cloned task cadence, including a named interval', async () => {
    // @note the regression that matters: `hourly` and friends are selected by
    // `schedule` + `lastRunAt` and never consult `nextRunAt`, so clearing the
    // next-run timestamp alone would not have stopped this one
    const tx = makeScheduledTx()

    await run(
      tx,
      {
        task: [{ id: 'local-task', name: 'Sweep', schedule: 'hourly' }],
      },
      'clone'
    )

    const { data } = tx.task.create.mock.calls[0][0]

    expect(data.schedule).toBeNull()
  })

  it('keeps the cadence under sync - the document is the callers own', async () => {
    const tx = makeScheduledTx()

    await run(
      tx,
      {
        triggerIntegration: [
          { id: 'local-trigger', name: 'Sweep', schedule: '0 8 * * *' },
        ],
      },
      'sync'
    )

    const { data } = tx.triggerIntegration.create.mock.calls[0][0]

    expect(data.schedule).toBe('0 8 * * *')
  })

  it('keeps the cadence under restore - a backup must come back live', async () => {
    const tx = makeScheduledTx()

    await run(
      tx,
      { task: [{ id: 'local-task', name: 'Sweep', schedule: 'daily' }] },
      'restore'
    )

    const { data } = tx.task.create.mock.calls[0][0]

    expect(data.schedule).toBe('daily')
  })

  it('still mints a fresh trigger secret on a dormant clone', async () => {
    const tx = makeScheduledTx()

    await run(
      tx,
      {
        triggerIntegration: [
          { id: 'local-trigger', name: 'Sweep', schedule: 'hourly' },
        ],
      },
      'clone'
    )

    const { data } = tx.triggerIntegration.create.mock.calls[0][0]

    expect(data.secret).toEqual(expect.any(String))
    expect(String(data.secret).length).toBeGreaterThan(0)
  })
})

describe('importBlueprintResources - ability link keys', () => {
  const user = { id: 'user-1' }
  const target = { id: 'bp-1', userId: 'user-1', alias: null }

  function makeAbilityTx() {
    const delegate = (name: string) => ({
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: data.id as string, name, description: '' })
      ),
      update: jest.fn().mockResolvedValue({
        id: 'existing',
        name,
        description: '',
      }),
    })

    return {
      ability: delegate('Ability'),
      blueprint: { findMany: jest.fn().mockResolvedValue([]) },
    }
  }

  async function run(tx: unknown, resources: Record<string, unknown>) {
    const nodesById = nodesFrom(resources)
    const plan = planImportOrder(nodesById)

    return importBlueprintResources({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tx: tx as any,
      user,
      targetBlueprint: target,
      nodesById,
      sortedNodeIds: plan.sortedNodeIds,
      importedNodeIds: plan.importedNodeIds,
      policy: 'clone',
    })
  }

  it('imports an ability that uses the linked keys', async () => {
    const tx = makeAbilityTx()

    const result = await run(tx, {
      ability: [
        {
          id: 'local-ability',
          name: 'Search',
          description: 'Search the web',
          instruction: '@platform/web-search',
          linkedSecretId: 'secret-1',
        },
      ],
    })

    expect(tx.ability.create).toHaveBeenCalledTimes(1)
    expect(result.idMap.get('local-ability')).toBe('cuid-1')
  })
})

describe('ability link keys survive an export -> import round trip', () => {
  const ability = {
    id: 'ability-1',
    name: 'Search',
    description: 'Search the web',
    instruction: '@platform/web-search',
    skillsetId: 'skillset-1',
    linkedSecretId: 'secret-1',
    linkedFileId: 'file-1',
    linkedBotId: 'bot-1',
    linkedSpaceId: 'space-1',
  }

  const links = {
    linkedSecretId: 'secret-1',
    linkedFileId: 'file-1',
    linkedBotId: 'bot-1',
    linkedSpaceId: 'space-1',
  }

  it('keeps all four links in the token-keyed export document', () => {
    const doc = exportResourceDocument({
      resources: { basic: { ability: [ability] } },
      sensitivity: 'public',
      buckets: FULL_EXPORT_BUCKETS,
    })

    expect(doc.resources['#ability:::ability-1'].data).toMatchObject(links)
    expect(doc.resources['#ability:::ability-1'].data).not.toHaveProperty(
      'secretId'
    )
  })

  // @note the category-array map is the shape the JSON export returns and the
  // import route's `parseCategoryArrayResources` consumes
  it('keeps all four links through the category-array export -> import', () => {
    const map = exportResourceCategoryMap({
      resources: { basic: { ability: [ability] } },
      sensitivity: 'public',
      buckets: FULL_EXPORT_BUCKETS,
    })

    expect(map.ability[0]).toMatchObject(links)

    const node = nodesFrom(map).get('ability-1')

    expect(node?.category).toBe('ability')
    expect(node?.data).toMatchObject(links)
  })
})

describe('importBlueprintResources - ability link keys resolve blueprint-local references', () => {
  const user = { id: 'user-1' }
  const target = { id: 'bp-1', userId: 'user-1', alias: null }

  function makeLinkedTx() {
    const delegate = (name: string) => ({
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: data.id as string, name, description: '' })
      ),
      update: jest.fn().mockResolvedValue({
        id: 'existing',
        name,
        description: '',
      }),
    })

    return {
      ability: delegate('Ability'),
      secret: delegate('Secret'),
      file: delegate('File'),
      bot: delegate('Bot'),
      space: delegate('Space'),
      blueprint: { findMany: jest.fn().mockResolvedValue([]) },
    }
  }

  async function run(
    tx: unknown,
    resources: Record<string, unknown>,
    policy: 'sync' | 'clone' | 'restore'
  ) {
    const nodesById = nodesFrom(resources)
    const plan = planImportOrder(nodesById)

    return importBlueprintResources({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tx: tx as any,
      user,
      targetBlueprint: target,
      nodesById,
      sortedNodeIds: plan.sortedNodeIds,
      importedNodeIds: plan.importedNodeIds,
      policy,
    })
  }

  function createdData(delegate: { create: jest.Mock }) {
    return delegate.create.mock.calls[0][0].data as Record<string, unknown>
  }

  it('resolves #type:::id links to the ids of the co-imported resources, creating them first', async () => {
    const tx = makeLinkedTx()

    const nodesById = nodesFrom({
      ability: [
        {
          id: '#ability:::a1',
          name: 'Search',
          description: '',
          instruction: '@platform/web-search',
          linkedSecretId: '#secret:::s1',
          linkedFileId: '#file:::f1',
          linkedBotId: '#bot:::b1',
          linkedSpaceId: '#space:::sp1',
        },
      ],
      secret: [{ id: '#secret:::s1', name: 'S', description: '' }],
      file: [{ id: '#file:::f1', name: 'F', description: '' }],
      bot: [{ id: '#bot:::b1', name: 'B', description: '' }],
      space: [{ id: '#space:::sp1', name: 'Sp', description: '' }],
    })

    const { sortedNodeIds } = planImportOrder(nodesById)

    // @note the linked keys are dependencies, so every linked resource sorts
    // ahead of the ability that points at it
    for (const id of ['#secret:::s1', '#file:::f1', '#bot:::b1', '#space:::sp1']) {
      expect(sortedNodeIds.indexOf(id)).toBeLessThan(
        sortedNodeIds.indexOf('#ability:::a1')
      )
    }

    const result = await run(
      tx,
      {
        ability: [
          {
            id: '#ability:::a1',
            name: 'Search',
            description: '',
            instruction: '@platform/web-search',
            linkedSecretId: '#secret:::s1',
            linkedFileId: '#file:::f1',
            linkedBotId: '#bot:::b1',
            linkedSpaceId: '#space:::sp1',
          },
        ],
        secret: [{ id: '#secret:::s1', name: 'S', description: '' }],
        file: [{ id: '#file:::f1', name: 'F', description: '' }],
        bot: [{ id: '#bot:::b1', name: 'B', description: '' }],
        space: [{ id: '#space:::sp1', name: 'Sp', description: '' }],
      },
      'sync'
    )

    expect(tx.ability.create).toHaveBeenCalledTimes(1)

    expect(createdData(tx.ability)).toMatchObject({
      linkedSecretId: result.idMap.get('#secret:::s1'),
      linkedFileId: result.idMap.get('#file:::f1'),
      linkedBotId: result.idMap.get('#bot:::b1'),
      linkedSpaceId: result.idMap.get('#space:::sp1'),
    })

    // every link points at a freshly minted id, never at the token
    for (const key of [
      'linkedSecretId',
      'linkedFileId',
      'linkedBotId',
      'linkedSpaceId',
    ]) {
      expect(createdData(tx.ability)[key]).toMatch(/^cuid-\d+$/)
    }

    // the referenced resources are written before the ability
    const abilityOrder = tx.ability.create.mock.invocationCallOrder[0]

    for (const delegate of [tx.secret, tx.file, tx.bot, tx.space]) {
      expect(delegate.create).toHaveBeenCalledTimes(1)
      expect(delegate.create.mock.invocationCallOrder[0]).toBeLessThan(
        abilityOrder
      )
    }

    // resolved links are internal, so no external access check ran
    for (const delegate of [tx.secret, tx.file, tx.bot, tx.space]) {
      expect(delegate.findUnique).not.toHaveBeenCalled()
    }
  })

  it('resolves a plain local id (no #type::: prefix) on linkedBotId', async () => {
    const tx = makeLinkedTx()

    const result = await run(
      tx,
      {
        bot: [{ id: 'bot-local', name: 'B', description: '' }],
        ability: [
          {
            id: 'ability-local',
            name: 'Search',
            description: '',
            instruction: '@platform/web-search',
            linkedBotId: 'bot-local',
          },
        ],
      },
      'sync'
    )

    expect(tx.bot.create.mock.invocationCallOrder[0]).toBeLessThan(
      tx.ability.create.mock.invocationCallOrder[0]
    )
    expect(createdData(tx.ability).linkedBotId).toBe(
      result.idMap.get('bot-local')
    )
    expect(tx.bot.findUnique).not.toHaveBeenCalled()
  })

  it('rejects a linkedSecretId that points at a secret the user cannot use (sync)', async () => {
    const tx = makeLinkedTx()

    tx.secret.findUnique.mockResolvedValue({
      id: 'ext-secret',
      userId: 'someone-else',
      visibility: 'private',
      kind: 'personal',
    })

    await expect(
      run(
        tx,
        {
          ability: [
            {
              id: 'a1',
              name: 'Search',
              description: '',
              instruction: '@platform/web-search',
              linkedSecretId: 'ext-secret',
            },
          ],
        },
        'sync'
      )
    ).rejects.toMatchObject({
      name: 'ImportError',
      details: {
        issues: [
          expect.objectContaining({
            nodeId: 'a1',
            category: 'ability',
            field: 'linkedSecretId',
            value: 'ext-secret',
            error: 'external_reference_not_authorized',
          }),
        ],
      },
    })

    expect(tx.secret.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ext-secret' } })
    )
    expect(tx.ability.create).not.toHaveBeenCalled()
  })

  it('rejects a linkedSecretId that does not exist (sync)', async () => {
    const tx = makeLinkedTx()

    await expect(
      run(
        tx,
        {
          ability: [
            {
              id: 'a1',
              name: 'Search',
              description: '',
              instruction: '@platform/web-search',
              linkedSecretId: 'missing-secret',
            },
          ],
        },
        'sync'
      )
    ).rejects.toMatchObject({
      name: 'ImportError',
      details: {
        issues: [
          expect.objectContaining({
            field: 'linkedSecretId',
            error: 'external_reference_not_found',
          }),
        ],
      },
    })

    expect(tx.ability.create).not.toHaveBeenCalled()
  })

  it('keeps a linkedSecretId that points at a secret the user can use (sync)', async () => {
    const tx = makeLinkedTx()

    tx.secret.findUnique.mockResolvedValue({
      id: 'own-secret',
      userId: 'user-1',
      visibility: 'private',
      kind: 'personal',
    })

    await run(
      tx,
      {
        ability: [
          {
            id: 'a1',
            name: 'Search',
            description: '',
            instruction: '@platform/web-search',
            linkedSecretId: 'own-secret',
          },
        ],
      },
      'sync'
    )

    expect(tx.secret.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'own-secret' } })
    )
    expect(createdData(tx.ability).linkedSecretId).toBe('own-secret')
  })

  it('nulls an external linkedSecretId under the clone policy without an access check', async () => {
    const tx = makeLinkedTx()

    await run(
      tx,
      {
        ability: [
          {
            id: 'a1',
            name: 'Search',
            description: '',
            instruction: '@platform/web-search',
            linkedSecretId: 'ext-secret',
          },
        ],
      },
      'clone'
    )

    expect(tx.secret.findUnique).not.toHaveBeenCalled()
    expect(createdData(tx.ability).linkedSecretId).toBeNull()
  })

  it('resolves a lone linkedSpaceId and leaves the other links null', async () => {
    const tx = makeLinkedTx()

    const result = await run(
      tx,
      {
        space: [{ id: '#space:::sp1', name: 'Sp', description: '' }],
        ability: [
          {
            id: '#ability:::a1',
            name: 'Search',
            description: '',
            instruction: '@platform/web-search',
            linkedSecretId: null,
            linkedFileId: null,
            linkedBotId: null,
            linkedSpaceId: '#space:::sp1',
          },
        ],
      },
      'sync'
    )

    expect(tx.space.create).toHaveBeenCalledTimes(1)
    expect(createdData(tx.ability)).toMatchObject({
      linkedSecretId: null,
      linkedFileId: null,
      linkedBotId: null,
      linkedSpaceId: result.idMap.get('#space:::sp1'),
    })
    expect(createdData(tx.ability).linkedSpaceId).toMatch(/^cuid-\d+$/)

    for (const delegate of [tx.secret, tx.file, tx.bot, tx.space]) {
      expect(delegate.findUnique).not.toHaveBeenCalled()
    }
  })
})
