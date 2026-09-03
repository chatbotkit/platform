/**
 * Thrown when the caller supplies property (or filter) names that do not exist
 * in the target Notion database schema. This is a caller-side validation
 * problem, not a server or upstream fault, so consumers should surface it as a
 * bad request rather than capturing it as an unexpected exception.
 */
export class UnsupportedPropertiesError extends Error {
  readonly properties: string[]

  constructor(properties: string[]) {
    super(`Unsupported properties: ${properties.join(', ')}`)

    this.name = 'UnsupportedPropertiesError'
    this.properties = properties
  }
}
