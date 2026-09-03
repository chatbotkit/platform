/* eslint-disable no-undef */
import ConversationAttachmentList from './ConversationAttachmentList'

import { render } from '@testing-library/react'

jest.mock('@/components/ResourceList', () => {
  return function MockResourceList(props) {
    globalThis.__lastResourceListProps = props

    return <div data-testid="resource-list">Mock ResourceList</div>
  }
})

describe('ConversationAttachmentList', () => {
  const getProps = () => globalThis.__lastResourceListProps

  it('passes default routes and defaults to ResourceList', () => {
    render(<ConversationAttachmentList conversationId="conv_123" />)

    const props = getProps()

    expect(props.kind).toBe('attachment')
    expect(props.listRoute).toBe(
      '/api/v1/conversation/conv_123/attachment/list'
    )
    expect(props.exportRoute).toBeNull()
    expect(props.deleteRoute).toBeNull()
    expect(props.instanceRoute).toBeNull()
    expect(props.filter).toBe(false)
  })

  it('passes through explicit route and option props', () => {
    render(
      <ConversationAttachmentList
        conversationId="conv_123"
        kind="file"
        listRoute="/custom/list"
        exportRoute="/custom/export"
        deleteRoute="/custom/delete"
        instanceRoute="/custom/instance"
        filter
      />
    )

    const props = getProps()

    expect(props.kind).toBe('file')
    expect(props.listRoute).toBe('/custom/list')
    expect(props.exportRoute).toBe('/custom/export')
    expect(props.deleteRoute).toBe('/custom/delete')
    expect(props.instanceRoute).toBe('/custom/instance')
    expect(props.filter).toBe(true)
  })

  it('uses default nameMapper preferring name then id', () => {
    render(<ConversationAttachmentList conversationId="conv_123" />)

    const { nameMapper } = getProps()

    expect(nameMapper({ name: 'report.pdf', id: 'att_1' })).toBe('report.pdf')
    expect(nameMapper({ name: '', id: 'att_2' })).toBe('att_2')
  })

  it('builds default download link using encoded name', () => {
    render(<ConversationAttachmentList conversationId="conv_999" />)

    const { extraLinks } = getProps()

    expect(extraLinks({ name: 'my file.pdf' })).toEqual({
      Download:
        '/api/v1/conversation/conv_999/attachment/my%20file.pdf/download',
    })
  })

  it('uses provided extraLinks and extraTags overrides', () => {
    const customLinks = jest.fn(() => ({ Open: '/open' }))
    const customTags = jest.fn(() => <div>custom-tag</div>)

    render(
      <ConversationAttachmentList
        conversationId="conv_123"
        extraLinks={customLinks}
        extraTags={customTags}
      />
    )

    const { extraLinks, extraTags } = getProps()

    extraLinks({ name: 'a.txt' })
    extraTags({ type: 'text/plain', size: 12 })

    expect(customLinks).toHaveBeenCalledWith({ name: 'a.txt' })
    expect(customTags).toHaveBeenCalledWith({ type: 'text/plain', size: 12 })
  })
})
