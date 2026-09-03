# @chatbotkit-dev/email

The **community email provider**. It does not deliver mail: it writes a line to
the console describing what would have been sent, so a deployment runs and is
observable without an email vendor configured.

The message body is deliberately never logged. Notification mail routinely
carries login links, and action mail carries conversation content.

## Providing your own

Replace this package at install time with one satisfying
[`@chatbotkit-dev/email-spec`](../email-spec):

```yaml
# Root pnpm-workspace.yaml
overrides:
  '@chatbotkit-dev/email': npm:your-email-implementation@*
```

An implementation owns the sending identity, the delivery vendor, tracking and
suppression. See the spec package for why notification and action mail are
separate functions.
