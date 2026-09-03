import { isForbiddenAddress, isIpAddress } from '@/lib/ip'

describe('isIpAddress', () => {
  it.each([
    '0.0.0.0',
    '127.0.0.1',
    '203.0.113.7',
    '255.255.255.255',
    '::',
    '::1',
    '2001:db8::1',
    '2001:db8:0:1:1:1:1:1',
    'fe80::1234:5678',
    '::ffff:192.0.2.128',
    '2001:db8::192.0.2.1',
  ])('should accept the IP address %s', (value) => {
    expect(isIpAddress(value)).toBe(true)
  })

  it.each([
    '',
    'example.com',
    '203.0.113',
    '203.0.113.7.8',
    '203.0.113.256',
    '203.0.113.-1',
    '203.0.113.01',
    ' 203.0.113.7',
    '203.0.113.7 ',
    ':',
    '1:2:3:4:5:6:7',
    '1:2:3:4:5:6:7:8:9',
    '1:2:3:4:5:6:7::8',
    '1::2::3',
    '2001:db8:::1',
    '2001:db8::g',
    '::ffff:192.0.2.999',
    'fe80::1%eth0',
  ])('should reject the non-IP value %s', (value) => {
    expect(isIpAddress(value)).toBe(false)
  })
})

describe('isForbiddenAddress', () => {
  it.each([
    ['127.0.0.1', 'loopback'],
    ['127.255.255.254', 'loopback range'],
    ['0.0.0.0', 'unspecified'],
    ['10.1.2.3', 'private 10/8'],
    ['172.16.0.1', 'private 172.16/12 low'],
    ['172.31.255.255', 'private 172.16/12 high'],
    ['192.168.1.1', 'private 192.168/16'],
    ['169.254.169.254', 'cloud metadata'],
    ['169.254.0.1', 'link-local'],
    ['100.64.0.1', 'carrier-grade NAT'],
    ['100.127.255.255', 'carrier-grade NAT high'],
    ['192.0.0.1', 'IETF protocol assignments'],
    ['192.0.2.1', 'documentation'],
    ['198.18.0.1', 'benchmark'],
    ['198.51.100.1', 'documentation'],
    ['203.0.113.1', 'documentation'],
    ['224.0.0.1', 'multicast'],
    ['240.0.0.1', 'reserved'],
    ['255.255.255.255', 'broadcast'],
    ['::1', 'IPv6 loopback'],
    ['::', 'IPv6 unspecified'],
    ['[::1]', 'bracketed loopback'],
    ['::ffff:127.0.0.1', 'IPv4-mapped loopback'],
    ['::ffff:10.0.0.1', 'IPv4-mapped private'],
    ['::ffff:7f00:1', 'IPv4-mapped loopback in hex groups'],
    ['::ffff:0:127.0.0.1', 'IPv4-translated loopback'],
    ['64:ff9b::7f00:1', 'NAT64 loopback'],
    ['64:ff9b::a00:1', 'NAT64 private'],
    ['fe80::1', 'link-local'],
    ['fe80::1%eth0', 'link-local with zone'],
    ['fc00::1', 'unique-local'],
    ['fd12:3456::1', 'unique-local fd'],
    ['fec0::1', 'site-local'],
    ['ff02::1', 'multicast'],
    ['2001:db8::1', 'documentation'],
    ['100::1', 'discard'],
    ['2002:7f00:1::', '6to4 embedding loopback'],
    ['2002:a00:1::', '6to4 embedding private'],
    ['localhost', 'not an address at all'],
    ['', 'empty'],
    ['999.1.1.1', 'malformed'],
  ])('refuses %s (%s)', (address) => {
    expect(isForbiddenAddress(address)).toBe(true)
  })

  it.each([
    '1.1.1.1',
    '8.8.8.8',
    '93.184.216.34',
    '172.15.255.255',
    '172.32.0.1',
    '100.63.255.255',
    '100.128.0.1',
    '192.0.1.1',
    '192.0.3.1',
    '198.17.255.255',
    '198.20.0.1',
    '223.255.255.255',
    '2606:4700:4700::1111',
    '2001:4860:4860::8888',
    '::ffff:1.1.1.1',
    '64:ff9b::101:101',
    '2002:101:101::',
    '[2606:4700:4700::1111]',
  ])('allows public %s', (address) => {
    expect(isForbiddenAddress(address)).toBe(false)
  })
})
