/**
 * @jest-environment node
 */

import fs from 'node:fs'
import path from 'node:path'

// @note the platform is open-core: the hosted product's domain reaches the
// code only through deployment configuration (SITE_URL, appConfig), never as
// a literal fallback. These are the surfaces that used to carry one.
const BRAND_SURFACES = [
  'layouts/App.jsx',
  'embeds/widget/v2.ts',
  'pages/examples/[slug]/index.jsx',
]

describe('site configuration', () => {
  it.each(BRAND_SURFACES)(
    'should not default to the hosted product domain in %s',
    (file) => {
      const source = fs.readFileSync(
        path.join(__dirname, '..', '..', file),
        'utf8'
      )

      expect(source).not.toMatch(/chatbotkit\.com/)
    }
  )
})
