import blacklist, { domains } from './index'

describe('blacklists', () => {
  it('exports the domain list both ways', () => {
    expect(blacklist.domains).toBe(domains)
  })

  it('carries the maintained disposable-email list plus the curated entries', () => {
    // @note the wildcard list alone is hundreds of entries; a shrunken list
    // means the dependency stopped resolving and signups lost their cover
    expect(domains.length).toBeGreaterThan(300)

    expect(domains).toContain('throwawaymail.com')
    expect(domains).toContain('qzz.io')
  })

  it('carries the bare TLD bans', () => {
    for (const tld of ['cfd', 'cc', 'top', 'xyz', 'sbs']) {
      expect(domains).toContain(tld)
    }
  })

  it('contains only plausible domain entries', () => {
    for (const domain of domains) {
      expect(domain).toMatch(/^[a-z0-9*.-]+$/i)
      expect(domain).not.toMatch(/\s|@|\/$/)
    }
  })
})
