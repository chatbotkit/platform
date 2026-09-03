/**
 * @jest-environment node
 */
import { getDatamodel } from '@chatbotkit-dev/db/pothos'

describe('installed database Pothos metadata', () => {
  it('should expose the generated datamodel through the database module', () => {
    const datamodel = getDatamodel()

    expect(datamodel.datamodel.models.Bot).toBeDefined()
  })
})
