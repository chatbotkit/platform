import { hostToHostname, normalizeRequestHost } from '@/lib/host.parse'

describe('hostToHostname', () => {
  it.each([
    ['cbk-labs.localhost:3000', 'cbk-labs.localhost'],
    ['CBK-Labs.localhost', 'cbk-labs.localhost'],
    ['labs.chatbotkit.com', 'labs.chatbotkit.com'],
    ['127.0.0.1:3000', '127.0.0.1'],
    ['[::1]:3000', '[::1]'],
    ['', ''],
    [null, ''],
    [undefined, ''],
  ])('reduces %s to %s', (host, hostname) => {
    expect(hostToHostname(host)).toBe(hostname)
  })

  it('keeps the port-less prefix of a host the URL parser rejects', () => {
    expect(hostToHostname('bad host:3000')).toBe('bad host')
  })
})

describe('normalizeRequestHost', () => {
  it.each([
    [' CBK.localhost:3000 ', 'cbk.localhost:3000'],
    ['example.com:443', 'example.com'],
    ['example.com:80', 'example.com:80'],
    ['user:pw@example.com', null],
    ['example.com/path', null],
    ['example.com?x=1', null],
    ['example.com;domain=evil', null],
    ['example.com,other', null],
    ['[::1]:3000', '[::1]:3000'],
    ['example.com.', 'example.com.'],
    ['', null],
    [null, null],
  ])('normalises %s to %s', (value, expected) => {
    expect(normalizeRequestHost(value)).toBe(expected)
  })
})
