import { ALLOWED_AUDIENCES, ALLOWED_SCOPES } from './mcp.oauth.constants'

describe('mcp.oauth.constants', () => {
  it('exports supported scopes for MCP OAuth', () => {
    expect(ALLOWED_SCOPES).toEqual(['mcp:tools', 'mcp:resources'])
  })

  it('exports supported audiences for MCP OAuth', () => {
    expect(ALLOWED_AUDIENCES).toEqual(['mcp'])
  })
})
