import eventsConfig from '@/lib/event'

describe('Events Configuration', () => {
  test('loads events config correctly', () => {
    expect(eventsConfig).toBeDefined()
    expect(Array.isArray(eventsConfig)).toBe(true)
    expect(eventsConfig.length).toBeGreaterThan(0)
  })

  test('all events have required properties', () => {
    eventsConfig.forEach((event) => {
      expect(event).toHaveProperty('type')
      expect(event).toHaveProperty('name')
      expect(event).toHaveProperty('description')
      expect(event).toHaveProperty('trigger')

      expect(typeof event.type).toBe('string')
      expect(typeof event.name).toBe('string')
      expect(typeof event.description).toBe('string')
      expect(typeof event.trigger).toBe('boolean')

      expect(event.type.trim()).not.toBe('')
      expect(event.name.trim()).not.toBe('')
      expect(event.description.trim()).not.toBe('')
    })
  })

  test('event types are unique', () => {
    const types = eventsConfig.map((event) => event.type)
    const uniqueTypes = new Set(types)

    expect(types.length).toBe(uniqueTypes.size)
  })
})
