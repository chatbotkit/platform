/* eslint-disable @typescript-eslint/no-require-imports */
const {
  computeAutoConnections,
  BOT_INTEGRATION_TYPES,
  DATASET_INTEGRATION_TYPES,
  SKILLSET_INTEGRATION_TYPES,
  MAX_AUTO_CONNECT_DISTANCE,
} = require('./designer')

describe('computeAutoConnections', () => {
  // Helper to create a node at a specific position
  const makeNode = (id, type, x = 0, y = 0, data = {}) => ({
    id,
    type,
    position: { x, y },
    data,
  })

  // Helper to create an edge
  const makeEdge = (source, sourceHandle, target, targetHandle) => ({
    id: `edge-${source}-${target}`,
    source,
    sourceHandle,
    target,
    targetHandle,
  })

  describe('dataset dropped near bot', () => {
    it('connects dataset to nearest bot without existing dataset connection', () => {
      const newNode = makeNode('#dataset-1', 'dataset', 100, 100)
      const existingNodes = [makeNode('#bot-1', 'bot', 150, 100)]
      const existingEdges = []

      const result = computeAutoConnections({
        newNode,
        existingNodes,
        existingEdges,
        resourceType: 'dataset',
        allResources: {},
      })

      expect(result.nodeUpdates).toHaveLength(1)
      expect(result.nodeUpdates[0]).toEqual({
        nodeId: '#bot-1',
        field: 'datasetId',
        value: '#dataset-1',
        isNewNode: false,
      })

      expect(result.edgesToCreate).toHaveLength(1)
      expect(result.edgesToCreate[0]).toMatchObject({
        source: '#bot-1',
        sourceHandle: 'datasetId',
        target: '#dataset-1',
        targetHandle: 'dataset',
      })
    })

    it('skips bot that already has a dataset connection', () => {
      const newNode = makeNode('#dataset-2', 'dataset', 100, 100)
      const existingNodes = [
        makeNode('#bot-1', 'bot', 150, 100),
        makeNode('#dataset-1', 'dataset', 200, 100),
      ]
      const existingEdges = [
        makeEdge('#bot-1', 'datasetId', '#dataset-1', 'dataset'),
      ]

      const result = computeAutoConnections({
        newNode,
        existingNodes,
        existingEdges,
        resourceType: 'dataset',
        allResources: {},
      })

      expect(result.nodeUpdates).toHaveLength(0)
      expect(result.edgesToCreate).toHaveLength(0)
    })

    it('connects to nearest bot when multiple bots exist', () => {
      const newNode = makeNode('#dataset-1', 'dataset', 100, 100)
      const existingNodes = [
        makeNode('#bot-1', 'bot', 500, 500), // farther
        makeNode('#bot-2', 'bot', 120, 100), // closer
      ]
      const existingEdges = []

      const result = computeAutoConnections({
        newNode,
        existingNodes,
        existingEdges,
        resourceType: 'dataset',
        allResources: {},
      })

      expect(result.nodeUpdates).toHaveLength(1)
      expect(result.nodeUpdates[0].nodeId).toBe('#bot-2')
    })

    it('does not connect when bot is too far away', () => {
      const newNode = makeNode('#dataset-1', 'dataset', 0, 0)
      const existingNodes = [
        makeNode('#bot-1', 'bot', MAX_AUTO_CONNECT_DISTANCE + 100, 0),
      ]
      const existingEdges = []

      const result = computeAutoConnections({
        newNode,
        existingNodes,
        existingEdges,
        resourceType: 'dataset',
        allResources: {},
      })

      expect(result.nodeUpdates).toHaveLength(0)
      expect(result.edgesToCreate).toHaveLength(0)
    })
  })

  describe('skillset dropped near bot', () => {
    it('connects skillset to nearest bot without existing skillset connection', () => {
      const newNode = makeNode('#skillset-1', 'skillset', 100, 100)
      const existingNodes = [makeNode('#bot-1', 'bot', 150, 100)]
      const existingEdges = []

      const result = computeAutoConnections({
        newNode,
        existingNodes,
        existingEdges,
        resourceType: 'skillset',
        allResources: {},
      })

      expect(result.nodeUpdates).toHaveLength(1)
      expect(result.nodeUpdates[0]).toEqual({
        nodeId: '#bot-1',
        field: 'skillsetId',
        value: '#skillset-1',
        isNewNode: false,
      })

      expect(result.edgesToCreate).toHaveLength(1)
      expect(result.edgesToCreate[0]).toMatchObject({
        source: '#bot-1',
        sourceHandle: 'skillsetId',
        target: '#skillset-1',
        targetHandle: 'skillset',
      })
    })

    it('skips bot that already has a skillset connection', () => {
      const newNode = makeNode('#skillset-2', 'skillset', 100, 100)
      const existingNodes = [
        makeNode('#bot-1', 'bot', 150, 100),
        makeNode('#skillset-1', 'skillset', 200, 100),
      ]
      const existingEdges = [
        makeEdge('#bot-1', 'skillsetId', '#skillset-1', 'skillset'),
      ]

      const result = computeAutoConnections({
        newNode,
        existingNodes,
        existingEdges,
        resourceType: 'skillset',
        allResources: {},
      })

      expect(result.nodeUpdates).toHaveLength(0)
      expect(result.edgesToCreate).toHaveLength(0)
    })
  })

  describe('ability dropped near skillset', () => {
    it('connects ability to nearest skillset', () => {
      const newNode = makeNode('#ability-1', 'ability', 100, 100)
      const existingNodes = [makeNode('#skillset-1', 'skillset', 150, 100)]
      const existingEdges = []

      const result = computeAutoConnections({
        newNode,
        existingNodes,
        existingEdges,
        resourceType: 'ability',
        allResources: {},
      })

      expect(result.nodeUpdates).toHaveLength(1)
      expect(result.nodeUpdates[0]).toEqual({
        nodeId: '#ability-1',
        field: 'skillsetId',
        value: '#skillset-1',
        isNewNode: true, // ability is the new node being updated
      })

      expect(result.edgesToCreate).toHaveLength(1)
      expect(result.edgesToCreate[0]).toMatchObject({
        source: '#ability-1',
        sourceHandle: 'skillsetId',
        target: '#skillset-1',
        targetHandle: 'skillset',
      })
    })

    it('handles custom ability types via allResources lookup', () => {
      const newNode = makeNode('#custom-ability-1', 'myCustomAbility', 100, 100)
      const existingNodes = [makeNode('#skillset-1', 'skillset', 150, 100)]
      const existingEdges = []

      const result = computeAutoConnections({
        newNode,
        existingNodes,
        existingEdges,
        resourceType: 'myCustomAbility',
        allResources: {
          myCustomAbility: { type: 'ability' },
        },
      })

      expect(result.nodeUpdates).toHaveLength(1)
      expect(result.nodeUpdates[0].nodeId).toBe('#custom-ability-1')
      expect(result.nodeUpdates[0].isNewNode).toBe(true)
    })

    it('does not connect when no skillset exists', () => {
      const newNode = makeNode('#ability-1', 'ability', 100, 100)
      const existingNodes = [makeNode('#bot-1', 'bot', 150, 100)]
      const existingEdges = []

      const result = computeAutoConnections({
        newNode,
        existingNodes,
        existingEdges,
        resourceType: 'ability',
        allResources: {},
      })

      expect(result.nodeUpdates).toHaveLength(0)
      expect(result.edgesToCreate).toHaveLength(0)
    })
  })

  describe('bot integration dropped near bot', () => {
    it.each(BOT_INTEGRATION_TYPES)(
      'connects %s to nearest bot',
      (integrationType) => {
        const newNode = makeNode('#integration-1', integrationType, 100, 100)
        const existingNodes = [makeNode('#bot-1', 'bot', 150, 100)]
        const existingEdges = []

        const result = computeAutoConnections({
          newNode,
          existingNodes,
          existingEdges,
          resourceType: integrationType,
          allResources: {},
        })

        expect(result.nodeUpdates).toHaveLength(1)
        expect(result.nodeUpdates[0]).toEqual({
          nodeId: '#integration-1',
          field: 'botId',
          value: '#bot-1',
          isNewNode: true, // integration is the new node being updated
        })

        expect(result.edgesToCreate).toHaveLength(1)
        expect(result.edgesToCreate[0]).toMatchObject({
          source: '#integration-1',
          sourceHandle: 'botId',
          target: '#bot-1',
          targetHandle: 'bot',
        })
      }
    )
  })

  describe('dataset integration dropped near dataset', () => {
    it.each(DATASET_INTEGRATION_TYPES)(
      'connects %s to nearest dataset',
      (integrationType) => {
        const newNode = makeNode('#integration-1', integrationType, 100, 100)
        const existingNodes = [makeNode('#dataset-1', 'dataset', 150, 100)]
        const existingEdges = []

        const result = computeAutoConnections({
          newNode,
          existingNodes,
          existingEdges,
          resourceType: integrationType,
          allResources: {},
        })

        expect(result.nodeUpdates).toHaveLength(1)
        expect(result.nodeUpdates[0]).toEqual({
          nodeId: '#integration-1',
          field: 'datasetId',
          value: '#dataset-1',
          isNewNode: true,
        })

        expect(result.edgesToCreate).toHaveLength(1)
        expect(result.edgesToCreate[0]).toMatchObject({
          source: '#integration-1',
          sourceHandle: 'datasetId',
          target: '#dataset-1',
          targetHandle: 'dataset',
        })
      }
    )
  })

  describe('skillset integration dropped near skillset', () => {
    it.each(SKILLSET_INTEGRATION_TYPES)(
      'connects %s to nearest skillset',
      (integrationType) => {
        const newNode = makeNode('#integration-1', integrationType, 100, 100)
        const existingNodes = [makeNode('#skillset-1', 'skillset', 150, 100)]
        const existingEdges = []

        const result = computeAutoConnections({
          newNode,
          existingNodes,
          existingEdges,
          resourceType: integrationType,
          allResources: {},
        })

        expect(result.nodeUpdates).toHaveLength(1)
        expect(result.nodeUpdates[0]).toEqual({
          nodeId: '#integration-1',
          field: 'skillsetId',
          value: '#skillset-1',
          isNewNode: true,
        })

        expect(result.edgesToCreate).toHaveLength(1)
        expect(result.edgesToCreate[0]).toMatchObject({
          source: '#integration-1',
          sourceHandle: 'skillsetId',
          target: '#skillset-1',
          targetHandle: 'skillset',
        })
      }
    )
  })

  describe('non-connectable resource types', () => {
    it('returns empty result for bot type', () => {
      const newNode = makeNode('#bot-1', 'bot', 100, 100)
      const existingNodes = [makeNode('#skillset-1', 'skillset', 150, 100)]
      const existingEdges = []

      const result = computeAutoConnections({
        newNode,
        existingNodes,
        existingEdges,
        resourceType: 'bot',
        allResources: {},
      })

      expect(result.nodeUpdates).toHaveLength(0)
      expect(result.edgesToCreate).toHaveLength(0)
    })

    it('returns empty result for secret type', () => {
      const newNode = makeNode('#secret-1', 'secret', 100, 100)
      const existingNodes = [makeNode('#bot-1', 'bot', 150, 100)]
      const existingEdges = []

      const result = computeAutoConnections({
        newNode,
        existingNodes,
        existingEdges,
        resourceType: 'secret',
        allResources: {},
      })

      expect(result.nodeUpdates).toHaveLength(0)
      expect(result.edgesToCreate).toHaveLength(0)
    })
  })

  describe('edge cases', () => {
    it('handles empty existing nodes', () => {
      const newNode = makeNode('#dataset-1', 'dataset', 100, 100)

      const result = computeAutoConnections({
        newNode,
        existingNodes: [],
        existingEdges: [],
        resourceType: 'dataset',
        allResources: {},
      })

      expect(result.nodeUpdates).toHaveLength(0)
      expect(result.edgesToCreate).toHaveLength(0)
    })

    it('generates unique edge IDs', () => {
      const newNode = makeNode('#dataset-1', 'dataset', 100, 100)
      const existingNodes = [makeNode('#bot-1', 'bot', 150, 100)]
      const existingEdges = []

      const result = computeAutoConnections({
        newNode,
        existingNodes,
        existingEdges,
        resourceType: 'dataset',
        allResources: {},
        generateEdgeId: () => '#edge:::unique-id',
      })

      expect(result.edgesToCreate[0].id).toBe('#edge:::unique-id')
    })
  })
})
