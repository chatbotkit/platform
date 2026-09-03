# @chatbotkit-dev/pii

The **community PII provider**. It detects nothing, and is a pass through: the
safe text is the text, and the round trip is the identity.

That is not a partial implementation, it is the honest one. Finding personal
data in free text needs a vendor or a model, and this package must run with
nothing configured. A deployment with no detector installed sends its text out
as written, which is what it would do without this module at all.

Detection and replacement are one package rather than two because they are one
decision. What counts as personal data is inseparable from how it is swapped
out, and a package that redacted without detecting would be asserting a policy
it cannot enforce.

## Providing your own

Replace this package at install time with one satisfying
[`@chatbotkit-dev/pii-spec`](../pii-spec):

```yaml
# Root pnpm-workspace.yaml
overrides:
  '@chatbotkit-dev/pii': npm:your-pii-implementation@*
```

An implementation owns what counts as personal data, which detector finds it,
what the confidence threshold means, and what a value is replaced with. The spec
package states the two properties the platform depends on regardless: tokens are
stable within a call, and redaction is reversible.
