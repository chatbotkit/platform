import availableEvents from '@/lib/event'
import schema from '@/lib/joi.schema'

const eventsSchema = schema
  .array()
  .items(
    schema
      .string()
      .valid(
        ...availableEvents
          .filter(({ trigger }) => !!trigger)
          .map(({ type }) => type)
      )
  )
  .allow(null)

export default eventsSchema
