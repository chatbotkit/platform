import mdFrontmatterLoader from './md-frontmatter'

describe('md-frontmatter-loader', () => {
  it('should extract frontmatter from markdown with complete frontmatter section', () => {
    const markdownContent = `---
title: Test Document
description: This is a test
status: draft
date: 2025-01-09
tags:
  - test
  - markdown
---

# Main Content

This is the content of the markdown file.`

    const result = mdFrontmatterLoader(markdownContent)

    // @note result should be a JavaScript module export

    expect(result).toMatch(/^export default /)

    // parse the exported JSON to verify content - handle multiline JSON output

    const jsonMatch = result.match(/export default ([\s\S]+);$/)

    expect(jsonMatch).toBeTruthy()

    const frontmatterData = JSON.parse(jsonMatch[1])

    expect(frontmatterData).toEqual({
      title: 'Test Document',
      description: 'This is a test',
      status: 'draft',
      date: '2025-01-09T00:00:00.000Z', // @note YAML parser converts date strings to Date objects
      tags: ['test', 'markdown'],
    })
  })

  it('should return empty object for markdown without frontmatter', () => {
    const markdownContent = `# Just a Title

This markdown has no frontmatter section.`

    const result = mdFrontmatterLoader(markdownContent)

    expect(result).toMatch(/^export default /)

    const jsonMatch = result.match(/export default ([\s\S]+);$/)
    const frontmatterData = JSON.parse(jsonMatch[1])

    expect(frontmatterData).toEqual({})
  })

  it('should handle frontmatter with complex YAML structures', () => {
    const markdownContent = `---
title: Complex Document
metadata:
  author:
    name: John Doe
    email: john@example.com
  settings:
    published: true
    priority: 1
tags:
  - complex
  - yaml
---

Content here.`

    const result = mdFrontmatterLoader(markdownContent)

    const jsonMatch = result.match(/export default ([\s\S]+);$/)
    const frontmatterData = JSON.parse(jsonMatch[1])

    expect(frontmatterData).toEqual({
      title: 'Complex Document',
      metadata: {
        author: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        settings: {
          published: true,
          priority: 1,
        },
      },
      tags: ['complex', 'yaml'],
    })
  })

  it('should handle malformed frontmatter gracefully', () => {
    const markdownContent = `---
title: Test
invalid yaml: [ unclosed array
---

Content here.`

    // @note the loader should handle malformed YAML gracefully without throwing

    expect(() => {
      mdFrontmatterLoader(markdownContent)
    }).not.toThrow()

    const result = mdFrontmatterLoader(markdownContent)
    const jsonMatch = result.match(/export default ([\s\S]+);$/)
    const frontmatterData = JSON.parse(jsonMatch[1])

    // should return empty object for malformed YAML
    expect(frontmatterData).toEqual({})
  })

  it('should preserve frontmatter with multiple dashes', () => {
    const markdownContent = `----
title: Test Document with Extra Dashes
description: Testing with multiple dashes
----

Content with dashes in the middle:

---

More content.`

    const result = mdFrontmatterLoader(markdownContent)

    const jsonMatch = result.match(/export default ([\s\S]+);$/)
    const frontmatterData = JSON.parse(jsonMatch[1])

    expect(frontmatterData).toEqual({
      title: 'Test Document with Extra Dashes',
      description: 'Testing with multiple dashes',
    })
  })
})
