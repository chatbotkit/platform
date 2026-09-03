# Usagelog App

Detailed usage record analysis and viewing tool for the ChatBotKit platform.

## Purpose

The Usagelog app provides a first-class log viewer for usage records, similar in
app structure to `eventlog` and `auditlog`, but focused on individual usage
events such as token consumption, conversation activity, and related resource
usage.

## Features

- Server-backed initial usage log load with cursor pagination
- Dedicated usage-focused table layout inside the apps shell
- Type and resource filters with optional auto refresh
- Usage record detail views with metadata inspection
- Related resource visibility for conversations, messages, tasks, bots, and more

## Architecture

```
usagelog/
├── app.manifest
├── const.ts
├── config.ts
├── components.jsx
├── layout.jsx
├── layout.utest.jsx
├── page.tsx
├── server.ts
└── README.md
```

## Usage

Access the app at `/apps/usagelog`.
