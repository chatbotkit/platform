import connections from '@/content/other/connections.yaml'
import abilities from '@/data/abilities/all'

describe('Connections Configuration', () => {
  test('loads connections config correctly', () => {
    expect(connections).toBeDefined()
    expect(typeof connections).toBe('object')
  })

  test('each connection key has a matching ability with corresponding logo', () => {
    const connectionKeys = Object.keys(connections)

    expect(connectionKeys.length).toBeGreaterThan(0)

    for (const key of connectionKeys) {
      const expectedLogo = `@logo/${key}`

      const matchingAbility = Object.entries(abilities).find(
        ([, ability]) => ability?.icon === expectedLogo
      )

      expect(matchingAbility).toBeDefined()
    }
  })

  test('all connections have required properties', () => {
    const connectionKeys = Object.keys(connections)

    for (const key of connectionKeys) {
      const connection = connections[key]

      expect(connection).toHaveProperty('title')
      expect(connection).toHaveProperty('description')
      expect(connection).toHaveProperty('content')

      expect(typeof connection.title).toBe('string')
      expect(typeof connection.description).toBe('string')
      expect(typeof connection.content).toBe('string')

      expect(connection.title.trim()).not.toBe('')
      expect(connection.description.trim()).not.toBe('')
      expect(connection.content.trim()).not.toBe('')
    }
  })
})
