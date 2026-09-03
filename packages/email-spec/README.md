# @chatbotkit-dev/email-spec

The **contract** for outbound email. Types only.

Separate from [`@chatbotkit-dev/email`](../email) because that package is
swappable: a deployment replaces it with its own implementation through a pnpm
override, and an implementation cannot import the package it replaces.

## The two kinds of mail

`sendEmailNotification` is the deployment writing to its own user: trial
notices, login links, limit warnings. The sending identity belongs to the
deployment, so the implementation owns the from address and the caller only
chooses where replies go.

`sendEmailAction` is an agent or integration writing to a third party. The
caller may supply the sending mailbox, because the message comes from an address
the deployment does not necessarily own, and may carry a `messageId` to thread
against inbound mail.

They are separate functions rather than one function with a flag because they
usually want separate sending domains and separate sending reputations.

## What is deliberately absent

Vendor concepts. Tracking flags, suppression groups, list-management bypasses
and sending domains are all decisions an implementation makes per purpose. A
platform caller says what kind of mail it is sending and nothing more.
