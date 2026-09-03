import schema from '@/lib/joi.schema'

export default schema.any().external(() => {
  return undefined
})
