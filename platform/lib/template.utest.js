import {
  getTemplate,
  getTemplateRealName,
  isPlatformTemplate,
  isTemplateName,
} from '@/lib/template'

describe('isTemplateName', () => {
  test('returns true for valid template name', () => {
    expect(isTemplateName('@template')).toBe(true)
  })

  test('returns false if name contains spaces', () => {
    expect(isTemplateName('@tem plate')).toBe(false)
  })

  test('returns false if name does not start with "@"', () => {
    expect(isTemplateName('template')).toBe(false)
  })
})

describe('isPlatformTemplateName', () => {
  test('returns true for system template name', () => {
    expect(isPlatformTemplate('@platform/template')).toBe(true)
  })

  test('returns false for non-system template name', () => {
    expect(isPlatformTemplate('@user/template')).toBe(false)
  })

  test('returns false for invalid template name', () => {
    expect(isPlatformTemplate('platform/template')).toBe(true)
  })
})

describe('getTemplateRealName', () => {
  test('converts name to lowercase and trims whitespace', () => {
    expect(getTemplateRealName('  @TemplateName ')).toBe('templatename')
  })

  test('removes "@" from the start', () => {
    expect(getTemplateRealName('@templateName')).toBe('templatename')
  })
})

describe('getTemplate', () => {
  const catalogue = {
    templatename: { id: 1, name: 'Template 1' },
    othertemplate: { id: 2, name: 'Template 2' },
  }

  test('returns the template object for a valid name', () => {
    expect(getTemplate('@templateName', catalogue)).toEqual({
      id: 1,
      name: 'Template 1',
    })
  })

  test('returns null for a name not in the catalogue', () => {
    expect(getTemplate('@nonexistent', catalogue)).toBeNull()
  })

  test('returns null for null or undefined name', () => {
    expect(getTemplate(null, catalogue)).toBeNull()
    expect(getTemplate(undefined, catalogue)).toBeNull()
  })
})
