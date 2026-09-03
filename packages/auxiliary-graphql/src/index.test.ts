import { schema } from './index'

describe('Auxiliary GraphQL Schema', () => {
  it('should build a valid schema', () => {
    expect(schema).toBeDefined()
    expect(schema.getQueryType()).toBeDefined()
    expect(schema.getMutationType()).toBeDefined()
  })

  it('should have notion namespace in query', () => {
    const queryType = schema.getQueryType()
    const fields = queryType?.getFields()

    expect(fields?.notion).toBeDefined()
    expect(fields?.notion.type.toString()).toContain('NotionNamespace')
  })

  it('should have slack namespace in query', () => {
    const queryType = schema.getQueryType()
    const fields = queryType?.getFields()

    expect(fields?.slack).toBeDefined()
    expect(fields?.slack.type.toString()).toContain('SlackNamespace')
  })

  it('should have notion namespace in mutation', () => {
    const mutationType = schema.getMutationType()
    const fields = mutationType?.getFields()

    expect(fields?.notion).toBeDefined()
    expect(fields?.notion.type.toString()).toContain('NotionNamespace')
  })

  it('should have slack namespace in mutation', () => {
    const mutationType = schema.getMutationType()
    const fields = mutationType?.getFields()

    expect(fields?.slack).toBeDefined()
    expect(fields?.slack.type.toString()).toContain('SlackNamespace')
  })
})
