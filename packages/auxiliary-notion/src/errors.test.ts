import { UnsupportedPropertiesError } from './errors'

describe('UnsupportedPropertiesError', () => {
  it('should format the message from the property names', () => {
    const error = new UnsupportedPropertiesError(['Long Summary', 'Priority'])

    expect(error.message).toBe('Unsupported properties: Long Summary, Priority')
  })

  it('should expose the property names', () => {
    const error = new UnsupportedPropertiesError(['Long Summary'])

    expect(error.properties).toEqual(['Long Summary'])
  })

  it('should be an instance of Error and carry its own name', () => {
    const error = new UnsupportedPropertiesError(['x'])

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(UnsupportedPropertiesError)
    expect(error.name).toBe('UnsupportedPropertiesError')
  })
})
