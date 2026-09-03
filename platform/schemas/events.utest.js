import availableEvents from '@/lib/event'

import eventsSchema from '@/schemas/events'

describe('eventsSchema', () => {
  const triggerableEvents = availableEvents
    .filter(({ trigger }) => !!trigger)
    .map(({ type }) => type)

  it('should allow null values', () => {
    const result = eventsSchema.validate(null)

    expect(result.error).toBeUndefined()
    expect(result.value).toBeNull()
  })

  it('should allow triggerable event types', () => {
    const result = eventsSchema.validate(triggerableEvents)

    expect(result.error).toBeUndefined()
    expect(result.value).toEqual(triggerableEvents)
  })

  it('should reject non-triggerable event types', () => {
    const nonTriggerableEvent = availableEvents.find(({ trigger }) => !trigger)

    expect(nonTriggerableEvent).toBeDefined()

    const result = eventsSchema.validate([nonTriggerableEvent.type])

    expect(result.error).toBeDefined()
  })

  it('should reject unknown event types', () => {
    const result = eventsSchema.validate(['missing.event'])

    expect(result.error).toBeDefined()
  })
})
