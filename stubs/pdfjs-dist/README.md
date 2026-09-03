# pdfjs-dist stub

This is a stub package that replaces `pdfjs-dist` to prevent `officeparser` from
trying to load it.

## Why?

`officeparser` imports `pdfjs-dist` at the top level of its `OfficeParser.js`
file, even if you never parse PDFs. The `pdfjs-dist` package is ESM-only and
causes webpack bundling issues in Next.js.

Since we use a separate PDF parsing solution (via `@chatbotkit-dev/file-pdf`),
we don't need officeparser's PDF capabilities.

## How it works

This stub is linked via `.pnpmfile.cjs` which overrides officeparser's
dependency:

```javascript
dependencyOverridesMap = {
  officeparser: {
    'pdfjs-dist': 'link:stubs/pdfjs-dist',
  },
}
```

This redirects officeparser's `require('pdfjs-dist')` or
`import from 'pdfjs-dist'` to this stub, preventing the real ESM package from
being loaded.

The stub provides:

- Empty runtime exports that throw errors if accidentally called
- Minimal exports (`GlobalWorkerOptions`, `OPS`, `getDocument`) to satisfy the
  import without crashing
