# @chatbotkit-dev/email

The **community email provider**. It delivers through whichever vendor it finds
credentials for - Resend, SendGrid or Amazon SES - and with none configured it
writes a line to the console describing what would have been sent, so a
deployment runs and is observable without an email vendor at all.

When printing, the text body is included: the console is delivery there, and
sign-in codes and invitations reach the operator nowhere else. Once a vendor is
configured nothing is logged.

## Environment

The vendor is detected from its credential, in this order, and `EMAIL_PROVIDER`
pins one when that is not what you want:

| `EMAIL_PROVIDER` | Detected from           | Also needs                                                                    |
| ---------------- | ----------------------- | ----------------------------------------------------------------------------- |
| `resend`         | `RESEND_API_KEY`        |                                                                               |
| `sendgrid`       | `SENDGRID_API_KEY`      |                                                                               |
| `ses`            | `SES_AWS_ACCESS_KEY_ID` | `SES_AWS_REGION`, `SES_AWS_SECRET_ACCESS_KEY`; optional `SES_AWS_SESSION_TOKEN`, `SES_AWS_ENDPOINT` |
| `print`          | nothing set             |                                                                               |

Every vendor sends as the deployment's own identity:

| Variable             | Purpose                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------- |
| `EMAIL_FROM`         | Sender of the deployment's own mail, e.g. `Login <noreply@example.com>`. Required with a vendor |
| `EMAIL_REPLY_TO`     | Where replies to that mail go, when the message does not say                            |
| `EMAIL_ACTIONS_FROM` | Default mailbox agents and integrations write from; falls back to `EMAIL_FROM`          |

The sending domain has to be verified with the vendor. SES credentials are the
module's own rather than the storage module's, so configuring object storage
does not silently switch mail delivery on.

Nothing is read at import. `assertConfigured` resolves with nothing set, and
with a vendor detected it fails on any missing credential or a missing
`EMAIL_FROM`, so a deployment that calls it at startup finds out then rather
than when a user fails to receive a login link.

## What each vendor does with the contract

Notification mail marked `essential` bypasses SendGrid list management and
tracking; action mail always does, because its recipient never subscribed to
anything. Resend and SES have no list management to bypass. A `messageId` on
action mail is set as `Message-ID`, `In-Reply-To` and `References` with every
vendor.

Inbound mail is not supported: integration inboxes derive from `SITE_URL` and
`parseInboundEmail` logs and returns null. An implementation with an inbound
vendor replaces this package.

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
